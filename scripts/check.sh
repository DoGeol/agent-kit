#!/bin/sh
# Offline checks for the kit. Exit 1 on any failure.
#   - every vendor/<name> is in manifest.tsv and has a LICENSE file
#   - every copy that vendor-map.tsv describes exists and equals its source; no copies that the map does not describe
#   - every skills/*/SKILL.md has name and description, and no tool-specific keys other than argument-hint
#   - no SKILL.md hiding inside copies (tools would register it as another skill)
#   - agents/*.md equal what build.sh generates from roles/*.md
#   - hooks/agent-guard.py lets a saved crew brief through and denies other kit:<role> calls
#   - the text a skill always reads (_rules + _vendor) stays under the budget; _roles/_stacks are read selectively and not counted
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
fail=0
err() { echo "FAIL $*"; fail=1; }
budget=${KIT_BUDGET_BYTES:-20000}
tmpd=$(mktemp -d); trap 'rm -rf "$tmpd"' EXIT

# vendor folders
for d in "$root"/vendor/*/; do
  n=$(basename "$d")
  grep -q "^$n	" "$root/vendor/manifest.tsv" || err "vendor/$n not in manifest.tsv"
  find "$d" -maxdepth 3 -iname 'LICENSE*' | grep -q . || err "vendor/$n has no LICENSE file"
done
grep -v '^#' "$root/vendor/manifest.tsv" | grep -v '^[[:space:]]*$' | cut -f1 | while read -r n; do
  [ -d "$root/vendor/$n" ] || echo "FAIL manifest row $n has no vendor/$n (run vendor.sh fetch)"
done | grep . && fail=1

# copies: expected list from the map, then compare and look for strays
grep -v '^#' "$root/scripts/vendor-map.tsv" | grep -v '^[[:space:]]*$' | while IFS="$(printf '\t')" read -r target src dest; do
  if [ -d "$root/$src" ]; then
    find "$root/$src" -type f | sort | while read -r f; do rel=${f#"$root/$src/"}; printf '%s\t%s\n' "$src/$rel" "$target/$dest/$rel"; done
  elif [ -f "$root/$src" ]; then
    printf '%s\t%s\n' "$src" "$target/$dest"
  else
    echo "FAIL vendor-map source missing: $src" >&2
  fi
done > "$tmpd/expected" 2> "$tmpd/experr"
[ -s "$tmpd/experr" ] && { cat "$tmpd/experr"; fail=1; }
while IFS="$(printf '\t')" read -r src dest; do
  [ -f "$root/$dest" ] || { err "$dest missing (run build.sh)"; continue; }
  cmp -s "$root/$src" "$root/$dest" || err "$dest differs from $src (run build.sh)"
done < "$tmpd/expected"
cut -f2 "$tmpd/expected" | sort > "$tmpd/expected-dests"
{ find "$root"/skills -type f \( -path '*/_rules/*' -o -path '*/_vendor/*' -o -path '*/_roles/*' -o -path '*/_stacks/*' \)
  find "$root"/stacks -type f -path '*/vendor/*'; } 2>/dev/null | sed "s|^$root/||" | sort > "$tmpd/actual-dests"
comm -13 "$tmpd/expected-dests" "$tmpd/actual-dests" | while read -r stray; do echo "FAIL $stray not in vendor-map.tsv (delete it or add a row)"; done | grep . && fail=1

# frontmatter
for s in "$root"/skills/*/SKILL.md; do
  rel=${s#"$root"/}
  fm=$(awk 'NR==1&&$0!="---"{exit} NR>1&&$0=="---"{exit} NR>1{print}' "$s")
  printf '%s\n' "$fm" | grep -q '^name:' || err "$rel: no name"
  printf '%s\n' "$fm" | grep -q '^description:' || err "$rel: no description"
  bad=$(printf '%s\n' "$fm" | grep -E '^[a-zA-Z-]+:' | grep -vE '^(name|description|argument-hint):' | cut -d: -f1 | tr '\n' ' ')
  [ -z "$bad" ] || err "$rel: tool-specific frontmatter keys: $bad"
  name=$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p')
  [ "$name" = "$(basename "$(dirname "$s")")" ] || err "$rel: name '$name' differs from folder"
done
find "$root"/skills "$root"/stacks -mindepth 3 -name SKILL.md | sed "s|^$root/||" | while read -r f; do echo "FAIL nested $f (rename the copy)"; done | grep . && fail=1

# agents match roles (regenerate into a temp dir and compare)
KIT_AGENTS_DIR="$tmpd/agents" sh "$root/scripts/build.sh" >/dev/null 2>&1 || err "build.sh failed while regenerating agents"
for f in "$tmpd"/agents/*.md; do
  [ -f "$f" ] || continue
  n=$(basename "$f")
  [ -f "$root/agents/$n" ] || { err "agents/$n missing (run build.sh)"; continue; }
  cmp -s "$f" "$root/agents/$n" || err "agents/$n differs from roles (run build.sh)"
done
for f in "$root"/agents/*.md; do
  [ -f "$f" ] || continue
  [ -f "$tmpd/agents/$(basename "$f")" ] || err "agents/$(basename "$f") has no role in roles/ (delete it)"
done

# agent-guard hook: allows a brief crew saved, denies everything else aimed at kit:<role>
g="$root/hooks/agent-guard.py"; gd="$tmpd/guard/.kit/s"; mkdir -p "$gd"
brief="kit-brief: backend:node
산출: $gd/report-backend.md
작업: x"
printf '%s\n' "$brief" > "$gd/brief-backend.md"
guard() { python3 -I -c 'import json,sys; print(json.dumps({"tool_name":"Agent","tool_input":{"subagent_type":sys.argv[1],"prompt":sys.argv[2]}}))' "$1" "$2" | python3 -I "$g"; }
[ -z "$(guard kit:backend "$brief
(덧붙임)")" ] || err "agent-guard denied a saved brief"
[ -n "$(guard kit:backend "crew build backend 정렬")" ] || err "agent-guard allowed a brief without kit-brief"
[ -n "$(guard kit:frontend "$brief")" ] || err "agent-guard allowed a brief for another role"
[ -n "$(guard kit:qa "kit-brief: qa
산출: $tmpd/guard/.kit/none/review-qa.md")" ] || err "agent-guard allowed a brief crew did not save"
[ -z "$(guard general-purpose "anything")" ] || err "agent-guard touched a non-kit agent"

# budget
for d in "$root"/skills/*/; do
  n=$(basename "$d"); total=0
  for f in "$d"_rules/* "$d"_vendor/*; do [ -f "$f" ] && total=$((total + $(wc -c < "$f"))); done
  [ "$total" -le "$budget" ] || err "skills/$n reads $total bytes of rules+vendor (budget $budget)"
done

[ "$fail" = 0 ] && echo "check ok" || exit 1

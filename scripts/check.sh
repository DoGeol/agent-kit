#!/bin/sh
# Offline checks for the kit. Exit 1 on any failure.
#   - every vendor/<name> is in manifest.tsv and has a LICENSE file
#   - every copy that vendor-map.tsv describes exists and equals its source; no copies that the map does not describe
#   - every skills/*/SKILL.md has name and description, and no tool-specific keys other than argument-hint
#   - no SKILL.md hiding inside copies (tools would register it as another skill)
#   - agents/*.md (AGY) and claude-agents/*.md (Claude Code) equal what build.sh generates from roles/*.md
#   - hooks/agent-guard.py lets a crew brief through only after a crew command (crew_mark.py) and denies other kit:<role> calls
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

# agents match roles (regenerate into a temp dir and compare), for both variants
KIT_AGENTS_DIR="$tmpd/agents" KIT_CLAUDE_AGENTS_DIR="$tmpd/claude-agents" sh "$root/scripts/build.sh" >/dev/null 2>&1 || err "build.sh failed while regenerating agents"
for dir in agents claude-agents; do
  for f in "$tmpd/$dir"/*.md; do
    [ -f "$f" ] || continue
    n=$(basename "$f")
    [ -f "$root/$dir/$n" ] || { err "$dir/$n missing (run build.sh)"; continue; }
    cmp -s "$f" "$root/$dir/$n" || err "$dir/$n differs from roles (run build.sh)"
  done
  for f in "$root/$dir"/*.md; do
    [ -f "$f" ] || continue
    [ -f "$tmpd/$dir/$(basename "$f")" ] || err "$dir/$(basename "$f") has no role in roles/ (delete it)"
  done
done
for f in "$root"/claude-agents/*.md; do
  grep -q "\"./claude-agents/$(basename "$f")\"" "$root/.claude-plugin/plugin.json" || err ".claude-plugin/plugin.json agents does not list claude-agents/$(basename "$f")"
done
grep -h '^tools:' "$root"/agents/*.md | grep -Eq '\b(Read|Write|Edit|Bash|Grep|Glob)\b' && err "agents/ (AGY) uses Claude tool names: AGY fails to start the agent"

# agent-guard hook: allows a brief crew saved after the user's crew command, denies everything else aimed at kit:<role>
g="$root/hooks/agent-guard.py"; m="$root/hooks/crew_mark.py"; repo="$tmpd/guard"; gd="$repo/.kit/s"
mkdir -p "$gd" "$repo/.git"; export XDG_STATE_HOME="$tmpd/state"
brief="kit-brief: backend:node
산출: $gd/report-backend.md
작업: x"
mark() { python3 -I -c 'import json,sys; print(json.dumps({"session_id":sys.argv[1],"prompt":sys.argv[2],"cwd":sys.argv[3]}))' "$1" "$2" "$repo" | python3 -I "$m"; }
guard() { python3 -I -c 'import json,sys; print(json.dumps({"session_id":sys.argv[1],"cwd":sys.argv[4],"tool_name":"Agent","tool_input":{"subagent_type":sys.argv[2],"prompt":sys.argv[3]}}))' "$1" "$2" "$3" "${4:-$repo}" | python3 -I "$g"; }
st="$XDG_STATE_HOME/agent-kit/crew"
mark s1 "crew build backend:node,qa 정렬" >/dev/null; [ -f "$st/s1" ] || err "crew_mark did not mark a crew prompt"
sleep 1; printf '%s\n' "$brief" > "$gd/brief-backend.md"
[ -z "$(guard s1 kit:backend "$brief
(덧붙임)")" ] || err "agent-guard denied a saved brief"
rel="kit-brief: qa
산출: .kit/r/report-qa.md"
mkdir -p "$repo/.kit/r"; printf '%s\n' "$rel" > "$repo/.kit/r/brief-qa.md"
[ -z "$(guard s1 kit:qa "$rel")" ] || err "agent-guard denied a relative 산출 path inside the repo"
brief2="kit-brief: backend:node
산출: $gd/report-backend-2.md
작업: 두 번째"
printf '%s\n' "$brief2" > "$gd/brief-backend-2.md"
[ -z "$(guard s1 kit:backend "$brief2")" ] || err "agent-guard denied a numbered brief for the same role"
mark s4 "/kit:crew build backend 정렬"; sleep 1; touch "$repo/.kit/r/brief-qa.md"
[ -n "$(guard s4 kit:qa "$rel")" ] || err "agent-guard allowed a role the crew command did not name"
mark s5 "crew build docs/specs/a.md" >/dev/null; sleep 1; touch "$repo/.kit/r/brief-qa.md"
[ -z "$(guard s5 kit:qa "$rel")" ] || err "agent-guard denied a role when the crew command named none"
[ -n "$(guard s2 kit:backend "$brief")" ] || err "agent-guard allowed a session with no crew command"
[ -n "$(guard s1 kit:backend "crew build backend 정렬")" ] || err "agent-guard allowed a brief without kit-brief"
[ -n "$(guard s1 kit:frontend "$brief")" ] || err "agent-guard allowed a brief for another role"
[ -n "$(guard s1 kit:qa "kit-brief: qa
산출: $repo/.kit/none/review-qa.md")" ] || err "agent-guard allowed a brief crew did not save"
mkdir -p "$tmpd/other/.kit/s"; printf '%s\n' "kit-brief: backend
산출: $tmpd/other/.kit/s/r.md" > "$tmpd/other/.kit/s/brief-backend.md"
[ -n "$(guard s1 kit:backend "kit-brief: backend
산출: $tmpd/other/.kit/s/r.md")" ] || err "agent-guard allowed a .kit folder outside the repo"
mark s1 "/kit:crew build backend 정렬"   # a new crew command: the old brief file is now stale
[ -n "$(guard s1 kit:backend "$brief")" ] || err "agent-guard allowed a brief saved before the crew command"
# reasons: specific inside a crew session, the fixed line without one
guard s1 kit:backend "$brief" | grep -q 'brief-backend.md`의 내용으로' || err "agent-guard did not say the brief is stale"
guard s1 kit:security "kit-brief: security" | grep -q '맡긴 직군은 backend' || err "agent-guard did not name the roles the crew command gave"
guard s1 kit:backend "crew build backend" | grep -q '첫 줄은' || err "agent-guard did not explain the kit-brief line"
guard s1 kit:backend "kit-brief: backend
산출: $tmpd/elsewhere/r.md" | grep -q '산출:` 경로' || err "agent-guard did not explain the 산출 path"
guard s9 kit:backend "$brief" | grep -q 'crew 명령을 친 작업에서만' || err "agent-guard gave a specific reason without a crew command"
guard s9 kit:backend "$brief" | grep -q 'brief-' && err "agent-guard leaked brief details without a crew command"
[ -z "$(guard s1 general-purpose "anything")" ] || err "agent-guard touched a non-kit agent"
mark s1 "<task-notification>done"; [ -f "$st/s1" ] || err "crew_mark cleared the mark on a background notice"
mark s1 '$dev 고쳐 줘'; [ ! -f "$st/s1" ] || err "crew_mark kept the mark after another kit command"
mark s3 "crew가 뭐야"; [ ! -f "$st/s3" ] || err "crew_mark marked a prompt that only mentions crew"
mark s6 "crew build backend 정렬" | grep -q 'crew Skill' || err "crew_mark did not point a plain crew command at the skill"
[ -z "$(mark s6 "/kit:crew build backend 정렬")" ] || err "crew_mark printed a line for a slash crew command"
mkdir -p "$tmpd/bin"; for c in sh cat grep printf dirname; do p=$(command -v "$c") && ln -sf "$p" "$tmpd/bin/$c"; done
printf '%s' '{"tool_name":"Agent","tool_input":{"subagent_type":"kit:backend","prompt":"x"}}' | PATH="$tmpd/bin" sh "$root/hooks/agent-guard.sh" 2>/dev/null
[ $? = 2 ] || err "agent-guard.sh without python3 did not block a kit call"
printf '%s' '{"tool_name":"Agent","tool_input":{"subagent_type":"general-purpose","prompt":"x"}}' | PATH="$tmpd/bin" sh "$root/hooks/agent-guard.sh"
[ $? = 0 ] || err "agent-guard.sh without python3 blocked a non-kit call"
# Antigravity: no UserPromptSubmit, so the guard reads the last kit command from the transcript
tr="$tmpd/transcript.jsonl"; ad="$repo/.kit/a"; mkdir -p "$ad"
step() { python3 -I -c 'import json,sys; print(json.dumps({"type":"USER_INPUT","source":"USER_EXPLICIT","created_at":sys.argv[2],"content":"<USER_REQUEST>\n"+sys.argv[1]+"\n</USER_REQUEST>"}, ensure_ascii=False))' "$1" "$2" >> "$tr"; }
agy() { python3 -I -c 'import json,sys; print(json.dumps({"toolCall":{"name":"invoke_subagent","args":{"TypeName":sys.argv[1],"Prompt":sys.argv[2]}},"transcriptPath":sys.argv[3],"workspacePaths":[sys.argv[4]]}))' "$1" "$2" "$tr" "$repo" | python3 -I "$g"; }
abrief="kit-brief: backend
산출: $ad/report-backend.md"
printf '%s\n' "$abrief" > "$ad/brief-backend.md"
: > "$tr"; step "/crew build backend 정렬" "2000-01-01T00:00:00Z"
[ -z "$(agy backend "$abrief")" ] || err "agent-guard denied an AGY crew brief"
[ -n "$(agy security "kit-brief: security
산출: $ad/review-security.md")" ] || err "agent-guard allowed an AGY role the crew command did not name"
[ -z "$(agy self "anything")" ] || err "agent-guard touched an AGY non-kit agent"
step "/spec 다른 일" "2000-01-01T00:00:01Z"
agy backend "$abrief" | grep -q '"decision": "deny"' || err "agent-guard allowed AGY after another kit command"
: > "$tr"; step "/crew build backend 정렬" "2099-01-01T00:00:00Z"
[ -n "$(agy backend "$abrief")" ] || err "agent-guard allowed an AGY brief saved before the crew command"
: > "$tr"; step "정렬 기능 만들어 줘" "2000-01-01T00:00:00Z"
[ -n "$(agy backend "$abrief")" ] || err "agent-guard allowed AGY without a crew command"
agy backend "$abrief" | grep -q 'crew 명령을 친 작업에서만' || err "agent-guard gave AGY a specific reason without a crew command"
printf '%s' '{"toolCall":{"name":"invoke_subagent","args":{"TypeName":"backend","Prompt":"x"}}}' | PATH="$tmpd/bin" sh "$root/hooks/agent-guard.sh" | grep -q '"decision":"deny"' || err "agent-guard.sh without python3 did not block an AGY kit call"
unset XDG_STATE_HOME

# budget
for d in "$root"/skills/*/; do
  n=$(basename "$d"); total=0
  for f in "$d"_rules/* "$d"_vendor/*; do [ -f "$f" ] && total=$((total + $(wc -c < "$f"))); done
  [ "$total" -le "$budget" ] || err "skills/$n reads $total bytes of rules+vendor (budget $budget)"
done

[ "$fail" = 0 ] && echo "check ok" || exit 1

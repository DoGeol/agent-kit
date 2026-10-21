#!/bin/sh
# Offline checks for the kit. Exit 1 on any failure.
#   - every vendor/<name> is in manifest.tsv and has a LICENSE file
#   - skills/*/_rules and _vendor copies match their sources (run build.sh)
#   - every skills/*/SKILL.md has name and description, and no tool-specific keys other than argument-hint
#   - the text a skill reads (_rules + _vendor) stays under the budget
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
fail=0
err() { echo "FAIL $*"; fail=1; }
budget=${KIT_BUDGET_BYTES:-16000}

# vendor folders
for d in "$root"/vendor/*/; do
  n=$(basename "$d")
  grep -q "^$n	" "$root/vendor/manifest.tsv" || err "vendor/$n not in manifest.tsv"
  ls "$d"/LICENSE* >/dev/null 2>&1 || err "vendor/$n has no LICENSE file"
done
grep -v '^#' "$root/vendor/manifest.tsv" | grep -v '^[[:space:]]*$' | cut -f1 | while read -r n; do
  [ -d "$root/vendor/$n" ] || echo "FAIL manifest row $n has no vendor/$n (run vendor.sh fetch)"
done | grep . && fail=1

# copies match sources
grep -v '^#' "$root/scripts/vendor-map.tsv" | grep -v '^[[:space:]]*$' | while IFS="$(printf '\t')" read -r skill src dest; do
  out="$root/skills/$skill/$dest"
  [ -f "$out" ] || { echo "FAIL skills/$skill/$dest missing (run build.sh)"; continue; }
  cmp -s "$root/$src" "$out" || echo "FAIL skills/$skill/$dest differs from $src (run build.sh)"
done | grep . && fail=1
# no stray copies
for f in "$root"/skills/*/_rules/* "$root"/skills/*/_vendor/*; do
  [ -f "$f" ] || continue
  rel=${f#"$root"/skills/}; skill=${rel%%/*}; dest=${rel#*/}
  grep -q "^$skill	.*	$dest$" "$root/scripts/vendor-map.tsv" || err "skills/$rel not in vendor-map.tsv"
done

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

# budget
for d in "$root"/skills/*/; do
  n=$(basename "$d"); total=0
  for f in "$d"_rules/* "$d"_vendor/*; do [ -f "$f" ] && total=$((total + $(wc -c < "$f"))); done
  [ "$total" -le "$budget" ] || err "skills/$n reads $total bytes of rules+vendor (budget $budget)"
done

[ "$fail" = 0 ] && echo "check ok" || exit 1

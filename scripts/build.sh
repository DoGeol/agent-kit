#!/bin/sh
# Copy rules/ and vendor/ files into each skill folder (skills/<skill>/_rules, _vendor) per scripts/vendor-map.tsv,
# so every skill folder is self-contained when installed or linked on its own. Byte-identical copies; check.sh verifies.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
map="$root/scripts/vendor-map.tsv"
grep -v '^#' "$map" | grep -v '^[[:space:]]*$' | while IFS="$(printf '\t')" read -r skill src dest; do
  [ -f "$root/$src" ] || { echo "missing source: $src" >&2; exit 1; }
  out="$root/skills/$skill/$dest"
  mkdir -p "$(dirname "$out")"
  if [ ! -f "$out" ] || ! cmp -s "$root/$src" "$out"; then cp "$root/$src" "$out"; echo "copy  $skill/$dest"; fi
done
echo "build done"

#!/bin/sh
# Keep vendor/ in sync with vendor/manifest.tsv (name, repo, commit, paths).
#   vendor.sh fetch           copy every manifest row at its pinned commit into vendor/<name>/
#   vendor.sh check           report rows whose repo default branch moved past the pinned commit
#   vendor.sh update <name>   pin <name> to the repo's current default branch, show the diff, re-fetch
# Needs git and network. Does not touch skills/: run build.sh afterwards.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
manifest="$root/vendor/manifest.tsv"
cmd=${1:-fetch}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

rows() { grep -v '^#' "$manifest" | grep -v '^[[:space:]]*$'; }

clone_at() { # $1 repo $2 commit $3 dir
  git clone -q --filter=blob:none --no-checkout "$1" "$3"
  git -C "$3" fetch -q origin "$2" 2>/dev/null || true
}

fetch_one() { # name repo commit paths
  name=$1; repo=$2; commit=$3; paths=$4
  dir="$tmp/$name"
  clone_at "$repo" "$commit" "$dir"
  dest="$root/vendor/$name"
  mkdir -p "$dest"
  for p in $paths; do
    git -C "$dir" checkout -q "$commit" -- "$p"
    mkdir -p "$dest/$(dirname "$p")"
    cp "$dir/$p" "$dest/$p"
  done
  echo "fetch $name @ $(printf %.7s "$commit")"
}

case "$cmd" in
  fetch)
    rows | while IFS="$(printf '\t')" read -r name repo commit paths; do
      fetch_one "$name" "$repo" "$commit" "$paths"
    done ;;
  check)
    rows | while IFS="$(printf '\t')" read -r name repo commit paths; do
      head=$(git ls-remote "$repo" HEAD | cut -f1)
      if [ "$head" = "$commit" ]; then echo "ok    $name"; else echo "moved $name $(printf %.7s "$commit") -> $(printf %.7s "$head")"; fi
    done ;;
  update)
    target=${2:?usage: vendor.sh update <name>}
    row=$(rows | awk -F'\t' -v n="$target" '$1==n')
    [ -n "$row" ] || { echo "no such vendor: $target" >&2; exit 1; }
    repo=$(printf '%s' "$row" | cut -f2); old=$(printf '%s' "$row" | cut -f3); paths=$(printf '%s' "$row" | cut -f4)
    new=$(git ls-remote "$repo" HEAD | cut -f1)
    [ "$new" != "$old" ] || { echo "already at $(printf %.7s "$old")"; exit 0; }
    dir="$tmp/$target"; clone_at "$repo" "$new" "$dir"
    echo "== $target: $(printf %.7s "$old") -> $(printf %.7s "$new")"
    for p in $paths; do git -C "$dir" diff --stat "$old" "$new" -- "$p"; done
    for p in $paths; do git -C "$dir" diff "$old" "$new" -- "$p"; done
    sed -i.bak "s|^$target	\([^	]*\)	$old	|$target	\1	$new	|" "$manifest" && rm -f "$manifest.bak"
    fetch_one "$target" "$repo" "$new" "$paths"
    echo "manifest updated. review the diff above, run scripts/build.sh, bump the kit version, then commit." ;;
  *) echo "usage: vendor.sh [fetch|check|update <name>]" >&2; exit 2 ;;
esac

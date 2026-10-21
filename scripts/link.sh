#!/bin/sh
# Link every skills/<name> into each agent's skills folder, so one git pull updates them all.
# Usage: scripts/link.sh [target-dir ...]   (default: ~/.codex/skills ~/.agents/skills)
# Claude Code is not a default target: install kit as a plugin there (/kit:dev). Linking as well would list each skill twice.
# Existing files or folders that are not links are left alone. Run scripts/build.sh first so _rules/_vendor copies exist.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
[ $# -gt 0 ] || set -- "$HOME/.codex/skills" "$HOME/.agents/skills"
for target in "$@"; do
  mkdir -p "$target"
  for skill in "$root"/skills/*/; do
    [ -f "$skill/SKILL.md" ] || continue
    name=$(basename "$skill")
    dest="$target/$name"
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      echo "skip $dest (exists, not a link)"
      continue
    fi
    ln -sfn "${skill%/}" "$dest"
    echo "link $dest -> ${skill%/}"
  done
done

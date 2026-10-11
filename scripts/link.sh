#!/bin/sh
# Link every skills/<name> into each agent's skills folder, so one git pull updates them all.
# Usage: scripts/link.sh [target-dir ...]   (default: ~/.claude/skills ~/.codex/skills ~/.agents/skills)
# Existing files or folders that are not links are left alone.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
[ $# -gt 0 ] || set -- "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.agents/skills"
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

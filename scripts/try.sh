#!/bin/sh
# Try a kit command on a throwaway copy of a project, in Claude Code, Codex or Antigravity, and summarize the run.
#   scripts/try.sh <claude|codex|agy> "<prompt>" [resume-id]    run in a fresh copy (or the last copy, when resuming)
#   scripts/try.sh clean                                        delete the copies and the Codex trust entries they left
# The project to copy is $KIT_TRY_PROJECT (a folder with its own git repo). Copies and logs live in
# ${KIT_TRY_DIR:-~/.cache/agent-kit/try}. Models: KIT_TRY_CLAUDE_MODEL (haiku), KIT_TRY_CODEX_MODEL and
# KIT_TRY_AGY_MODEL (each tool's default when unset). Each run prints the session id to resume with, the tool
# calls, the final answer, and whether the copy's git tree changed. KIT_TRY_REUSE=1 starts a new session in the
# last copy (to see what a fresh conversation does with files an earlier run left).
# Runs skip permission prompts inside the copy, so point KIT_TRY_PROJECT only at a project you are fine to run.
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
dir=${KIT_TRY_DIR:-$HOME/.cache/agent-kit/try}
codex_home=${CODEX_HOME:-$HOME/.codex}
tool=${1:-}

case "$tool" in
  clean)
    [ -d "$dir" ] && rm -rf -- "$dir" && echo "removed $dir"
    if [ -f "$codex_home/config.toml" ]; then
      python3 -I - "$codex_home/config.toml" "$dir" <<'EOF'
import re, sys
path, under = sys.argv[1], sys.argv[2].rstrip("/") + "/"
text = open(path, encoding="utf-8").read()
pattern = r'(?m)^\[projects\."' + re.escape(under) + r'[^"]*"\]\n(?:[^\[\n][^\n]*\n|\n)*?(?=^\[|\Z)'
new, n = re.subn(pattern, "", text)
if n:
    open(path, "w", encoding="utf-8").write(new)
print(f"removed {n} Codex trust entries under {under}")
EOF
    fi
    exit 0 ;;
  claude|codex|agy) ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
prompt=${2:?prompt missing}
resume=${3:-}
mkdir -p "$dir/logs"
if [ -n "$resume" ] || [ "${KIT_TRY_REUSE:-}" = 1 ]; then
  copy=$(cat "$dir/last" 2>/dev/null) || { echo "no earlier copy to resume in" >&2; exit 1; }
else
  project=${KIT_TRY_PROJECT:?set KIT_TRY_PROJECT to the project folder to copy}
  [ -d "$project/.git" ] || { echo "$project is not a git repo (the run compares its tree before and after)" >&2; exit 1; }
  copy="$dir/$(date +%Y%m%d-%H%M%S)-$tool"
  cp -R "$project" "$copy" || exit 1
  echo "$copy" > "$dir/last"
fi
log="$dir/logs/$(basename "$copy").$(date +%H%M%S).log"
cd "$copy" || exit 1
before=$(git status --porcelain | cksum)
start=$(date +%s)
case "$tool" in
  claude)
    claude -p "$prompt" ${resume:+--resume "$resume"} --model "${KIT_TRY_CLAUDE_MODEL:-haiku}" \
      --output-format stream-json --verbose --permission-mode bypassPermissions > "$log" 2>&1 ;;
  codex)
    # stdin closed: codex exec otherwise waits for more input when run from a script
    if [ -n "$resume" ]; then
      CODEX_HOME="$codex_home" codex exec resume --json ${KIT_TRY_CODEX_MODEL:+-m "$KIT_TRY_CODEX_MODEL"} \
        --dangerously-bypass-approvals-and-sandbox "$resume" "$prompt" < /dev/null > "$log" 2>&1
    else
      CODEX_HOME="$codex_home" codex exec --json ${KIT_TRY_CODEX_MODEL:+-m "$KIT_TRY_CODEX_MODEL"} \
        --dangerously-bypass-approvals-and-sandbox -C "$copy" "$prompt" < /dev/null > "$log" 2>&1
    fi ;;
  agy)
    agy -p "$prompt" ${resume:+--conversation "$resume"} ${KIT_TRY_AGY_MODEL:+--model "$KIT_TRY_AGY_MODEL"} \
      --dangerously-skip-permissions --output-format stream-json > "$log" 2>&1 ;;
esac
rc=$?
after=$(git status --porcelain | cksum)
changed=no; [ "$before" = "$after" ] || changed=yes
python3 -I "$root/scripts/try-sum.py" "$log"
printf '\nrc=%s secs=%s tree_changed=%s\ncopy=%s\nlog=%s\n' "$rc" "$(( $(date +%s) - start ))" "$changed" "$copy" "$log"

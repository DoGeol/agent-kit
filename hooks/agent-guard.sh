#!/bin/sh
# PreToolUse wrapper for agent-guard.py. Without python3 it still blocks kit:<role> subagent calls
# (exit 2 = block in Claude Code) and lets every other call through.
in=$(cat)
if command -v python3 >/dev/null 2>&1; then
  printf '%s' "$in" | python3 "$(dirname "$0")/agent-guard.py"
  exit $?
fi
if printf '%s' "$in" | grep -Eq '"subagent_type"[[:space:]]*:[[:space:]]*"kit:'; then
  echo "kit: python3가 없어 kit 서브에이전트 호출을 막습니다. python3를 설치한 뒤 crew를 다시 치세요." >&2
  exit 2
fi
exit 0

#!/bin/sh
# PreToolUse wrapper for agent-guard.py (Claude Code, Antigravity). Without python3 it still blocks kit
# subagent calls and lets every other call through: Claude Code reads exit 2 as a block, Antigravity reads
# a {"decision":"deny"} line.
in=$(cat)
if command -v python3 >/dev/null 2>&1; then
  printf '%s' "$in" | python3 "$(dirname "$0")/agent-guard.py"
  exit $?
fi
reason="kit: python3가 없어 kit 서브에이전트 호출을 막습니다. python3를 설치한 뒤 crew를 다시 치세요."
if printf '%s' "$in" | grep -Eq '"TypeName"[[:space:]]*:[[:space:]]*"(frontend|backend|qa|designer|reviewer|security)"'; then
  printf '{"decision":"deny","reason":"%s"}\n' "$reason"
  exit 0
fi
if printf '%s' "$in" | grep -Eq '"subagent_type"[[:space:]]*:[[:space:]]*"kit:'; then
  echo "$reason" >&2
  exit 2
fi
exit 0

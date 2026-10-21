#!/bin/sh
# Optional UserPromptSubmit hook (Claude Code, Codex): keeps the terse caveman voice from leaking into turns that
# are not /dev work. Off unless ~/.config/agent-kit/hooks contains a line `plain=on`.
# Reads the hook JSON on stdin, prints one context line on stdout when the prompt is not a /dev call.
set -u
cfg="${XDG_CONFIG_HOME:-$HOME/.config}/agent-kit/hooks"
[ -f "$cfg" ] && grep -q '^plain=on$' "$cfg" || exit 0
prompt=$(sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)
case "$prompt" in
  /dev*|/kit:dev*|\$dev*|"") exit 0 ;;
esac
echo "kit: 이 턴은 /dev 호출이 아니다. 같은 /dev 작업이 이어지는 중이 아니면 일반 문장으로 답한다(짧은 말투 끔)."

#!/bin/sh
# Report whether caveman, ponytail and im-not-ai are installed for Claude Code, Codex and Antigravity on this machine.
# Looks for a folder or file whose name contains the skill name under each tool's skill/plugin folders. Read-only.
set -u
home=${HOME:-~}
claude_dirs="$home/.claude/skills $home/.claude/plugins ${CLAUDE_CONFIG_DIR:-}"
codex_dirs="$home/.codex/skills $home/.agents/skills $home/.codex/plugins"
agy_dirs="$home/.gemini/config/skills $home/.gemini/config/plugins $home/.gemini/extensions $home/.gemini/skills $home/.config/antigravity $home/.antigravity"

found() { # dirs pattern
  for d in $1; do
    [ -d "$d" ] || continue
    if find "$d" -maxdepth 4 -iname "*$2*" 2>/dev/null | grep -q .; then return 0; fi
  done
  return 1
}
mark() { if found "$1" "$2"; then printf '있음'; else printf '없음'; fi; }

printf '%-10s %-8s %-8s %-8s\n' "외부 Skill" "Claude" "Codex" "AGY"
for s in caveman ponytail; do
  printf '%-10s %-8s %-8s %-8s\n' "$s" "$(mark "$claude_dirs" "$s")" "$(mark "$codex_dirs" "$s")" "$(mark "$agy_dirs" "$s")"
done
printf '%-10s %-8s %-8s %-8s\n' "im-not-ai" "$(mark "$claude_dirs" "humanize")" "$(mark "$codex_dirs" "humanize")" "$(mark "$agy_dirs" "humanize")"

cat <<'EOF'

설치 명령 (없는 것만 실행. 각 저장소 README가 최신)
  caveman    Claude: claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman
             Codex·AGY: curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash  (여러 도구 한 번에)
  ponytail   Claude: claude plugin marketplace add DietrichGebert/ponytail && claude plugin install ponytail@ponytail
             Codex:  codex plugin marketplace add DietrichGebert/ponytail && codex plugin add ponytail@ponytail
             AGY:    agy plugin install https://github.com/DietrichGebert/ponytail
  im-not-ai  Claude: /plugin marketplace add epoko77-ai/im-not-ai 뒤 /plugin install humanize-korean@im-not-ai
             Codex:  git clone https://github.com/epoko77-ai/im-not-ai.git && cd im-not-ai && ./install.sh --codex-only
             AGY:    agy extensions install https://github.com/epoko77-ai/im-not-ai.git  (Gemini CLI 문서 기준, 확인 필요)

기본 끔 (kit의 /dev가 켤 때만 쓰도록)
  ponytail   환경변수 PONYTAIL_DEFAULT_MODE=off, 또는 세션에서 /ponytail default off
  caveman    환경변수 CAVEMAN_DEFAULT_MODE=off, 또는 ~/.config/caveman/config.json에 {"defaultMode": "off"}
             세션의 /caveman off는 그 세션만 끈다. 새 세션은 기본값으로 다시 켜진다
EOF

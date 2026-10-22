#!/bin/sh
# Report whether caveman, ponytail and im-not-ai are installed for Claude Code, Codex and Antigravity on this machine.
# A tool counts as having one when its installed-plugin list names it (enabled, for Codex and AGY) or its own skill
# folder holds a folder with that name. Plugin caches and marketplace copies do not count, the same rule /dev uses.
# Read-only.
set -u
home=${HOME:-~}
claude_home=${CLAUDE_CONFIG_DIR:-$home/.claude}
claude_dirs="$claude_home/skills"
codex_dirs="${CODEX_HOME:-$home/.codex}/skills $home/.agents/skills"
agy_dirs="$home/.gemini/config/skills $home/.gemini/extensions"

in_dirs() { # dirs pattern
  for d in $1; do
    [ -d "$d" ] || continue
    if find "$d" -mindepth 1 -maxdepth 2 -iname "*$2*" 2>/dev/null | grep -q .; then return 0; fi
  done
  return 1
}
claude_plugins() { grep -o '"[^"/]*@[^"/]*"' "$claude_home/plugins/installed_plugins.json" 2>/dev/null; }
codex_plugins() { # enabled entries of [plugins."name@marketplace"] in Codex config.toml
  awk '/^\[plugins\."/ { n = $0; sub(/^\[plugins\."/, "", n); sub(/"\].*/, "", n); next }
       /^\[/ { n = "" }
       n != "" && /^enabled[[:space:]]*=[[:space:]]*true/ { print n }' "${CODEX_HOME:-$home/.codex}/config.toml" 2>/dev/null
}
agy_plugins() { command -v agy >/dev/null 2>&1 && agy plugin list 2>/dev/null | sed -n 's/^- \([^ ]*\) (enabled.*/\1/p'; }
plugins_claude=$(claude_plugins); plugins_codex=$(codex_plugins); plugins_agy=$(agy_plugins)
mark() { # dirs plugin-list pattern
  if in_dirs "$1" "$3" || printf '%s\n' "$2" | grep -qi "$3"; then printf '있음'; else printf '없음'; fi
}

printf '%-10s %-8s %-8s %-8s\n' "외부 Skill" "Claude" "Codex" "AGY"
for s in caveman ponytail; do
  printf '%-10s %-8s %-8s %-8s\n' "$s" "$(mark "$claude_dirs" "$plugins_claude" "$s")" "$(mark "$codex_dirs" "$plugins_codex" "$s")" "$(mark "$agy_dirs" "$plugins_agy" "$s")"
done
printf '%-10s %-8s %-8s %-8s\n' "im-not-ai" "$(mark "$claude_dirs" "$plugins_claude" "humanize")" "$(mark "$codex_dirs" "$plugins_codex" "humanize")" "$(mark "$agy_dirs" "$plugins_agy" "humanize")"

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

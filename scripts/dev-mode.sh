#!/bin/sh
# Switch Codex and Antigravity between running kit from this repo (on) and the GitHub install (off).
#   scripts/dev-mode.sh status   show where each tool reads kit from (changes nothing)
#   scripts/dev-mode.sh on       Codex: kit plugin off in config.toml, skills/ linked into ~/.codex/skills
#                                AGY:   ~/.gemini/config/plugins/kit becomes a folder of links into this repo
#                                git:   core.hooksPath=scripts/hooks (pre-commit runs build.sh and check.sh)
#   scripts/dev-mode.sh off      remove those links, reinstall kit from GitHub main in Codex and AGY
# Claude Code is only reported: add this folder as a directory marketplace and it already reads it live.
# After editing kit, run scripts/build.sh (the pre-commit hook does it too) and start a new session.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
codex_home=${CODEX_HOME:-$HOME/.codex}
cfg="$codex_home/config.toml"
agy_dir="$HOME/.gemini/config/plugins/kit"
marker="$agy_dir/.kit-dev-mode"
plugin='kit@dg-agent-kit'
repo_url=https://github.com/DoGeol/agent-kit

codex_plugin() { # prints true, false or missing
  [ -f "$cfg" ] || { echo missing; return; }
  python3 -I - "$cfg" "$plugin" <<'EOF'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
m = re.findall(r'(?m)^\[plugins\."' + re.escape(sys.argv[2]) + r'"\]\nenabled = (true|false)$', text)
print(m[0] if len(m) == 1 else "missing")
EOF
}

codex_set() { # true|false: back up config.toml, then flip only the enabled line of the kit plugin
  cp "$cfg" "$cfg.bak-dev-mode"
  python3 -I - "$cfg" "$plugin" "$1" <<'EOF'
import re, sys
path, name, value = sys.argv[1:]
text = open(path, encoding="utf-8").read()
pattern = r'(?m)^(\[plugins\."' + re.escape(name) + r'"\]\nenabled = )(true|false)$'
if len(re.findall(pattern, text)) != 1:
    sys.exit(f"{path}: expected exactly one [plugins.\"{name}\"] enabled line; left unchanged")
open(path, "w", encoding="utf-8").write(re.sub(pattern, r"\g<1>" + value, text))
EOF
}

codex_links() { # links in ~/.codex/skills that point into this repo
  for l in "$codex_home/skills"/*; do
    [ -L "$l" ] || continue
    case "$(readlink "$l")" in "$root/skills/"*) echo "$l" ;; esac
  done
}

agy_plugin_json() {
  python3 -I - "$root/.claude-plugin/plugin.json" "$agy_dir/plugin.json" <<'EOF'
import json, sys
src = json.load(open(sys.argv[1], encoding="utf-8"))
out = {k: src[k] for k in ("name", "version", "description") if k in src}
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
EOF
}

agy_dev() { # the AGY plugin folder is made of links into this repo
  [ -f "$marker" ] || [ "$(readlink "$agy_dir/skills" 2>/dev/null)" = "$root/skills" ]
}

status() {
  claude_from=$(claude plugin list 2>/dev/null | awk '/kit@dg-agent-kit/{f=1} f&&/Read from:/{print $3; exit}')
  case "$claude_from" in
    "$root") echo "Claude  이 레포를 바로 읽음" ;;
    "") echo "Claude  kit 설치를 찾지 못함" ;;
    *) echo "Claude  다른 곳에서 읽음: $claude_from" ;;
  esac
  n=$(codex_links | wc -l | tr -d ' ')
  case "$(codex_plugin)" in
    false) echo "Codex   dev (플러그인 꺼짐, Skill 링크 ${n}개)" ;;
    true) echo "Codex   github (플러그인 켜짐, Skill 링크 ${n}개)" ;;
    *) echo "Codex   kit 플러그인 항목 없음 (Skill 링크 ${n}개)" ;;
  esac
  [ "$codex_home" = "$HOME/.codex" ] || echo "        CODEX_HOME=$codex_home"
  if agy_dev; then echo "AGY     dev ($agy_dir → 이 레포 링크)"
  elif [ -d "$agy_dir" ]; then echo "AGY     github ($(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$agy_dir/plugin.json" 2>/dev/null || echo '?'))"
  else echo "AGY     설치 없음"; fi
  if [ "$(git -C "$root" config --get core.hooksPath || true)" = scripts/hooks ]; then echo "git     pre-commit 켜짐"; else echo "git     pre-commit 꺼짐"; fi
}

on() {
  # Codex
  if [ "$(codex_plugin)" = true ]; then codex_set false && echo "Codex: kit 플러그인 끔 (백업 $cfg.bak-dev-mode)"; fi
  sh "$root/scripts/link.sh" "$codex_home/skills" | sed 's/^/Codex: /'
  # AGY
  if [ -d "$agy_dir" ] && ! agy_dev; then
    if command -v agy >/dev/null 2>&1; then agy plugin uninstall kit >/dev/null 2>&1 || true; fi
    [ -d "$agy_dir" ] && { echo "AGY: $agy_dir 가 kit 설치본도 dev 폴더도 아닙니다. 손대지 않습니다." >&2; exit 1; }
  fi
  mkdir -p "$agy_dir"
  agy_plugin_json
  for n in skills agents hooks rules README.md LICENSE; do ln -sfn "$root/$n" "$agy_dir/$n"; done
  ln -sfn "$root/hooks/hooks.json" "$agy_dir/hooks.json"
  echo "kit dev mode: links into $root" > "$marker"
  echo "AGY: $agy_dir → 이 레포"
  # git
  git -C "$root" config core.hooksPath scripts/hooks && echo "git: pre-commit 켜짐"
  echo; status
}

off() {
  # Codex
  codex_links | while read -r l; do rm "$l"; echo "Codex: unlink $l"; done
  if [ "$(codex_plugin)" = false ]; then codex_set true && echo "Codex: kit 플러그인 켬 (백업 $cfg.bak-dev-mode)"; fi
  if command -v codex >/dev/null 2>&1; then
    CODEX_HOME="$codex_home" codex plugin marketplace upgrade dg-agent-kit >/dev/null
    CODEX_HOME="$codex_home" codex plugin add "$plugin" | tail -1
  fi
  # AGY
  if agy_dev; then
    for n in skills agents hooks rules README.md LICENSE hooks.json; do if [ -L "$agy_dir/$n" ]; then rm "$agy_dir/$n"; fi; done
    rm -f "$agy_dir/plugin.json" "$marker"
    rmdir "$agy_dir"
    if command -v agy >/dev/null 2>&1; then agy plugin install "$repo_url" | tail -1; fi
  else
    echo "AGY: dev 폴더가 아니라서 그대로 둡니다"
  fi
  echo
  echo "GitHub main 기준으로 설치했습니다. 이 브랜치의 바뀐 내용은 병합 전까지 들어가지 않습니다."
  echo "Codex는 훅이 바뀌었으면 /hooks에서 kit 훅 신뢰를 다시 묻습니다. pre-commit(core.hooksPath)은 그대로 둡니다."
  echo; status
}

case "${1:-status}" in
  status) status ;;
  on) on ;;
  off) off ;;
  *) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

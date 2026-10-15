#!/bin/sh
# orchestration-kit helper. Creates missing files only; never overwrites or deletes.
# Usage:
#   kit.sh init project <dir> <projectId> [taskPrefix]
#   kit.sh init portfolio <dir>
#   kit.sh register <hubDir> <projectDir>
#   kit.sh pending <hubDir>
#   kit.sh mark <hubDir> <projectId> <reportId> <applied|superseded|needs-review> [note]
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
tab=$(printf '\t')

die() { echo "kit.sh: $*" >&2; exit 1; }
matches() { printf '%s\n' "$1" | grep -Eq "$2"; }
now() { date +%Y-%m-%dT%H:%M:%S%z | sed 's/\(..\)$/:\1/'; }
# Print a YAML frontmatter value (flat `key: value` only) from stdin.
fm() {
  awk -v k="$1" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 { i = index($0, ":"); if (i && substr($0, 1, i - 1) == k) {
      v = substr($0, i + 1); sub(/^[ \t]+/, "", v); sub(/[ \t]+#.*$/, "", v); sub(/[ \t]+$/, "", v); print v; exit } }'
}
is_git() { git -C "$1" rev-parse --git-dir >/dev/null 2>&1; }
expand_path() { case $1 in "~/"*) printf '%s/%s\n' "$HOME" "${1#\~/}" ;; *) printf '%s\n' "$1" ;; esac; }
# Data rows of portfolio/PROJECTS.md as "id<TAB>path<TAB>status".
projects() {
  awk -F'|' '/^\|/ {
    for (i = 2; i <= 4; i++) { gsub(/^[ \t]+|[ \t]+$/, "", $i) }
    if ($2 == "projectId" || $2 ~ /^-+$/ || $2 == "") next
    print $2 "\t" $3 "\t" $4 }' "$1/portfolio/PROJECTS.md"
}
require_role() { # dir role
  [ -f "$1/.ai/ORCHESTRATION.md" ] || die "$1: .ai/ORCHESTRATION.md 없음. 먼저 init 실행"
  [ "$(fm role < "$1/.ai/ORCHESTRATION.md")" = "$2" ] || die "$1: role이 $2가 아님"
}

cmd_init() {
  role=${1:-}; dir=${2:-}
  case $role in project|portfolio) ;; *) die "usage: kit.sh init project|portfolio <dir> ..." ;; esac
  [ -d "$dir" ] || die "$dir: 폴더가 없음"
  dir=$(cd "$dir" && pwd)
  id=-; prefix=-; ref=-
  if [ "$role" = project ]; then
    id=${3:-}
    matches "$id" '^[a-z0-9][a-z0-9-]*$' || die "projectId는 소문자 kebab-case: '$id'"
    prefix=${4:-$(printf '%s' "$id" | cut -d- -f1 | tr '[:lower:]' '[:upper:]')}
    matches "$prefix" '^[A-Z][A-Z0-9]*$' || die "taskPrefix는 대문자로 시작하는 대문자·숫자: '$prefix'"
    ref=
    if is_git "$dir"; then
      ref=$(git -C "$dir" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true); ref=${ref#origin/}
      [ -n "$ref" ] || ref=$(git -C "$dir" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
    fi
    matches "$ref" '^[A-Za-z0-9._/-]+$' || ref=main
  fi
  conf="$dir/.ai/ORCHESTRATION.md"
  if [ -f "$conf" ]; then
    old_role=$(fm role < "$conf")
    [ "$old_role" = "$role" ] || die "$conf: 이미 role=$old_role. 다른 역할로 초기화하지 않음"
    if [ "$role" = project ]; then
      old_id=$(fm projectId < "$conf")
      [ "$old_id" = "$id" ] || die "$conf: 이미 projectId=$old_id. projectId는 바꾸지 않음"
      prefix=$(fm taskPrefix < "$conf"); ref=$(fm reportsRef < "$conf")
    fi
  fi
  if is_git "$dir" && [ -n "$(git -C "$dir" status --porcelain)" ]; then
    echo "주의: 커밋하지 않은 변경이 있음. 기존 파일은 건드리지 않고 없는 파일만 만든다."
  fi
  version=$(cat "$root/policies/VERSION"); at=$(now)
  (cd "$root/templates/$role" && find . -type f | sort) | while IFS= read -r rel; do
    rel=${rel#./}; dest="$dir/$rel"
    if [ -e "$dest" ] || [ -L "$dest" ]; then echo "skip    $rel (이미 있음)"; continue; fi
    mkdir -p "$(dirname "$dest")"
    (set -C; sed -e "s|{{PROJECT_ID}}|$id|g" -e "s|{{TASK_PREFIX}}|$prefix|g" -e "s|{{REPORTS_REF}}|$ref|g" \
      -e "s|{{POLICY_VERSION}}|$version|g" -e "s|{{NOW}}|$at|g" "$root/templates/$role/$rel" > "$dest")
    echo "create  $rel"
  done
  [ "$role" = project ] && echo "projectId=$id taskPrefix=$prefix reportsRef=$ref (다르면 .ai/ORCHESTRATION.md 수정)"
  for f in CLAUDE.md AGENTS.md; do
    if [ -e "$dir/$f" ]; then echo "$f: 있음. 변경하지 않음"; else echo "$f: 없음. 만들지 않음"; fi
  done
  echo "진입점 문구 제안 (사용자 승인 후 CLAUDE.md·AGENTS.md 끝에 덧붙인다):"
  echo "---8<---"
  if [ "$role" = project ]; then
    printf '%s\n' "## Orchestration" "" \
      "이 저장소는 orchestration-kit의 Project 역할이다 (projectId: \`$id\`)." \
      "설정과 프로젝트 컨텍스트는 \`.ai/ORCHESTRATION.md\`와 \`.ai/\`에 있다. Coordinator 작업은 orchestration-kit project Skill 절차를 따른다."
  else
    printf '%s\n' "## Orchestration" "" \
      "이 저장소는 orchestration-kit의 Portfolio 역할이다." \
      "업무·우선순위·등록 프로젝트는 \`portfolio/\`, 위임과 보고 처리는 \`handoffs/\`에 있다. 작업은 orchestration-kit portfolio Skill 절차를 따른다."
  fi
  echo "--->8---"
  echo "Coordinator·Worker는 실행하지 않았다."
}

cmd_register() {
  hub=${1:-}; proj=${2:-}
  [ -d "$hub" ] && [ -d "$proj" ] || die "usage: kit.sh register <hubDir> <projectDir>"
  require_role "$hub" portfolio; require_role "$proj" project
  [ -f "$hub/portfolio/PROJECTS.md" ] || die "$hub/portfolio/PROJECTS.md 없음"
  id=$(fm projectId < "$proj/.ai/ORCHESTRATION.md")
  matches "$id" '^[a-z0-9][a-z0-9-]*$' || die "잘못된 projectId: '$id'"
  path=$(cd "$proj" && pwd)
  case $path in "$HOME"/*) path="~/${path#"$HOME"/}" ;; esac
  case $path in *"|"*) die "경로에 | 문자가 있어 등록할 수 없음" ;; esac
  rows=$(projects "$hub")
  old=$(printf '%s\n' "$rows" | awk -F'\t' -v id="$id" '$1 == id { print $2; exit }')
  if [ -n "$old" ]; then
    [ "$old" = "$path" ] && { echo "이미 등록됨: $id"; return 0; }
    die "projectId 충돌: $id는 이미 $old로 등록됨"
  fi
  other=$(printf '%s\n' "$rows" | awk -F'\t' -v p="$path" '$2 == p { print $1; exit }')
  [ -z "$other" ] || die "같은 경로가 이미 $other로 등록됨"
  printf '| %s | %s | active | - |\n' "$id" "$path" >> "$hub/portfolio/PROJECTS.md"
  echo "등록: $id -> $path"
}

# Prints why a report is invalid, or nothing when it is valid. Args: projectId name; content on stdin.
check_report() {
  c=$(cat)
  for k in schema reportId projectId portfolioTaskId projectTaskId origin status verifiedAt coordinator; do
    [ -n "$(printf '%s\n' "$c" | fm "$k")" ] || { echo "필드 없음: $k"; return; }
  done
  get() { printf '%s\n' "$c" | fm "$1"; }
  [ "$(get schema)" = project-report/v1 ] || { echo "schema가 project-report/v1이 아님"; return; }
  [ "$(get reportId)" = "$2" ] || { echo "파일 이름과 reportId가 다름"; return; }
  [ "$(get projectId)" = "$1" ] || { echo "projectId가 등록 정보와 다름"; return; }
  task=$(get projectTaskId)
  matches "$task" '^[A-Z][A-Z0-9]*-[0-9]{4}$' || { echo "projectTaskId 형식 오류"; return; }
  matches "$2" "^$1-$task-r[0-9]{2}\$" || { echo "reportId 형식 오류"; return; }
  case $(get status) in completed|blocked|needs-review|cancelled) ;; *) echo "모르는 status"; return ;; esac
  case $(get origin) in
    portfolio) matches "$(get portfolioTaskId)" '^PORT-[0-9]{4}$' || echo "portfolioTaskId 형식 오류" ;;
    project-direct) [ "$(get portfolioTaskId)" = null ] || echo "project-direct는 portfolioTaskId: null" ;;
    *) echo "모르는 origin" ;;
  esac
}

# Output lines: pending<TAB>projectId<TAB>reportId<TAB>status<TAB>source | invalid<TAB>projectId<TAB>file<TAB>reason | error<TAB>projectId<TAB>-<TAB>reason
cmd_pending() {
  hub=${1:-}
  [ -d "$hub" ] || die "usage: kit.sh pending <hubDir>"
  require_role "$hub" portfolio
  projects "$hub" | while IFS="$tab" read -r id path status; do
    [ "$status" = active ] || continue
    p=$(expand_path "$path")
    if [ ! -f "$p/.ai/ORCHESTRATION.md" ]; then printf 'error\t%s\t-\t%s\n' "$id" "$path/.ai/ORCHESTRATION.md 없음"; continue; fi
    ref=$(fm reportsRef < "$p/.ai/ORCHESTRATION.md")
    if is_git "$p"; then
      git -C "$p" rev-parse --verify --quiet "$ref^{commit}" >/dev/null ||
        { printf 'error\t%s\t-\t%s\n' "$id" "reportsRef '$ref' 커밋 없음"; continue; }
      files=$(git -C "$p" ls-tree --name-only "$ref" -- .ai/reports/)
    else
      files=$(cd "$p" && ls .ai/reports/*.md 2>/dev/null || true)
    fi
    printf '%s\n' "$files" | while IFS= read -r f; do
      name=$(basename "$f")
      case $name in .*|*.tmp) continue ;; *.md) ;; *) continue ;; esac
      name=${name%.md}
      [ -e "$hub/handoffs/processed/$name.md" ] && continue
      if is_git "$p"; then content=$(git -C "$p" show "$ref:$f"); src="$path@$ref:$f"
      else content=$(cat "$p/$f"); src="$path/$f"; fi
      why=$(printf '%s\n' "$content" | check_report "$id" "$name")
      if [ -n "$why" ]; then printf 'invalid\t%s\t%s\t%s\n' "$id" "$f" "$why"
      else printf 'pending\t%s\t%s\t%s\t%s\n' "$id" "$name" "$(printf '%s\n' "$content" | fm status)" "$src"; fi
    done
  done
}

cmd_mark() {
  hub=${1:-}; id=${2:-}; rid=${3:-}; outcome=${4:-}; note=${5:-}
  [ -d "$hub" ] || die "usage: kit.sh mark <hubDir> <projectId> <reportId> <outcome> [note]"
  require_role "$hub" portfolio
  case $outcome in applied|superseded|needs-review) ;; *) die "outcome은 applied|superseded|needs-review" ;; esac
  matches "$rid" "^$id-[A-Z][A-Z0-9]*-[0-9]{4}-r[0-9]{2}\$" || die "reportId가 projectId와 맞지 않음: $rid"
  mkdir -p "$hub/handoffs/processed"
  marker="$hub/handoffs/processed/$rid.md"
  [ -e "$marker" ] && { echo "이미 처리됨: $rid"; return 0; }
  (set -C; printf -- '---\nschema: processed-report/v1\nreportId: %s\nprojectId: %s\nprocessedAt: %s\noutcome: %s\n---\n%s\n' \
    "$rid" "$id" "$(now)" "$outcome" "$note" > "$marker")
  echo "처리 마커: handoffs/processed/$rid.md"
}

case ${1:-} in
  init) shift; cmd_init "$@" ;;
  register) shift; cmd_register "$@" ;;
  pending) shift; cmd_pending "$@" ;;
  mark) shift; cmd_mark "$@" ;;
  *) sed -n '3,8p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

#!/bin/sh
# orchestration-kit helper. Creates missing files only; never overwrites or deletes.
# Usage:
#   kit.sh init project <dir> <projectId> [taskPrefix]
#   kit.sh init project --personal <hubDir> <dir> <projectId> [taskPrefix]
#   kit.sh init portfolio <dir>
#   kit.sh where <projectDir>
#   kit.sh register <hubDir> <projectDir>
#   kit.sh hub <dir>
#   kit.sh pending <hubDir>
#   kit.sh board <hubDir>
#   kit.sh decision-take <projectDir> <decisionId>
#   kit.sh mark <hubDir> <projectId> <reportId> <applied|superseded|needs-review|invalid> [note]
#   kit.sh usage [claude|codex|antigravity ...]
#   kit.sh usage-watch [--interval sec] [--until caution|danger] [--for min] <provider>...
#   kit.sh coordinator <projectDir>
#   kit.sh audit <hubDir>
#   kit.sh adopt-check <projectDir>
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
tab=$(printf '\t')
nl='
'

die() { echo "kit.sh: $*" >&2; exit 1; }
matches() { printf '%s\n' "$1" | grep -Eq "$2"; }
now() { date +%Y-%m-%dT%H:%M:%S%z | sed 's/\(..\)$/:\1/'; }
# Print a YAML frontmatter value (flat `key: value` only) from stdin.
fm() {
  awk -v k="$1" '
    { sub(/\r$/, "") }
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 { i = index($0, ":"); if (i && substr($0, 1, i - 1) == k) {
      v = substr($0, i + 1); sub(/^[ \t]+/, "", v); sub(/[ \t]+#.*$/, "", v); sub(/[ \t]+$/, "", v); print v; exit } }'
}
is_git() { git -C "$1" rev-parse --git-dir >/dev/null 2>&1; }
expand_path() { case $1 in "~/"*) printf '%s/%s\n' "$HOME" "${1#\~/}" ;; *) printf '%s\n' "$1" ;; esac; }
# Data rows of portfolio/PROJECTS.md as "id<TAB>path<TAB>status<TAB>lastPulled" (- when empty).
projects() {
  awk -F'|' '/^\|/ {
    for (i = 2; i <= 5; i++) { gsub(/^[ \t]+|[ \t]+$/, "", $i) }
    if ($2 == "projectId" || $2 ~ /^-+$/ || $2 == "") next
    print $2 "\t" $3 "\t" $4 "\t" ($5 == "" ? "-" : $5) }' "$1/portfolio/PROJECTS.md"
}
require_role() { # dir role
  [ -f "$1/.ai/ORCHESTRATION.md" ] || die "$1: .ai/ORCHESTRATION.md 없음. 먼저 init 실행"
  [ "$(fm role < "$1/.ai/ORCHESTRATION.md")" = "$2" ] || die "$1: role이 $2가 아님"
}
# Shared mode keeps state in the repo's .ai/. Personal mode keeps it in <hub>/projects/<projectId>/.ai/ and leaves
# only a pointer file in the git common dir (never committed, seen from every worktree) plus a local exclude line.
pointer=orchestration-kit-state
has_schema() { [ -f "$1/.ai/ORCHESTRATION.md" ] && [ "$(fm schema < "$1/.ai/ORCHESTRATION.md")" = orchestration-config/v1 ]; }
common_dir() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }
# Prints "shared|personal<TAB>state root" for a project checkout or any of its worktrees; fails when not initialized.
locate() {
  d=$(cd "$1" && pwd); ptr=
  if is_git "$d"; then c=$(common_dir "$d") && [ -f "$c/$pointer" ] && ptr=$(cat "$c/$pointer"); fi
  if has_schema "$d"; then
    [ -z "$ptr" ] || die "$d: 공유 모드 .ai/와 개인 모드 상태 경로($ptr)가 함께 있음. 어느 쪽을 쓸지 사용자에게 묻는다"
    printf 'shared\t%s\n' "$d"
  elif [ -n "$ptr" ]; then
    has_schema "$ptr" || die "$d: 개인 모드 상태 폴더가 없음: $ptr"
    printf 'personal\t%s\n' "$ptr"
  else return 1; fi
}
# State root of a registered project: personal when the hub holds projects/<id>/.ai/, otherwise the repo path.
# Keeps Worker progress files out of git status in every worktree. Append only; the user's own entries stay.
add_exclude() { # git common dir
  mkdir -p "$1/info"; ex="$1/info/exclude"
  grep -qxF '.orch-progress/' "$ex" 2>/dev/null && return 0
  [ ! -s "$ex" ] || [ -z "$(tail -c 1 "$ex")" ] || echo >> "$ex"
  echo '.orch-progress/' >> "$ex"
}
# A shared-mode project has no state path to follow back to its hub, so register leaves one: the hub's path
# in the git common dir (never committed, seen from every worktree), read by `hub`.
hub_pointer=orchestration-kit-hub
project_root() { # hub id path
  if [ -f "$1/projects/$2/.ai/ORCHESTRATION.md" ]; then printf '%s\n' "$1/projects/$2"; else expand_path "$3"; fi
}

cmd_init() {
  role=${1:-}; personal=; hub=
  if [ "${2:-}" = --personal ]; then personal=1; hub=${3:-}; shift 2; fi
  dir=${2:-}
  case $role in project|portfolio) ;; *) die "usage: kit.sh init project|portfolio <dir> ..." ;; esac
  [ -d "$dir" ] || die "$dir: 폴더가 없음"
  dir=$(cd "$dir" && pwd)
  out=$dir; mode=shared
  if [ -n "$personal" ]; then
    [ "$role" = project ] || die "--personal은 project에만 쓴다"
    [ -d "$hub" ] || die "usage: kit.sh init project --personal <hubDir> <dir> <projectId> [taskPrefix]"
    require_role "$hub" portfolio; hub=$(cd "$hub" && pwd -P)
    is_git "$dir" || die "$dir: 개인 모드는 Git 저장소에서만 쓴다"
    ! has_schema "$dir" || die "$dir: 이미 공유 모드(.ai/)로 초기화됨. 모드를 바꾸려면 사용자와 수동으로 옮긴다"
    common=$(common_dir "$dir") || die "$dir: Git 공통 폴더를 찾지 못함"
    mode=personal
  elif [ "$role" = project ] && is_git "$dir" && c=$(common_dir "$dir") && [ -f "$c/$pointer" ]; then
    die "$dir: 이미 개인 모드로 초기화됨 ($(cat "$c/$pointer")). 모드를 바꾸려면 사용자와 수동으로 옮긴다"
  fi
  id=-; prefix=-; ref=-
  if [ "$role" = project ]; then
    id=${3:-}
    matches "$id" '^[a-z0-9][a-z0-9-]*$' || die "projectId는 소문자 kebab-case: '$id'"
    prefix=${4:-$(printf '%s' "$id" | cut -d- -f1 | tr '[:lower:]' '[:upper:]')}
    matches "$prefix" '^[A-Z][A-Z0-9]*$' || die "taskPrefix는 대문자로 시작하는 대문자·숫자: '$prefix'"
    if [ -n "$personal" ]; then
      out="$hub/projects/$id"
      old=$(cat "$common/$pointer" 2>/dev/null || true)
      [ -z "$old" ] || [ "$old" = "$out" ] || die "$dir: 이미 다른 상태 폴더를 가리킴: $old"
    fi
    ref=
    if [ -n "$personal" ]; then ref=-
    elif is_git "$dir"; then
      ref=$(git -C "$dir" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true); ref=${ref#origin/}
      # No remote default: use the main worktree's branch, not a linked worktree's (a Worker branch).
      [ -n "$ref" ] || ref=$(git -C "$dir" worktree list --porcelain 2>/dev/null | awk '/^$/ { exit } /^branch / { sub("refs/heads/", "", $2); print $2 }')
    fi
    matches "$ref" '^[A-Za-z0-9._/-]+$' || { ref=main; echo "주의: 기준 브랜치를 찾지 못해 reportsRef를 main으로 둔다. .ai/ORCHESTRATION.md에서 확인한다." >&2; }
  fi
  conf="$out/.ai/ORCHESTRATION.md"
  if [ -f "$conf" ]; then
    old_role=$(fm role < "$conf")
    [ "$old_role" = "$role" ] || die "$conf: 이미 role=$old_role. 다른 역할로 초기화하지 않음"
    if [ "$role" = project ]; then
      old_id=$(fm projectId < "$conf")
      [ "$old_id" = "$id" ] || die "$conf: 이미 projectId=$old_id. projectId는 바꾸지 않음"
      prefix=$(fm taskPrefix < "$conf"); ref=$(fm reportsRef < "$conf")
    fi
  fi
  if [ -z "$personal" ] && is_git "$dir" && [ -n "$(git -C "$dir" status --porcelain)" ]; then
    echo "주의: 커밋하지 않은 변경이 있음. 기존 파일은 건드리지 않고 없는 파일만 만든다."
  fi
  version=$(cat "$root/policies/VERSION"); at=$(now)
  (cd "$root/templates/$role" && find . -type f | sort) | while IFS= read -r rel; do
    rel=${rel#./}; dest="$out/$rel"
    if [ -e "$dest" ] || [ -L "$dest" ]; then echo "skip    $rel (이미 있음)"; continue; fi
    mkdir -p "$(dirname "$dest")"
    (set -C; sed -e "s|{{PROJECT_ID}}|$id|g" -e "s|{{TASK_PREFIX}}|$prefix|g" -e "s|{{REPORTS_REF}}|$ref|g" -e "s|{{MODE}}|$mode|g" \
      -e "s|{{POLICY_VERSION}}|$version|g" -e "s|{{NOW}}|$at|g" "$root/templates/$role/$rel" > "$dest")
    echo "create  $rel"
  done
  if [ -n "$personal" ]; then
    [ -f "$common/$pointer" ] || printf '%s\n' "$out" > "$common/$pointer"
    add_exclude "$common"
    echo "projectId=$id taskPrefix=$prefix mode=personal 상태 폴더=projects/$id/.ai/ (hub)"
    echo "저장소의 추적 파일은 바꾸지 않았다. Git 공통 폴더에 상태 경로 파일, 로컬 무시 목록(info/exclude)에 .orch-progress/ 를 더했다."
    echo "진입점 문구는 없다. Coordinator 세션은 project Skill로 시작한다. 상태 파일은 hub 저장소에 커밋한다."
    echo "Coordinator·Worker는 실행하지 않았다."
    return 0
  fi
  if [ "$role" = project ] && is_git "$dir"; then add_exclude "$(common_dir "$dir")"; fi
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

# Shared mode in a git repo only; writes when missing, and warns instead of overwriting a pointer to another hub.
write_hub_pointer() { # mode projectDir hub
  [ "$1" = shared ] && is_git "$2" || return 0
  f="$(common_dir "$2")/$hub_pointer"
  if [ -f "$f" ]; then
    [ "$(cat "$f")" = "$3" ] || echo "주의: $f 가 다른 hub($(cat "$f"))를 가리킴. 덮어쓰지 않음"
    return 0
  fi
  printf '%s\n' "$3" > "$f"
  echo "hub 포인터: $f"
}

cmd_register() {
  hub=${1:-}; proj=${2:-}
  [ -d "$hub" ] && [ -d "$proj" ] || die "usage: kit.sh register <hubDir> <projectDir>"
  require_role "$hub" portfolio; hub=$(cd "$hub" && pwd -P)
  loc=$(locate "$proj") || die "$proj: 초기화되지 않음. 먼저 init 실행"
  sroot=${loc#*"$tab"}
  require_role "$sroot" project
  [ -f "$hub/portfolio/PROJECTS.md" ] || die "$hub/portfolio/PROJECTS.md 없음"
  id=$(fm projectId < "$sroot/.ai/ORCHESTRATION.md")
  matches "$id" '^[a-z0-9][a-z0-9-]*$' || die "잘못된 projectId: '$id'"
  path=$(cd "$proj" && pwd)
  if [ "${loc%%"$tab"*}" = personal ]; then
    [ "$sroot" = "$hub/projects/$id" ] || die "$proj: 상태 폴더가 이 hub에 있지 않음: $sroot"
    # Register the main checkout, not whichever worktree the command ran in.
    path=$(dirname "$(common_dir "$proj")")
  fi
  case $path in "$HOME"/*) path="~/${path#"$HOME"/}" ;; esac
  case $path in *"|"*) die "경로에 | 문자가 있어 등록할 수 없음" ;; esac
  rows=$(projects "$hub")
  old=$(printf '%s\n' "$rows" | awk -F'\t' -v id="$id" '$1 == id { print $2; exit }')
  if [ -n "$old" ]; then
    [ "$old" = "$path" ] || die "projectId 충돌: ${id}는 이미 ${old}로 등록됨"
    write_hub_pointer "${loc%%"$tab"*}" "$proj" "$hub"
    echo "이미 등록됨: $id"; return 0
  fi
  other=$(printf '%s\n' "$rows" | awk -F'\t' -v p="$path" '$2 == p { print $1; exit }')
  [ -z "$other" ] || die "같은 경로가 이미 ${other}로 등록됨"
  write_hub_pointer "${loc%%"$tab"*}" "$proj" "$hub"
  [ -z "$(tail -c 1 "$hub/portfolio/PROJECTS.md")" ] || echo >> "$hub/portfolio/PROJECTS.md"
  printf '| %s | %s | active | - |\n' "$id" "$path" >> "$hub/portfolio/PROJECTS.md"
  echo "등록: $id -> $path"
  prefix=$(fm taskPrefix < "$sroot/.ai/ORCHESTRATION.md")
  printf '%s\n' "$rows" | while IFS="$tab" read -r rid rpath _; do
    [ -n "$rid" ] || continue
    rconf="$(project_root "$hub" "$rid" "$rpath")/.ai/ORCHESTRATION.md"
    [ -f "$rconf" ] && [ "$(fm taskPrefix < "$rconf")" = "$prefix" ] &&
      echo "주의: taskPrefix ${prefix}를 ${rid}도 쓴다. 구분하려면 $proj/.ai/ORCHESTRATION.md의 taskPrefix를 바꾼다."
  done || true
}

# Prints the hub of any folder of a Portfolio or project (stdout one line); read-only.
cmd_hub() {
  [ -d "${1:-}" ] || die "usage: kit.sh hub <dir>"
  d=$(cd "$1" && pwd -P)
  if has_schema "$d" && [ "$(fm role < "$d/.ai/ORCHESTRATION.md")" = portfolio ]; then printf '%s\n' "$d"; return 0; fi
  loc=$(locate "$d") || die "$1: 초기화되지 않음 (setup Skill로 초기화)"
  if [ "${loc%%"$tab"*}" = personal ]; then
    h=$(printf '%s\n' "${loc#*"$tab"}" | sed 's|/projects/[^/]*/*$||')
  else
    is_git "$d" && [ -f "$(common_dir "$d")/$hub_pointer" ] || die "$1: hub 포인터 없음 (hub에서 kit.sh register를 다시 실행)"
    h=$(cat "$(common_dir "$d")/$hub_pointer")
  fi
  has_schema "$h" && [ "$(fm role < "$h/.ai/ORCHESTRATION.md")" = portfolio ] || die "$1: hub 포인터가 가리키는 곳이 hub가 아님: $h"
  printf '%s\n' "$h"
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
  hub=$(cd "$hub" && pwd)
  projects "$hub" | while IFS="$tab" read -r id path status _; do
    [ "$status" = active ] || continue
    p=$(project_root "$hub" "$id" "$path")
    if [ ! -f "$p/.ai/ORCHESTRATION.md" ]; then printf 'error\t%s\t-\t%s\n' "$id" "$path/.ai/ORCHESTRATION.md 없음"; continue; fi
    # Personal mode: a report is published once it is committed to the hub's current branch.
    if [ "$p" = "$hub/projects/$id" ]; then ref=HEAD; label=hub; else ref=$(fm reportsRef < "$p/.ai/ORCHESTRATION.md"); label=$path; fi
    if is_git "$p"; then
      git -C "$p" rev-parse --verify --quiet "$ref^{commit}" >/dev/null ||
        { printf 'error\t%s\t-\t%s\n' "$id" "reportsRef '$ref' 커밋 없음"; continue; }
      # --full-name: paths from the repo root, so `git show ref:path` also works for a project in a monorepo subfolder.
      files=$(git -c core.quotePath=false -C "$p" ls-tree --full-name --name-only "$ref" -- .ai/reports/) ||
        { printf 'error\t%s\t-\t%s\n' "$id" "reportsRef '$ref'에서 .ai/reports 읽기 실패"; continue; }
    else
      files=$(cd "$p" && ls .ai/reports/*.md 2>/dev/null || true)
    fi
    printf '%s\n' "$files" | while IFS= read -r f; do
      name=$(basename "$f")
      case $name in .*|*.tmp) continue ;; *.md) ;; *) continue ;; esac
      name=${name%.md}
      [ -e "$hub/handoffs/processed/$name.md" ] && continue
      if is_git "$p"; then
        content=$(git -C "$p" show "$ref:$f" 2>/dev/null) || { printf 'error\t%s\t%s\t%s\n' "$id" "$f" "보고서 읽기 실패"; continue; }
        src="$label@$ref:$f"
      else content=$(cat "$p/$f"); src="$label/$f"; fi
      why=$(printf '%s\n' "$content" | check_report "$id" "$name")
      if [ -n "$why" ]; then printf 'invalid\t%s\t%s\t%s\n' "$id" "$f" "$why"
      else printf 'pending\t%s\t%s\t%s\t%s\n' "$id" "$name" "$(printf '%s\n' "$content" | fm status)" "$src"; fi
    done
  done
}

# --- User decision requests (.ai/user-decisions/<decisionId>.md in a project's state folder) ---
# A Project writes a request; the Kit commands (/decide) write the answer file; `decision-take` takes an answer exactly once.
sha256_of() { # file
  if command -v shasum > /dev/null; then shasum -a 256 "$1" | cut -d' ' -f1; else sha256sum "$1" | cut -d' ' -f1; fi
}
# Names (without .md) of the requests in a folder: temp files, dot files and answer/done/result files are not requests.
request_names() { # dir
  for f in "$1"/*.md; do
    [ -f "$f" ] || continue
    n=${f##*/}
    case $n in .*|*.tmp|*.answer.md|*.done.md|*.result.md) continue ;; esac
    printf '%s\n' "${n%.md}"
  done
}
# One pass over a request on stdin (the board reads every open request, so this is one process, not one per field).
# Args: projectId name. Prints "ok<TAB>createdAt<TAB>epoch<TAB>questions<TAB>irreversible<TAB>title", or "bad<TAB>why".
# The epoch (seconds, the offset applied) orders requests by the moment they were made, not by how their times are written.
# shortcut: no {n} intervals in the patterns, older awks (mawk) lack them.
request_info() {
  # LC_ALL=C: macOS awk compares Korean headings as equal under a UTF-8 locale.
  LC_ALL=C awk -v pid="$1" -v name="$2" '
    function fin(m) { fail = m; exit }
    { sub(/\r$/, "") }
    NR == 1 { if ($0 != "---") fin("머리말이 없음"); inf = 1; next }
    inf { if ($0 == "---") { inf = 0; next }
      i = index($0, ":"); if (i) { k = substr($0, 1, i - 1); v = substr($0, i + 1); sub(/^[ \t]+/, "", v); sub(/[ \t]+#.*$/, "", v); sub(/[ \t]+$/, "", v); if (!(k in fm)) fm[k] = v }
      next }
    /^# / && !title { t = $0; sub(/^# /, "", t); gsub(/\t/, " ", t); title = t; next }
    /^## 질문 [0-9]+/ { q++; sec = "q"; next }
    /^## 실행 내용/ { sec = "x"; hasx = 1; next }
    /^## / { sec = "o"; next }
    sec == "q" && /^[0-9]+\. / { o[q]++ }
    sec == "x" && /[^ \t]/ { xs++ }
    END {
      if (fail == "") {
        n = split("schema decisionId projectId projectTaskId createdAt irreversible", req, " ")
        for (j = 1; j <= n; j++) if (fm[req[j]] == "") { fail = "필드 없음: " req[j]; break } }
      if (fail == "" && fm["schema"] != "user-decision/v1") fail = "schema가 user-decision/v1이 아님"
      if (fail == "" && fm["decisionId"] != name) fail = "파일 이름과 decisionId가 다름"
      if (fail == "" && fm["projectId"] != pid) fail = "projectId가 등록 정보와 다름"
      if (fail == "" && fm["projectTaskId"] !~ /^[A-Z][A-Z0-9]*-[0-9][0-9][0-9][0-9]$/) fail = "projectTaskId 형식 오류"
      if (fail == "" && fm["decisionId"] !~ ("^" fm["projectTaskId"] "-d[0-9][0-9]$")) fail = "decisionId 형식 오류"
      if (fail == "" && fm["createdAt"] !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9](Z|[+-][0-9][0-9]:[0-9][0-9])$/) fail = "createdAt 형식 오류"
      if (fail == "" && fm["irreversible"] != "true" && fm["irreversible"] != "false") fail = "irreversible은 true|false"
      if (fail == "" && q < 1) fail = "질문이 없음"
      if (fail == "" && q > 4) fail = "질문이 4개를 넘음"
      for (j = 1; fail == "" && j <= q; j++) if (o[j] < 2 || o[j] > 4) fail = "질문 " j " 선택지가 " o[j] + 0 "개 (2~4개여야 함)"
      if (fail == "" && fm["irreversible"] == "true" && xs + 0 == 0) fail = "irreversible인데 ## 실행 내용이 없음"
      if (fail != "") { print "bad\t" fail; exit }
      s = fm["createdAt"]; y = substr(s, 1, 4) + 0; m = substr(s, 6, 2) + 0; d = substr(s, 9, 2) + 0
      h = substr(s, 12, 2) + 0; mi = substr(s, 15, 2) + 0; sc = substr(s, 18, 2) + 0; z = substr(s, 20); off = 0
      if (z ~ /^[+-][0-9][0-9]:[0-9][0-9]$/) off = (substr(z, 2, 2) * 3600 + substr(z, 5, 2) * 60) * (substr(z, 1, 1) == "-" ? -1 : 1)
      if (m <= 2) y--
      era = int(y / 400); yoe = y - era * 400; doy = int((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1
      doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
      printf "ok\t%s\t%012.0f\t%d\t%s\t%s\n", s, (era * 146097 + doe - 719468) * 86400 + h * 3600 + mi * 60 + sc - off, q, fm["irreversible"], (title == "" ? "-" : title) }'
}
# Prints why a request is invalid, or nothing when it is valid. Args: projectId name; content on stdin.
check_decision() {
  ri=$(request_info "$1" "$2")
  [ "${ri%%"$tab"*}" = ok ] || printf '%s\n' "${ri#*"$tab"}"
  return 0
}
# The answer lines ("- 질문 N: ...") after the front matter, from stdin.
answer_lines() {
  awk '{ sub(/\r$/, "") } NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { f = 1; next } f' | LC_ALL=C grep '^- 질문 [0-9]*:' | sed 's/[ 	]*$//' || true
}
# Prints why an answer file is not accepted, or nothing when it is. Args: file projectId decisionId digest where(portfolio|project) questions
# A digest that is the only difference prints "stale-request: ..." (the request changed after it was asked).
answer_reason() {
  ac=$(cat "$1")
  aget() { printf '%s\n' "$ac" | fm "$1"; }
  for k in schema decisionId projectId answeredAt recordedBy origin where requestDigest; do
    [ -n "$(aget "$k")" ] || { echo "필드 없음: $k"; return 0; }
  done
  [ "$(aget schema)" = user-decision-answer/v1 ] || { echo "schema가 user-decision-answer/v1이 아님"; return 0; }
  [ "$(aget recordedBy)" = dialog ] || { echo "recordedBy가 dialog가 아님 (결정 명령이 쓴 답만 받는다)"; return 0; }
  [ "$(aget where)" = "$5" ] || { echo "위치: where=$(aget where)인 답이 $5 폴더에 있음"; return 0; }
  case $(aget origin) in composer|bridge) ;; *) echo "origin이 composer|bridge가 아님"; return 0 ;; esac
  [ "$(aget projectId)" = "$2" ] || { echo "projectId가 요청과 다름"; return 0; }
  [ "$(aget decisionId)" = "$3" ] || { echo "decisionId가 요청과 다름"; return 0; }
  an=$(printf '%s\n' "$ac" | answer_lines | wc -l | tr -d ' ')
  [ "$an" = "$6" ] || { echo "답 줄이 ${an}개 (질문 ${6}개)"; return 0; }
  [ "$(aget requestDigest)" = "sha256:$4" ] || { echo "stale-request: 요청 해시가 다름"; return 0; }
  return 0
}
# Board lines for the open requests of one project, each led by a sort key (the cmd_board sorts and strips it):
#   <key><TAB>decision<TAB>projectId<TAB>decisionId<TAB>state<TAB>createdAt<TAB>title<TAB>request file<TAB>hub answer folder
#   <key><TAB>invalid<TAB>projectId<TAB>user-decisions/<file><TAB>reason
# state: waiting | asking (a asking/ marker is there) | answered (an accepted answer) | conflict (two accepted answers differ).
# A request with a done marker is finished and not listed. An answer that fails answer_reason (forged, stale) is not counted.
decision_lines() { # stateRoot projectId hubDir
  ud="$1/.ai/user-decisions"; ad="$3/handoffs/user-decisions/$2"
  [ -d "$ud" ] || return 0
  dnames=$(request_names "$ud")
  while IFS= read -r dn; do
    [ -n "$dn" ] || continue
    [ -e "$ud/$dn.done.md" ] && continue
    ri=$(request_info "$2" "$dn" < "$ud/$dn.md")
    if [ "${ri%%"$tab"*}" != ok ]; then printf '999999999999\tinvalid\t%s\tuser-decisions/%s.md\t%s\n' "$2" "$dn" "${ri#*"$tab"}"; continue; fi
    IFS="$tab" read -r _ created epoch dq _ title <<INFO
$ri
INFO
    state=waiting
    if [ -e "$ud/$dn.answer.md" ] || [ -e "$ad/$dn.answer.md" ]; then
      dd=$(sha256_of "$ud/$dn.md"); v1=; v2=
      if [ -f "$ud/$dn.answer.md" ] && [ -z "$(answer_reason "$ud/$dn.answer.md" "$2" "$dn" "$dd" project "$dq")" ]; then v1=$(answer_lines < "$ud/$dn.answer.md"); fi
      if [ -f "$ad/$dn.answer.md" ] && [ -z "$(answer_reason "$ad/$dn.answer.md" "$2" "$dn" "$dd" portfolio "$dq")" ]; then v2=$(answer_lines < "$ad/$dn.answer.md"); fi
      if [ -n "$v1" ] && [ -n "$v2" ] && [ "$v1" != "$v2" ]; then state=conflict; elif [ -n "$v1$v2" ]; then state=answered; fi
    fi
    if [ "$state" = waiting ] && { [ -d "$ud/$dn.asking" ] || [ -d "$ad/$dn.asking" ]; }; then state=asking; fi
    printf '%s\tdecision\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$epoch" "$2" "$dn" "$state" "$created" "$title" "$ud/$dn.md" "$ad"
  done <<NAMES
$dnames
NAMES
  return 0
}

usage_err() { echo "kit.sh: $*" >&2; exit 2; }
# Creates a done marker only if none exists (set -C), so the first caller wins. Args: file decisionId projectId source outcome digest body
write_done() {
  ( set -C; printf -- '---\nschema: user-decision-done/v1\ndecisionId: %s\nprojectId: %s\ntakenAt: %s\nanswerSource: %s\noutcome: %s\nrequestDigest: sha256:%s\n---\n%s\n' \
    "$2" "$3" "$(now)" "$4" "$5" "$6" "$7" > "$1" ) 2> /dev/null
}
# Takes the answer to a user decision request, once. It reads the answer from the project's state folder (a direct answer, where: project)
# and from the hub (where: portfolio), accepts one only if answer_reason passes, and closes the request with a done marker.
# Exit: 0 taken (stdout: the answer lines) | 1 no accepted answer (stdout: none; stderr: why each file was refused)
#   | 2 bad input | 3 already closed (stdout: the marker, with its outcome) | 4 the two answers differ (marker outcome: conflict)
#   | 5 the request changed after it was asked (marker outcome: stale-request). Only 0 means: go ahead.
cmd_decision_take() {
  dir=${1:-}; id=${2:-}
  [ $# = 2 ] && [ -d "$dir" ] || usage_err "usage: kit.sh decision-take <projectDir> <decisionId>"
  matches "$id" '^[A-Z][A-Z0-9]*-[0-9]{4}-d[0-9]{2}$' || usage_err "잘못된 decisionId: '$id'"
  loc=$(locate "$dir") || usage_err "$dir: 초기화되지 않음 (setup Skill로 초기화)"
  sroot=${loc#*"$tab"}
  [ "$(fm role < "$sroot/.ai/ORCHESTRATION.md")" = project ] || usage_err "$sroot: role이 project가 아님"
  pid=$(fm projectId < "$sroot/.ai/ORCHESTRATION.md")
  ud="$sroot/.ai/user-decisions"; req="$ud/$id.md"
  [ -f "$req" ] || usage_err "$id: 요청 파일이 없음"
  why=$(check_decision "$pid" "$id" < "$req"); [ -z "$why" ] || usage_err "$id: 요청 형식 오류: $why"
  digest=$(sha256_of "$req"); nq=$(request_info "$pid" "$id" < "$req" | cut -f4)
  hub=$(cmd_hub "$dir" 2> /dev/null) || { hub=; echo "kit.sh: hub를 찾지 못해 Portfolio 답은 읽지 않음 (이 프로젝트의 직접 답만 본다)" >&2; }
  ad=; [ -z "$hub" ] || ad="$hub/handoffs/user-decisions/$pid"
  v_pf=; v_pr=; stale=
  for w in portfolio project; do
    if [ "$w" = portfolio ]; then f="$ad/$id.answer.md"; [ -n "$ad" ] || continue; else f="$ud/$id.answer.md"; fi
    [ -f "$f" ] || continue
    r=$(answer_reason "$f" "$pid" "$id" "$digest" "$w" "$nq")
    if [ -z "$r" ]; then
      if [ "$w" = portfolio ]; then v_pf=$(answer_lines < "$f"); else v_pr=$(answer_lines < "$f"); fi
    else
      case $r in stale-request*) stale=1 ;; esac
      echo "kit.sh: 거부 $f: $r" >&2
    fi
  done
  # An answer for this request anywhere else is not read; say so.
  { [ -z "$hub" ] || find "$hub/handoffs" -name "$id.answer.md" -not -path "$ad/*" 2> /dev/null
    find "$sroot/.ai" -name "$id.answer.md" -not -path "$ud/*" 2> /dev/null; } | while IFS= read -r f; do
    echo "kit.sh: 거부 $f: 위치 (답 파일은 $ad/ 또는 $ud/ 에만 둔다)" >&2
  done
  done_file="$ud/$id.done.md"
  # The winner may still be writing the marker the loser is shown.
  already() { w=0; while [ ! -s "$done_file" ] && [ "$w" -lt 40 ]; do sleep 0.05; w=$((w + 1)); done; cat "$done_file"; exit 3; }
  if [ -z "$v_pf$v_pr" ]; then
    if [ -n "$stale" ]; then
      if write_done "$done_file" "$id" "$pid" - stale-request "$digest" '요청이 답을 받은 뒤 바뀜: 새 decisionId로 다시 묻는다'; then echo stale-request; exit 5; fi
      already
    fi
    echo none; exit 1
  fi
  if [ -n "$v_pf" ] && [ -n "$v_pr" ] && [ "$v_pf" != "$v_pr" ]; then
    body="portfolio: $(printf '%s' "$v_pf" | tr '\n' ' ')${nl}project: $(printf '%s' "$v_pr" | tr '\n' ' ')"
    if write_done "$done_file" "$id" "$pid" both conflict "$digest" "$body"; then printf 'conflict\n%s\n' "$body"; exit 4; fi
    already
  fi
  if [ -n "$v_pf" ] && [ -n "$v_pr" ]; then src=both; elif [ -n "$v_pf" ]; then src=portfolio; else src=project; fi
  body=${v_pf:-$v_pr}
  write_done "$done_file" "$id" "$pid" "$src" taken "$digest" "$body" || already
  # An answer typed by hand to a question that cannot be undone is not one of the choices that were shown.
  if [ "$(fm irreversible < "$req")" = true ] && printf '%s\n' "$body" | grep -q '직접 입력:'; then
    echo "kit.sh: irreversible 요청에 직접 입력 답이 있음. 실행하지 말고 다시 묻는다" >&2
  fi
  printf '%s\n' "$body"
  exit 0
}

# Board lines from a Kit task table: blocked rows, rows waiting for review, "row<TAB>id<TAB>status<TAB>cell 4<TAB>cell 6<TAB>cell 2"
# for every task (the board's own use; cell 2, the title, comes last), then "open<TAB>id<TAB>n" (work not done yet).
# Project cells: 1 id, 2 title, 3 status, 4 portfolioTaskId, 6 Orca ref; review is in-review.
# Portfolio cells: 4 priority, 6 report; review is needs-review (a person decides).
task_lines() { # file projectId
  [ -f "$1" ] || { printf 'open\t%s\t0\n' "$2"; return 0; }
  awk -F'|' -v id="$2" '
    BEGIN { rv = "in-review" }
    { sub(/\r$/, "") }
    /^\|/ {
      for (i = 2; i < NF; i++) { c[i - 1] = $i; gsub(/^[ \t]+|[ \t]+$/, "", c[i - 1]); gsub(/\t/, " ", c[i - 1]); if (c[i - 1] == "") c[i - 1] = "-" }
      if (c[1] == "portfolioTaskId") rv = "needs-review"
      if (c[1] ~ /^:?-+:?$/ || c[1] == "projectTaskId" || c[1] == "portfolioTaskId") { split("", c); next }
      s = c[3]; c4 = (4 in c) ? c[4] : "-"; c6 = (6 in c) ? c[6] : "-"
      if (s ~ /^(assigned|accepted|in-progress|in-review|needs-review|blocked)$/) open++
      if (s == "blocked") print "blocked\t" id "\t" c[1] "\t" c[2]
      if (s == rv) print "review\t" id "\t" c[1] "\t" c[2] "\t" c6
      print "row\t" c[1] "\t" s "\t" c4 "\t" c6 "\t" c[2]
      split("", c) }
    END { print "open\t" id "\t" open + 0 }' "$1"
}
# "observedAt<TAB>next work" from STATUS.md: the first item under 다음 업무, else the checkpoint's next safe action.
status_line() { # STATUS.md
  [ -f "$1" ] || { printf '%s\t%s\n' - -; return 0; }
  # LC_ALL=C: macOS awk compares Korean strings by collation and calls different headings equal.
  LC_ALL=C awk '
    { sub(/\r$/, "") }
    /^## / { sec = $0; next }
    sec == "## 다음 업무" && /^- / && nxt == "" { nxt = substr($0, 3) }
    /^- observedAt:/ { obs = $0; sub(/^- observedAt:[ \t]*/, "", obs) }
    /^- 다음 안전한 행동:/ { safe = $0; sub(/^- 다음 안전한 행동:[ \t]*/, "", safe) }
    END { if (nxt == "") nxt = safe; if (obs == "") obs = "-"; if (nxt == "") nxt = "-"; gsub(/\t/, " ", nxt); print obs "\t" nxt }' "$1"
}
# Live Orca workers. A Worker is live while its workerState is not a final one and its liveness is not `exited`:
# terminalState is process accounting (a person taking the terminal over makes it `retained`), so it is not read.
#   worker<TAB>projectId<TAB>projectTaskId<TAB>runId<TAB>state<TAB>provider/model<TAB>terminal<TAB>portfolioTaskId<TAB>title<TAB>liveness<TAB>lastObservedAt (epoch ms)<TAB>activity<TAB>attention
# `-` stands for a value that is not there. Columns 1-7 are the original line; the rest were appended after them.
#   workers<TAB>unknown<TAB>reason (nothing could be read) | workers<TAB>partial<TAB>reason (a Run failed or has more rows than one page)
# worker-list without --run sees only the caller's bound Run, so Runs are read one by one: those whose coordinator terminal is
# live, plus those an open Kit task names (every Run with a coordinator when the terminal list cannot be read).
board_workers() { # lines "projectId<TAB>repo root<TAB>projectTaskId<TAB>Orca ref<TAB>portfolioTaskId<TAB>open 1|0<TAB>title"
  if ! command -v orca > /dev/null || ! command -v jq > /dev/null; then printf 'workers\tunknown\torca 또는 jq 없음\n'; return 0; fi
  # jq reads empty input as success, so the answer is taken first and must say ok.
  if ! j=$(orca_json orchestration run-list); then printf 'workers\tunknown\t%s\n' "$orca_reason"; return 0; fi
  if tl=$(orca_json terminal list); then live=$(printf '%s' "$tl" | jq -c '[.result.terminals[]?.handle]'); else live=null; fi
  named=$(printf '%s\n' "$1" | awk -F'\t' '$6 == 1 { print $4 }' | grep -oE 'run_[a-z0-9]+' | sort -u | jq -R . | jq -sc .)
  runs=$(printf '%s' "$j" | jq -r --argjson live "$live" --argjson named "$named" '.result.runs[]? | select(.coordinator_handle != null)
    | select($live == null or (.coordinator_handle as $h | $live | any(. == $h)) or (.id as $i | $named | any(. == $i))) | .id')
  for r in $runs; do
    if ! wl=$(orca_json orchestration worker-list --run "$r"); then printf '!partial\t%s: 응답 없음\n' "$r"; continue; fi
    [ "$(printf '%s' "$wl" | jq -r '.result.page.hasMore // false')" != true ] || printf '!partial\t%s: 한 쪽을 넘는 Worker가 있음\n' "$r"
    printf '%s' "$wl" | jq -r '.result.workers[]?
      | select(.workerState | test("^(succeeded|failed|cancelled|abandoned|stopped)$") | not)
      | select(.projection.liveness.verdict != "exited")
      | [.runId, .workerState, (.taskId // "-"), (.dispatchId // "-"), ((.projection.provider.id // "-") + "/" + (.projection.provider.model // "-")),
         ((.projection.workspace.id // "") | split("::") | .[1] // "-"), (.agentTerminalHandle // "-"),
         ((.projection.liveness.verdict // "-") + (if .projection.liveness.reason then ":" + .projection.liveness.reason else "" end)),
         ((.projection.evidence.lastObservedAt // "-") | tostring), (.projection.stage.activity // "-"),
         ((.projection.attention.categories // []) | join(",") | if . == "" then "-" else . end)] | @tsv' 2>/dev/null || true
  done | while IFS="$tab" read -r run state task disp model ws term live at act att; do
    if [ "$run" = '!partial' ]; then printf 'workers\tpartial\t%s\n' "$state"; continue; fi
    c=$(common_dir "$ws") || c=; c=${c%/.git}
    # The task whose Orca ref names this Orca task (else this dispatch) exactly ("run_x / task_y / ctx_z"), else the repo's first project.
    # With no repo (the Worktree folder is gone) only the exact link counts, across all projects; no link leaves the project unknown.
    m=$(printf '%s\n' "$1" | awk -F'\t' -v c="$c" -v t="$task" -v d="$disp" '
      c != "" && $2 != c { next }
      c != "" && first == "" { first = $1 }
      { n = split($4, a, /[\/, \t()·;]+/); for (i = 1; i <= n; i++) {
          if (t != "-" && a[i] == t && !tm) tm = $1 "\t" $3 "\t" $5 "\t" $7
          if (d != "-" && a[i] == d && !dm) dm = $1 "\t" $3 "\t" $5 "\t" $7 } }
      END { print (tm ? tm : dm ? dm : (first == "" ? "-" : first) "\t-\t-\t-") }')
    pid=${m%%"$tab"*}; rest=${m#*"$tab"}; ptask=${rest%%"$tab"*}; rest=${rest#*"$tab"}; port=${rest%%"$tab"*}; title=${rest#*"$tab"}
    printf 'worker\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$pid" "$ptask" "$run" "$state" "$model" "$term" "$port" "$title" "$live" "$at" "$act" "$att"
  done
}
# One snapshot for a status view: what needs someone, and every active project. Read-only.
#   project <id> <shared|personal|-> <open tasks> <lastPulled> <observedAt> <next work>
#   blocked <id|portfolio> <taskId> <title> / review <id|portfolio> <taskId> <title> <Orca ref|report> / handoff <id> <PORT> <title>
#   decision <projectId> <decisionId> <waiting|asking|answered|conflict> <createdAt> <title> <request file> <hub answer folder>, then invalid <id> user-decisions/<file> <reason>
#     (open user decision requests in the order they were made, before pending; see decision_lines)
#   pending|invalid|error (as kit.sh pending) / worker (13 columns, see board_workers) / workers unknown|partial <reason>
cmd_board() {
  hub=${1:-}
  [ -d "$hub" ] || die "usage: kit.sh board <hubDir>"
  require_role "$hub" portfolio
  hub=$(cd "$hub" && pwd)
  pt=$(task_lines "$hub/portfolio/TASKS.md" portfolio)
  printf '%s\n' "$pt" | grep -Ev '^(open|row)	' || true
  # PORTs the Portfolio closed keep their outbox file but need no one.
  closed=$(printf '%s\n' "$pt" | awk -F'\t' '$1 == "row" && $3 ~ /^(cancelled|completed)$/ { print $2 }')
  refs=; dl=
  # shortcut: TASKS.md, STATUS.md and the outbox are read from the working tree, while pending reads reportsRef.
  while IFS="$tab" read -r id path status pulled; do
    [ -n "$id" ] && [ "$status" = active ] || continue
    p=$(project_root "$hub" "$id" "$path")
    c=$(common_dir "$(expand_path "$path")") || c=; c=${c%/.git}
    [ -z "$c" ] || refs="$refs$id$tab$c$tab-$tab-$tab-$tab-$tab-$tab-$nl"
    if [ ! -f "$p/.ai/ORCHESTRATION.md" ]; then printf 'project\t%s\t-\t0\t%s\t-\t-\n' "$id" "$pulled"; continue; fi
    if [ "$p" = "$hub/projects/$id" ]; then mode=personal; else mode=shared; fi
    t=$(task_lines "$p/.ai/TASKS.md" "$id")
    open=$(printf '%s\n' "$t" | awk -F'\t' '$1 == "open" { print $3 }')
    printf 'project\t%s\t%s\t%s\t%s\t%s\n' "$id" "$mode" "$open" "$pulled" "$(status_line "$p/.ai/STATUS.md")"
    printf '%s\n' "$t" | grep -Ev '^(open|row)	' || true
    [ -z "$c" ] || refs="$refs$(printf '%s\n' "$t" | awk -F'\t' -v id="$id" -v c="$c" '$1 == "row" { print id "\t" c "\t" $2 "\t" $5 "\t" $4 "\t" ($3 ~ /^(assigned|accepted|in-progress|in-review|needs-review|blocked)$/ ? 1 : 0) "\t" $6 }')$nl"
    # A delegation is accepted once a project task names its portfolioTaskId (the outbox file keeps status: assigned).
    for f in "$hub/handoffs/outbox/$id"/*.md; do
      [ -f "$f" ] || continue
      port=$(fm portfolioTaskId < "$f")
      if [ -n "$port" ]; then
        printf '%s\n' "$closed" | grep -qxF -- "$port" && continue
        printf '%s\n' "$t" | awk -F'\t' -v k="$port" '$1 == "row" && $4 == k { f = 1; exit } END { exit !f }' && continue
      fi
      title=$(awk '/^# / { sub(/^# /, ""); print; exit }' "$f")
      printf 'handoff\t%s\t%s\t%s\n' "$id" "${port:--}" "${title:--}"
    done
    dl="$dl$(decision_lines "$p" "$id" "$hub")$nl"
  done <<ROWS
$(projects "$hub")
ROWS
  # Open user decision requests in the order they were made, before the reports; the sort key leads each line.
  printf '%s\n' "$dl" | grep -v '^$' | LC_ALL=C sort -t "$tab" -k1,1 -k3,3 -k4,4 | cut -f2- || true
  cmd_pending "$hub"
  board_workers "$refs"
}

cmd_mark() {
  hub=${1:-}; id=${2:-}; rid=${3:-}; outcome=${4:-}; note=${5:-}
  [ -d "$hub" ] || die "usage: kit.sh mark <hubDir> <projectId> <reportId> <outcome> [note]"
  require_role "$hub" portfolio
  case $outcome in applied|superseded|needs-review|invalid) ;; *) die "outcome은 applied|superseded|needs-review|invalid" ;; esac
  case $id$rid in *"$nl"*) die "줄바꿈이 든 값은 받지 않음" ;; esac
  matches "$id" '^[a-z0-9][a-z0-9-]*$' || die "잘못된 projectId: '$id'"
  projects "$hub" | cut -f1 | grep -qxF "$id" || die "등록되지 않은 projectId: $id"
  if [ "$outcome" = invalid ]; then
    # Invalid reports may have a malformed name: accept the plain file name (without .md) that pending printed.
    matches "$rid" '^[A-Za-z0-9][A-Za-z0-9._-]*$' || die "파일 이름 형식 오류: $rid"
  else
    matches "$rid" "^$id-[A-Z][A-Z0-9]*-[0-9]{4}-r[0-9]{2}\$" || die "reportId가 projectId와 맞지 않음: $rid"
  fi
  mkdir -p "$hub/handoffs/processed"
  marker="$hub/handoffs/processed/$rid.md"
  [ -e "$marker" ] && { echo "이미 처리됨: $rid"; return 0; }
  (set -C; printf -- '---\nschema: processed-report/v1\nreportId: %s\nprojectId: %s\nprocessedAt: %s\noutcome: %s\n---\n%s\n' \
    "$rid" "$id" "$(now)" "$outcome" "$note" > "$marker")
  echo "처리 마커: handoffs/processed/$rid.md"
}

# Usage readers print "ok<TAB>session%<TAB>weekly%<TAB>5h reset epoch<TAB>limited 0|1<TAB>source" or "fail<TAB>reason".
# None of them calls a model. Thresholds come from the environment so a project Override can change them.
orca_home="$HOME/Library/Application Support/orca"
# A failed read keeps what the tool said on stderr (and stdout for Orca) in a file; when it shows the sandbox refused
# the call, the reason starts with "sandbox: " so a caller can tell "read it again outside" from "not readable".
sandbox_traces='operation not permitted|EPERM|runtime_access_denied'
fail_reason() { # reason traceFile...
  r=$1; shift
  if cat "$@" 2>/dev/null | grep -Eiq "$sandbox_traces"; then r="sandbox: $r"; fi
  printf 'fail\t%s\n' "$r"
}
read_claude() {
  err=$(mktemp "${TMPDIR:-/tmp}/kit-usage.XXXXXX")
  # Claude Code pushes rate_limits to Orca on every reply, so Orca's Claude value is live while a Claude session runs.
  raw=$(orca account list --json 2>>"$err") || true
  printf '%s\n' "$raw" >> "$err"
  line=$(printf '%s\n' "$raw" | jq -r --argjson now "$(date +%s)" --argjson st "${KIT_USAGE_STALE_MIN:-15}" '
    .result.rateLimits.claude // empty | select(.status == "ok" and ($now - .updatedAt / 1000) <= $st * 60)
    | ["ok", (.session.usedPercent // "-"), (.weekly.usedPercent // "-"), ((.session.resetsAt // 0) / 1000 | floor), 0, "orca"] | @tsv' 2>/dev/null) || true
  # Without the Orca pane variables the child session cannot report into (and spoil) the calling pane's status.
  [ -n "$line" ] || line=$(env -u ORCA_PANE_KEY -u ORCA_AGENT_HOOK_PORT -u ORCA_AGENT_HOOK_TOKEN -u ORCA_AGENT_HOOK_ENDPOINT \
    -u ORCA_AGENT_HOOK_ROOT -u ORCA_AGENT_HOOK_ENV -u ORCA_AGENT_HOOK_VERSION -u ORCA_AGENT_HOOK_TRANSPORT \
    claude -p /usage --output-format stream-json --verbose 2>>"$err" | jq -r '
    def ep: if . == null then 0 else sub("\\.[0-9]+"; "") | sub("\\+00:00$"; "Z") | fromdateiso8601 end;
    select(.usage_report?) | .usage_report.rate_limits.limits as $l
    | ($l | map(select(.kind == "session"))[0]) as $s | ($l | map(select(.kind == "weekly_all"))[0]) as $w
    | ["ok", ($s.percent // "-"), ($w.percent // "-"), ($s.resets_at | ep), 0, "claude-cli"] | @tsv' 2>/dev/null) || true
  if [ -n "$line" ]; then printf '%s\n' "$line"; else fail_reason 'Orca 값이 오래됐고 claude /usage도 실패' "$err"; fi
  rm -f "$err"
}
codex_home() { # the account Orca launches Codex with; KIT_CODEX_HOME overrides
  [ -z "${KIT_CODEX_HOME:-}" ] || { printf '%s\n' "$KIT_CODEX_HOME"; return; }
  for f in "$orca_home"/profiles/*/orca-data.json; do
    [ -f "$f" ] || continue
    jq -r '.settings as $s | $s.codexManagedAccounts[]? | select(.id == $s.activeCodexManagedAccountId) | .managedHomePath // empty' "$f" 2>/dev/null && return
  done
}
read_codex() {
  command -v codex >/dev/null || { printf 'fail\tcodex 없음\n'; return; }
  h=$(codex_home) || h=; out=$(mktemp "${TMPDIR:-/tmp}/kit-usage.XXXXXX"); err=$(mktemp "${TMPDIR:-/tmp}/kit-usage.XXXXXX")
  # app-server quits at stdin EOF without answering, so stdin stays open until the answer lands (at most 10 s).
  { printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"orchestration-kit","title":"orchestration-kit","version":"1"}}}' \
      '{"jsonrpc":"2.0","id":2,"method":"account/rateLimits/read","params":{}}'
    i=0; while [ ! -s "$out" ] && [ $i -lt 40 ]; do sleep 0.25; i=$((i + 1)); done
  } | { if [ -n "$h" ]; then CODEX_HOME=$h codex app-server; else codex app-server; fi; } 2>"$err" |
    awk -v f="$out" '/"id": *2[,}]/ { print > f; close(f); exit }' || true
  # Without an Orca account the default ~/.codex account is read: say so in the source column.
  src=codex-app-server; [ -n "$h" ] || src=codex-app-server:default-home
  line=$(jq -r --arg src "$src" '.result // empty | (.rateLimitsByLimitId.codex // .rateLimits) as $r
    | ([$r.primary, $r.secondary] | map(select(. != null))) as $w
    | ($w | map(select(.windowDurationMins == 300))[0]) as $s | ($w | map(select(.windowDurationMins == 10080))[0]) as $k
    | ["ok", ($s.usedPercent // "-"), ($k.usedPercent // "-"), ($s.resetsAt // 0),
       (if .ordinaryUsageAllowed == false or $r.rateLimitReachedType != null then 1 else 0 end), $src] | @tsv' "$out" 2>/dev/null) || true
  rm -f "$out"
  if [ -n "$line" ]; then printf '%s\n' "$line"; else fail_reason 'codex app-server 응답 없음' "$err"; fi
  rm -f "$err"
}
read_agy() {
  command -v agy >/dev/null || { printf 'fail\tagy 없음\n'; return; }
  v=$(agy --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  # Before 1.1.11, agy treats /usage as a prompt and spends quota (Orca stops at the same version).
  printf '%s\n' "$v" | awk -F. '{ exit !($1 > 1 || ($1 == 1 && ($2 > 1 || ($2 == 1 && $3 >= 11)))) }' ||
    { printf 'fail\tagy %s: /usage를 읽지 않음 (1.1.11 이상 필요)\n' "${v:-?}"; return; }
  err=$(mktemp "${TMPDIR:-/tmp}/kit-usage.XXXXXX")
  line=$(agy -p /usage --output-format json --print-timeout 20s 2>"$err" | jq -r '
    select(.num_turns == 0 and .command.name == "usage") | [.command.data.groups[].buckets[]] as $b
    | def worst(w): $b | map(select(.window == w) | . + {used: ((1 - .remaining_fraction) * 100 | round)}) | max_by(.used);
      worst("5h") as $s | worst("weekly") as $k
    | ["ok", ($s.used // "-"), ($k.used // "-"), (if $s then $s.reset_time | sub("\\.[0-9]+"; "") | fromdateiso8601 else 0 end), 0, "agy"] | @tsv' 2>/dev/null) || true
  if [ -n "$line" ]; then printf '%s\n' "$line"; else fail_reason 'agy /usage 실패' "$err"; fi
  rm -f "$err"
}
state_of() { # session weekly limited
  awk -v s="$1" -v w="$2" -v l="$3" -v c="${KIT_USAGE_CAUTION:-70}" -v d="${KIT_USAGE_DANGER:-85}" -v wm="${KIT_USAGE_WEEKLY:-90}" 'BEGIN {
    if (l == 1 || (s != "-" && s + 0 >= d) || (w != "-" && w + 0 >= wm)) print "danger"
    else if (s != "-" && s + 0 >= c) print "caution"; else print "ok" }'
}
check_providers() {
  command -v jq >/dev/null || die "jq 필요"
  for p in "$@"; do case $p in claude|codex|antigravity) ;; *) die "provider는 claude|codex|antigravity: $p" ;; esac; done
}

# Output lines: usage<TAB>provider<TAB>ok|caution|danger<TAB>session%<TAB>weekly%<TAB>min to 5h reset<TAB>source
#             | usage<TAB>provider<TAB>unknown<TAB>-<TAB>-<TAB>-<TAB>reason
cmd_usage() {
  [ $# -gt 0 ] || set -- claude codex antigravity
  check_providers "$@"
  for p in "$@"; do
    case $p in claude) r=$(read_claude) ;; codex) r=$(read_codex) ;; antigravity) r=$(read_agy) ;; esac || r="fail${tab}읽기 오류"
    IFS="$tab" read -r kind s w reset limited src <<EOF
$r
EOF
    if [ "$kind" = ok ]; then
      m=-; [ "$reset" -gt 0 ] 2>/dev/null && m=$(( (reset - $(date +%s)) / 60 ))
      printf 'usage\t%s\t%s\t%s\t%s\t%s\t%s\n' "$p" "$(state_of "$s" "$w" "$limited")" "$s" "$w" "$m" "$src"
    else printf 'usage\t%s\tunknown\t-\t-\t-\t%s\n' "$p" "$s"; fi
  done
}

# Prints nothing until it stops. Stops on: state at or above --until, a projected 100% before the 5h reset
# (rate measured from the first reading, only after a rise of 3 points: values are whole percents, so one
# point right after start inflates the rate), two unreadable readings in a row, or --for minutes.
# Output when it stops: watch<TAB>reason, then the usage lines.
cmd_usage_watch() {
  interval=120; until=caution; minutes=240
  while [ $# -gt 0 ]; do case $1 in
    --interval) interval=$2; shift 2 ;; --until) until=$2; shift 2 ;; --for) minutes=$2; shift 2 ;; *) break ;;
  esac; done
  case $until in caution|danger) ;; *) die "--until은 caution|danger" ;; esac
  [ $# -gt 0 ] || die "usage: kit.sh usage-watch [--interval sec] [--until caution|danger] [--for min] <provider>..."
  check_providers "$@"
  t0=$(date +%s); first=; failed=
  while :; do
    lines=$(cmd_usage "$@"); [ -n "$first" ] || first=$lines
    el=$(( $(date +%s) - t0 ))
    verdict=$(printf '%s\n--\n%s\n' "$first" "$lines" | awk -F'\t' -v until="$until" -v el="$el" -v failed="$failed" '
      $0 == "--" { cur = 1; next }
      !cur { base[$2] = $4; next }
      $4 != "-" && base[$2] != "-" && $4 + 0 < base[$2] + 0 { rebase = 1 }
      $3 == "danger" || ($3 == "caution" && until == "caution") { why = why " " $2 ":" $3; next }
      $3 == "unknown" { if (index(failed, " " $2 " ")) why = why " " $2 ":unknown-twice"; else now = now " " $2 " "; next }
      el > 0 && $4 != "-" && base[$2] != "-" && $6 != "-" && $4 - base[$2] >= 3 {
        p = $4 + ($4 - base[$2]) / el * $6 * 60; if (p >= 100) why = why " " $2 ":projected-" int(p) "%" }
      END { print (why == "" ? "-" : substr(why, 2)) "\t" rebase + 0 "\t" now }')
    why=${verdict%%"$tab"*}; rest=${verdict#*"$tab"}; failed=${rest#*"$tab"}
    # A 5h window rolled over: measure the rate from this reading.
    [ "${rest%%"$tab"*}" = 0 ] || { first=$lines; t0=$(date +%s); }
    [ "$why" = - ] && [ "$el" -lt $((minutes * 60)) ] || { printf 'watch\t%s\n%s\n' "$( [ "$why" = - ] && echo timeout || echo "$why")" "$lines"; return 0; }
    sleep "$interval"
  done
}

# Prints the JSON of an Orca read when it answered ok, else fails. stdin is closed so a caller's loop is not read.
orca_json() { # orca args without --json
  j=$(orca "$@" --json 2>/dev/null </dev/null) && [ "$(printf '%s' "$j" | jq -r '.ok' 2>/dev/null)" = true ] && printf '%s\n' "$j"
}
orca_reason='orca 응답 없음 (sandbox 안이면 밖에서 실행)'

# Agent terminals of one repository and of its worktrees; the terminal a Run names as coordinator_handle is `bound`.
# Read-only. Output: coordinator<TAB>handle<TAB>runId|-<TAB>bound|agent<TAB>title (bound first) | coordinator<TAB>unknown<TAB>reason
# `agent` only means a Claude/Codex/AGY session sits in that repo: whether it is a Coordinator is for a person to judge.
cmd_coordinator() {
  [ -d "${1:-}" ] || die "usage: kit.sh coordinator <projectDir>"
  d=$(cd "$1" && pwd -P); top=$d
  if is_git "$d" && c=$(common_dir "$d"); then top=$(dirname "$c"); fi
  if ! command -v orca >/dev/null || ! command -v jq >/dev/null; then printf 'coordinator\tunknown\torca 또는 jq 없음\n'; return 0; fi
  if ! t=$(orca_json terminal list) || ! r=$(orca_json orchestration run-list) || ! p=$(orca_json repo list); then
    printf 'coordinator\tunknown\t%s\n' "$orca_reason"; return 0
  fi
  rid=$(printf '%s' "$p" | jq -r --arg top "$top" '[.result.repos[]? | select(.path == $top) | .id][0] // ""')
  # run-list is newest first, so reverse it: the newest Run wins when one terminal is named twice.
  runs=$(printf '%s' "$r" | jq -c '[.result.runs[]? | select(.coordinator_handle != null)] | reverse | map({key: .coordinator_handle, value: .id}) | from_entries')
  printf '%s' "$t" | jq -r --arg rid "$rid" --arg top "$top" --arg d "$d" --argjson runs "$runs" '
    [.result.terminals[]? | select(.agentIdentity != null)
      | select(($rid != "" and ((.worktreeId // "") | startswith($rid + "::"))) or .worktreePath == $top or .worktreePath == $d)
      | {h: .handle, run: $runs[.handle], title: ((.title // "-") | gsub("[\t\n\r]"; " "))}]
    | (map(select(.run != null)) + map(select(.run == null)))[]
    | ["coordinator", .h, (.run // "-"), (if .run then "bound" else "agent" end), .title] | @tsv'
}

# Task rows of a Kit project TASKS.md on stdin: "projectTaskId<TAB>status<TAB>report cell".
task_rows() {
  awk -F'|' '/^\|/ {
    for (i = 2; i < NF; i++) { c[i - 1] = $i; gsub(/^[ \t]+|[ \t]+$/, "", c[i - 1]) }
    if (c[1] !~ /^:?-+:?$/ && c[1] != "projectTaskId") print c[1] "\t" c[3] "\t" ((7 in c) ? c[7] : "-")
    split("", c) }'
}
# Runs that still hold Tasks that are not completed. Project: the project whose TASKS.md names the Run in its Orca ref.
audit_runs() { # hub
  if ! command -v orca >/dev/null || ! command -v jq >/dev/null; then printf 'runs\tunknown\torca 또는 jq 없음\n'; return 0; fi
  if ! j=$(orca_json orchestration run-list); then printf 'runs\tunknown\t%s\n' "$orca_reason"; return 0; fi
  # A failed terminal list leaves the live/gone column at - instead of calling every Coordinator gone.
  live=; have_live=
  if tj=$(orca_json terminal list); then live=$(printf '%s' "$tj" | jq -r '.result.terminals[]?.handle'); have_live=1; fi
  rmap=$(projects "$1" | while IFS="$tab" read -r id path _; do
    f="$(project_root "$1" "$id" "$path")/.ai/TASKS.md"; [ -f "$f" ] || continue
    grep -oE 'run_[a-z0-9]+' "$f" | sort -u | sed "s/^/$id$tab/" || true
  done)
  printf '%s' "$j" | jq -r '.result.runs[]? | [.id, (.coordinator_handle // "-"), (.created_at // "-")] | @tsv' |
    while IFS="$tab" read -r run handle created; do
      if t=$(orca_json orchestration task-list --run "$run" --brief); then
        # failed is a finished state in Orca (a cancelled Task is failed too): a Run holding only completed and failed Tasks is not listed.
        # The status column still names every state that is not completed, so a Run with blocked Tasks shows its failed ones too.
        open=$(printf '%s' "$t" | jq -r '[.result.tasks[]? | select(.status != "completed")] as $n
          | if ($n | map(select(.status != "failed")) | length) == 0 then "" else ($n | group_by(.status) | map("\(.[0].status)=\(length)") | join(",")) end')
      else open=unknown; fi
      [ -n "$open" ] || continue
      state=-
      if [ "$handle" != - ] && [ -n "$have_live" ]; then
        if printf '%s\n' "$live" | grep -qxF -- "$handle"; then state=live; else state=gone; fi
      fi
      proj=$(printf '%s\n' "$rmap" | awk -F'\t' -v r="$run" '$2 == r { print $1; exit }')
      printf 'run\t%s\t%s\t%s\t%s\t%s\n' "${proj:--}" "$run" "$created" "$state" "$open"
    done
}
# Drift between a project's TASKS.md and its checkpoint, read from the committed state (reportsRef; the hub's HEAD in personal mode):
#   checkpoint: a status changed after the last commit that touched STATUS.md (a commit that changed TASKS.md alone)
#   unreported: a completed Task whose report cell is empty and that has no report file
audit_drift() { # hub id path
  p=$(project_root "$1" "$2" "$3")
  [ -f "$p/.ai/ORCHESTRATION.md" ] || return 0
  if [ "$p" = "$1/projects/$2" ]; then ref=HEAD; else ref=$(fm reportsRef < "$p/.ai/ORCHESTRATION.md"); fi
  g=; is_git "$p" && git -C "$p" rev-parse --verify --quiet "$ref^{commit}" >/dev/null && g=1
  if [ -n "$g" ]; then
    rows=$(git -C "$p" show "$ref:./.ai/TASKS.md" 2>/dev/null | task_rows || true)
    names=$(git -C "$p" ls-tree --name-only "$ref" -- .ai/reports/ 2>/dev/null || true)
    s=$(git -C "$p" log -1 --format=%H "$ref" -- .ai/STATUS.md)
    obs=$(git -C "$p" show "$ref:./.ai/STATUS.md" 2>/dev/null | awk '/^- observedAt:/ { sub(/^- observedAt:[ \t]*/, ""); print; exit }')
    if [ -n "$s" ] && [ -n "$obs" ] && [ "$obs" != - ]; then
      then_rows=$(git -C "$p" show "$s:./.ai/TASKS.md" 2>/dev/null | task_rows || true)
      if [ "$(printf '%s\n' "$then_rows" | cut -f1,2)" != "$(printf '%s\n' "$rows" | cut -f1,2)" ]; then
        printf 'drift\t%s\tcheckpoint\t%s\t%s\n' "$2" "$(git -C "$p" log -1 --format=%cI "$ref" -- .ai/TASKS.md)" "$obs"
      fi
    fi
  else
    rows=; [ ! -f "$p/.ai/TASKS.md" ] || rows=$(task_rows < "$p/.ai/TASKS.md")
    names=$(ls "$p/.ai/reports" 2>/dev/null || true)
  fi
  printf '%s\n' "$rows" | while IFS="$tab" read -r tid st rep; do
    { [ "$st" = completed ] && { [ -z "$rep" ] || [ "$rep" = - ]; }; } || continue
    matches "$tid" '^[A-Z][A-Z0-9]*-[0-9]{4}$' || continue
    printf '%s\n' "$names" | grep -Eq -- "-$tid-r[0-9]{2}\.md\$" && continue
    printf 'drift\t%s\tunreported\t%s\n' "$2" "$tid"
  done
}
# Read-only; changes nothing in Orca or the hub. Output:
#   run<TAB>projectId|-<TAB>runId<TAB>createdAt<TAB>live|gone|-<TAB>status=count,... (only Runs with an unfinished Task: not completed or failed)
#   runs<TAB>unknown<TAB>reason (Orca did not answer; drift lines still follow)
#   drift<TAB>projectId<TAB>checkpoint<TAB>TASKS.md commit time<TAB>observedAt
#   drift<TAB>projectId<TAB>unreported<TAB>projectTaskId
cmd_audit() {
  hub=${1:-}
  [ -d "$hub" ] || die "usage: kit.sh audit <hubDir>"
  require_role "$hub" portfolio
  hub=$(cd "$hub" && pwd)
  audit_runs "$hub"
  projects "$hub" | while IFS="$tab" read -r id path status _; do
    [ "$status" = active ] || continue
    audit_drift "$hub" "$id" "$path"
  done
}

# The adopt Skill map (.ai/ADOPT.md) and project overlays (.ai/roles/*.md) record their sources under "## 출처":
#   - <path> @ <commit>          a repo file and the commit it was read at
#   - skill <name> @ <where>     a skill: .agents/skills, .claude/skills or plugin (plugin is not checked)
# Prints "none" (no overlays), "ok", or one line per finding: stale<TAB>overlay<TAB>source<TAB>detail,
# new<TAB>skill<TAB>name<TAB>where. Never fails on findings; only bad input dies.
adopt_findings() {
  known=
  for o in "$@"; do
    # LC_ALL=C: macOS awk compares Korean headings as equal under a UTF-8 locale.
    srcs=$(LC_ALL=C awk '/^## /{ on = ($0 == "## 출처"); next } on && /^- /{ sub(/^- /, ""); print }' "$o")
    while IFS= read -r src; do
      case $src in
        "skill "*" @ "*)
          name=${src#skill }; name=${name%% @ *}; where=${src##* @ }; known="$known $name "
          case $where in plugin) ;; *) [ -d "$repo/$where/$name" ] ||
            printf 'stale\t%s\t%s\t%s\n' "${o##*/}" "skill $name" "없어짐: $where/$name" ;; esac ;;
        *" @ "*)
          path=${src% @ *}; at=${src##* @ }
          # .ai/ sources live in the state folder (the hub in personal mode), not in the repo.
          case $path in .ai/*) base=${ai%/.ai} ;; *) base=$repo ;; esac
          if [ ! -e "$base/$path" ]; then printf 'stale\t%s\t%s\t%s\n' "${o##*/}" "$path" "없어짐"; continue; fi
          cur=$(git -C "$base" log -1 --format=%H -- "$path")
          case $cur in "$at"*) ;; *) printf 'stale\t%s\t%s\t%s\n' "${o##*/}" "$path" "$at -> $(printf %.7s "$cur")" ;; esac ;;
      esac
    done <<SRC
$srcs
SRC
  done
  for where in .agents/skills .claude/skills; do
    for sk in "$repo/$where"/*/; do
      [ -d "$sk" ] || continue; name=$(basename "$sk")
      case $known in *" $name "*) ;; *) known="$known $name "; printf 'new\tskill\t%s\t%s\n' "$name" "$where" ;; esac
    done
  done
}

cmd_adopt_check() {
  [ $# = 1 ] && [ -d "$1" ] || die "usage: kit.sh adopt-check <projectDir>"
  repo=$(cd "$1" && pwd)
  loc=$(locate "$repo") || die "$repo: 초기화되지 않음 (setup Skill로 초기화)"
  ai="${loc#*"$tab"}/.ai"; set --
  for o in "$ai/ADOPT.md" "$ai"/roles/*.md; do [ -f "$o" ] && set -- "$@" "$o"; done
  [ $# -gt 0 ] || { echo none; return 0; }
  is_git "$repo" || die "$repo: git 저장소가 아님"
  res=$(adopt_findings "$@")
  if [ -n "$res" ]; then printf '%s\n' "$res"; else echo ok; fi
}

case ${1:-} in
  init) shift; cmd_init "$@" ;;
  where) [ -d "${2:-}" ] || die "usage: kit.sh where <projectDir>"; locate "$2" || die "$2: 초기화되지 않음 (setup Skill로 초기화)" ;;
  register) shift; cmd_register "$@" ;;
  hub) shift; cmd_hub "$@" ;;
  pending) shift; cmd_pending "$@" ;;
  board) shift; cmd_board "$@" ;;
  mark) shift; cmd_mark "$@" ;;
  decision-take) shift; cmd_decision_take "$@" ;;
  usage) shift; cmd_usage "$@" ;;
  usage-watch) shift; cmd_usage_watch "$@" ;;
  coordinator) shift; cmd_coordinator "$@" ;;
  audit) shift; cmd_audit "$@" ;;
  adopt-check) shift; cmd_adopt_check "$@" ;;
  *) awk 'NR > 2 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"; exit 1 ;;
esac

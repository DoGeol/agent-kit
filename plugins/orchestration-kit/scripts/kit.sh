#!/bin/sh
# orchestration-kit helper. Creates missing files only; never overwrites or deletes.
# Usage:
#   kit.sh init project <dir> <projectId> [taskPrefix]
#   kit.sh init portfolio <dir>
#   kit.sh register <hubDir> <projectDir>
#   kit.sh pending <hubDir>
#   kit.sh mark <hubDir> <projectId> <reportId> <applied|superseded|needs-review|invalid> [note]
#   kit.sh usage [claude|codex|antigravity ...]
#   kit.sh usage-watch [--interval sec] [--until caution|danger] [--for min] <provider>...
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
      # No remote default: use the main worktree's branch, not a linked worktree's (a Worker branch).
      [ -n "$ref" ] || ref=$(git -C "$dir" worktree list --porcelain 2>/dev/null | awk '/^$/ { exit } /^branch / { sub("refs/heads/", "", $2); print $2 }')
    fi
    matches "$ref" '^[A-Za-z0-9._/-]+$' || { ref=main; echo "주의: 기준 브랜치를 찾지 못해 reportsRef를 main으로 둔다. .ai/ORCHESTRATION.md에서 확인한다." >&2; }
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
    die "projectId 충돌: ${id}는 이미 ${old}로 등록됨"
  fi
  other=$(printf '%s\n' "$rows" | awk -F'\t' -v p="$path" '$2 == p { print $1; exit }')
  [ -z "$other" ] || die "같은 경로가 이미 ${other}로 등록됨"
  [ -z "$(tail -c 1 "$hub/portfolio/PROJECTS.md")" ] || echo >> "$hub/portfolio/PROJECTS.md"
  printf '| %s | %s | active | - |\n' "$id" "$path" >> "$hub/portfolio/PROJECTS.md"
  echo "등록: $id -> $path"
  prefix=$(fm taskPrefix < "$proj/.ai/ORCHESTRATION.md")
  printf '%s\n' "$rows" | while IFS="$tab" read -r rid rpath _; do
    [ -n "$rid" ] || continue
    rconf="$(expand_path "$rpath")/.ai/ORCHESTRATION.md"
    [ -f "$rconf" ] && [ "$(fm taskPrefix < "$rconf")" = "$prefix" ] &&
      echo "주의: taskPrefix ${prefix}를 ${rid}도 쓴다. 구분하려면 $proj/.ai/ORCHESTRATION.md의 taskPrefix를 바꾼다."
  done || true
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
        src="$path@$ref:$f"
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
read_claude() {
  # Claude Code pushes rate_limits to Orca on every reply, so Orca's Claude value is live while a Claude session runs.
  line=$(orca account list --json 2>/dev/null | jq -r --argjson now "$(date +%s)" --argjson st "${KIT_USAGE_STALE_MIN:-15}" '
    .result.rateLimits.claude // empty | select(.status == "ok" and ($now - .updatedAt / 1000) <= $st * 60)
    | ["ok", (.session.usedPercent // "-"), (.weekly.usedPercent // "-"), ((.session.resetsAt // 0) / 1000 | floor), 0, "orca"] | @tsv' 2>/dev/null) || true
  [ -n "$line" ] || line=$(claude -p /usage --output-format stream-json --verbose 2>/dev/null | jq -r '
    def ep: if . == null then 0 else sub("\\.[0-9]+"; "") | sub("\\+00:00$"; "Z") | fromdateiso8601 end;
    select(.usage_report?) | .usage_report.rate_limits.limits as $l
    | ($l | map(select(.kind == "session"))[0]) as $s | ($l | map(select(.kind == "weekly_all"))[0]) as $w
    | ["ok", ($s.percent // "-"), ($w.percent // "-"), ($s.resets_at | ep), 0, "claude-cli"] | @tsv' 2>/dev/null) || true
  [ -n "$line" ] && printf '%s\n' "$line" || printf 'fail\tOrca 값이 오래됐고 claude /usage도 실패\n'
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
  h=$(codex_home) || h=; out=$(mktemp "${TMPDIR:-/tmp}/kit-usage.XXXXXX")
  # app-server quits at stdin EOF without answering, so stdin stays open until the answer lands (at most 10 s).
  { printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"orchestration-kit","title":"orchestration-kit","version":"1"}}}' \
      '{"jsonrpc":"2.0","id":2,"method":"account/rateLimits/read","params":{}}'
    i=0; while [ ! -s "$out" ] && [ $i -lt 40 ]; do sleep 0.25; i=$((i + 1)); done
  } | { if [ -n "$h" ]; then CODEX_HOME=$h codex app-server; else codex app-server; fi; } 2>/dev/null |
    awk -v f="$out" '/"id": *2[,}]/ { print > f; close(f); exit }' || true
  # Without an Orca account the default ~/.codex account is read: say so in the source column.
  src=codex-app-server; [ -n "$h" ] || src=codex-app-server:default-home
  line=$(jq -r --arg src "$src" '.result // empty | (.rateLimitsByLimitId.codex // .rateLimits) as $r
    | ([$r.primary, $r.secondary] | map(select(. != null))) as $w
    | ($w | map(select(.windowDurationMins == 300))[0]) as $s | ($w | map(select(.windowDurationMins == 10080))[0]) as $k
    | ["ok", ($s.usedPercent // "-"), ($k.usedPercent // "-"), ($s.resetsAt // 0),
       (if .ordinaryUsageAllowed == false or $r.rateLimitReachedType != null then 1 else 0 end), $src] | @tsv' "$out" 2>/dev/null) || true
  rm -f "$out"
  [ -n "$line" ] && printf '%s\n' "$line" || printf 'fail\tcodex app-server 응답 없음\n'
}
read_agy() {
  command -v agy >/dev/null || { printf 'fail\tagy 없음\n'; return; }
  v=$(agy --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  # Before 1.1.11, agy treats /usage as a prompt and spends quota (Orca stops at the same version).
  printf '%s\n' "$v" | awk -F. '{ exit !($1 > 1 || ($1 == 1 && ($2 > 1 || ($2 == 1 && $3 >= 11)))) }' ||
    { printf 'fail\tagy %s: /usage를 읽지 않음 (1.1.11 이상 필요)\n' "${v:-?}"; return; }
  line=$(agy -p /usage --output-format json --print-timeout 20s 2>/dev/null | jq -r '
    select(.num_turns == 0 and .command.name == "usage") | [.command.data.groups[].buckets[]] as $b
    | def worst(w): $b | map(select(.window == w) | . + {used: ((1 - .remaining_fraction) * 100 | round)}) | max_by(.used);
      worst("5h") as $s | worst("weekly") as $k
    | ["ok", ($s.used // "-"), ($k.used // "-"), (if $s then $s.reset_time | sub("\\.[0-9]+"; "") | fromdateiso8601 else 0 end), 0, "agy"] | @tsv' 2>/dev/null) || true
  [ -n "$line" ] && printf '%s\n' "$line" || printf 'fail\tagy /usage 실패\n'
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
# (rate measured from the first reading), two unreadable readings in a row, or --for minutes.
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
      el > 0 && $4 != "-" && base[$2] != "-" && $6 != "-" {
        p = $4 + ($4 - base[$2]) / el * $6 * 60; if (p >= 100) why = why " " $2 ":projected-" int(p) "%" }
      END { print (why == "" ? "-" : substr(why, 2)) "\t" rebase + 0 "\t" now }')
    why=${verdict%%"$tab"*}; rest=${verdict#*"$tab"}; failed=${rest#*"$tab"}
    # A 5h window rolled over: measure the rate from this reading.
    [ "${rest%%"$tab"*}" = 0 ] || { first=$lines; t0=$(date +%s); }
    [ "$why" = - ] && [ "$el" -lt $((minutes * 60)) ] || { printf 'watch\t%s\n%s\n' "$( [ "$why" = - ] && echo timeout || echo "$why")" "$lines"; return 0; }
    sleep "$interval"
  done
}

case ${1:-} in
  init) shift; cmd_init "$@" ;;
  register) shift; cmd_register "$@" ;;
  pending) shift; cmd_pending "$@" ;;
  mark) shift; cmd_mark "$@" ;;
  usage) shift; cmd_usage "$@" ;;
  usage-watch) shift; cmd_usage_watch "$@" ;;
  *) sed -n '3,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

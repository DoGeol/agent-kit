#!/bin/sh
# ok (orchestration kit) helper. Creates missing files only; never overwrites or deletes.
# Usage:
#   ok.sh init <hubDir>
#   ok.sh add <hubDir> <repoDir> <projectId> [--base <branch>] [--title <text>]
#   ok.sh where <dir>
#   ok.sh status <hubDir> [projectId]
#   ok.sh usage [claude|codex|antigravity ...]
#   ok.sh usage-watch [--interval sec] [--until caution|danger] [--for min] <provider>...
#   ok.sh adopt-check <repoDir>
#   ok.sh migrate <hubDir> [--apply]
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
tab=$(printf '\t')

die() { echo "ok.sh: $*" >&2; exit 1; }
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
# First "# " heading of a Markdown file (after frontmatter).
title_of() { awk '/^# / { sub(/^# /, ""); print; exit }' "$1"; }
is_git() { git -C "$1" rev-parse --git-dir >/dev/null 2>&1; }
expand_path() { case $1 in "~/"*) printf '%s/%s\n' "$HOME" "${1#\~/}" ;; *) printf '%s\n' "$1" ;; esac; }
short_path() { case $1 in "$HOME"/*) printf '~/%s\n' "${1#"$HOME"/}" ;; *) printf '%s\n' "$1" ;; esac; }
common_dir() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }
# The main checkout of a repo or of any of its worktrees (Orca worktrees live outside the repo).
main_repo() { c=$(common_dir "$1") || return 1; case $c in */.git) dirname "$c" ;; *) printf '%s\n' "$c" ;; esac; }
need_jq() { command -v jq >/dev/null || die "jq 필요"; }
is_hub() { [ -f "$1/hub.json" ]; }
require_hub() { is_hub "$1" || die "$1: hub.json 없음. 먼저 ok.sh init"; }
# Pointer from a repo to its hub, in the git common dir: never committed, seen from every worktree.
pointer=ok-hub

# Copy one template tree into dest, skipping files that already exist.
put_templates() { # templateDir dest id
  (cd "$1" && find . -type f | sort) | while IFS= read -r rel; do
    rel=${rel#./}; d="$2/$rel"
    if [ -e "$d" ] || [ -L "$d" ]; then echo "skip    $rel (이미 있음)"; continue; fi
    mkdir -p "$(dirname "$d")"
    (set -C; sed -e "s|{{ID}}|$3|g" -e "s|{{NOW}}|$(now)|g" "$1/$rel" > "$d")
    echo "create  $rel"
  done
}

cmd_init() {
  [ $# = 1 ] && [ -d "$1" ] || die "usage: ok.sh init <hubDir>"
  hub=$(cd "$1" && pwd -P)
  put_templates "$root/templates/hub" "$hub" -
  echo "hub: $hub"
  echo "다음: ok.sh add $hub <레포 경로> <projectId>. Coordinator·Worker는 실행하지 않았다."
}

# Keeps Worker output folders out of git status in every worktree. Append only; the user's own entries stay.
add_exclude() { # git common dir
  mkdir -p "$1/info"; ex="$1/info/exclude"
  grep -qxF '.ok/' "$ex" 2>/dev/null && return 0
  [ ! -s "$ex" ] || [ -z "$(tail -c 1 "$ex")" ] || echo >> "$ex"
  echo '.ok/' >> "$ex"
}

# Base branch of a repo: origin's default, else main or master (remote, then local), else the checked-out
# branch with a warning on stderr (it may be a feature branch).
default_base() {
  b=$(git -C "$1" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true); b=${b#origin/}
  if [ -z "$b" ]; then
    for c in refs/remotes/origin/main refs/remotes/origin/master refs/heads/main refs/heads/master; do
      git -C "$1" show-ref --verify --quiet "$c" && { b=${c##*/}; break; }
    done
  fi
  if [ -z "$b" ]; then
    b=$(git -C "$1" branch --show-current)
    echo "주의: $1 의 기본 브랜치를 찾지 못해 지금 브랜치($b)를 기준으로 둔다. 다르면 --base로 다시 준다" >&2
  fi
  printf '%s\n' "$b"
}

cmd_add() {
  [ $# -ge 3 ] || die "usage: ok.sh add <hubDir> <repoDir> <projectId> [--base <branch>] [--title <text>]"
  need_jq; require_hub "$1"; hub=$(cd "$1" && pwd -P); dir=$2; id=$3; shift 3; base=; title=
  while [ $# -gt 0 ]; do case $1 in
    --base) base=${2:-}; shift 2 ;; --title) title=${2:-}; shift 2 ;; *) die "모르는 옵션: $1" ;;
  esac; done
  matches "$id" '^[a-z0-9][a-z0-9-]*$' || die "projectId는 소문자 kebab-case: '$id'"
  [ -d "$dir" ] && is_git "$dir" || die "$dir: git 저장소가 아님"
  repo=$(main_repo "$dir") || die "$dir: git 공통 폴더를 찾지 못함"
  [ -n "$base" ] || base=$(default_base "$repo")
  matches "$base" '^[A-Za-z0-9._/-]+$' || die "기준 브랜치를 찾지 못함. --base로 준다"
  short=$(short_path "$repo")
  old=$(jq -r --arg id "$id" '.projects[] | select(.id == $id) | .repo' "$hub/hub.json")
  other=$(jq -r --arg r "$short" --arg id "$id" '.projects[] | select(.repo == $r and .id != $id) | .id' "$hub/hub.json")
  [ -z "$other" ] || die "같은 레포가 이미 ${other}로 등록됨"
  if [ -n "$old" ]; then
    [ "$old" = "$short" ] || die "projectId 충돌: ${id}는 이미 ${old}로 등록됨"
    echo "이미 등록됨: $id"
  else
    tmp=$(mktemp "$hub/.hub.json.XXXXXX")
    jq --arg id "$id" --arg t "${title:-$id}" --arg r "$short" --arg b "$base" \
      '.projects += [{id: $id, title: $t, repo: $r, base: $b}]' "$hub/hub.json" > "$tmp" && mv "$tmp" "$hub/hub.json"
    echo "등록: $id -> $short (기준 $base)"
  fi
  put_templates "$root/templates/project" "$hub/projects/$id" "$id"
  c=$(common_dir "$repo")
  if [ -f "$c/$pointer" ] && [ "$(cat "$c/$pointer")" != "$hub" ]; then
    echo "주의: $c/$pointer 가 다른 hub($(cat "$c/$pointer"))를 가리킴. 덮어쓰지 않음"
  else
    [ -f "$c/$pointer" ] || printf '%s\n' "$hub" > "$c/$pointer"
  fi
  add_exclude "$c"
  echo "레포의 추적 파일은 바꾸지 않았다. git 공통 폴더에 hub 포인터, info/exclude에 .ok/ 를 더했다."
}

# Prints "hub<TAB>projectId<TAB>repo<TAB>base" for a repo, any of its worktrees, or the hub itself (projectId -).
cmd_where() {
  [ $# = 1 ] && [ -d "$1" ] || die "usage: ok.sh where <dir>"
  need_jq; d=$(cd "$1" && pwd -P)
  if is_hub "$d"; then printf '%s\t-\t-\t-\n' "$d"; return 0; fi
  is_git "$d" || die "$1: git 저장소도 hub도 아님"
  repo=$(main_repo "$d"); c=$(common_dir "$d"); hub=${OK_HUB:-}
  [ -n "$hub" ] || { [ -f "$c/$pointer" ] && hub=$(cat "$c/$pointer"); } || true
  [ -n "$hub" ] || die "$1: hub를 모름 (hub에서 ok.sh add를 실행하거나 OK_HUB를 준다)"
  require_hub "$hub"
  jq -r --arg home "$HOME" --arg repo "$repo" '.projects[]
    | select((.repo | if startswith("~/") then $home + .[1:] else . end) == $repo)
    | [.id, .base] | @tsv' "$hub/hub.json" | head -1 | {
    IFS="$tab" read -r id base || die "$repo: $hub 에 등록되지 않음"
    printf '%s\t%s\t%s\t%s\n' "$hub" "$id" "$repo" "$base"
  }
}

# Read-only summary. Lines:
#   project<TAB>id<TAB>repo<TAB>status.md updated
#   task<TAB>id<TAB>slug<TAB>status<TAB>track<TAB>tier<TAB>title        (not completed/cancelled)
#   decision<TAB>id<TAB>file<TAB>title                                   (status: open)
#   report<TAB>id<TAB>file<TAB>outcome                                   (applied: false)
cmd_status() {
  [ $# -ge 1 ] || die "usage: ok.sh status <hubDir> [projectId]"
  need_jq; require_hub "$1"; hub=$(cd "$1" && pwd -P)
  jq -r --arg id "${2:-}" '.projects[] | select($id == "" or .id == $id) | [.id, .repo] | @tsv' "$hub/hub.json" |
  while IFS="$tab" read -r id repo; do
    p="$hub/projects/$id"
    printf 'project\t%s\t%s\t%s\n' "$id" "$repo" "$( [ -f "$p/status.md" ] && fm updated < "$p/status.md" || echo -)"
    for f in "$p"/tasks/*.md; do
      [ -f "$f" ] || continue
      s=$(fm status < "$f"); case $s in completed|cancelled) continue ;; esac
      printf 'task\t%s\t%s\t%s\t%s\t%s\t%s\n' "$id" "$(basename "$f" .md)" "${s:--}" "$(fm track < "$f")" "$(fm tier < "$f")" "$(fm title < "$f")"
    done
    for f in "$p"/decisions/*.md; do
      [ -f "$f" ] && [ "$(fm status < "$f")" = open ] || continue
      printf 'decision\t%s\t%s\t%s\n' "$id" "$(basename "$f")" "$(title_of "$f")"
    done
    for f in "$p"/reports/*.md; do
      [ -f "$f" ] && [ "$(fm applied < "$f")" = false ] || continue
      printf 'report\t%s\t%s\t%s\n' "$id" "$(basename "$f")" "$(fm outcome < "$f")"
    done
  done
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
  err=$(mktemp "${TMPDIR:-/tmp}/ok-usage.XXXXXX")
  # Claude Code pushes rate_limits to Orca on every reply, so Orca's Claude value is live while a Claude session runs.
  raw=$(orca account list --json 2>>"$err") || true
  printf '%s\n' "$raw" >> "$err"
  line=$(printf '%s\n' "$raw" | jq -r --argjson now "$(date +%s)" --argjson st "${OK_USAGE_STALE_MIN:-15}" '
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
codex_home() { # the account Orca launches Codex with; OK_CODEX_HOME overrides
  [ -z "${OK_CODEX_HOME:-}" ] || { printf '%s\n' "$OK_CODEX_HOME"; return; }
  for f in "$orca_home"/profiles/*/orca-data.json; do
    [ -f "$f" ] || continue
    jq -r '.settings as $s | $s.codexManagedAccounts[]? | select(.id == $s.activeCodexManagedAccountId) | .managedHomePath // empty' "$f" 2>/dev/null && return
  done
}
read_codex() {
  command -v codex >/dev/null || { printf 'fail\tcodex 없음\n'; return; }
  h=$(codex_home) || h=; out=$(mktemp "${TMPDIR:-/tmp}/ok-usage.XXXXXX"); err=$(mktemp "${TMPDIR:-/tmp}/ok-usage.XXXXXX")
  # app-server quits at stdin EOF without answering, so stdin stays open until the answer lands (at most 10 s).
  { printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"ok","title":"ok","version":"1"}}}' \
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
  err=$(mktemp "${TMPDIR:-/tmp}/ok-usage.XXXXXX")
  line=$(agy -p /usage --output-format json --print-timeout 20s 2>"$err" | jq -r '
    select(.num_turns == 0 and .command.name == "usage") | [.command.data.groups[].buckets[]] as $b
    | def worst(w): $b | map(select(.window == w) | . + {used: ((1 - .remaining_fraction) * 100 | round)}) | max_by(.used);
      worst("5h") as $s | worst("weekly") as $k
    | ["ok", ($s.used // "-"), ($k.used // "-"), (if $s then $s.reset_time | sub("\\.[0-9]+"; "") | fromdateiso8601 else 0 end), 0, "agy"] | @tsv' 2>/dev/null) || true
  if [ -n "$line" ]; then printf '%s\n' "$line"; else fail_reason 'agy /usage 실패' "$err"; fi
  rm -f "$err"
}
state_of() { # session weekly limited
  awk -v s="$1" -v w="$2" -v l="$3" -v c="${OK_USAGE_CAUTION:-70}" -v d="${OK_USAGE_DANGER:-85}" -v wm="${OK_USAGE_WEEKLY:-90}" 'BEGIN {
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
  [ $# -gt 0 ] || die "usage: ok.sh usage-watch [--interval sec] [--until caution|danger] [--for min] <provider>..."
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
          # hub: sources live in the hub (projects/<id>/...), not in the repo.
          case $path in hub:*) base=$hub; path=${path#hub:} ;; *) base=$repo ;; esac
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
  [ $# = 1 ] && [ -d "$1" ] || die "usage: ok.sh adopt-check <repoDir>"
  w=$(cmd_where "$1") || exit 1
  hub=${w%%"$tab"*}; rest=${w#*"$tab"}; id=${rest%%"$tab"*}
  [ "$id" != - ] || die "$1: hub가 아니라 프로젝트 레포에서 실행한다"
  repo=$(cd "$1" && git rev-parse --show-toplevel); state="$hub/projects/$id"; set --
  for o in "$state/ADOPT.md" "$state"/roles/*.md; do [ -f "$o" ] && set -- "$@" "$o"; done
  [ $# -gt 0 ] || { echo none; return 0; }
  res=$(adopt_findings "$@")
  if [ -n "$res" ]; then printf '%s\n' "$res"; else echo ok; fi
}

# One-time move of an old orchestration-kit hub (portfolio/, handoffs/, .ai/) to the ok layout.
# Preview by default; --apply makes the changes. Old files move to archive/ inside the hub and are never deleted.
# Project repos keep their files: only the hub pointer and the .ok/ exclude line are added (as in `add`).
cmd_migrate() {
  [ $# -ge 1 ] && [ -d "$1" ] || die "usage: ok.sh migrate <hubDir> [--apply]"
  need_jq; hub=$(cd "$1" && pwd -P); apply=; [ "${2:-}" = --apply ] && apply=1
  [ -f "$hub/portfolio/PROJECTS.md" ] || die "$hub: 옛 Kit hub가 아님 (portfolio/PROJECTS.md 없음)"
  day=$(date +%Y-%m-%d)
  [ -n "$apply" ] || echo "미리보기 (바꾸지 않음). 적용하려면 --apply"
  if [ ! -f "$hub/hub.json" ]; then
    echo "create  hub.json"; [ -z "$apply" ] || put_templates "$root/templates/hub" "$hub" - >/dev/null
  fi
  for f in AGENTS.md CLAUDE.md; do
    [ -f "$hub/$f" ] && grep -q 'portfolio' "$hub/$f" &&
      echo "주의: $f 가 옛 Kit(portfolio)를 가리킴. 직접 고친다 (새 문구: $root/templates/hub/$f)"
  done
  rows=$(awk -F'|' '/^\|/ {
    for (i = 2; i <= 4; i++) gsub(/^[ \t]+|[ \t]+$/, "", $i)
    if ($2 == "projectId" || $2 ~ /^-+$/ || $2 == "") next
    print $2 "\t" $3 "\t" $4 }' "$hub/portfolio/PROJECTS.md")
  printf '%s\n' "$rows" | while IFS="$tab" read -r id path pstatus; do
    [ -n "$id" ] || continue
    repo=$(expand_path "$path")
    if [ -f "$hub/projects/$id/.ai/ORCHESTRATION.md" ]; then ai="$hub/projects/$id/.ai"; mode=personal
    else ai="$repo/.ai"; mode=shared; fi
    base=$(fm reportsRef < "$ai/ORCHESTRATION.md" 2>/dev/null || true); base=${base#origin/}
    [ -n "$base" ] && [ "$base" != - ] || base=
    shown=$base; [ -n "$shown" ] || { [ -d "$repo" ] && is_git "$repo" && shown=$(default_base "$(main_repo "$repo")"); } || true
    echo "project $id ($mode, $pstatus) $path 기준 ${shown:-?}"
    if [ -n "$apply" ]; then
      if [ -d "$repo" ]; then
        out=$(cmd_add "$hub" "$repo" "$id" ${base:+--base "$base"}) || die "등록 실패: $id ($path). 위 오류를 고치고 다시 실행한다"
        printf '%s\n' "$out" | sed 's/^/  /'
      else echo "  주의: 레포 없음, 등록 건너뜀: $path"; continue; fi
    fi
    p="$hub/projects/$id"
    [ -f "$ai/TASKS.md" ] && awk -F'|' '/^\|/ {
      for (i = 2; i <= 5; i++) gsub(/^[ \t]+|[ \t]+$/, "", $i)
      if ($2 == "projectTaskId" || $2 ~ /^-+$/ || $2 == "") next
      if ($4 == "completed" || $4 == "cancelled") next
      for (i = 2; i <= 5; i++) if ($i == "") $i = "-"
      print $2 "\t" $3 "\t" $4 "\t" $5 }' "$ai/TASKS.md" | while IFS="$tab" read -r tid ttitle tst port; do
      write_task "$p" "$tid" "$ttitle" "$tst" "kit에서 옮김: $tid${port:+ / $port}. 옛 기록: $( [ $mode = personal ] && echo archive/kit-ai/TASKS.md || echo "$path/.ai/TASKS.md")"
    done
    for src in "$ai/ADOPT.md" "$ai/DESIGN-PRINCIPLES.md" "$ai"/roles/*.md; do
      [ -f "$src" ] || continue
      rel=${src#"$ai"/}
      if [ -e "$p/$rel" ]; then echo "  skip    $rel (이미 있음)"; continue; fi
      echo "  copy    .ai/$rel -> projects/$id/$rel"
      [ -z "$apply" ] || { mkdir -p "$(dirname "$p/$rel")"; cp "$src" "$p/$rel"; }
    done
    if [ $mode = personal ]; then
      echo "  move    projects/$id/.ai -> projects/$id/archive/kit-ai"
      [ -z "$apply" ] || { [ ! -e "$p/archive/kit-ai" ] || die "$p/archive/kit-ai 이미 있음"; mkdir -p "$p/archive"; mv "$ai" "$p/archive/kit-ai"; }
    else
      echo "  그대로  $path/.ai/ (팀 저장소 파일이라 지울지는 사용자가 정한다)"
    fi
  done || exit 1
  # Portfolio items no project picked up yet become planned tasks of their project.
  awk -F'|' '/^\|/ {
    for (i = 2; i <= 8; i++) gsub(/^[ \t]+|[ \t]+$/, "", $i)
    if ($2 !~ /^PORT-[0-9]+$/ || ($4 != "backlog" && $4 != "assigned") || index($6, "(")) next
    for (i = 2; i <= 8; i++) if ($i == "") $i = "-"
    print $2 "\t" $3 "\t" $6 "\t" $8 }' "$hub/portfolio/TASKS.md" | while IFS="$tab" read -r pid ptitle proj memo; do
    if [ "$proj" = - ] || { [ -n "$apply" ] && ! jq -e --arg id "$proj" 'any(.projects[]; .id == $id)' "$hub/hub.json" >/dev/null; }; then
      echo "주의: $pid 의 프로젝트 $proj 가 등록되지 않음. 건너뜀"; continue
    fi
    write_task "$hub/projects/$proj" "$pid" "$ptitle" planned "Portfolio에서 옮김: $pid. 메모: $memo"
  done
  # portfolio/ moves last: while it is still here a failed run can be repeated.
  for old in handoffs .ai portfolio; do
    [ -e "$hub/$old" ] || continue
    echo "move    $old -> archive/kit/$old"
    [ -z "$apply" ] || { [ ! -e "$hub/archive/kit/$old" ] || die "archive/kit/$old 이미 있음"; mkdir -p "$hub/archive/kit"; mv "$hub/$old" "$hub/archive/kit/$old"; }
  done
  [ -z "$apply" ] || echo "끝. 옛 결정·보고는 archive/ 안에만 있어 status에 보이지 않는다. hub가 git 저장소면 변경을 확인하고 커밋한다."
}

write_task() { # projectDir oldId title oldStatus note
  slug=$(printf '%s' "$2" | tr '[:upper:]' '[:lower:]'); f="$1/tasks/$slug.md"
  case $4 in backlog|planned) s=planned ;; failed) s=blocked ;; *) s=$4 ;; esac
  rel=${f#"$hub"/}
  if [ -e "$f" ]; then echo "  skip    $rel (이미 있음)"; return 0; fi
  echo "  create  $rel ($s) $3"
  [ -n "$apply" ] || return 0
  mkdir -p "$1/tasks"
  (set -C; printf -- '---\nid: %s\ntitle: %s\nstatus: %s\ntrack:\nrisk:\nsize:\ntier:\nowner: coordinator\nsessions: []\nagents: []\ndepends: []\nbranch:\nworktree:\ncreated: %s\nupdated: %s\n---\n# %s\n\n%s\n' \
    "$slug" "$3" "$s" "$day" "$day" "$3" "$5" > "$f")
}

case ${1:-} in
  init) shift; cmd_init "$@" ;;
  add) shift; cmd_add "$@" ;;
  where) shift; cmd_where "$@" ;;
  status) shift; cmd_status "$@" ;;
  usage) shift; cmd_usage "$@" ;;
  usage-watch) shift; cmd_usage_watch "$@" ;;
  adopt-check) shift; cmd_adopt_check "$@" ;;
  migrate) shift; cmd_migrate "$@" ;;
  *) awk 'NR > 2 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"; exit 1 ;;
esac

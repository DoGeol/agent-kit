#!/bin/sh
# Local checks for orchestration-kit. Usage: tests/run.sh   (exits 1 on the first failure)
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
kit="$root/scripts/kit.sh"
tmp=$(mktemp -d "${TMPDIR:-/tmp}/orchkit.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok   $*"; }
snap() { (cd "$1" && find . -type f -not -path './.git/*' | sort | while IFS= read -r f; do cksum "$f"; done); }
git_commit() { git -C "$1" add -A && git -C "$1" -c user.name=test -c user.email=test@example.com commit -qm "$2"; }

# 1. Skill frontmatter: name and description only, name matches the folder
for s in "$root"/skills/*/SKILL.md; do
  dir=$(basename "$(dirname "$s")")
  keys=$(awk 'NR == 1 { next } /^---$/ { exit } /^[A-Za-z]/ { sub(/:.*/, ""); print }' "$s" | sort | tr '\n' ' ')
  [ "$keys" = "description name " ] || fail "$s frontmatter keys: $keys"
  grep -q "^name: $dir\$" "$s" || fail "$s name != $dir"
done
[ "$(ls -d "$root"/skills/*/ | wc -l | tr -d ' ')" = 3 ] || fail "expected 3 skills"
ok "skill frontmatter (portfolio, project, setup)"

# 2. Relative Markdown links resolve inside the plugin
find "$root" -name '*.md' -not -path '*/tests/*' | while IFS= read -r f; do
  grep -o '\](\([^)]*\))' "$f" | sed 's/^](//; s/)$//; s/#.*//' | while IFS= read -r link; do
    case $link in ''|http*|mailto:*) continue ;; esac
    [ -e "$(dirname "$f")/$link" ] || fail "$f: broken link $link"
    case $(cd "$(dirname "$f")" && cd "$(dirname "$link")" && pwd) in "$root"*) ;; *) fail "$f: link leaves plugin: $link" ;; esac
  done
done
ok "policy and template links resolve inside the plugin"

# 3a. sh reads a non-ASCII byte after $name as part of the name; scripts must brace such expansions
if LC_ALL=C grep -nE '\$[A-Za-z_][A-Za-z0-9_]*[^ -~]' "$root"/scripts/*.sh; then fail "unbraced \$name before non-ASCII text"; fi
ok "variable expansions before Korean text are braced"

# 3. No personal paths or secrets-looking strings
if grep -rnE '/Users/|/home/[a-z]|api[_-]?key *[:=]' "$root" --exclude=run.sh; then fail "personal path or key"; fi
ok "no personal paths"

# 4. Report template and fixtures carry the protocol fields
for k in schema reportId projectId portfolioTaskId projectTaskId origin status verifiedAt coordinator; do
  grep -q "^$k: " "$root/templates/reports/project-report.md" || fail "report template missing $k"
done
for k in schema portfolioTaskId projectId origin status priority createdAt; do
  grep -q "^$k: " "$root/templates/handoffs/portfolio-task.md" || fail "delegation template missing $k"
  grep -q "^$k: " "$root/tests/fixtures/PORT-0001.md" || fail "delegation fixture missing $k"
done
for h in Summary Changes 'Acceptance evidence' Decisions 'Risks / Blockers' Follow-ups References; do
  grep -q "^## $h\$" "$root/templates/reports/project-report.md" || fail "report template missing section $h"
done
ok "templates match protocol fields"

# 4a. Role profiles: listed in policies/roles.md, required sections, short enough to inline in a spec
for r in "$root"/roles/*.md; do
  id=$(basename "$r" .md)
  head -1 "$r" | grep -q "^# $id: " || fail "$r title must start with '# $id: '"
  grep -q '^기본 등급: ' "$r" || fail "$r missing 기본 등급"
  for h in 관점 산출물 '수용 기준' '하지 않는 것'; do grep -q "^## $h\$" "$r" || fail "$r missing section $h"; done
  grep -q -- '- \[ \] ' "$r" || fail "$r has no acceptance checklist"
  [ "$(wc -l < "$r")" -le 40 ] || fail "$r longer than 40 lines"
  grep -q "](../roles/$id.md)" "$root/policies/roles.md" || fail "$id not listed in policies/roles.md"
done
ok "role profiles ($(ls "$root"/roles/*.md | wc -l | tr -d ' ')) have required sections and are listed"

# 5. Project init keeps existing files and is idempotent
app="$tmp/app"; mkdir -p "$app/.ai"
git -C "$app" init -q -b main
printf 'project rules\n' > "$app/CLAUDE.md"
printf 'agent rules\n' > "$app/AGENTS.md"
printf 'my status\n' > "$app/.ai/STATUS.md"
git_commit "$app" init
printf 'uncommitted\n' > "$app/notes.txt"
before=$(snap "$app")
"$kit" init project "$app" sample-app > "$tmp/init.out"
grep -q 'skip    .ai/STATUS.md' "$tmp/init.out" || fail "existing STATUS.md not skipped"
git -C "$app" diff --quiet || fail "tracked files changed"
[ "$(cat "$app/CLAUDE.md")" = 'project rules' ] && [ "$(cat "$app/AGENTS.md")" = 'agent rules' ] || fail "entry files changed"
[ "$(cat "$app/.ai/STATUS.md")" = 'my status' ] && [ "$(cat "$app/notes.txt")" = uncommitted ] || fail "existing files changed"
printf '%s\n' "$before" | while IFS= read -r line; do snap "$app" | grep -qxF "$line" || fail "changed: $line"; done
for f in ORCHESTRATION.md PROJECT.md ARCHITECTURE.md TASKS.md decisions/.gitkeep reports/.gitkeep; do
  [ -f "$app/.ai/$f" ] || fail "missing .ai/$f"
done
grep -q '^projectId: sample-app$' "$app/.ai/ORCHESTRATION.md" && grep -q '^taskPrefix: SAMPLE$' "$app/.ai/ORCHESTRATION.md" \
  && grep -q '^reportsRef: main$' "$app/.ai/ORCHESTRATION.md" || fail "ORCHESTRATION.md values"
if grep -rq '{{' "$app/.ai"; then fail "unreplaced placeholder"; fi
once=$(snap "$app"); "$kit" init project "$app" sample-app > /dev/null
[ "$once" = "$(snap "$app")" ] || fail "second init changed files"
ok "project init: existing CLAUDE.md, AGENTS.md, .ai/STATUS.md, uncommitted file preserved; rerun changes nothing"

# 6. Init refuses bad input and role or ID changes
if "$kit" init project "$app" other-app > /dev/null 2>&1; then fail "projectId change accepted"; fi
if "$kit" init portfolio "$app" > /dev/null 2>&1; then fail "role change accepted"; fi
mkdir "$tmp/bad"
if "$kit" init project "$tmp/bad" Bad_Id > /dev/null 2>&1; then fail "invalid projectId accepted"; fi
[ -z "$(ls -A "$tmp/bad")" ] || fail "rejected init wrote files"
ok "init rejects projectId change, role change, invalid projectId"

# 7. Portfolio init and registration without duplicates
hub="$tmp/hub"; mkdir "$hub"
"$kit" init portfolio "$hub" > /dev/null
for f in .ai/ORCHESTRATION.md portfolio/PROJECTS.md portfolio/TASKS.md portfolio/DASHBOARD.md portfolio/PRIORITIES.md handoffs/outbox/.gitkeep handoffs/processed/.gitkeep; do
  [ -f "$hub/$f" ] || fail "missing $f"
done
"$kit" register "$hub" "$app" > /dev/null
"$kit" register "$hub" "$app" | grep -q '이미 등록됨' || fail "re-register not idempotent"
[ "$(grep -c '^| sample-app |' "$hub/portfolio/PROJECTS.md")" = 1 ] || fail "duplicate project row"
dup="$tmp/dup"; mkdir "$dup"; "$kit" init project "$dup" sample-app > /dev/null
if "$kit" register "$hub" "$dup" > "$tmp/reg.err" 2>&1; then fail "projectId conflict accepted"; fi
grep -q "projectId 충돌: sample-app는 이미" "$tmp/reg.err" || fail "conflict message: $(cat "$tmp/reg.err")"
api="$tmp/api"; mkdir "$api"; "$kit" init project "$api" sample-api > /dev/null
"$kit" register "$hub" "$api" | grep -q '주의: taskPrefix SAMPLE를 sample-app도 쓴다' || fail "taskPrefix clash not warned"
ok "portfolio init; register is idempotent, rejects projectId conflicts, warns on shared taskPrefix"

# 8. Delegation to report to pull, with duplicate protection
mkdir -p "$hub/handoffs/outbox/sample-app"
cp "$root/tests/fixtures/PORT-0001.md" "$hub/handoffs/outbox/sample-app/"
[ -z "$("$kit" pending "$hub")" ] || fail "pending before any report"
cp "$root/tests/fixtures/sample-app-SAMPLE-0001-r01.md" "$app/.ai/reports/"
[ -z "$("$kit" pending "$hub")" ] || fail "uncommitted report listed"
git_commit "$app" report
out=$("$kit" pending "$hub")
printf '%s\n' "$out" | grep -q "^pending	sample-app	sample-app-SAMPLE-0001-r01	completed	" || fail "report not pending: $out"
sed 's/^status: completed$/status: done/' "$root/tests/fixtures/sample-app-SAMPLE-0001-r01.md" | sed 's/r01$/r02/' > "$app/.ai/reports/sample-app-SAMPLE-0001-r02.md"
sed 's/^reportId: .*/reportId: wrong-id/' "$root/tests/fixtures/sample-app-SAMPLE-0001-r01.md" > "$app/.ai/reports/sample-app-SAMPLE-0002-r01.md"
git_commit "$app" bad-reports
out=$("$kit" pending "$hub")
printf '%s\n' "$out" | grep -q '^invalid	sample-app	.ai/reports/sample-app-SAMPLE-0001-r02.md	모르는 status' || fail "bad status not flagged: $out"
printf '%s\n' "$out" | grep -q '^invalid	sample-app	.ai/reports/sample-app-SAMPLE-0002-r01.md	파일 이름과 reportId가 다름' || fail "bad id not flagged: $out"
"$kit" mark "$hub" sample-app sample-app-SAMPLE-0001-r01 applied 'PORT-0001: in-progress -> completed' > /dev/null
marker="$hub/handoffs/processed/sample-app-SAMPLE-0001-r01.md"
grep -q '^outcome: applied$' "$marker" || fail "marker content"
m1=$(cksum < "$marker")
"$kit" mark "$hub" sample-app sample-app-SAMPLE-0001-r01 needs-review | grep -q '이미 처리됨' || fail "second mark not idempotent"
[ "$m1" = "$(cksum < "$marker")" ] || fail "marker overwritten"
if "$kit" pending "$hub" | grep -q 'SAMPLE-0001-r01'; then fail "processed report listed again"; fi
if "$kit" mark "$hub" sample-app other-app-X-0001-r01 applied > /dev/null 2>&1; then fail "foreign reportId marked"; fi
if "$kit" mark "$hub" ghost-app ghost-app-G-0001-r01 applied > /dev/null 2>&1; then fail "unregistered projectId marked"; fi
if "$kit" mark "$hub" '.*' '../escaped-A-0001-r01' applied > /dev/null 2>&1; then fail "regex projectId marked"; fi
"$kit" mark "$hub" sample-app sample-app-SAMPLE-0001-r02 invalid > /dev/null
if "$kit" mark "$hub" sample-app "sample-app-SAMPLE-0001-r03
../../x" applied > /dev/null 2>&1; then fail "reportId with newline marked"; fi
if "$kit" pending "$hub" | grep -q 'SAMPLE-0001-r02'; then fail "invalid-marked report listed again"; fi
ok "pending lists committed reports only, flags invalid ones; mark is idempotent, accepts invalid, rejects unregistered projects"

# 8a. A project in a monorepo subfolder is read, and does not stop the projects after it
mono="$tmp/mono"; mkdir -p "$mono/svc"; git -C "$mono" init -q -b main
"$kit" init project "$mono/svc" svc-app SVC > /dev/null
sed 's/sample-app/svc-app/g; s/SAMPLE-/SVC-/g' "$root/tests/fixtures/sample-app-SAMPLE-0001-r01.md" > "$mono/svc/.ai/reports/svc-app-SVC-0001-r01.md"
git_commit "$mono" mono
"$kit" register "$hub" "$mono/svc" > /dev/null
cp "$root/tests/fixtures/sample-app-SAMPLE-0001-r01.md" "$api/.ai/reports/sample-api-SAMPLE-0009-r01.md"
sed -i.bak 's/sample-app/sample-api/g; s/SAMPLE-0001/SAMPLE-0009/g' "$api/.ai/reports/sample-api-SAMPLE-0009-r01.md"; rm "$api/.ai/reports/sample-api-SAMPLE-0009-r01.md.bak"
git -C "$api" init -q -b main; git_commit "$api" api
out=$("$kit" pending "$hub")
printf '%s\n' "$out" | grep -q '^pending	svc-app	svc-app-SVC-0001-r01	completed	' || fail "monorepo report not listed: $out"
printf '%s\n' "$out" | grep -q '^pending	sample-api	sample-api-SAMPLE-0009-r01	' || fail "project after monorepo not listed: $out"
ok "pending reads a monorepo subfolder project and keeps going"

# 8b. Init inside a linked worktree records the main branch, not the Worker branch
wtbase="$tmp/wtbase"; mkdir "$wtbase"; git -C "$wtbase" init -q -b main; printf x > "$wtbase/x"; git_commit "$wtbase" base
git -C "$wtbase" worktree add -q -b feat/worker-x "$tmp/wt"
"$kit" init project "$tmp/wt" wt-app > /dev/null
grep -q '^reportsRef: main$' "$tmp/wt/.ai/ORCHESTRATION.md" || fail "worktree reportsRef: $(grep reportsRef "$tmp/wt/.ai/ORCHESTRATION.md")"
ok "init in a linked worktree uses the main worktree branch as reportsRef"

# 9. Marketplace keeps the existing plugin and registers this one
mp="$root/../../.claude-plugin/marketplace.json"
if [ -f "$mp" ] && command -v jq > /dev/null; then
  [ "$(jq -r '[.plugins[].name] | sort | join(",")' "$mp")" = "mods-hud,orchestration-kit" ] || fail "marketplace plugins"
  [ "$(jq -r '.plugins[] | select(.name == "orchestration-kit") | .source' "$mp")" = ./plugins/orchestration-kit ] || fail "marketplace source"
  ok "marketplace: mods-hud kept, orchestration-kit registered"
fi
echo "all checks passed"

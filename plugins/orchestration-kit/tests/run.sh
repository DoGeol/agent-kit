#!/bin/sh
# Local checks for orchestration-kit. Usage: tests/run.sh   (exits 1 on the first failure)
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
kit="$root/scripts/kit.sh"
tmp=$(cd "$(mktemp -d "${TMPDIR:-/tmp}/orchkit.XXXXXX")" && pwd -P)
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
[ "$(ls -d "$root"/skills/*/ | wc -l | tr -d ' ')" = 5 ] || fail "expected 5 skills"
ok "skill frontmatter (portfolio, project, setup, issue-review, adopt)"

# Policy version follows the plugin version, so a policy change always reaches users with a bump
grep -q "\"version\": \"$(cat "$root/policies/VERSION")\"" "$root/.claude-plugin/plugin.json" || fail "policies/VERSION != plugin.json version"
ok "policies/VERSION matches plugin.json"

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
grep -qxF '.orch-progress/' "$app/.git/info/exclude" || fail "shared init did not hide progress files"
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

# 8d. A pull-request project reads reports from a remote-tracking reportsRef, not the local branch
pr="$tmp/prproj"; mkdir "$pr"; git -C "$pr" init -q -b main; "$kit" init project "$pr" pr-app PRA > /dev/null
grep -q '^integration: unset$' "$pr/.ai/ORCHESTRATION.md" || fail "integration field missing"
sed -i.bak 's|^reportsRef: main$|reportsRef: origin/main|; s|^integration: unset$|integration: pull-request|' "$pr/.ai/ORCHESTRATION.md"; rm "$pr/.ai/ORCHESTRATION.md.bak"
git_commit "$pr" setup; git -C "$pr" update-ref refs/remotes/origin/main HEAD
"$kit" register "$hub" "$pr" > /dev/null
git -C "$pr" checkout -q -b pra-0001-x
sed 's/sample-app/pr-app/g; s/SAMPLE-/PRA-/g' "$root/tests/fixtures/sample-app-SAMPLE-0001-r01.md" > "$pr/.ai/reports/pr-app-PRA-0001-r01.md"
git_commit "$pr" report-in-pr
if "$kit" pending "$hub" | grep -q 'pr-app-PRA-0001-r01'; then fail "report on an unmerged PR branch listed"; fi
git -C "$pr" update-ref refs/remotes/origin/main HEAD
"$kit" pending "$hub" | grep -q '^pending	pr-app	pr-app-PRA-0001-r01	completed	' || fail "report not read from origin/main after merge"
ok "pull-request project: report on the PR branch is invisible until origin/main has it"

# 8e. Personal mode: state lives in the hub, the project repo stays byte-identical
own="$tmp/own"; mkdir "$own"; git -C "$own" init -q -b main; printf 'code\n' > "$own/a.txt"; git_commit "$own" base
printf 'my-local-rule\n' >> "$own/.git/info/exclude"
before=$(snap "$own")
"$kit" init project --personal "$hub" "$own" own-app OWN > "$tmp/own.out"
[ "$before" = "$(snap "$own")" ] && [ -z "$(git -C "$own" status --porcelain)" ] || fail "personal init changed the project repo"
[ "$(cat "$own/.git/orchestration-kit-state")" = "$hub/projects/own-app" ] || fail "pointer file"
grep -qxF 'my-local-rule' "$own/.git/info/exclude" && [ "$(grep -cxF '.orch-progress/' "$own/.git/info/exclude")" = 1 ] || fail "exclude file"
grep -q '^mode: personal$' "$hub/projects/own-app/.ai/ORCHESTRATION.md" && grep -q '^reportsRef: -$' "$hub/projects/own-app/.ai/ORCHESTRATION.md" || fail "personal config"
hubsnap=$(snap "$hub"); "$kit" init project --personal "$hub" "$own" own-app OWN > /dev/null
[ "$hubsnap" = "$(snap "$hub")" ] && [ "$(grep -cxF '.orch-progress/' "$own/.git/info/exclude")" = 1 ] || fail "personal init rerun changed files"
git -C "$own" worktree add -q -b feat/x "$tmp/own-wt"; mkdir "$tmp/own-wt/.orch-progress"; echo p > "$tmp/own-wt/.orch-progress/a.md"
[ "$("$kit" where "$tmp/own-wt")" = "personal	$hub/projects/own-app" ] || fail "where from a worktree: $("$kit" where "$tmp/own-wt")"
[ -z "$(git -C "$tmp/own-wt" status --porcelain)" ] || fail "progress files visible in git status"
[ "$("$kit" where "$own")" = "personal	$hub/projects/own-app" ] || fail "where from the main checkout: $("$kit" where "$own")"
[ "$("$kit" where "$app")" = "shared	$app" ] || fail "where for a shared project"
if "$kit" init project "$own" own-app OWN > /dev/null 2>&1; then fail "shared init over a personal project"; fi
[ -z "$(git -C "$own" status --porcelain)" ] || fail "refused shared init wrote files"
if "$kit" where "$tmp/bad" > /dev/null 2>&1; then fail "where accepted an uninitialized folder"; fi
if "$kit" init project --personal "$hub" "$app" sample-app > /dev/null 2>&1; then fail "personal init over a shared project"; fi
"$kit" register "$hub" "$tmp/own-wt" > /dev/null
grep -q "^| own-app | .*/own | active |" "$hub/portfolio/PROJECTS.md" || fail "personal project not registered with the main checkout: $(grep own-app "$hub/portfolio/PROJECTS.md")"
sed 's/sample-app/own-app/g; s/SAMPLE-/OWN-/g' "$root/tests/fixtures/sample-app-SAMPLE-0001-r01.md" > "$hub/projects/own-app/.ai/reports/own-app-OWN-0001-r01.md"
git -C "$hub" init -q -b main 2>/dev/null || true
if "$kit" pending "$hub" | grep -q 'own-app-OWN-0001-r01'; then fail "uncommitted hub report listed"; fi
git_commit "$hub" hub
out=$("$kit" pending "$hub")
printf '%s\n' "$out" | grep -q '^pending	own-app	own-app-OWN-0001-r01	completed	hub@HEAD:projects/own-app/.ai/reports/' || fail "personal report not read from hub HEAD: $out"
printf '%s\n' "$out" | grep -q '^pending	svc-app	' || fail "shared projects no longer listed next to a personal one: $out"
ok "personal mode: repo untouched, pointer + exclude only, idempotent, found from worktrees, reports read from hub HEAD"

# 8e2. Shared mode: register leaves a hub pointer in the git common dir, and `hub` reads it back
shp="$tmp/shp"; mkdir "$shp"; git -C "$shp" init -q -b main; "$kit" init project "$shp" shp-app SHP > /dev/null
git_commit "$shp" base
hubreal=$(cd "$hub" && pwd -P); shbefore=$(git -C "$shp" status --porcelain)
"$kit" register "$hub" "$shp" | grep -q '^hub 포인터: ' || fail "R1 register printed no pointer line"
[ "$(cat "$shp/.git/orchestration-kit-hub" 2>/dev/null)" = "$hubreal" ] || fail "R1 pointer content: $(cat "$shp/.git/orchestration-kit-hub" 2>&1)"
[ "$shbefore" = "$(git -C "$shp" status --porcelain)" ] || fail "R1 register changed git status"
ok "R1 shared register writes the hub pointer in the git common dir; git status unchanged"
rm "$shp/.git/orchestration-kit-hub"
"$kit" register "$hub" "$shp" | grep -q '이미 등록됨' || fail "R2 re-register not idempotent"
[ "$(cat "$shp/.git/orchestration-kit-hub" 2>/dev/null)" = "$hubreal" ] || fail "R2 pointer not rewritten on re-register"
"$kit" register "$hub" "$shp" | grep -q '^hub 포인터: ' && fail "R2 second register rewrote a good pointer"
ok "R2 re-registering an already registered project restores a missing pointer"
printf '%s\n' "$tmp/elsewhere" > "$shp/.git/orchestration-kit-hub"
"$kit" register "$hub" "$shp" | grep -q '^주의: .*다른 hub' || fail "R3 no warning for a pointer to another hub"
[ "$(cat "$shp/.git/orchestration-kit-hub")" = "$tmp/elsewhere" ] || fail "R3 pointer overwritten"
ok "R3 a pointer to another hub is kept and warned about"
printf '%s\n' "$hubreal" > "$shp/.git/orchestration-kit-hub"
git -C "$shp" worktree add -q -b feat/hub-ptr "$tmp/shp-wt"
[ "$("$kit" hub "$hub")" = "$hubreal" ] || fail "R4 hub from the hub folder"
[ "$("$kit" hub "$tmp/own-wt")" = "$hubreal" ] || fail "R4 hub from a personal worktree"
[ "$("$kit" hub "$shp")" = "$hubreal" ] || fail "R4 hub from a shared project"
[ "$("$kit" hub "$tmp/shp-wt")" = "$hubreal" ] || fail "R4 hub from a shared worktree"
if "$kit" hub "$tmp/bad" > /dev/null 2>&1; then fail "R4 hub for an uninitialized folder"; fi
shn="$tmp/shn"; mkdir "$shn"; git -C "$shn" init -q -b main; "$kit" init project "$shn" shn-app SHN > /dev/null
if "$kit" hub "$shn" > /dev/null 2>&1; then fail "R4 hub for a shared project without a pointer"; fi
printf '%s\n' "$tmp/bad" > "$shp/.git/orchestration-kit-hub"
if "$kit" hub "$shp" > /dev/null 2>&1; then fail "R4 pointer to a folder that is not a hub"; fi
ok "R4 hub: hub folder, personal worktree, shared pointer, shared worktree; fails for uninitialized, no pointer, bad pointer"
[ ! -e "$own/.git/orchestration-kit-hub" ] || fail "R5 personal registration left a hub pointer"
ok "R5 personal registration leaves no hub pointer"

# 8f. board: blocked and in-review tasks, a delegation until a task names it, working-tree STATUS, workers via a stub orca
if command -v jq > /dev/null; then
  printf '| SAMPLE-0007 | 상태 화면 | in-review | - | Direct | PR #4 | - |\n| SAMPLE-0008 | 계약 결정 | blocked | - | Session | run_t / task_t1 / ctx_t | - |\n' >> "$app/.ai/TASKS.md"
  # Portfolio needs-review is listed for review; a cancelled PORT and an outbox file without a PORT id are told apart.
  printf '| PORT-0005 | 결정 필요 | needs-review | high | sample-app | sample-app-SAMPLE-0001-r01 | - |\n| PORT-0006 | 취소 | cancelled | low | sample-app | - | - |\n' >> "$hub/portfolio/TASKS.md"
  printf -- '---\nportfolioTaskId: PORT-0006\n---\n# 취소된 위임\n' > "$hub/handoffs/outbox/sample-app/PORT-0006.md"
  printf -- '---\nportfolioTaskId:\n---\n# 번호 없는 위임\n' > "$hub/handoffs/outbox/sample-app/PORT-none.md"
  bb="$tmp/board-bin"; mkdir "$bb"
  cat > "$bb/orca" <<EOF
#!/bin/sh
echo "\$*" >> "$tmp/orca.calls"
case "\$2" in
  run-list) echo '{"ok":true,"result":{"runs":[{"id":"run_t","coordinator_handle":"term_c"},{"id":"run_old","coordinator_handle":null}]}}' ;;
  worker-list) echo '{"ok":true,"result":{"workers":[{"runId":"run_t","workerState":"ready","taskId":"task_t1","agentTerminalHandle":"term_w","projection":{"provider":{"id":"claude","model":"haiku"},"workspace":{"id":"w1::$app"}}},{"runId":"run_t","workerState":"succeeded","taskId":"task_t0","agentTerminalHandle":"term_d","projection":{"workspace":{"id":"w1::$app"}}},{"runId":"run_t","workerState":"ready","taskId":"task_t","agentTerminalHandle":"term_x","projection":{"workspace":{"id":"w1::$app"}}},{"runId":"run_t","workerState":"ready","taskId":null,"agentTerminalHandle":"term_y","projection":{"workspace":{"id":"w1::$app"}}}]}}' ;;
esac
EOF
  chmod +x "$bb/orca"
  out=$(PATH="$bb:$PATH" "$kit" board "$hub")
  printf '%s\n' "$out" | grep -q '^project	sample-app	shared	2	' || fail "board open count: $out"
  printf '%s\n' "$out" | grep -qx 'review	sample-app	SAMPLE-0007	상태 화면	PR #4' || fail "board review row: $out"
  printf '%s\n' "$out" | grep -qx 'blocked	sample-app	SAMPLE-0008	계약 결정' || fail "board blocked row: $out"
  printf '%s\n' "$out" | grep -q '^handoff	sample-app	PORT-0001	' || fail "unaccepted delegation not listed: $out"
  printf '%s\n' "$out" | grep -q '^project	sample-api	shared	0	.*	프로젝트 문서 작성$' || fail "next safe action from STATUS.md: $out"
  printf '%s\n' "$out" | grep -q '^project	own-app	personal	0	' || fail "personal project row: $out"
  printf '%s\n' "$out" | grep -q '^pending	own-app	own-app-OWN-0001-r01	' || fail "board lost pending reports: $out"
  printf '%s\n' "$out" | grep -qx 'worker	sample-app	SAMPLE-0008	run_t	ready	claude/haiku	term_w' || fail "worker not mapped to its project task: $out"
  printf '%s\n' "$out" | grep -qx 'worker	sample-app	-	run_t	ready	-/-	term_x' || fail "task_t matched the task_t1 row by substring: $out"
  printf '%s\n' "$out" | grep -qx 'worker	sample-app	-	run_t	ready	-/-	term_y' || fail "worker without a task id mapped to a task: $out"
  [ "$(printf '%s\n' "$out" | grep -c '^worker	')" = 3 ] || fail "settled worker listed: $out"
  printf '%s\n' "$out" | grep -qx 'review	portfolio	PORT-0005	결정 필요	sample-app-SAMPLE-0001-r01' || fail "portfolio needs-review not listed: $out"
  if printf '%s\n' "$out" | grep -q '^handoff	sample-app	PORT-0006	'; then fail "cancelled PORT listed as a delegation: $out"; fi
  printf '%s\n' "$out" | grep -qx 'handoff	sample-app	-	번호 없는 위임' || fail "outbox file without a PORT id taken as accepted: $out"
  if printf '%s\n' "$out" | grep -q '^row	'; then fail "board leaked its row lines: $out"; fi
  if grep -q 'run_old' "$tmp/orca.calls"; then fail "board read a Run without a coordinator"; fi
  printf '| SAMPLE-0009 | 클라이언트 | in-progress | PORT-0001 | Direct | - | - |\n' >> "$app/.ai/TASKS.md"
  if PATH="$bb:$PATH" "$kit" board "$hub" | grep -q '^handoff	sample-app	PORT-0001	'; then fail "accepted delegation still listed"; fi
  printf '#!/bin/sh\nexit 1\n' > "$bb/orca"
  PATH="$bb:$PATH" "$kit" board "$hub" | grep -q '^workers	unknown	' || fail "board without orca did not say workers unknown"
  rm "$hub/handoffs/outbox/sample-app/PORT-0006.md" "$hub/handoffs/outbox/sample-app/PORT-none.md"
  ok "board: blocked/review rows, delegation until accepted or closed, STATUS next action, personal row, workers mapped by exact Orca ref, unknown without it"
fi

# 8g. adopt-check: none without overlays, ok when sources match, stale on file change or removed skill, new skill listed
ad="$tmp/adopt"; mkdir -p "$ad/.agents/skills/ui-build" "$ad/docs"
git -C "$ad" init -q -b main
printf 'rules\n' > "$ad/DESIGN.md"; printf 'x\n' > "$ad/.agents/skills/ui-build/SKILL.md"; printf 'a\n' > "$ad/docs/a.md"
git_commit "$ad" base
"$kit" init project "$ad" adopt-app > /dev/null
[ "$("$kit" adopt-check "$ad")" = none ] || fail "adopt-check without overlays"
ng="$tmp/adopt-nogit"; mkdir -p "$ng"; "$kit" init project "$ng" nogit-app > /dev/null
[ "$("$kit" adopt-check "$ng")" = none ] || fail "adopt-check on non-git project without overlays"
c=$(git -C "$ad" log -1 --format=%h -- DESIGN.md)
mkdir -p "$ad/.ai/roles"
printf '# frontend 보강\n\n## 출처\n- DESIGN.md @ %s\n- skill ui-build @ .agents/skills\n- skill design-review @ plugin\n\n## 관점\n- 날짜는 formatDate @ src/lib/date.ts\n' "$c" > "$ad/.ai/roles/frontend.md"
printf '# 대응표\n\n## 출처\n- docs/a.md @ %s\n' "$(git -C "$ad" log -1 --format=%h -- docs/a.md)" > "$ad/.ai/ADOPT.md"
[ "$("$kit" adopt-check "$ad")" = ok ] || fail "adopt-check fresh: $("$kit" adopt-check "$ad")"
printf 'rules 2\n' > "$ad/DESIGN.md"; mkdir -p "$ad/.claude/skills/qa-sheet"; printf 'y\n' > "$ad/.claude/skills/qa-sheet/SKILL.md"
rm -r "$ad/.agents/skills/ui-build"; git_commit "$ad" change
out=$("$kit" adopt-check "$ad")
printf '%s\n' "$out" | grep -q "^stale	frontend.md	DESIGN.md	$c -> " || fail "changed source not stale: $out"
printf '%s\n' "$out" | grep -q '^stale	frontend.md	skill ui-build	없어짐' || fail "removed skill not stale: $out"
printf '%s\n' "$out" | grep -q '^new	skill	qa-sheet	.claude/skills' || fail "new skill not listed: $out"
if printf '%s\n' "$out" | grep -q 'design-review\|ADOPT.md'; then fail "plugin skill or unchanged source flagged: $out"; fi
ok "adopt-check: none (also non-git), ok (non-source @ lines ignored), stale on changed file and removed skill, new skill; plugin skills not checked"
# Personal mode: .ai/ sources resolve against the hub state folder, not the project repo
pa="$hub/projects/own-app/.ai"; printf 'P1\n' > "$pa/DESIGN-PRINCIPLES.md"; git_commit "$hub" principles
mkdir -p "$pa/roles"; printf '# designer 보강\n\n## 출처\n- .ai/DESIGN-PRINCIPLES.md @ %s\n' "$(git -C "$hub" log -1 --format=%h -- projects/own-app/.ai/DESIGN-PRINCIPLES.md)" > "$pa/roles/designer.md"
[ "$("$kit" adopt-check "$own")" = ok ] || fail "personal adopt-check fresh: $("$kit" adopt-check "$own")"
printf 'P2\n' > "$pa/DESIGN-PRINCIPLES.md"; git_commit "$hub" principles2
"$kit" adopt-check "$own" | grep -q '^stale	designer.md	.ai/DESIGN-PRINCIPLES.md	' || fail "personal state source not stale: $("$kit" adopt-check "$own")"
ok "adopt-check in personal mode reads .ai/ sources from the hub"

# 8c. Usage readers against stub orca, claude, codex and agy (no real provider is called)
if command -v jq > /dev/null; then
  bin="$tmp/bin"; mkdir "$bin"; nowms=$(( $(date +%s) * 1000 )); reset=$(( $(date +%s) + 3600 ))
  cat > "$bin/orca" <<EOF
#!/bin/sh
printf '{"result":{"rateLimits":{"claude":{"status":"ok","updatedAt":%s,"session":{"usedPercent":12,"resetsAt":%s},"weekly":{"usedPercent":30}}}}}\n' "\$(cat "$tmp/orca.updated")" "${reset}000"
EOF
  cat > "$bin/claude" <<'EOF'
#!/bin/sh
echo '{"type":"system"}'
echo '{"usage_report":{"rate_limits":{"limits":[{"kind":"session","percent":72,"resets_at":"2030-01-01T00:00:00.5+00:00"},{"kind":"weekly_all","percent":40,"resets_at":null}]}}}'
EOF
  # Fake app-server: answers after both requests, then waits for stdin EOF like the real one. Each call takes the next 5h % from codex.pct.
  cat > "$bin/codex" <<EOF
#!/bin/sh
read -r a; read -r b
p=\$(head -1 "$tmp/codex.pct"); tail -n +2 "$tmp/codex.pct" > "$tmp/codex.next"; mv "$tmp/codex.next" "$tmp/codex.pct"
echo '{"method":"account/updated","params":{}}'
printf '{"id":2,"result":{"ordinaryUsageAllowed":true,"rateLimits":{"primary":{"usedPercent":%s,"windowDurationMins":300,"resetsAt":%s},"secondary":{"usedPercent":5,"windowDurationMins":10080}}}}\n' "\$p" "$reset"
cat > /dev/null
EOF
  cat > "$bin/agy" <<EOF
#!/bin/sh
[ "\$1" = --version ] && { cat "$tmp/agy.version"; exit 0; }
touch "$tmp/agy.called"
echo '{"num_turns":0,"command":{"name":"usage","data":{"groups":[{"buckets":[{"window":"5h","remaining_fraction":0.9,"reset_time":"2030-01-01T00:00:00Z"},{"window":"weekly","remaining_fraction":0.5}]},{"buckets":[{"window":"5h","remaining_fraction":0.2,"reset_time":"2030-01-01T00:00:00Z"}]}]}}}'
EOF
  chmod +x "$bin"/*
  u() { PATH="$bin:$PATH" KIT_CODEX_HOME="$tmp" "$kit" "$@"; }
  echo "$nowms" > "$tmp/orca.updated"; echo 75 > "$tmp/codex.pct"; echo 1.4.0 > "$tmp/agy.version"
  out=$(u usage)
  printf '%s\n' "$out" | grep -q '^usage	claude	ok	12	30	[0-9]*	orca$' || fail "claude from Orca: $out"
  printf '%s\n' "$out" | grep -q '^usage	codex	caution	75	5	[0-9]*	codex-app-server$' || fail "codex: $out"
  echo 1 > "$tmp/codex.pct"
  (HOME="$tmp" PATH="$bin:$PATH" "$kit" usage codex) | grep -q '	codex-app-server:default-home$' || fail "codex without Orca account not labelled"
  printf '%s\n' "$out" | grep -q '^usage	antigravity	caution	80	50	[0-9]*	agy$' || fail "agy worst bucket: $out"
  echo $(( nowms - 3600000 )) > "$tmp/orca.updated"
  u usage claude | grep -q '^usage	claude	caution	72	40	[0-9]*	claude-cli$' || fail "stale Orca value not replaced: $(u usage claude)"
  rm -f "$tmp/agy.called"; echo 1.0.9 > "$tmp/agy.version"
  u usage antigravity | grep -q '^usage	antigravity	unknown	-	-	-	agy 1.0.9' || fail "old agy not refused"
  [ ! -e "$tmp/agy.called" ] || fail "old agy was asked /usage"
  if u usage gemini > /dev/null 2>&1; then fail "unknown provider accepted"; fi
  echo 70 > "$tmp/codex.pct"
  out=$(u usage-watch --interval 0 codex)
  printf '%s\n' "$out" | head -1 | grep -q '^watch	codex:caution$' || fail "watch did not stop at caution: $out"
  printf '%s\n' "$out" | grep -q '^usage	codex	caution	70	' || fail "watch output lacks usage line: $out"
  printf '10\n20\n' > "$tmp/codex.pct"
  u usage-watch --interval 1 --until danger codex | head -1 | grep -q '^watch	codex:projected-' || fail "watch did not project the limit"
  printf '0\n1\n70\n' > "$tmp/codex.pct"
  out=$(u usage-watch --interval 1 codex)
  printf '%s\n' "$out" | head -1 | grep -q '^watch	codex:caution$' || fail "watch projected from a 1-point rise: $out"
  printf '80\n10\n20\n' > "$tmp/codex.pct"
  out=$(u usage-watch --interval 1 --until danger codex)
  printf '%s\n' "$out" | head -1 | grep -q '^watch	codex:projected-' || fail "watch did not re-measure after a 5h reset: $out"
  u usage-watch --interval 0 antigravity | head -1 | grep -q '^watch	antigravity:unknown-twice$' || fail "watch did not stop on unknown"
  ok "usage: Orca for fresh Claude, CLI fallback when stale, codex app-server, agy worst bucket and version floor; usage-watch stops on caution, projection, unknown"
fi

# 9. Marketplace keeps the existing plugin and registers this one
mp="$root/../../.claude-plugin/marketplace.json"
if [ -f "$mp" ] && command -v jq > /dev/null; then
  [ "$(jq -r '[.plugins[].name] | sort | join(",")' "$mp")" = "mods-hud,orchestration-kit" ] || fail "marketplace plugins"
  [ "$(jq -r '.plugins[] | select(.name == "orchestration-kit") | .source' "$mp")" = ./plugins/orchestration-kit ] || fail "marketplace source"
  ok "marketplace: mods-hud kept, orchestration-kit registered"
fi
echo "all checks passed"

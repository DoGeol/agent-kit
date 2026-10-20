#!/bin/sh
# Local checks for the ok plugin. Usage: tests/run.sh   (exits 1 on the first failure)
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
okc="$root/scripts/ok.sh"
tmp=$(cd "$(mktemp -d "${TMPDIR:-/tmp}/ok-test.XXXXXX")" && pwd -P)
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok   $*"; }
snap() { (cd "$1" && find . -type f -not -path './.git/*' | sort | while IFS= read -r f; do cksum "$f"; done); }
git_commit() { git -C "$1" add -A && git -C "$1" -c user.name=test -c user.email=test@example.com commit -qm "$2"; }
new_repo() { mkdir -p "$1" && git -C "$1" init -q -b main && printf 'x\n' > "$1/README.md" && git_commit "$1" init; }

# 1. Every skill runs only when invoked by name: disable-model-invocation: true, name matches the folder
n=0
for s in "$root"/skills/*/SKILL.md; do
  dir=$(basename "$(dirname "$s")"); n=$((n + 1))
  keys=$(awk 'NR == 1 { next } /^---$/ { exit } /^[A-Za-z]/ { sub(/:.*/, ""); print }' "$s" | sort | tr '\n' ' ')
  [ "$keys" = "argument-hint description disable-model-invocation name " ] || fail "$s frontmatter keys: $keys"
  grep -q "^name: $dir\$" "$s" || fail "$s name != $dir"
  grep -q '^disable-model-invocation: true$' "$s" || fail "$s can be started by the model"
  grep -q "/ok:$dir" "$s" || fail "$s description does not name /ok:$dir"
done
[ "$n" = 7 ] || fail "expected 7 skills, got $n"
ok "7 skills, all explicit-only (disable-model-invocation: true)"

# 1a. Roles: each role in policies/roles.md has roles/<id>.md and a thin agents/<id>.md that checks the ok-brief line
for id in $(sed -n 's/^| \[\([a-z-]*\)\](\.\.\/roles\/.*/\1/p' "$root/policies/roles.md"); do
  [ -f "$root/roles/$id.md" ] || fail "role file missing: $id"
  a="$root/agents/$id.md"; [ -f "$a" ] || fail "agent missing: $id"
  grep -q "^name: $id\$" "$a" || fail "$a name"
  grep -q 'ok-brief: <projectId>/<slug>' "$a" && grep -q 'tasks/<slug>.md' "$a" || fail "$a does not check the ok-brief line and task file"
  if sed -n '/^---$/,/^---$/p' "$a" | grep -q 'ok-brief'; then fail "$a shows the marker in its description"; fi
  for k in model effort tools; do grep -q "^$k: " "$a" || fail "$a missing $k"; done
done
for a in "$root"/agents/*.md; do
  grep -q "^| \[$(basename "$a" .md)\](" "$root/policies/roles.md" || fail "agent not listed in roles.md: $a"
done
[ "$(ls "$root"/agents/*.md | wc -l | tr -d ' ')" = 13 ] || fail "expected 13 agents"
ok "13 roles: role file, thin agent with ok-brief guard, listed in roles.md"

# 1b. Briefs carry the ok-brief line; policies say when orchestration may start
grep -q '^ok-brief: <projectId>/<slug>$' "$root/policies/coordinator.md" || fail "worker spec lacks ok-brief"
[ "$(grep -c 'ok-brief: <id>/<slug>' "$root/skills/plan/SKILL.md")" -ge 5 ] || fail "plan briefs lack ok-brief"
grep -q '^## 시작 조건 (명시적 요청만)$' "$root/policies/permissions.md" || fail "start conditions missing"
grep -q 'allow_implicit_invocation: false' "$root/policies/permissions.md" || fail "Codex explicit-only option not written"
ok "ok-brief in briefs and worker specs; explicit-start conditions written per agent"

# Policy version follows the plugin version
grep -q "\"version\": \"$(cat "$root/policies/VERSION")\"" "$root/.claude-plugin/plugin.json" || fail "policies/VERSION != plugin.json version"
ok "policies/VERSION matches plugin.json"

# 2. Relative Markdown links resolve inside the plugin
find "$root" -name '*.md' -not -path '*/tests/*' -not -path '*/.claude/*' | while IFS= read -r f; do
  grep -o '\](\([^)]*\))' "$f" | sed 's/^](//; s/)$//; s/#.*//' | while IFS= read -r link; do
    case $link in ''|http*|mailto:*) continue ;; esac
    [ -e "$(dirname "$f")/$link" ] || fail "$f: broken link $link"
    case $(cd "$(dirname "$f")" && cd "$(dirname "$link")" && pwd) in "$root"*) ;; *) fail "$f: link leaves plugin: $link" ;; esac
  done
done
ok "links resolve inside the plugin"

# 2a. No leftovers of the old layout (README and the init Skill describe the migration, so they may name it)
if grep -rnE 'kit\.sh|portfolio/|handoffs/|\.ai/(TASKS|STATUS|ORCHESTRATION)|/orchestration-kit:|Skill 도구로 .*(manager|clarify)' "$root" --include='*.md' --exclude-dir=tests --exclude-dir=init --exclude=README.md; then
  fail "old orchestration-kit layout referenced"
fi
ok "no old layout references in docs"

# 3. sh reads a non-ASCII byte after $name as part of the name; scripts must brace such expansions
if LC_ALL=C grep -nE '\$[A-Za-z_][A-Za-z0-9_]*[^ -~]' "$root"/scripts/*.sh; then fail "unbraced \$name before non-ASCII text"; fi
ok "variable expansions before Korean text are braced"

# 3a. No personal paths or secrets-looking strings
if grep -rnE '/Users/|/home/[a-z]|api[_-]?key *[:=]' "$root" --exclude=run.sh; then fail "personal path or key"; fi
ok "no personal paths"

# 4. init and add: missing files only, idempotent, repo tracked files untouched
if command -v jq > /dev/null; then
  hub="$tmp/hub"; mkdir "$hub"; app="$tmp/app"; new_repo "$app"
  "$okc" init "$hub" > /dev/null
  for f in hub.json AGENTS.md CLAUDE.md; do [ -f "$hub/$f" ] || fail "init did not create $f"; done
  printf 'mine\n' > "$hub/AGENTS.md"; "$okc" init "$hub" | grep -q '^skip    AGENTS.md' || fail "init overwrote AGENTS.md"
  [ "$(cat "$hub/AGENTS.md")" = mine ] || fail "AGENTS.md changed"
  before=$(snap "$app")
  "$okc" add "$hub" "$app" app > /dev/null
  [ "$(snap "$app")" = "$before" ] || fail "add changed repo files"
  [ -z "$(git -C "$app" status --porcelain)" ] || fail "add left git changes in the repo"
  for f in project.md status.md learnings.md; do [ -f "$hub/projects/app/$f" ] || fail "add did not create $f"; done
  grep -q '^# app 상태$' "$hub/projects/app/status.md" || fail "template id not filled"
  [ "$(cat "$app/.git/ok-hub")" = "$hub" ] || fail "hub pointer"
  [ "$(grep -cx '.ok/' "$app/.git/info/exclude")" = 1 ] || fail "exclude line"
  "$okc" add "$hub" "$app" app > /dev/null
  [ "$(grep -cx '.ok/' "$app/.git/info/exclude")" = 1 ] || fail "exclude line added twice"
  [ "$(jq '.projects | length' "$hub/hub.json")" = 1 ] || fail "add twice made two entries"
  [ "$(jq -r '.projects[0].base' "$hub/hub.json")" = main ] || fail "base branch"
  if "$okc" add "$hub" "$app" other 2>/dev/null; then fail "same repo under a second id accepted"; fi
  if "$okc" add "$hub" "$app" Bad_Id 2>/dev/null; then fail "bad id accepted"; fi
  fb="$tmp/feature-checked-out"; new_repo "$fb"; git -C "$fb" switch -q -c feature-x
  "$okc" add "$hub" "$fb" fb > /dev/null 2>&1
  [ "$(jq -r '.projects[] | select(.id == "fb") | .base' "$hub/hub.json")" = main ] || fail "base fell back to the checked-out feature branch"
  nb="$tmp/no-main"; mkdir -p "$nb"; git -C "$nb" init -q -b trunk; git_commit "$nb" init 2>/dev/null || { printf 'x\n' > "$nb/a"; git_commit "$nb" init; }
  "$okc" add "$hub" "$nb" nb 2>&1 >/dev/null | grep -q '^주의: .*trunk' || fail "fallback to the current branch not warned"
  ok "init/add: missing files only, idempotent, repo files and status untouched, pointer and one exclude line; base prefers main over a checked-out branch"

  # 5. where: repo, an outside worktree, the hub itself; OK_HUB without a pointer
  git -C "$app" worktree add -q "$tmp/app-wt" -b feat
  [ "$("$okc" where "$tmp/app-wt")" = "$hub	app	$app	main" ] || fail "where from worktree: $("$okc" where "$tmp/app-wt")"
  [ "$("$okc" where "$app")" = "$hub	app	$app	main" ] || fail "where from repo"
  [ "$("$okc" where "$hub")" = "$hub	-	-	-" ] || fail "where from hub"
  lone="$tmp/lone"; new_repo "$lone"
  if "$okc" where "$lone" 2>/dev/null; then fail "where without hub succeeded"; fi
  if OK_HUB="$hub" "$okc" where "$lone" 2>/dev/null; then fail "unregistered repo found"; fi
  ok "where: repo, outside worktree, hub; fails for unknown repos"

  # 6. status: open tasks, open decisions, unapplied reports only
  p="$hub/projects/app"; mkdir -p "$p/tasks" "$p/decisions" "$p/reports"
  printf -- '---\nid: a\ntitle: 할 일 A\nstatus: in-progress\ntrack: plan\ntier: M\n---\n' > "$p/tasks/a.md"
  printf -- '---\nid: b\ntitle: 끝남\nstatus: completed\ntrack: quick\n---\n' > "$p/tasks/b.md"
  printf -- '---\nstatus: open\n---\n# 고를 것\n' > "$p/decisions/a-d01.md"
  printf -- '---\nstatus: answered\n---\n# 답함\n' > "$p/decisions/a-d02.md"
  printf -- '---\noutcome: succeeded\napplied: false\n---\n' > "$p/reports/a-f1.md"
  printf -- '---\noutcome: succeeded\napplied: true\n---\n' > "$p/reports/a-f2.md"
  out=$("$okc" status "$hub")
  printf '%s\n' "$out" | grep -q '^task	app	a	in-progress	plan	M	할 일 A$' || fail "status task: $out"
  printf '%s\n' "$out" | grep -q '^decision	app	a-d01.md	고를 것$' || fail "status decision: $out"
  printf '%s\n' "$out" | grep -q '^report	app	a-f1.md	succeeded$' || fail "status report: $out"
  if printf '%s\n' "$out" | grep -q '끝남\|a-d02\|a-f2'; then fail "status listed closed items: $out"; fi
  ok "status: open tasks, open decisions, unapplied reports"

  # 7. migrate: preview changes nothing; apply moves old files to archive/, never deletes, makes tasks
  old="$tmp/oldhub"; mkdir -p "$old/portfolio" "$old/handoffs/outbox" "$old/.ai" "$old/projects/own/.ai/roles"
  sh_app="$tmp/shared-app"; own="$tmp/own-app"; new_repo "$sh_app"; new_repo "$own"
  mkdir -p "$sh_app/.ai"; printf -- '---\nreportsRef: origin/develop\n---\n' > "$sh_app/.ai/ORCHESTRATION.md"
  printf '| projectTaskId | 제목 | 상태 | portfolioTaskId |\n|---|---|---|---|\n| SH-0001 | 열린 일 | in-progress | PORT-0001 |\n| SH-0002 | 끝난 일 | completed | - |\n' > "$sh_app/.ai/TASKS.md"
  git_commit "$sh_app" kit
  printf -- '---\nrole: project\n---\n' > "$old/projects/own/.ai/ORCHESTRATION.md"
  printf '| projectTaskId | 제목 | 상태 | portfolioTaskId |\n|---|---|---|---|\n| OWN-0001 | 막힌 일 | failed | - |\n' > "$old/projects/own/.ai/TASKS.md"
  printf '# frontend 보강\n' > "$old/projects/own/.ai/roles/frontend.md"
  printf '| projectId | path | status | lastPulled |\n|---|---|---|---|\n| shared-app | %s | active | - |\n| own | %s | active | - |\n' "$sh_app" "$own" > "$old/portfolio/PROJECTS.md"
  printf '| portfolioTaskId | 제목 | 상태 | 우선순위 | 프로젝트 | 보고서 | 메모 |\n|---|---|---|---|---|---|---|\n| PORT-0001 | 연결됨 | accepted | - | shared-app (SH-0001) | - | - |\n| PORT-0002 | 대기 | backlog | - | own | - | 메모 하나 |\n' > "$old/portfolio/TASKS.md"
  printf 'portfolio skill\n' > "$old/AGENTS.md"
  before=$(snap "$old")
  out=$("$okc" migrate "$old")
  [ "$(snap "$old")" = "$before" ] || fail "migrate preview changed files"
  printf '%s\n' "$out" | grep -q '주의: AGENTS.md' || fail "old entry text not flagged: $out"
  sh_before=$(snap "$sh_app")
  "$okc" migrate "$old" --apply > /dev/null
  [ "$(snap "$sh_app")" = "$sh_before" ] || fail "migrate changed a shared repo's files"
  [ "$(jq -r '[.projects[].id] | join(",")' "$old/hub.json")" = "shared-app,own" ] || fail "migrated hub.json: $(cat "$old/hub.json")"
  [ "$(jq -r '.projects[0].base' "$old/hub.json")" = develop ] || fail "base from reportsRef"
  grep -q '^status: in-progress$' "$old/projects/shared-app/tasks/sh-0001.md" || fail "open shared task not moved"
  [ ! -e "$old/projects/shared-app/tasks/sh-0002.md" ] || fail "completed task moved"
  grep -q '^status: blocked$' "$old/projects/own/tasks/own-0001.md" || fail "failed task not blocked"
  grep -q '^status: planned$' "$old/projects/own/tasks/port-0002.md" || fail "backlog PORT not planned"
  grep -q '메모 하나' "$old/projects/own/tasks/port-0002.md" || fail "PORT memo lost"
  [ ! -e "$old/projects/shared-app/tasks/port-0001.md" ] || fail "linked PORT became a task"
  [ -f "$old/projects/own/roles/frontend.md" ] || fail "role overlay not copied"
  [ -f "$old/projects/own/archive/kit-ai/TASKS.md" ] || fail "personal .ai not archived"
  for d in portfolio handoffs .ai; do [ -e "$old/archive/kit/$d" ] && [ ! -e "$old/$d" ] || fail "$d not archived"; done
  [ "$(cat "$old/AGENTS.md")" = "portfolio skill" ] || fail "migrate overwrote AGENTS.md"
  [ "$(cat "$own/.git/ok-hub")" = "$old" ] || fail "migrate pointer"
  "$okc" migrate "$old" 2>/dev/null && fail "second migrate ran on a new hub" || true
  ok "migrate: preview is read-only; apply keeps repos, archives old files, moves open tasks and overlays"

  # 7b. a project that cannot be registered stops migrate before anything is archived, so it can be rerun
  bad="$tmp/badhub"; mkdir -p "$bad/portfolio" "$tmp/not-git"
  printf '| projectId | path | status | lastPulled |\n|---|---|---|---|\n| nogit | %s | active | - |\n' "$tmp/not-git" > "$bad/portfolio/PROJECTS.md"
  printf '| portfolioTaskId | 제목 | 상태 | 우선순위 | 프로젝트 | 보고서 | 메모 |\n|---|---|---|---|---|---|---|\n| PORT-0001 | 빈 프로젝트 | backlog | - |  | - | - |\n' > "$bad/portfolio/TASKS.md"
  "$okc" migrate "$bad" --apply > /dev/null 2>&1 && fail "migrate went on after a failed registration" || true
  [ -d "$bad/portfolio" ] && [ ! -e "$bad/archive" ] || fail "failed migrate archived files"
  [ ! -e "$bad/projects/tasks" ] && [ ! -e "$bad/projects//tasks" ] || fail "empty project cell made a task folder"
  ok "migrate: failed registration stops before archiving"

  # 8. adopt-check: none, ok, stale on change or removed skill, new skill; hub: sources resolve in the hub
  ad="$tmp/adopt"; mkdir -p "$ad/.agents/skills/ui-build"; git -C "$ad" init -q -b main
  printf 'rules\n' > "$ad/DESIGN.md"; printf 'x\n' > "$ad/.agents/skills/ui-build/SKILL.md"; git_commit "$ad" base
  git -C "$hub" init -q -b main; git_commit "$hub" hub
  "$okc" add "$hub" "$ad" adopt-app > /dev/null
  [ "$("$okc" adopt-check "$ad")" = none ] || fail "adopt-check without overlays"
  ap="$hub/projects/adopt-app"; mkdir -p "$ap/roles"; printf 'P1\n' > "$ap/DESIGN-PRINCIPLES.md"; git_commit "$hub" principles
  c=$(git -C "$ad" log -1 --format=%h -- DESIGN.md); hc=$(git -C "$hub" log -1 --format=%h -- projects/adopt-app/DESIGN-PRINCIPLES.md)
  printf '# frontend 보강\n\n## 출처\n- DESIGN.md @ %s\n- hub:projects/adopt-app/DESIGN-PRINCIPLES.md @ %s\n- skill ui-build @ .agents/skills\n- skill design-review @ plugin\n' "$c" "$hc" > "$ap/roles/frontend.md"
  [ "$("$okc" adopt-check "$ad")" = ok ] || fail "adopt-check fresh: $("$okc" adopt-check "$ad")"
  printf 'rules 2\n' > "$ad/DESIGN.md"; mkdir -p "$ad/.claude/skills/qa-sheet"; printf 'y\n' > "$ad/.claude/skills/qa-sheet/SKILL.md"
  rm -r "$ad/.agents/skills/ui-build"; git_commit "$ad" change
  printf 'P2\n' > "$ap/DESIGN-PRINCIPLES.md"; git_commit "$hub" principles2
  out=$("$okc" adopt-check "$ad")
  printf '%s\n' "$out" | grep -q "^stale	frontend.md	DESIGN.md	$c -> " || fail "changed source not stale: $out"
  printf '%s\n' "$out" | grep -q '^stale	frontend.md	projects/adopt-app/DESIGN-PRINCIPLES.md	' || fail "hub source not stale: $out"
  printf '%s\n' "$out" | grep -q '^stale	frontend.md	skill ui-build	없어짐' || fail "removed skill not stale: $out"
  printf '%s\n' "$out" | grep -q '^new	skill	qa-sheet	.claude/skills' || fail "new skill not listed: $out"
  if printf '%s\n' "$out" | grep -q 'design-review'; then fail "plugin skill flagged: $out"; fi
  ok "adopt-check: none, ok, stale (repo and hub: sources, removed skill), new skill; plugin skills not checked"
fi

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
  u() { PATH="$bin:$PATH" OK_CODEX_HOME="$tmp" "$okc" "$@"; }
  echo "$nowms" > "$tmp/orca.updated"; echo 75 > "$tmp/codex.pct"; echo 1.4.0 > "$tmp/agy.version"
  out=$(u usage)
  printf '%s\n' "$out" | grep -q '^usage	claude	ok	12	30	[0-9]*	orca$' || fail "claude from Orca: $out"
  printf '%s\n' "$out" | grep -q '^usage	codex	caution	75	5	[0-9]*	codex-app-server$' || fail "codex: $out"
  echo 1 > "$tmp/codex.pct"
  (HOME="$tmp" PATH="$bin:$PATH" "$okc" usage codex) | grep -q '	codex-app-server:default-home$' || fail "codex without Orca account not labelled"
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

# 8c2. A usage read the sandbox refused says so in the reason column
if command -v jq > /dev/null; then
  sb="$tmp/sandbox-bin"; mkdir "$sb"
  cat > "$sb/orca" <<'EOF'
#!/bin/sh
echo '{"ok":false,"error":{"code":"runtime_access_denied","message":"Permission denied connecting to Orca (EPERM)"}}'
exit 1
EOF
  printf '#!/bin/sh\nexit 1\n' > "$sb/claude"
  cat > "$sb/codex" <<'EOF'
#!/bin/sh
read -r a; read -r b
echo 'failed to initialize sqlite state runtime: Operation not permitted' >&2
exit 1
EOF
  cat > "$sb/agy" <<'EOF'
#!/bin/sh
[ "$1" = --version ] && { echo 1.4.2; exit 0; }
echo 'listen tcp 127.0.0.1:0: bind: operation not permitted' >&2
exit 1
EOF
  chmod +x "$sb"/*
  out=$(PATH="$sb:$PATH" OK_CODEX_HOME="$tmp" "$okc" usage)
  for p in claude codex antigravity; do
    line=$(printf '%s\n' "$out" | grep "^usage	$p	") || fail "Q5 no $p line: $out"
    printf '%s\n' "$line" | grep -q "^usage	$p	unknown	-	-	-	sandbox: " || fail "Q5 $p sandbox failure not named: $line"
    [ "$(printf '%s\n' "$line" | awk -F'\t' '{ print NF }')" = 7 ] || fail "Q5 $p line is not 7 columns: $line"
  done
  u2() { PATH="$sb:$PATH" "$okc" "$@"; }
  u2 usage antigravity | grep -q '	sandbox: agy /usage 실패$' || fail "Q5 original reason lost: $(u2 usage antigravity)"
  u2 usage-watch --interval 0 antigravity | head -1 | grep -q '^watch	antigravity:unknown-twice$' || fail "Q5b usage-watch changed with a sandbox reason"
  printf '#!/bin/sh\n[ "$1" = --version ] && { echo 1.4.2; exit 0; }\nexit 1\n' > "$sb/agy"
  [ "$(u2 usage antigravity)" = "usage	antigravity	unknown	-	-	-	agy /usage 실패" ] || fail "Q5 failure without a sandbox trace got a prefix: $(u2 usage antigravity)"
  ok "usage: a read the sandbox refused (Orca, codex, agy) says sandbox: in the reason column, 7 columns; a plain failure has no prefix; usage-watch unchanged"
fi


# 9. Marketplace lists mods-hud and ok, and no longer orchestration-kit
mp="$root/../../.claude-plugin/marketplace.json"
if [ -f "$mp" ] && command -v jq > /dev/null; then
  [ "$(jq -r '[.plugins[].name] | sort | join(",")' "$mp")" = "mods-hud,ok" ] || fail "marketplace plugins"
  [ "$(jq -r '.plugins[] | select(.name == "ok") | .source' "$mp")" = ./plugins/ok ] || fail "marketplace source"
  ok "marketplace: mods-hud kept, ok registered"
fi
echo "all checks passed"

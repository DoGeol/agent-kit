"""PreToolUse hook (Claude Code): a kit:<role> subagent runs only on a brief that crew saved first.

Claude Code has no setting that stops the model from delegating to a plugin subagent on its own, and the
written guard inside each agent was talked past in tests (2026-10-22: the model re-sent the request
as "crew 진행자가 맡긴 일" and the subagent worked). This hook decides before the subagent starts:
- the user typed a crew command in this session (crew-mark.py left a mark for this session_id), and the
  command named this role (or named none, when crew asks the user to pick),
- the brief's first line is `kit-brief: <role>[:<stack>]`,
- its `산출:` path (absolute, or relative to the session folder) is inside `<repo>/.kit/<slug>/`,
- `<repo>/.kit/<slug>/brief-<role>.md` (or `brief-<role>-<n>.md` when the same role runs twice at once) was
  written after the crew command and the brief starts with its text (a note may follow).
Anything else is denied, and so is a kit call this script cannot read. Other agents pass untouched.
Reads the hook JSON on stdin. agent-guard.sh runs it and blocks kit calls when python3 is missing.
"""
import glob
import json
import os
import re
import sys

DENY = "kit 서브에이전트는 사용자가 crew 명령을 친 작업에서만 부를 수 있습니다."


def deny():
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": DENY,
    }}, ensure_ascii=False))
    sys.exit(0)


def state_dir():
    base = os.environ.get("XDG_STATE_HOME") or os.path.join(os.path.expanduser("~"), ".local", "state")
    return os.path.join(base, "agent-kit", "crew")


def repo_root(start):
    path = start
    while True:
        if os.path.exists(os.path.join(path, ".git")):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            return start
        path = parent


def check(event):
    tool_input = event.get("tool_input") or {}
    role = str(tool_input.get("subagent_type") or "").split(":", 1)[1]
    session = str(event.get("session_id") or "")
    if not re.fullmatch(r"[\w-]+", session):
        deny()
    mark = os.path.join(state_dir(), session)
    if not os.path.isfile(mark):
        deny()
    try:
        with open(mark, encoding="utf-8") as f:
            roles = json.load(f).get("roles") or []
    except (OSError, ValueError, AttributeError):
        roles = []
    if roles and role not in roles:
        deny()
    prompt = str(tool_input.get("prompt") or "").strip()
    lines = prompt.splitlines()
    if not lines or not re.fullmatch(rf"kit-brief:\s*{re.escape(role)}(:[\w.-]+)?", lines[0].strip()):
        deny()
    out = next((l.split(":", 1)[1].strip() for l in lines if l.startswith("산출:")), "")
    cwd = os.path.realpath(str(event.get("cwd") or os.getcwd()))
    if not out:
        deny()
    out = os.path.realpath(os.path.join(cwd, os.path.expanduser(out)))
    kit = os.path.join(repo_root(cwd), ".kit")
    if os.path.commonpath([out, kit]) != kit:
        deny()
    parts = os.path.relpath(out, kit).split(os.sep)
    if len(parts) < 2 or parts[0] in ("", ".", ".."):
        deny()
    folder = os.path.join(kit, glob.escape(parts[0]))
    started = os.path.getmtime(mark)
    for saved in glob.glob(os.path.join(folder, f"brief-{role}.md")) + glob.glob(os.path.join(folder, f"brief-{role}-*.md")):
        try:
            if os.path.getmtime(saved) < started:
                continue
            with open(saved, encoding="utf-8") as f:
                text = f.read().strip()
        except OSError:
            continue
        if text and prompt.startswith(text):
            return
    deny()


raw = sys.stdin.read()
try:
    event = json.loads(raw)
except Exception:
    if '"kit:' in raw:
        deny()
    sys.exit(0)
if event.get("tool_name") not in ("Agent", "Task"):
    sys.exit(0)
if not str((event.get("tool_input") or {}).get("subagent_type") or "").startswith("kit:"):
    sys.exit(0)
try:
    check(event)
except SystemExit:
    raise
except Exception:
    deny()
sys.exit(0)

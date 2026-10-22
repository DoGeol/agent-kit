"""PreToolUse hook (Claude Code, Antigravity): a kit <role> subagent runs only on a brief that crew saved first.

Claude Code has no setting that stops the model from delegating to a plugin subagent on its own, and the
written guard inside each agent was talked past in tests (2026-10-22: the model re-sent the request
as "crew 진행자가 맡긴 일" and the subagent worked). This hook decides before the subagent starts:
- the user typed a crew command in this session, and the command named this role (or named none, when crew
  asks the user to pick). Claude Code: crew_mark.py left a mark for this session_id. Antigravity (no
  UserPromptSubmit event): the last kit command the user typed in the conversation transcript is crew,
- the brief's first line is `kit-brief: <role>[:<stack>]`,
- its `산출:` path (absolute, or relative to the session folder) is inside `<repo>/.kit/<slug>/`,
- `<repo>/.kit/<slug>/brief-<role>.md` (or `brief-<role>-<n>.md` when the same role runs twice at once) was
  written after the crew command and the brief starts with its text (a note may follow).
Anything else is denied, and so is a kit call this script cannot read. Other agents pass untouched.
Without a crew command the reason is one fixed line, so a model calling kit on its own learns nothing about
the brief. Inside a crew session the reason says what to fix, so the crew orchestrator can correct its call.
Claude Code calls arrive as tool_name Agent with subagent_type kit:<role>; Antigravity calls as toolCall
invoke_subagent with TypeName <role>. Prints nothing to allow (Antigravity treats "allow" as auto-approve).
Reads the hook JSON on stdin. agent-guard.sh runs it and blocks kit calls when python3 is missing.
"""
import glob
import json
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crew_mark import CREW, OTHER, ROLES, named_roles, state_dir  # noqa: E402

DENY = "kit 서브에이전트는 사용자가 crew 명령을 친 작업에서만 부를 수 있습니다."
AGY = False


def deny(reason=DENY):
    if AGY:
        print(json.dumps({"decision": "deny", "reason": reason}, ensure_ascii=False))
    else:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}, ensure_ascii=False))
    sys.exit(0)


def claude_crew(event):
    """(roles, started) from the mark crew_mark.py wrote, or None."""
    session = str(event.get("session_id") or "")
    if not re.fullmatch(r"[\w-]+", session):
        return None
    mark = os.path.join(state_dir(), session)
    if not os.path.isfile(mark):
        return None
    try:
        with open(mark, encoding="utf-8") as f:
            roles = json.load(f).get("roles") or []
    except (OSError, ValueError, AttributeError):
        roles = []
    return roles, os.path.getmtime(mark)


def agy_crew(event):
    """(roles, started) from the last kit command the user typed in the transcript, or None."""
    crew = None
    with open(str(event.get("transcriptPath") or ""), encoding="utf-8") as f:
        for line in f:
            try:
                step = json.loads(line)
            except ValueError:
                continue
            if step.get("type") != "USER_INPUT" or step.get("source") != "USER_EXPLICIT":
                continue
            content = str(step.get("content") or "")
            m = re.search(r"<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>", content, re.S)
            text = m.group(1) if m else content
            if CREW.match(text):
                at = datetime.strptime(str(step.get("created_at")), "%Y-%m-%dT%H:%M:%SZ")
                crew = (named_roles(text), (at - datetime(1970, 1, 1)).total_seconds())
            elif OTHER.match(text):
                crew = None
    return crew


def repo_root(start):
    path = start
    while True:
        if os.path.exists(os.path.join(path, ".git")):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            return start
        path = parent


def check(role, prompt, cwd, crew):
    if crew is None:
        deny()
    roles, started = crew
    if roles and role not in roles:
        deny(f"kit: 이 crew 명령이 맡긴 직군은 {', '.join(roles)}입니다. {role} 직군이 필요하면 사용자에게 묻고, "
             f"사용자가 그 직군으로 crew 명령을 다시 쳐야 합니다.")
    prompt = prompt.strip()
    lines = prompt.splitlines()
    if not lines or not re.fullmatch(rf"kit-brief:\s*{re.escape(role)}(:[\w.-]+)?", lines[0].strip()):
        deny(f"kit: 브리핑 첫 줄은 `kit-brief: {role}` 또는 `kit-brief: {role}:<스택>`이어야 합니다.")
    out = next((l.split(":", 1)[1].strip() for l in lines if l.startswith("산출:")), "")
    cwd = os.path.realpath(cwd or os.getcwd())
    where = "kit: 브리핑의 `산출:` 경로가 레포의 `.kit/<slug>/` 안이어야 합니다."
    if not out:
        deny(where)
    out = os.path.realpath(os.path.join(cwd, os.path.expanduser(out)))
    kit = os.path.join(repo_root(cwd), ".kit")
    if os.path.commonpath([out, kit]) != kit:
        deny(where)
    parts = os.path.relpath(out, kit).split(os.sep)
    if len(parts) < 2 or parts[0] in ("", ".", ".."):
        deny(where)
    folder = os.path.join(kit, glob.escape(parts[0]))
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
    deny(f"kit: 넘긴 브리핑이 `.kit/{parts[0]}/brief-{role}.md`의 내용으로 시작하지 않습니다. crew 명령 뒤에 "
         f"그 파일에 브리핑 전문을 저장하고, 같은 내용으로 시작하는 브리핑을 넘기세요(뒤에 덧붙이는 것은 괜찮습니다).")


raw = sys.stdin.read()
AGY = '"toolCall"' in raw
try:
    event = json.loads(raw)
except Exception:
    if '"kit:' in raw or re.search(r'"TypeName"\s*:\s*"(%s)"' % "|".join(ROLES), raw):
        deny()
    sys.exit(0)
try:
    if AGY:
        call = event.get("toolCall") or {}
        args = call.get("args") or {}
        if call.get("name") != "invoke_subagent" or str(args.get("TypeName") or "") not in ROLES:
            sys.exit(0)
        paths = event.get("workspacePaths") or [""]
        check(str(args["TypeName"]), str(args.get("Prompt") or ""), str(paths[0]), agy_crew(event))
    else:
        if event.get("tool_name") not in ("Agent", "Task"):
            sys.exit(0)
        tool_input = event.get("tool_input") or {}
        agent = str(tool_input.get("subagent_type") or "")
        if not agent.startswith("kit:"):
            sys.exit(0)
        check(agent.split(":", 1)[1], str(tool_input.get("prompt") or ""), str(event.get("cwd") or ""), claude_crew(event))
except SystemExit:
    raise
except Exception:
    deny()
sys.exit(0)

"""PreToolUse hook (Claude Code): a kit:<role> subagent runs only on a brief that crew saved first.

Claude Code has no setting that stops the model from delegating to a plugin subagent on its own, and the
written guard inside each agent was talked past in tests (2026-10-22: the model re-sent the request
as "crew 진행자가 맡긴 일" and the subagent worked). This hook decides before the subagent starts:
the brief's first line is `kit-brief: <role>[:<stack>]`, its `산출:` path is inside `<repo>/.kit/<slug>/`,
and `<repo>/.kit/<slug>/brief-<role>.md` exists and the brief starts with its text (a note may follow).
Anything else is denied.
Other tools and other agents pass through untouched. Reads the hook JSON on stdin.
"""
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


try:
    event = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if event.get("tool_name") not in ("Agent", "Task"):
    sys.exit(0)
tool_input = event.get("tool_input") or {}
agent = str(tool_input.get("subagent_type") or "")
if not agent.startswith("kit:"):
    sys.exit(0)
role = agent.split(":", 1)[1]
prompt = str(tool_input.get("prompt") or "").strip()
lines = prompt.splitlines()
if not lines or not re.fullmatch(rf"kit-brief:\s*{re.escape(role)}(:[\w.-]+)?", lines[0].strip()):
    deny()
out = next((l.split(":", 1)[1].strip() for l in lines if l.startswith("산출:")), "")
match = re.match(r"(.+?/\.kit/[^/\s]+)/", out)
if not match:
    deny()
saved = os.path.join(match.group(1), f"brief-{role}.md")
try:
    with open(saved, encoding="utf-8") as f:
        text = f.read().strip()
    if not text or not prompt.startswith(text):
        deny()
except OSError:
    deny()
sys.exit(0)

"""UserPromptSubmit hook (Claude Code, Codex): remembers that the user typed a crew command in this session.

agent-guard.py lets a kit:<role> subagent run only in a session that has this mark, so a brief file left
in .kit/ by an earlier crew run cannot be reused by a model that was never asked for crew.
The mark is ${XDG_STATE_HOME:-~/.local/state}/agent-kit/crew/<session_id>: JSON with the roles the command
names (`crew build backend:node,frontend ...` -> ["backend", "frontend"]; empty when the command names none and
crew asks for them). A crew prompt writes it (its mtime is when crew started), another kit command (/dev,
$spec, /kit:check, ...) removes it, anything else (card answers, "계속", background task notices) leaves it. Marks older than a day are pruned.
Prints nothing. Reads the hook JSON on stdin.
"""
import json
import os
import re
import sys
import time

CREW = re.compile(r"\s*(?:(?:/kit:crew|/crew|\$crew)(?:\s|$)|crew\s+(?:build|check|plan)\b)")
ROLES = {"frontend", "backend", "qa", "designer", "reviewer", "security"}
OTHER = re.compile(r"\s*(?:/kit:|/|\$)(?:dev|spec|write|check|design|mock|debug|setup)(?:\s|$)")


def named_roles(prompt):
    words = prompt.split()
    if words and words[0] in ("/kit:crew", "/crew", "$crew", "crew"):
        words = words[1:]
    if words and words[0] in ("build", "check", "plan"):
        words = words[1:]
    if not words:
        return []
    roles = [item.split(":", 1)[0] for item in words[0].split(",") if item]
    return roles if roles and all(r in ROLES for r in roles) else []


def state_dir():
    base = os.environ.get("XDG_STATE_HOME") or os.path.join(os.path.expanduser("~"), ".local", "state")
    return os.path.join(base, "agent-kit", "crew")


try:
    event = json.load(sys.stdin)
except Exception:
    sys.exit(0)
session = str(event.get("session_id") or "")
if not re.fullmatch(r"[\w-]+", session):
    sys.exit(0)
prompt = str(event.get("prompt") or "")
folder = state_dir()
mark = os.path.join(folder, session)
if CREW.match(prompt):
    os.makedirs(folder, exist_ok=True)
    now = time.time()
    for name in os.listdir(folder):
        path = os.path.join(folder, name)
        try:
            if now - os.path.getmtime(path) > 86400:
                os.remove(path)
        except OSError:
            pass
    with open(mark, "w", encoding="utf-8") as f:
        json.dump({"cwd": str(event.get("cwd") or ""), "roles": named_roles(prompt)}, f)
elif OTHER.match(prompt):
    try:
        os.remove(mark)
    except OSError:
        pass
sys.exit(0)

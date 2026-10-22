"""Summarize a scripts/try.sh log (Claude stream-json, Codex --json or Antigravity stream-json).

usage: python3 -I scripts/try-sum.py <log> [--full]
Prints the session id to resume with, one line per tool call, and the final answer (last 4000 characters
unless --full). Lines that are not JSON (tool warnings) are listed under "other".
"""
import json
import sys

path = sys.argv[1]
full = "--full" in sys.argv
calls, texts, other, session = [], [], [], None


def short(value, n=160):
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    s = s.replace("\n", " ")
    return s if full or len(s) <= n else s[:n] + "…"


for line in open(path, encoding="utf-8", errors="replace"):
    line = line.strip()
    if not line.startswith("{"):
        if line:
            other.append(line)
        continue
    try:
        e = json.loads(line)
    except ValueError:
        other.append(line)
        continue
    t = e.get("type")
    # Claude Code
    if t == "system" and e.get("subtype") == "init":
        session = e.get("session_id")
    elif t == "assistant" and isinstance(e.get("message"), dict):
        for c in e["message"].get("content", []):
            if c.get("type") == "tool_use":
                calls.append(f"{c.get('name')}: {short(c.get('input'))}")
            elif c.get("type") == "text" and c.get("text", "").strip():
                texts.append(c["text"])
    elif t == "user" and isinstance(e.get("message"), dict):
        for c in e["message"].get("content", []):
            if isinstance(c, dict) and c.get("type") == "tool_result" and c.get("is_error"):
                calls.append(f"  error: {short(c.get('content'), 200)}")
    elif t == "result":
        texts.append(str(e.get("result", "")))
        session = e.get("session_id", session)
    # Codex
    elif t == "thread.started":
        session = e.get("thread_id")
    elif t == "item.completed" and isinstance(e.get("item"), dict):
        item = e["item"]
        kind = item.get("type")
        if kind == "agent_message":
            texts.append(item.get("text", ""))
        elif kind == "command_execution":
            calls.append(f"cmd: {short(item.get('command'))} -> exit {item.get('exit_code')}")
        elif kind == "file_change":
            calls.append(f"files: {short(item.get('changes'))}")
        elif kind != "reasoning":
            calls.append(f"{kind}: {short(item)}")
    elif t in ("turn.failed", "error"):
        other.append(short(e, 400))
    # Antigravity
    elif e.get("event") == "init":
        session = (e.get("init") or {}).get("conversation_id") or e.get("conversation_id")
    elif e.get("event") == "step_update":
        step = e["step_update"]
        session = step.get("conversation_id", session)
        if step.get("step_type") == "tool" and step.get("state") == "DONE":
            info = step.get("tool_info", {})
            calls.append(f"{step.get('tool_name')}: {short(info.get('parameters'))} -> {short(info.get('output', ''), 100)}")
    elif e.get("event") == "result":
        result = e["result"]
        session = result.get("conversation_id", session)
        texts.append(str(result.get("response", "")))

print("session:", session)
for c in calls:
    print(" ", c)
if other:
    print("other:", *other[:10], sep="\n  ")
print("--- answer ---")
answer = texts[-1] if texts else ""
print(answer if full else answer[-4000:])

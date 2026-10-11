# 004. Whether ListAgents works from a plugin (orchestration state)

- **State:** works (terminal, 2026-10-11)
- **Where:** orchestration session state (`pollSessions`)

## Background
- Every 10 seconds, but only while there are session rows, the plugin calls `$.tool.call({ tool: 'ListAgents' })` and reads each session's state: running / idle / ended.
- A session missing from the answer is shown as **ended (■)**, e.g. once archived. When the call itself fails, the state stays **unknown**, drawn as a dim ◇ 대기.

## To check
- The `list-agents:` line of `/mods-hud debug`: `ok N개` / `deny: …` / `threw`.
- Whether the call raises a permission prompt every 10 seconds.
  - The transcript was searched, and no tool rows from it were found.
- Whether the ListAgents session names match the cross-session `from-name`.

## Checked (2026-10-11)
- Terminal session with one session row: `list-agents: ok 11개`, then `ok 12개` 30 seconds later.
- No permission prompt in that time.
- A session absent from the list showed as ended (`gone`).
- Not checked: whether real session names match `from-name` (the test used a made-up session).

## Alternatives
- On the desktop, the `ccd_session_mgmt` `list_sessions` MCP. Its result shape is untyped, so it was left out.
- The engine's `session.receive` / `session.send` events.

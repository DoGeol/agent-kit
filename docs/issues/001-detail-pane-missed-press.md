# 001. Presses in the detail pane are sometimes lost

- **State:** fixed; checked on the terminal, desktop not yet
- **Where:** `plugins/mods-hud`, detail pane (`session-detail`)

## Symptom
In the session detail pane, pressing a tab or a subagent/session row sometimes did nothing. It happened more often than on the band.

## Cause (presumed)
- Every redraw of the pane read the whole transcript (`$.session.messages()`, up to 4096 rows). In a long session one redraw took a while, so a press answered late or was lost to the redraw.
- The pane also redrew every 2 seconds, whatever changed.

## Done
- The transcript is read again only when a tool call finishes or a turn ends (`transcriptV` / `transcriptCache`). Otherwise the stored copy is used, and only the newest 400 rows are kept.
- The 2-second redraw is gone. The pane redraws only when state changes, or after a tool call.

## Checked
- **Terminal (2026-10-11):** with two Explore subagents running, tabs and agent rows answered every press. The agent detail opened with 73 messages and 33 calls read.

## Still to check
- The same on the desktop app.
- How often a press is lost now while subagents run, when the pane redraws on each of their tool calls.
- If it is still frequent: batch the pane's redraws to one every 3 seconds or so while agents run.

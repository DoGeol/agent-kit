# 001. Presses in the detail pane are sometimes lost

- **State:** fixed again (0.4.8); desktop idle checked, with agents running to confirm
- **Where:** `plugins/mods-hud`, detail pane (`session-detail`)

## Symptom
In the session detail pane, pressing a tab or a subagent/session row sometimes did nothing. It happened more often than on the band.

## Cause (presumed)
- Every redraw of the pane read the whole transcript (`$.session.messages()`, up to 4096 rows). In a long session one redraw took a while, so a press answered late or was lost to the redraw.
- The pane also redrew every 2 seconds, whatever changed.

## Done
- The transcript is read again only when a tool call finishes or a turn ends (`transcriptV` / `transcriptCache`). Otherwise the stored copy is used, and only the newest 400 rows are kept.
- The 2-second redraw is gone. The pane redraws only when state changes, or after a tool call.

## Still lost after 0.4.2 (2026-10-11)
Presses were still lost on the desktop.

**Cause:** the 2-second poll wrote `meter` and `history` on every tick, even when nothing changed. `update()` writes whatever `fn` returns, and returning the same value does not skip the write. Each write redraws every site that reads the value, so an idle session redrew the band and the detail pane every 2 seconds. A test counted 10 writes of each in 20 idle seconds.

**Fix (0.4.8):** the polled writes (`meter`, `history`, `sessions`) go through helpers that write only a change. A test checks that an idle session writes nothing for 20 seconds.

## Checked
- **Terminal (2026-10-11):** with two Explore subagents running, tabs and agent rows answered every press. The agent detail opened with 73 messages and 33 calls read.

## Still to check
- The same on the desktop app.
- How often a press is lost now while subagents run, when the pane redraws on each of their tool calls.
- If it is still frequent: batch the pane's redraws to one every 3 seconds or so while agents run.

## Desktop check (0.4.9, 2026-10-12)
- Idle: 9 tab presses in the detail pane, all 9 reached the mod (`detail 9회`, no failures) and every one changed the tab.
- Idle draw rate: `band 16` a minute with no state written by the mod. The desktop asks for the band on its own (about every 4 s); #99265 reports the same. Not from this mod.
- With three Explore subagents running: `band 19 · detail 26` a minute, `band 6회 · detail 8회`, no failures. Redraws follow the agents' tool calls.

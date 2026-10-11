# 001. Presses in the detail pane are sometimes lost

- **State:** closed: the detail pane was removed (0.5.0)
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
- While the agents ran, a press now and then did nothing on screen (reported by hand). The counters showed no failures, so the presses that reached the mod ran; a lost one either never reached it or landed during a redraw.

## Next
- Batch the redraws while agents run: write agent rows at most once every 2-3 s instead of on each tool call.
- Then repeat step 3 and compare the counted presses with the presses made.

## 0.4.13 (issue 018)
A tool call no longer writes any state, so nothing redraws the pane or the band mid-run. The per-call lines move in feed regions.
Desktop check (2026-10-12, a subagent with four shell calls): `/mods-hud debug` showed `detail 32회(실패 0)`, and the user saw no press lost.

## 0.4.14: lost again on tab switches
Desktop (2026-10-12): switching 턴 / 도구 / 지금 back and forth, the second press did nothing. `/mods-hud debug`: `detail 14회(실패 0)` and `detail 33` draws in the last minute. Every press that reached the mod ran; the lost one never reached it.
Guess: a tab press redraws the whole pane, and its labels changed (`● 턴` against `턴`, dim on and off). A desktop Button is native, so a changed one is made anew, and a press during that swap is lost.

## 0.4.15: fixed tab buttons
The three tab buttons keep the same label and look in every drawing. The active tab is named in a Text beside them (`▸ 도구`). A press on the active tab writes nothing, so it redraws nothing.
If presses are still lost, the next step is the whole pane in one Client (tabs switched in the module, with no redraw of the pane), or no pane at all (issue 018).

## 0.5.0: the detail pane is gone (2026-10-12)
The person chose the band alone: the detail pane was hard to read, and tab presses were still lost after 0.4.15 was proposed. The pane, its turn history and its call log are removed. The band's rows are plain text now; its only buttons are ■ stop, ↻ resume, ✕ close and the fold lines.

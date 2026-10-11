# Known issues

| # | Issue | State |
|---|---|---|
| 1 | Presses in the detail pane were sometimes lost | Transcript reads now cached; needs checking on screen |
| 2 | Presses on the band were sometimes lost while subagents run | The every-second full redraw was removed; how often it still happens needs checking |
| 3 | The running clock drawn in its own `Client` region | The test kit can't run it; needs checking on screen |
| 4 | Whether `ListAgents` (session running/idle/ended) works from a plugin | Unconfirmed; check the `list-agents:` line of `/mods-hud debug` |
| 5 | The desktop's ×1.3 Hangul width factor | Long all-Latin text may overflow |
| 6 | The desktop draws Buttons natively, so inactive tabs may not dim | Only the `●` marker may tell the active tab |
| 7 | A message from another session that starts a turn is logged on the previous card | Known limit |
| 8 | After a reload, a closed subagent the engine still lists comes back on the band | Known bug |
| 9 | Summary wording (echoed instructions, sentence-style endings) | Prompt-mitigated; the model may still drift |
| 10 | The `[-]` on the band's right is the engine's mark | Can't be removed |

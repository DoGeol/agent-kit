# 014. No band in the desktop view of a Remote Control session

- **State:** open, upstream (app). Reported as [anthropics/claude-code#101256](https://github.com/anthropics/claude-code/issues/101256)
- **Where:** the desktop app's Remote Control view, `ui.render` (`AbovePrompt`)

## Symptom
A session started in a terminal and opened in the desktop app over Remote Control shows no board in the desktop view. The terminal still shows it.

## What we found
- `/mods-hud debug` from the desktop view: `surfaces=terminal · 입력=bridge`, and only terminal draws.
- The desktop client never attaches as a surface and never asks for `AbovePrompt`. A mod draws only where a surface asks, so it cannot push the band there.
- The input path works: a command typed in the desktop view arrives with `origin.kind === 'bridge'`, and command output shows there.

## Done
- Tried a text fallback (a `[현황판]` line after each bridge turn, and `/mods-hud status`). Removed in 0.4.7: not the board the person wants.

## To check
When the app changes, `/mods-hud debug` from the Remote Control view should list `desktop` in `surfaces` and a `desktop AbovePrompt` draw.

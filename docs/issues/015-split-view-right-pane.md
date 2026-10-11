# 015. No band in a split view's right pane

- **State:** open, upstream (app). Tracked in [anthropics/claude-code#99265](https://github.com/anthropics/claude-code/issues/99265)
- **Where:** the desktop app's split view, `ui.render` (`AbovePrompt`)

## Symptom
With two sessions side by side, the board shows only in the leftmost pane.

## What we found
- Moving this session to the right pane: the footer (`SessionMode`) was drawn again at the new width, but the `AbovePrompt` draw stayed the same.
- The issue above quotes the app's renderer: it asks for the band only when the session is `local` and its panel is active. Other reports there say a `Pane` and `$.ui.status` also disappear in the right pane.
- The same gate likely explains 014 (a Remote Control session is not `local`). Not confirmed in the renderer.

## To check
When the app changes, the board should show in each pane.

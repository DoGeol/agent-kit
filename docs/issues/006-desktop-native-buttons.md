# 006. The desktop draws Buttons natively

- **State:** worked around
- **Where:** fold line, tabs

## What it is
- A desktop `Button` is a native button. It ignores the colors of the `Text` children inside it.
- A button keeps its content's width and doesn't shrink, so it overlapped the text beside it.

## Done
- **Fold line:** the Button holds `▸ 서브에이전트 N` only. The colored counts are plain Text beside it.
- **Labels:** pre-cut with `clipCells`, inside a Box with `overflow="hidden"` and `minWidth={0}`.
- **Tabs:** the active one is marked with a `●` prefix.

## To check
Whether the inactive tabs' `dimColor` shows on the desktop.

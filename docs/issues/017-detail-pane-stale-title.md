# 017. The detail pane keeps its first title

- **State:** fixed (0.4.10), desktop to recheck
- **Where:** detail pane (`session-detail`), navigation inside it

## Symptom
Opened on a subagent (`Explore · Summarize all md files`), then `← 메인 세션`: the pane showed the main tabs under the subagent's title.

## Cause
The title was set only when the band opened the pane (`openDetail`). Moving inside the pane (back, an agent row, a session row) changed what it showed, not its title.

## Done
Each move inside the pane calls `$.ui.open` with the pane's id and the new title (an open id retitles): `세션 상세`, `<type> · <description>`, or `세션 · <name>`. A test checks the title after opening an agent and going back.

## To check
On the desktop: open a subagent from the band, press `← 메인 세션`, and the title reads `세션 상세`.

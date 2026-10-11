# 018. Session detail on Client regions, with clearer tabs

- **State:** stages 1 and 2 implemented (0.4.13), desktop to check; stage 3 open
- **Where:** the detail pane in `hooks/register.tsx` (`DETAIL`), new surface modules next to `hooks/elapsed.tsx`
- **Related:** [001](001-detail-pane-missed-press.md) (presses lost while agents run), [003](003-client-elapsed-clock.md) (Client clock, works on the desktop)

## What a Client can and can't do (Claude Code 2.1.295 types, mods reference)

- A `Client` runs a surface module with its own state and timer. Only its region redraws.
- It can't read `$.state`. New data reaches it two ways only: a `ui.render` redraw of the pane (what we want to avoid), or `surface.post(data)` to `ui.message`, whose hook answers `{ props }`. That answer arrives with no `ui.render`.
- So every live region polls: the module posts a tick, the hook answers with the rows to show.
- One post per instance per frame. Props and posts are capped at 100,000 characters, 20,000 values, 32 deep.
- `ui.message` carries `requestId` and `element` (the Client's `key`), so several Clients in one pane route apart.
- The module knows its region's `columns` and `rows`, but not the surface. Pass the surface in props (the desktop Hangul fit).
- Elements inside: Box, Text, Button, Input, Select, Link, Code, Markdown. No nested Client.
- A throw, an overrun or a tree past the bounds unmounts it, and `ui.fault` fires.
- Pane and Client both draw on the terminal and the desktop only, so there is no other surface to fall back for.
- Unverified: whether `ui.message` answers reach the desktop (the type says "`desktop` once it has them"), whether a Button inside a Client works on the desktop, and whether a Client taller than its region scrolls with the pane.

## What reads badly now

| Where | Problem |
|---|---|
| Tab row | `도구 호출 N` changes on every call. The label widths shift and the whole pane redraws mid-press. |
| 도구 호출 | One row per call: dot and description. No tool name column, no time, no duration, no turn grouping, no error text. |
| 히스토리 | A card has no tool count. The live card says `결과 …` until the turn ends. |
| 현재 | Mostly repeats the band: the same agent rows, plus one meta line. |
| Agent view | Calls and the last words only. No request, no result, no time. |

## Stage 0 results

- 0.4.11: the agent clock (`elapsed.tsx`) posts every 2 s and the hook answers `{ props }` with a fresh `now`. `/mods-hud debug` prints `Client 왕복: <surface> 받음 N · 응답 도착 M`. M counts the answers the module saw.
- The tab label no longer carries the call count (`도구 호출`).
- Terminal (2026-10-12, a 15 s subagent): `받음 7 · 응답 도착 6`. The round trip works. M lags N by one because the module reports its count with its next post.
- Desktop: to check. Same run, then `/mods-hud debug`. If `응답 도착` stays 0, the desktop drops answers, and Stage 1 can't move per-call fields out of the pane there.
- Desktop, first try (0.4.11, the module confirmed loaded): `Client 왕복: 없음`. No post reached the hook. 0.4.12 also counts posts of the wrong shape and records `ui.fault` (`Client 오류`), to tell "never posts" from "fails".
- Desktop, second try (0.4.12, `sleep 30` agent, debug while it ran): `받음 8 · 응답 도착 7`, `Client 오류: 없음`. The round trip works on the desktop. The first try's `없음` came from running debug after the agent ended.
- Not probed yet: a Button inside a Client, and a Client taller than its region.

## Stages 1 and 2 (0.4.13)

- `publish` writes the agents with `lastTool`, `activity` and `tools` blanked. Those stay in the module's `tracked` map.
- `tool.call` no longer touches `detailAtom`. A tool call now writes no state at all (test: `a tool call writes no state`).
- New surface module `hooks/feed.tsx`: lines with an optional colored mark. It asks every second with `{ topic, columns }`; the hook answers `{ props }` only when the lines moved for that instance (`feedSent`).
- Topics: `step|<agent>` (the band's `→ step` line), `meta|<agent>` (the 현재 tab's `도구 N  → step`), `calls|<main or agent>|<rows>` (the calls list, read from the transcript cache).
- `/mods-hud debug` shows `Client 왕복: feed <surface> 받음 N · 응답 M` (asks, answers sent) and `시계 <surface> ...`.
- Terminal (2026-10-12, a subagent with four shell calls): `feed terminal 받음 25 · 응답 2`, no faults. The step line moved twice with no state write. The band still drew 33 times a minute: the terminal asks for the band on its own (typing, the spinner), not on our writes.
- Validator rule met on the way: `$` can be passed only to functions declared at the top of the file (`messagesOf`).

## Plan

**Stage 0. Probe (gate).** In `elapsed.tsx`, post every 2 s; a `ui.message` hook answers `{ props: { ...props, n } }`; show `n`. Check on the terminal and the desktop. Also try one Button inside a Client, and a Client taller than its region. The answers decide Stage 2's shape.

**Stage 1. Fewer redraws without a Client.** Drop the count from the tab labels. Keep per-call fields (`tools`, `lastTool`, `activity`) out of the atoms the pane and the band read; hold them in module memory, read only by `ui.message`. Then measure with `/mods-hud debug` while an agent runs: pane draws per minute, presses received against presses made. If draws drop near zero, 001 is fixed here, and Stage 2 is only about showing per-call data live.

**Stage 2. Client regions.** Buttons (tabs, agent rows, back, older turns) stay in the outer tree with fixed labels. Text that changes per call moves into Clients:
- `calls.tsx`: the calls list (newest rows that fit `surface.rows`).
- `live.tsx`: the running step and its elapsed time, for the main loop and each agent.
- The live turn card's `결과` line.
The hook answers from `transcriptCache` and the in-memory steps, never calling `$.session.messages()` on every tick, and sends only the visible rows.

**Stage 3. Readability.**
- Tabs: `지금` · `턴` · `도구`, fixed labels.
- 도구: grouped under a turn header; each row `✓ 12:03  Bash   npm test        1.2s`; an error adds one dim line with its message; the running call last, with a live clock.
- 턴: the top line adds `도구 N · 에이전트 M`; the live card shows its current step instead of `…`.
- 지금: what the band doesn't show: the request, the running step, each agent's current step, the last words.
- Agent view: its request, its calls (same rows as 도구), its result.

**Stage 4. Check.** Tests (zero `agents`/`history` writes between an agent's start and end apart from status; Client props shape), a terminal `expect` run with an agent of 10 s or more, the desktop in a new session after a version bump (016), `/mods-hud debug` counters.

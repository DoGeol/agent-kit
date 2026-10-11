# mods-hud

A status board (HUD) that sits above the chat input in Claude Code, in both the terminal and the desktop app.

```
● 진행 중  오케스트레이션 뷰 병합 중                      Opus 5.5(high)
  ▾ 서브에이전트 2  진행 중 1 · 완료 1
    ⎿ ● 진행 중  Explore  라이선스 파일 세는 중   01:04  Sonnet 5.5(low)  ■
    ⎿ ✓ 완료    Plan     수정안 3개 제시          00:40  Opus 5.5(high)   ✕
  ▸ 오케스트레이션 1  대기 1
Opus 5.5 high · 5h 16%(18:10) · w 81%(10/14 12:00) · ctx 58%      ← terminal only
```

## What it shows
- **Session row:** one Korean line summarizing the turn, its state (대기 / 진행 중 / 완료 / 중지), and model(effort).
- **Subagents:** its state, a Korean summary (at start, every 2 minutes while it works, and when it ends), the latest step, elapsed time, and model(effort). ■ stops it (press twice), ↻ resumes it, ✕ closes it. Two or more fold into one line.
- **Orchestration:** other sessions this session exchanged messages with. It shows their state (진행 중 / 대기 / 종료), the direction and age of the last message (↑ sent / ↓ received), and a Korean summary of what was received.
- **Usage:** 5-hour and weekly limits, context %, model and effort. Inside the card in the terminal; in the bar under the input in the desktop app.
- **Session detail pane:** press the summary row to open it. Its tabs are [히스토리] (per-turn cards: request, result, subagents, sessions), [도구 호출] and [현재].

## Commands
| Command | Effect |
|---|---|
| `/mods-hud` | Refresh the summary row now |
| `/mods-hud usage` | Usage detail, plus the tokens this mod has spent |
| `/mods-hud pane` | Show the status board as a pane |
| `/mods-hud agents off` / `on` | Turn Korean subagent summaries off or on |
| `/mods-hud debug` | Diagnostics |

## Cost
Korean summaries use Haiku (effort low). Each request sends only the turn's request, recent steps and the start of the answer. `/mods-hud usage` shows the running totals. Everything else (state, drawing) spends no tokens.

## Known issues
See [ISSUES.md](ISSUES.md).

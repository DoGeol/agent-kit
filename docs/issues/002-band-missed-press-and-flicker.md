# 002. Band presses lost, and the app blinks

- **State:** fixed, needs checking on screen
- **Where:** band above the prompt (`AbovePrompt`)

## Symptom
- While a subagent ran, a press on a band Button (fold line, ✕, ■) was sometimes lost.
- The chat area blinked with it.

## Cause
The running agents' elapsed time redrew the whole band every second (first a `beat` atom on the 2s poll, then a 1s timer). The desktop re-lays out its native Buttons on every redraw.

## Done
- The whole-band redraw timer is gone.
- Only the running clock is drawn in its own `Client` region (`hooks/elapsed.tsx`), which redraws itself every second (see 003).
- An ended agent shows how long it took as plain text.

## Still to check
- Whether presses are lost and the app blinks while agents run.
- Other sources of redraw: agent row changes on each tool call, session state polled every 10s, summary arrivals.

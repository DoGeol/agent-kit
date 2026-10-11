# 003. A running clock in a Client region (partial rendering)

- **State:** implemented, not checked on screen
- **Where:** `hooks/elapsed.tsx`, the right side of an agent row

## What it is
- The `Client` element runs a surface module (`ClientModule`) with its own state and timer. Only its region redraws (`surface.every(1000)` + `setState`).
- Its props are `{ startedAt, now }`. It counts seconds since the last `now` the band handed it.
- The terminal and the desktop have `Client`. VS Code and mobile don't, and fall back to a fixed start time (`16:42~`).

## Tried (2026-10-11)
A terminal session with an Explore subagent: it ended in 4 seconds, too fast to see the clock tick. Needs a subagent that runs for 10 seconds or more.

## Unverified
- The test kit doesn't run the module. Whether it ticks by the second for real, and whether its surrounding layout shifts, needs checking on screen.
- If the module throws, the engine unmounts it, and the time cell goes blank.

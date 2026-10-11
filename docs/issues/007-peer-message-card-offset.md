# 007. A turn another session's message starts is logged on the previous card

- **State:** known limit
- **Where:** history cards (`history`)

## What it is
- `prompt.submit` comes before `turn.start`. So a `<cross-session-message>` that starts a turn is logged on the card before it.
- A turn a notice or another session started (text beginning with `<`) adds no card of its own, on purpose; it joins the card before it.

## A fix to consider
At `prompt.submit`, hold an incoming message for a moment, then log it after `turn.start`.

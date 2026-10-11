# 013. Model, effort and usage missing from the terminal board

- **State:** fixed (0.4.2), confirmed on screen
- **Where:** `session.start`, `session.measure`, the meter

## Symptom
The terminal board showed no model, effort or usage line. `/mods-hud debug` showed the last terminal draw was the monitor pane at 88 rows and 62 columns, so neither the tight-rows rule (under 7 rows) nor the narrow rule (under 60 columns) applied.

## Presumed cause
- `session.start` read the model, the usage and the settings together, without a fallback. If any read failed, the hook threw before it made the meter and before it started its timers.
- `session.measure` and `turn.step` only update a meter that exists, so the meter stayed empty for the whole session.

## Done
- Each read at start has a fallback. The meter is made anyway, and the timers start.
- `session.measure` makes the meter if it is missing. The next tick fills in the model.
- `/mods-hud debug` now shows the meter (`사용량: <model> <effort> 한도<n> ctx=<n>`), and keeps the band's and the pane's last draws apart.

## To check
After `/reload-plugins`, run `/mods-hud debug`. `사용량: 없음` would mean the cause is elsewhere.

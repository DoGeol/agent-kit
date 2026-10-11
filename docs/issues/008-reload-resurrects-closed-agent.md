# 008. After a reload, a closed subagent comes back on the band

- **State:** fixed (0.4.1)
- **Where:** `tracked` restore, `agent.list` merge

## Symptom
After a hot reload, an agent dropped from the band but still on the engine's `$.agent.list()` reappears on the band with a fresh clock.

## Note
History cards keep their snapshot through `snapOf`, so only the band is affected.

## Done
- An agent that ages off the band (ended more than 10 minutes ago) leaves the module's map, and its id is saved in state (`dropped`, the newest 200).
- The `agent.list` merge skips a saved id, unless the agent runs again (a message woke it).
- A closed (✕) agent was already kept in `hidden`, which outlives a reload.
- Tests seed `dropped` to stand in for a fresh load, since the test kit has no reload.

## Remaining
- The band keeps the newest 12 rows in state. An agent older than those, ended under 10 minutes ago, is in neither list, so a reload still finds it with a fresh clock. Rare.
- An agent woken out of `dropped` is tracked again from that moment, so its clock starts over.

# 008. After a reload, a closed subagent comes back on the band

- **State:** known bug
- **Where:** `tracked` restore, `agent.list` merge

## Symptom
After a hot reload, an agent dropped from the band but still on the engine's `$.agent.list()` reappears on the band with a fresh clock.

## Note
History cards keep their snapshot through `snapOf`, so only the band is affected.

## A fix to consider
Keep the ids that were dropped or closed in state. Skip them when merging `agent.list`.

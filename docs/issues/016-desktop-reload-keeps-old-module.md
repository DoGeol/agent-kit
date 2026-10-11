# 016. `/reload-plugins` does not load a new mods-hud in a desktop session

- **State:** open, upstream (app). Tracked in [anthropics/claude-code#96223](https://github.com/anthropics/claude-code/issues/96223)
- **Where:** sessions the desktop app hosts; plugin read from this repository's folder

## Symptom
After `claude plugin update` and `/reload-plugins` (also `--force`) in a desktop session, `/mods-hud debug` still printed the old output: no `입력=` field, no `at=` time, and the same last draws as before the reload. A new session loads the new code.

## What we found
- `claude plugin list` says mods-hud is read from `plugins/mods-hud` in this repository, so a reload should re-read the folder.
- In a terminal session (driven with `expect`): edit `register.tsx`, run `/reload-plugins`, and the output says `re-read from its folder: plugins/mods-hud`; `/mods-hud debug` then shows the edit. So the terminal reload works.
- In the desktop sessions the reload output never named mods-hud, and the module's in-memory values survived, so the module was not reloaded.

## Workaround
Open a new session after an update.

## To check
- In a desktop session, edit the folder, run `/reload-plugins`, and look for the `re-read from its folder` line.
- If it never appears there, report it upstream with the terminal comparison.

## Confirmed (2026-10-12)
- Desktop: with the folder edited (`[진단]` → `[진단-B]`), `/reload-plugins` printed no `re-read from its folder` line, `/mods-hud debug` still printed `[진단]`, and the press counters survived. The module was not reloaded.
- Desktop sessions load the install-time copy under `~/.claude/plugins/cache/dg-agent-kit/mods-hud/<version>/`, not the folder. Each copy holds `.in_use/<pid>` of the desktop sessions using it: two older sessions on 0.4.2, the new one on 0.4.9.
- The terminal loads the folder in place, and its reload picks up an edit.
- Same as #96223 (desktop sessions load the cache copy of a local-directory marketplace plugin).

## Workaround
After a change: bump the version, run `claude plugin update mods-hud@dg-agent-kit`, then open a new desktop session.

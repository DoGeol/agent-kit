# agent-kit

A personal kit for coding agents. It is not tied to one vendor.

- `skills/`: skills in the [Agent Skills](https://agentskills.io) format (`SKILL.md`). Claude Code, Codex and Antigravity all use them.
- `plugins/`: plugins and mods that work only in Claude Code.

## Claude Code

```
/plugin install mods-hud --marketplace DoGeol/agent-kit
```

Type `y` when asked to add the marketplace, then pick a scope. The user scope applies to every session on this machine, in the terminal and in the desktop app.

| Plugin | Description |
|---|---|
| [mods-hud](plugins/mods-hud) | A status board (HUD) above the chat input: a session summary and its state, subagents and orchestration sessions, model and effort, usage limits, and a session detail pane with per-turn history |

**Updates:** run `claude plugin update mods-hud`.

## Skills (Claude Code, Codex, Antigravity)

```bash
git clone https://github.com/DoGeol/agent-kit.git ~/agent-kit
~/agent-kit/scripts/link.sh
```

`link.sh` links each folder under `skills/` into every tool's skills folder. After a `git pull`, all the tools see the change right away. See [skills/README.md](skills/README.md) for how to write a skill.

## Developing locally

Register this folder as a marketplace, and Claude Code reads the folder directly instead of an installed copy. Edit, then run `/reload-plugins`.

```bash
claude plugin marketplace add ~/WebstormProjects/agent-kit
claude plugin install mods-hud@dg-agent-kit
```

To check a plugin:

```bash
claude plugin validate plugins/mods-hud
claude plugin test plugins/mods-hud
```

## License

MIT

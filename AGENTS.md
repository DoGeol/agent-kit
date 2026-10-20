# Working rules for this repository

- Top-level `skills/<name>/SKILL.md` follows the Agent Skills standard. Its frontmatter holds only `name` and `description`, with no fields tied to one tool. Plugin skills (`plugins/*/skills/`) are Claude Code only and may use Claude Code fields such as `disable-model-invocation` and `argument-hint`.
- Skill bodies don't name a particular agent's tools ("셸에서 실행", not "Bash 도구로"). Script paths are relative to the skill folder.
- `plugins/` holds plugins for Claude Code only. Before committing, run `claude plugin validate plugins/<name>`, `claude plugin test plugins/<name>` when the plugin has a mod (`hooks/hooks.json` with `modules`), and the plugin's `tests/run.sh` when it has one.
- When a plugin changes, bump the `version` in its `.claude-plugin/plugin.json`. That is how users receive the update.
- Never commit secrets (API keys, tokens), company-internal information or personal paths.

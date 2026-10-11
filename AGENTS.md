# Working rules for this repository

- `skills/<name>/SKILL.md` follows the Agent Skills standard. Its frontmatter holds only `name` and `description`, with no fields tied to one tool.
- Skill bodies don't name a particular agent's tools ("셸에서 실행", not "Bash 도구로"). Script paths are relative to the skill folder.
- `plugins/` holds plugins for Claude Code only. Before committing, run `claude plugin validate plugins/<name>` and `claude plugin test plugins/<name>`.
- When a plugin changes, bump the `version` in its `.claude-plugin/plugin.json`. That is how users receive the update.
- Never commit secrets (API keys, tokens), company-internal information or personal paths.

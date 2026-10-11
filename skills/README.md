# Skills

Write each skill in the [Agent Skills](https://agentskills.io) format, so Claude Code, Codex and Antigravity can all read it.

```
skills/<name>/
├─ SKILL.md        required: frontmatter (name, description) + instructions
├─ scripts/        optional: scripts to run (shell, Python)
└─ references/     optional: reference documents to read when needed
```

```markdown
---
name: pr-review
description: Use when reviewing a PR diff. Triggered by requests such as "리뷰해줘" or "PR 봐줘".
---
# How to review a PR
1. ...
```

- **description:** spell out which requests it is for. Every tool picks a skill by this line.
- **Frontmatter:** `name` and `description` only. Fields such as `allowed-tools` belong to one tool.
- **Body:** use general wording rather than naming a particular agent's tools.

Run `scripts/link.sh` to link the skills into each tool's folder.

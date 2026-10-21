# Skills

Write each skill in the [Agent Skills](https://agentskills.io) format, so Claude Code, Codex and Antigravity can all read it.

```
skills/<name>/
├─ SKILL.md        required: frontmatter (name, description, argument-hint) + instructions
├─ _rules/         copies of rules/ made by scripts/build.sh (do not edit)
├─ _vendor/        copies of vendor/ files made by scripts/build.sh (do not edit)
└─ *.sh            optional scripts the skill runs from its own folder
```

```markdown
---
name: dev
description: 사용자가 "/dev <요청>"을 직접 입력했을 때만 돈다. …
argument-hint: "<요청>"
---
# /dev
요청: 명령 뒤에 적힌 문장.
| 재료 | 쓰는 곳 |
...
```

- **description:** say exactly when it runs ("직접 입력했을 때만") and what it produces. Every tool picks a skill by this line, and it is the only argument hint Codex and Antigravity show.
- **Frontmatter:** `name`, `description`, `argument-hint` only. `argument-hint` is read by Claude Code and ignored elsewhere.
- **Body:** general wording, no tool names, no `$ARGUMENTS`. Start with a 재료 table (which `_rules`/`_vendor` file is used at which step). Read only files inside the skill folder.
- **Adding a vendor or rules file to a skill:** add a row to `scripts/vendor-map.tsv`, run `scripts/build.sh`, then `scripts/check.sh` (it also enforces the per-skill size budget).

Run `scripts/link.sh` to link the skills into Codex and Antigravity folders; Claude Code installs the root plugin instead.

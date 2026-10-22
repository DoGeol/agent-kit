# skills

Skill 하나가 폴더 하나다. [Agent Skills](https://agentskills.io) 형식이라 Claude Code·Codex·Antigravity가 모두 읽는다.

```
skills/<name>/
├─ SKILL.md     필수. frontmatter(name, description, argument-hint) + 재료 표 + 절차
├─ _rules/      rules/에서 build.sh가 복사 (고치지 않는다)
├─ _vendor/     vendor/에서 복사 (고치지 않는다)
├─ _roles/      roles/에서 복사. check·crew·design만
├─ _stacks/     stacks/에서 복사. 스택이 걸리는 Skill만
└─ *.sh         Skill이 자기 폴더에서 돌리는 스크립트 (setup/check.sh)
```

| Skill | 뼈대 | 읽는 사본 |
|---|---|---|
| dev | `_rules/dev.md` | karpathy, verification-before-completion, `_stacks/*` |
| spec | grilling | `_rules/spec.md`, to-spec |
| write | `_rules/write.md` | 없음 |
| check | `_rules/check.md` | code-reviewer, security-auditor, `_roles/*`, `_stacks/*` |
| crew | `_rules/crew.md` | dispatching-parallel-agents, `_roles/*`(브리핑 경로용), `_stacks/*` |
| design | `_rules/design.md` | grilling, `_stacks/design`, `_roles/designer/reference.md` |
| mock | Emil prototype | `_rules/mock.md`, picker, `_stacks/design`·`react`·`animation`·`mobile` |
| debug | systematic-debugging | `_rules/debug.md`, `_stacks/*` |
| setup | `check.sh` | 없음 |

묻는 자리가 있는 Skill(dev·setup 빼고 전부)은 `_rules/ask.md`도 함께 받는다.

## 쓰는 법

```markdown
---
name: dev
description: 사용자가 "/dev <요청>"을 직접 입력했을 때만 돈다. …무엇을 내는지… 값 목록…
argument-hint: "<요청>"
---
# /dev
요청: 명령 뒤에 적힌 문장.

| 재료 | 쓰는 곳 |
|---|---|
| `_rules/dev.md` | 전체 절차 (뼈대) |
...
## 절차
1. 첫 줄에 재료를 적는다: `재료: …`
...
## 하지 않는 것
```

- **description**: 언제 도는지("직접 입력했을 때만"), 무엇을 내는지, 값 목록(직군·스택). 세 도구가 이 한 줄로 고르고, Codex·AGY 팝업이 보여 주는 유일한 안내다.
- **frontmatter**: `name`·`description`·`argument-hint`만. `argument-hint`는 Claude만 읽고 다른 도구는 무시한다.
- **본문**: 도구 이름·`$ARGUMENTS` 금지("명령 뒤에 적힌 문장"). 자기 폴더 안 파일만 읽는다. 재료 표가 맨 위, 첫 줄에 `재료: …`를 찍게 한다. 뼈대는 하나, 나머지는 단계별 참고. 묻는 자리는 `_rules/ask.md`.
- **사본 추가**: `scripts/vendor-map.tsv`에 행(`skills/<name>  <원본>  <사본 경로>`)을 더하고 `build.sh` → `check.sh`. `_rules`+`_vendor` 합계는 20KB까지(`check.sh`가 잰다). `_roles`·`_stacks`는 선택적으로 읽어 예산 밖.
- **이름**: Codex·AGY에서 맨 이름으로 뜨므로 내장 명령과 겹치면 안 된다. 피할 이름은 [docs/restructure.md](../docs/restructure.md#4-skill-이름).

Codex·AGY는 `scripts/link.sh`로 링크해도 된다. Claude Code는 루트 플러그인으로만 설치한다. kit을 고치면서 세 도구에서 바로 보려면 `scripts/dev-mode.sh on`(루트 README의 로컬 개발).

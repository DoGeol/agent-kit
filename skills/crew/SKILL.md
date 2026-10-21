---
name: crew
description: 사용자가 "crew build|check|plan <직군>[:<스택>] <요청 또는 spec 경로>"를 직접 입력했을 때만 돈다. 직군(frontend backend qa designer reviewer security)에 일을 맡긴다. 서브에이전트가 있으면 그것으로, 없으면 같은 세션에서 그 역할로. 직군이 둘이면 계약을 먼저 뽑고 병렬·순차를 묻는다. 스택은 react animation design python java node, 생략하면 레포 파일로 판단.
argument-hint: "build|check|plan <직군>[:<스택>][,<직군>[:<스택>]] <요청 또는 docs/specs/<slug>.md>"
---

# crew

인자: 명령 뒤에 적힌 것. 동작(build·check·plan)이 없으면 `build`. 직군이 없으면 `_rules/ask.md` 형식으로 추천과 함께 묻는다.

| 재료 | 쓰는 곳 |
|---|---|
| `_rules/crew.md` | 전체 절차 (뼈대): 브리핑 형식, build·check·plan, 진행자 규칙 |
| `_rules/ask.md` | 직군·병렬 여부·막혔을 때 묻기 |
| `_vendor/dispatching-parallel-agents.md` | 병렬일 때: 독립인 일만, 파일 안 겹치게, 결과는 진행자가 합침 |
| `_roles/*.md`, `_roles/review-format.md`, `_roles/<직군>/reference.md` | 브리핑에 **절대 경로**로 넘긴다. 본 세션은 읽지 않는다(서브에이전트가 없어 직접 할 때만 읽는다) |
| `_stacks/<스택>/STACK.md` | 파일이 있으면 브리핑 `스택:`에 경로로 |

## 절차

1. 첫 줄에 재료와 정한 값을 적는다: `재료: crew.md · 역할 backend:python · 동작 build`.
2. `_rules/crew.md`를 읽고 1절(인자) → 2절(브리핑) → 동작에 맞는 절(3·4·5) → 6절(진행자 규칙) 순서로 한다.
3. 브리핑의 `<KIT>`는 이 Skill 폴더의 절대 경로다(이 파일이 있는 폴더). 상대 경로를 넘기지 않는다.
4. 띄운 역할이 끝날 때마다 산출 파일을 읽고 3줄로 보여 준다. 묻는 것은 `_rules/crew.md`가 정한 자리에서만(직군 없음, 병렬 여부, 계약 변경 3회 초과, 2회 실패).
5. 서브에이전트를 못 띄우면 같은 세션에서 `_roles/<직군>.md`를 읽고 그 역할로 순서대로 한다. 이때는 병렬 선택지를 보이지 않는다.

## 하지 않는 것

- 본 세션이 레포 코드를 고치기(합치기와 `.kit/` 파일만).
- 역할끼리 직접 대화시키기. 조율은 `contract-changes.md`를 거쳐 본 세션이 한다.
- 기능 3개·반나절을 넘는 일. `/spec`으로 쪼개라고 한 줄.

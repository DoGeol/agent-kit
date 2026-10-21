---
name: check
description: 사용자가 "/check [직군[:스택]] [대상]"을 직접 입력했을 때만 돈다. 현재 diff(또는 브랜치·경로·PR)를 읽기 전용으로 리뷰해 지적마다 위치·실패 상황·고치는 법·확신도를 적는다. 직군은 reviewer(기본) security qa designer frontend backend, 스택은 react animation design python java node.
argument-hint: "[reviewer|security|qa|designer|frontend|backend][:<스택>] [브랜치|경로|PR]   비우면 현재 diff"
---

# /check

인자: 명령 뒤에 적힌 것. 직군·스택·대상 모두 생략 가능.

| 재료 | 쓰는 곳 |
|---|---|
| `_rules/check.md` | 전체 절차 (뼈대) |
| `_roles/<직군>.md` | 그 직군의 "리뷰에서 보는 것". 기본 `_roles/reviewer.md` |
| `_roles/review-format.md` | 산출 형식 |
| `_vendor/code-reviewer.md` | 2단계: 5관점 순서(정확성·가독성·구조·보안·성능)로 훑기 |
| `_vendor/security-auditor.md` | 보안 관점일 때 한 번 더 |
| `_stacks/<스택>.md` | 파일이 있으면 스택 규칙과 대조 |
| `_rules/ask.md` | 대상이 비었을 때 묻기 |
| ponytail-review (설치돼 있으면) | "줄일 것" 관점 추가 |

## 절차

1. `_rules/check.md` 1절대로 직군·대상·스택을 정하고 첫 줄에 재료를 적는다.
2. `_roles/<직군>.md`와 `_roles/review-format.md`를 읽는다. `security`면 `_vendor/security-auditor.md`도.
3. `_rules/check.md` 2절대로 읽는다: diff 전체, 호출자, `_vendor/code-reviewer.md`의 5관점 순서.
4. `_rules/check.md` 3절 형식으로 쓴다. 산출 경로가 없으면 답으로.
5. 끝에 "고치려면 `/dev 지적 1·3번 반영`".

## 하지 않는 것

- 파일 수정, 커밋.
- 취향·문체 지적, 바뀌지 않은 줄의 기존 문제, 린터가 잡을 것.
- 여러 직군을 동시에 보기(그건 `crew check`).

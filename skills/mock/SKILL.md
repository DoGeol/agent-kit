---
name: mock
description: 사용자가 "/mock <UI 조각>"을 직접 입력했을 때만 돈다. 조각 하나(카드, 토스트, 버튼, 폼)를 서로 다른 축(배치·밀도·성격·모션)의 실제 동작하는 시안 3개로 만들어 피커 뒤에 두고, 사용자가 고르면 그것만 코드에 반영한다. 탐색 중 제품 코드는 건드리지 않는다. "x5", "riff <변형>", "keep <변형>"을 받는다.
argument-hint: "<UI 조각> [x5] | riff <변형> | keep <변형>[, 남겨 둬]"
---

# /mock

대상: 명령 뒤에 적힌 조각. 비었으면 "어느 조각인지 한 줄로 적어 주세요"로 멈춘다.

| 재료 | 쓰는 곳 |
|---|---|
| `_rules/mock.md` | 덮어쓰는 점과 지키는 것 (먼저 읽는다) |
| `_vendor/prototype.md` | 뼈대: 범위 → 바닥 확인 → 방향 3개 → 하네스 → 검증·제시 → 선택 시 반영 |
| `_vendor/picker.md` | 4단계 하네스. 마크업·스타일·키 입력을 그대로 |
| `_rules/ask.md` | 5단계에서 고르게 하기 |
| `_stacks/design/team.md`, `_stacks/react/team.md` | 토큰·컴포넌트·원칙의 상한 |
| `_stacks/animation/STACK.md` | 변형에 모션이 있을 때 수치 기준 |

## 절차

1. 첫 줄에 재료를 적는다: `재료: prototype · design/STACK.md · 축 3개`. 인사는 하지 않는다.
2. `_rules/mock.md`를 읽는다. 그다음 `_vendor/prototype.md`의 Phase 1~6을 따르되 `_rules/mock.md`의 덮어쓰기가 이긴다.
3. Phase 4에서 `_vendor/picker.md`를 읽어 그대로 쓴다.
4. Phase 5에서 표를 보이고 `_rules/ask.md` 카드로 고르게 한다. 고르기 전에는 반영하지 않는다.
5. 고르면 Phase 6: 반영은 테스트 먼저·최소 변경으로, 프로토타입은 삭제(남겨 두라면 유지).

## 하지 않는 것

- 탐색 중 제품 코드 수정, 사용자가 고르기 전에 반영.
- 색·문구만 다른 변형.
- 화면 전체 설계(그건 `/design`).

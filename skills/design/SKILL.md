---
name: design
description: 사용자가 "/design <화면>" 또는 "/design audit"를 직접 입력했을 때만 돈다. 화면 하나를 질문 라운드(목적→독자→내용 우선순위→제약→분위기, 추천 첫 번째인 선택지)로 굳히고, 구성 2~3개를 비교해 고르게 한 뒤 docs/design/<slug>.md에 설계 문서를 쓴다. audit는 레포의 컴포넌트·토큰을 훑어 변형 수와 토큰 미사용을 표로 내고 디자인 원칙 초안을 제안한다. 코드와 시안은 만들지 않는다.
argument-hint: "<화면 이름> | audit   예: 주문 목록 화면"
---

# /design

대상: 명령 뒤에 적힌 화면, 또는 `audit`. 비었으면 "어느 화면인지 한 줄로 적어 주세요(또는 audit)"로 멈춘다.

| 재료 | 쓰는 곳 |
|---|---|
| `_rules/design.md` | 전체 절차 (뼈대). `audit` 모드 포함 |
| `_rules/ask.md` | 질문·구성 고르기·원칙 이름 고르기 형식 |
| `_vendor/grilling.md` | 3단계: 한 라운드에 지금 물을 수 있는 것 전부 |
| `_stacks/design/team.md` | 디자인 원칙. 범용 기본값이 들어 있다. 결정마다 원칙 ID |
| `_stacks/design/STACK.md` + `rules/` | 일반 기준과 패턴 규칙(폼·목록·상태·내비·반응형·대화상자·피드백·문구). 걸리는 것만 |
| `_stacks/design/vendor/frontend-design.md` | 5단계 "새 방향"일 때만 |
| `_stacks/design/vendor/pick-ui-library.md` | 라이브러리가 걸릴 때만 |
| `_roles/designer/reference.md` | `audit`에서 원칙 초안 만들기·바꾸기 절차 |

## 절차

1. 첫 줄에 재료를 적는다: `재료: design.md · grilling(질문) · 원칙 team.md(기본값/팀)`.
2. 화면이면 `_rules/design.md`를 읽고 1→6 순서대로. 질문은 `_rules/ask.md` 형식, 한국어. 설계 문서의 각 절은 `_stacks/design/rules/`의 해당 패턴 규칙을 따른다.
3. `audit`이면 `_rules/design.md`의 `audit` 모드대로. 원칙 초안은 `_roles/designer/reference.md` 절차.
4. 바닥 확인(2절)은 묻지 않고 레포에서 찾는다.
5. 구성 비교(4절)는 표 + 카드. 추천 첫 번째.
6. 설계 문서를 쓰고 끝 한 줄. "시안은 `/mock <요소>`, 구현은 `/dev`, 브라우저 확인은 `/check design`".

## 하지 않는 것

- 코드 수정, 시안(HTML) 만들기, 커밋.
- 사용자만 정할 값 지어내기.
- 짧은 말투. 설계 문서는 사람이 읽는다.

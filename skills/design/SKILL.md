---
name: design
description: 사용자가 "/design <화면>"을 직접 입력했을 때만 돈다. 화면 하나를 질문 라운드(목적→독자→내용 우선순위→제약→분위기, 추천 첫 번째인 선택지)로 굳히고, 구성 2~3개를 비교해 고르게 한 뒤 docs/design/<slug>.md에 설계 문서를 쓴다. 코드와 시안은 만들지 않는다.
argument-hint: "<화면 이름>   예: 주문 목록 화면"
---

# /design

대상: 명령 뒤에 적힌 화면. 비었으면 "어느 화면인지 한 줄로 적어 주세요"로 멈춘다.

| 재료 | 쓰는 곳 |
|---|---|
| `_rules/design.md` | 전체 절차 (뼈대) |
| `_rules/ask.md` | 질문·구성 고르기 형식 |
| `_vendor/grilling.md` | 3단계: 한 라운드에 지금 물을 수 있는 것 전부 |
| `_stacks/design/team.md` | 디자인 원칙. 채워져 있으면 우선, 결정마다 원칙 ID |
| `_stacks/design/STACK.md` | 일반 기준(간격·타이포·상태·접근성), 구성 고르기 |
| `_stacks/design/vendor/frontend-design.md` | 5단계 "새 방향"일 때만: 주제에서 미감 끌어내기 |
| `_stacks/design/vendor/pick-ui-library.md` | 라이브러리가 걸릴 때만 |

## 절차

1. 첫 줄에 재료를 적는다: `재료: design.md · grilling(질문) · 원칙 team.md(있음/비어 있음)`.
2. `_rules/design.md`를 읽고 1→6 순서대로 한다. 질문은 `_rules/ask.md` 형식, 한국어.
3. 바닥 확인(2절)은 묻지 않고 레포에서 찾는다. 원칙 문서가 비어 있으면 `_stacks/design/STACK.md`의 기준으로 가고, 끝에 "원칙 초안을 만들려면 `crew plan designer 디자인 원칙`" 한 줄.
4. 구성 비교(4절)는 표 + 카드. 추천 첫 번째.
5. 설계 문서(5절)를 쓰고 끝 한 줄(6절).

## 하지 않는 것

- 코드 수정, 시안(HTML) 만들기, 커밋.
- 사용자만 정할 값 지어내기.
- 짧은 말투. 설계 문서는 사람이 읽는다.

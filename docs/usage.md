# kit 사용법 (초안)

[restructure.md](restructure.md)대로 만들었을 때의 사용법. 만들면서 실제 동작에 맞춰 고친다. Skill 이름은 확정 전(검토 쟁점·후속 확인 참고).

## 부르는 법

| 도구 | 형태 | 예 |
|---|---|---|
| Claude Code (플러그인) | `/kit:<이름>` | `/kit:dev 주문 취소 API 추가` |
| Codex | `$<이름>` | `$dev 주문 취소 API 추가` |
| AGY | `/<이름>` | `/dev 주문 취소 API 추가` |

아래 예는 `/이름`으로 적는다. 모든 Skill은 **이름으로 불러야만** 돈다. 자동으로 끼어들지 않는다.

## 처음 한 번

```
/setup
```

caveman·ponytail·im-not-ai가 설치돼 있는지 보여 주고, 없는 것은 그 도구의 설치 명령을 알려 준다. 설치는 직접 한다. 안 해도 나머지는 돈다.

## 명령 9개

| 명령 | 언제 | 넣는 것 | 나오는 것 |
|---|---|---|---|
| `/dev <요청>` | 코드를 고칠 때 | 요청 한 줄. 파일 경로를 적으면 더 정확 | 테스트 + 구현. 짧은 말투(caveman), 최소 구현(ponytail). 커밋 메시지는 일반 문장 |
| `/spec <요청>` | 뭘 만들지 아직 흐릿할 때 | 아이디어 한두 문장 | 질문 카드(추천 첫 번째) → `spec.md`: 범위·기능·완료 조건·안 하는 것 |
| `/write <요청>` | 사람이 읽을 글 | 목적·독자·형식 | 한국어 일반 문장. 끝에 "`/humanize`로 다듬으세요" |
| `/check [직군[:스택]] [대상]` | 머지 전, 남의 PR | 생략하면 현재 diff | 지적 목록: 위치·실패 상황·고치는 법·확신도. 파일은 안 고침 |
| `crew <build\|check\|plan> <직군>[:<스택>] <요청>` | 일을 직군에 맡길 때 | 직군, 스택(생략 가능), 요청 | 그 역할의 산출물. 단계마다 멈춰 보여 줌 |
| `/design <화면>` | 화면을 어떻게 짤지 정할 때 | 화면 이름 | 질문 카드(목적→독자→우선순위→제약→분위기) → 구성 2~3개 비교 → `design-brief.md` |
| `/mock <UI 조각>` | 시안을 보고 고르고 싶을 때 | 컴포넌트 하나 | 서로 다른 축의 시안 3개를 피커로 → 고른 것만 코드에 반영 |
| `/debug <증상>` | 버그·실패·느려짐 | 오류 메시지, 재현 절차, 파일 | 이 버그에만 켜지는 신호부터 → 원인(파일:줄) → 고침 → 회귀 테스트. 3번 실패하면 멈추고 카드 |
| `/setup` | 처음, 또는 도구를 옮겼을 때 | 없음 | 설치 상태 표 + 설치 명령 |

직군: `frontend` `backend` `designer` `qa` `reviewer` `security`. 스택: `react` `animation` `design` `python` `java` `node`. 스택을 생략하면 레포 파일로 판단한다.

짧은 말투가 `/dev` 밖으로 새는 게 거슬리면(Claude·Codex): `~/.config/agent-kit/hooks` 파일에 `plain=on` 한 줄. `/dev`가 아닌 턴마다 "일반 문장으로" 한 줄이 들어간다. 지우면 꺼진다.

## 하루 흐름 예

```
/spec   주문 취소 기능                     → 질문 카드 몇 장 → spec.md
/dev    spec.md의 F1(취소 API) 구현         → 테스트 + 코드
/check  backend:python                     → 지적 3개
/dev    지적 1·3번 반영                     → 수정
/write  이 변경의 PR 본문                   → 한국어 초안
/humanize                                   → 다듬은 본문 (im-not-ai)
```

- `/spec` → `/dev`로 넘길 때 spec 파일 경로를 적는다. 다시 묻지 않고 읽는다.
- `/check` → `/dev`로 넘길 때 지적 번호만 적는다.
- `/dev`는 같은 작업이 이어지는 동안 유지된다. 다른 주제를 꺼내거나 `/write`·`/spec`을 치면 풀린다.

## 화면 작업 예

```
/design  주문 목록 화면        → 질문 카드 → 구성 A(테이블)·B(카드)·C(타임라인) 비교, A 추천 → design-brief.md
/mock    주문 카드             → 밀도·성격·모션 축으로 시안 3개, 피커로 넘겨 보고 2번 선택 → 코드 반영
/check   design                → 접근성·최악 데이터(긴 이름, 0건)·모션 지적
```

## 직군에 맡기는 예

```
crew build backend:java 결제 재시도 큐      → backend 역할 + java 스택으로 구현. 단계마다 결과 보여 줌
crew check security                        → 보안 관점 지적만 (읽기 전용)
crew check qa                              → 테스트 빠진 곳
crew plan frontend 알림 센터               → 작업 단위로 쪼갠 계획
```

같은 diff를 `crew check security`·`crew check qa`로 따로 돌리면 관점이 달라 겹치는 지적이 적다.

spec에 직군이 둘 이상이면 `crew build spec.md`가 카드로 묻는다:

```
Q1. spec에 backend·frontend 일이 있습니다. 어떻게 맡길까요?
  1. 병렬: backend:python + frontend:react, 계약 먼저 (추천) — 기능이 서로 독립
  2. 순차: backend 먼저 → frontend — 계약이 아직 흔들릴 때
  3. 하나로: backend가 둘 다 — 변경이 작을 때
```

병렬이면 본 세션이 먼저 `contract.md`(API 모양·오류 코드)를 뽑고 둘을 동시에 띄운다. 계약을 바꿔야 하면 에이전트가 `contract-changes.md`에 적고 본 세션이 판단한다. 끝나면 머지 → 계약 테스트 → `/check`. 서브에이전트가 없는 도구에서는 같은 세션에서 순서대로 한다.

맡긴 결과(보고, 리뷰, 계약)는 레포의 `.kit/<slug>/`에 남는다. `crew`가 `.git/info/exclude`에 `.kit/`을 넣어 커밋되지 않게 한다.

## 질문 카드

`/spec`·`/design`·`/mock`·`crew`가 물을 때는 모두 같은 형식이다. 카드가 있는 도구는 카드로, 없는 도구는 번호 목록으로. 추천이 항상 1번이고 라벨 끝에 "(추천)". 한 번에 질문 4개까지.

```
Q1. 취소 가능 시점은?
  1. 배송 전까지 (추천) — 가장 흔한 정책, 나중에 넓힐 수 있음
  2. 결제 직후만 — 구현이 가장 작음
  3. 언제든 — 환불·재고 처리가 복잡해짐
```

번호로 답하거나 "기타"에 직접 적는다.

## 팀 규칙 넣는 곳

| 파일 | 내용 | 누가 읽나 |
|---|---|---|
| `stacks/react/team.md` | 상태 관리, 폴더 구조, 이름 짓기, 금지 패턴 | `/dev frontend`, `/check frontend:react` |
| `stacks/design/team.md` | 디자인 원칙, 토큰 위치, 공용 컴포넌트 | `/design`, `/mock`, `/check design` |
| 레포의 `AGENTS.md` | 그 레포에서만 다른 점 | 세 도구 전부, 항상 |

kit 파일은 안 고친다. 팀 규칙은 `team.md`, 레포 규칙은 그 레포 `AGENTS.md`.

## 자주 걸리는 것

| 상황 | 대처 |
|---|---|
| `/dev` 끝났는데 짧은 말투가 남음 | "normal mode" 한 번. Claude·Codex는 선택 훅이 자동 처리 |
| `/dev` 없이도 caveman이 켜짐 | caveman·ponytail 자체 훅이 켜진 것. `/setup`이 끄는 법을 알려 줌 |
| 어떤 외부 규칙이 적용됐는지 모르겠음 | 명령 첫 줄 `재료: grill-me(질문) · ponytail 세 질문(깎기)`를 본다 |
| `crew`에 너무 큰 일 | 기능 3개·반나절을 넘으면 `/spec`으로 쪼개서 기능마다 `crew build` |
| 커밋·PR 본문이 짧은 말투 | `/write`로 다시 |
| 스택을 잘못 판단함 | `backend:python`처럼 직접 지정 |

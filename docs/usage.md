# kit 사용법

명령 9개를 어떻게 부르고 이어 쓰는지. 설계와 확인 안 된 것은 [restructure.md](restructure.md).

## 부르는 법

| 도구 | 형태 | 예 |
|---|---|---|
| Claude Code (플러그인) | `/kit:<이름>` | `/kit:dev 주문 취소 API 추가` |
| Codex | `$<이름>` | `$dev 주문 취소 API 추가` |
| AGY | `/<이름>` | `/dev 주문 취소 API 추가` |

아래 예는 `/이름`으로 적는다. 모든 Skill은 **이름으로 불러야만** 돈다. 자동으로 끼어들지 않는다. 명령마다 첫 줄에 `재료: …`가 찍힌다. 어떤 규칙과 외부 Skill을 썼는지 보여 주는 줄이다.

## 처음 한 번

```
/setup
```

caveman·ponytail·im-not-ai가 설치돼 있는지 표로 보여 주고, 없는 것은 그 도구의 설치 명령을 알려 준다. 설치는 직접 한다. 안 해도 나머지는 돈다. 설치했으면 자체 훅은 꺼 둔다(표 아래 "기본 끔" 줄).

## 명령 9개

| 명령 | 언제 | 넣는 것 | 나오는 것 |
|---|---|---|---|
| `/dev <요청>` | 코드를 고칠 때 | 요청 한 줄. 파일 경로를 적으면 더 정확 | 테스트 + 구현. 짧은 말투(caveman), 최소 구현(ponytail). 커밋 메시지는 일반 문장 |
| `/spec <요청>` | 뭘 만들지 아직 흐릿할 때 | 아이디어 한두 문장 | 질문 카드(추천 첫 번째) → `docs/specs/<slug>.md`: 문제·해결·사용자 이야기·기능·구현 결정·테스트 결정·완료 조건·안 하는 것 |
| `/write <요청>` | 사람이 읽을 글 | 목적·독자·형식 | 한국어 일반 문장. 끝에 "`/humanize`로 다듬으세요"(im-not-ai가 있을 때) |
| `/check [직군[:스택]] [대상]` | 머지 전, 남의 PR | 생략하면 현재 diff | `VERDICT` → 지적(위치·실패 상황·고치는 법·확신도) → 보류 → 병합 가능?. 파일은 안 고침 |
| `crew <build\|check\|plan> <직군>[:<스택>] <요청>` | 일을 직군에 맡길 때 | 직군, 스택(생략 가능), 요청 또는 spec 경로 | 그 역할의 산출물. 끝날 때마다 3줄로 보여 줌 |
| `/design <화면>` | 화면을 어떻게 짤지 정할 때 | 화면 이름 | 질문 카드(목적→독자→우선순위→제약→분위기) → 구성 2~3개 비교 → `docs/design/<slug>.md` |
| `/design audit` | 디자인 시스템을 점검할 때 | 없음 | 컴포넌트·토큰 목록, 변형 수, 토큰 미사용, 원칙 초안 → 카드로 승인 → `team.md` |
| `/mock <UI 조각>` | 시안을 보고 고르고 싶을 때 | 컴포넌트 하나 | 서로 다른 축의 시안 3개를 피커로 → 고른 것만 코드에 반영. `x5`, `riff <변형>`, `keep <변형>` |
| `/debug <증상>` | 버그·실패·느려짐 | 오류 메시지, 재현 절차, 파일 | 이 버그에만 켜지는 신호부터 → 원인(파일:줄) → 고침 → 회귀 테스트. 3번 실패하면 멈추고 카드 |
| `/setup` | 처음, 또는 도구를 옮겼을 때 | 없음 | 설치 상태 표 + 설치 명령 |

직군: `frontend` `backend` `qa` `designer` `reviewer` `security`. 스택: `react` `animation` `design` `mobile` `python` `java` `node`.

스택을 생략하면 레포 파일로 판단한다: `pyproject.toml` → python, `build.gradle`·`pom.xml` → java, `package.json`에 `react-native`·`expo` → mobile, `react` → react, 그 밖 → node. 화면 코드면 design(패턴 규칙), 모션이 있으면 animation도. 잘못 잡으면 `backend:python`처럼 직접 적는다.

## 하루 흐름 예

```
/spec   주문 취소 기능                     → 질문 카드 몇 장 → docs/specs/order-cancel.md
/dev    docs/specs/order-cancel.md의 F1     → 테스트 + 코드
/check  backend:python                     → 지적 3개
/dev    지적 1·3번 반영                     → 수정
/write  이 변경의 PR 본문                   → 한국어 초안
/humanize                                   → 다듬은 본문 (im-not-ai)
```

- `/spec` → `/dev`로 넘길 때 spec 파일 경로와 기능 ID를 적는다. 다시 묻지 않고 읽는다.
- `/check` → `/dev`로 넘길 때 지적 번호만 적는다.
- `/dev`는 같은 작업이 이어지는 동안 유지된다. 다른 주제를 꺼내거나 `/write`·`/spec`을 치면 풀린다.

## 화면 작업 예

```
/design  주문 목록 화면        → 질문 카드 → 구성 비교(테이블·카드·타임라인, 추천 첫 번째) → docs/design/order-list.md
/mock    주문 카드             → 밀도·성격·모션 축으로 시안 3개, 피커로 넘겨 보고 2번 선택 → 코드 반영
/dev     docs/design/order-list.md 구현
/check   design                → 브라우저에서 상태별 스크린샷·콘솔·키보드 흐름, 최악 데이터, 모션
/design  audit                 → 컴포넌트 변형 수·토큰 미사용 표, 원칙 초안 승인 → team.md
```

`/check design`은 dev 서버를 띄울 수 있을 때 Playwright로 실제 화면을 본다. 못 띄우면 코드만 본다.

## 직군에 맡기는 예

```
crew build backend:java 결제 재시도 큐      → backend 역할 + java 스택으로 구현. 끝나면 3줄 보고
crew check security                        → 보안 관점 지적만 (읽기 전용)
crew check qa                              → 테스트 빠진 곳
crew plan frontend 알림 센터               → 작업 단위로 쪼갠 표 (docs/specs/<slug>-plan.md)
```

같은 diff를 `crew check security`·`crew check qa`로 따로 돌리면 관점이 달라 겹치는 지적이 적다.

spec에 직군이 둘 이상이면 `crew build docs/specs/<slug>.md`가 카드로 묻는다:

```
Q1. spec에 backend·frontend 일이 있습니다. 어떻게 맡길까요?
  1. 병렬: backend:python + frontend:react, 계약 먼저 (추천) — 기능이 서로 독립
  2. 순차: backend 먼저 → frontend — 계약이 아직 흔들릴 때
  3. 하나로: backend가 둘 다 — 변경이 작을 때
```

병렬이면 본 세션이 먼저 `contract.md`(API 모양·오류 코드)를 뽑고 둘을 동시에 띄운다. 계약을 바꿔야 하면 에이전트가 `contract-changes.md`에 적고 본 세션이 판단한다(같은 건 3회까지). 끝나면 머지 → 계약 테스트 → `/check`. 서브에이전트가 없는 도구에서는 같은 세션에서 순서대로 한다.

맡긴 결과(보고, 리뷰, 계약)는 레포의 `.kit/<slug>/`에 남는다. `crew`가 `.git/info/exclude`에 `.kit/`을 넣어 커밋되지 않게 한다.

## 질문 카드

`/spec`·`/design`·`/mock`·`crew`·`/debug`가 물을 때는 모두 같은 형식이다. 카드가 있는 도구는 카드로, 없는 도구는 번호 목록으로. 추천이 항상 1번이고 라벨 끝에 "(추천)". 한 번에 질문 4개까지. 사실은 묻지 않고 레포에서 찾는다.

```
Q1. 취소 가능 시점은?
  1. 배송 전까지 (추천) — 가장 흔한 정책, 나중에 넓힐 수 있음
  2. 결제 직후만 — 구현이 가장 작음
  3. 언제든 — 환불·재고 처리가 복잡해짐
```

번호로 답하거나 "직접 적기"에 쓴다. 직군·스택을 빼먹어도 같은 카드로 묻는다(추천은 요청과 레포 파일로).

## 팀 규칙 넣는 곳

| 파일 | 내용 | 누가 읽나 |
|---|---|---|
| `stacks/react/team.md` | 상태 관리, 폴더 구조, 이름 짓기, 스타일, 금지, 검사 명령 | `/dev`, `/check`, `crew`, `/mock` |
| `stacks/design/team.md` | 디자인 원칙 P1~P4, 규칙 R1~R7, 토큰·컴포넌트 위치, 결정 기록 | `/design`, `/mock`, `/check design` |
| `stacks/python`·`java`·`node`·`mobile/team.md` | 버전·도구, 구조, 이름, 오류, 테스트, 금지, 검사 명령 | `/dev`, `/check`, `crew`, `/debug` |
| 레포의 `AGENTS.md` | 그 레포에서만 다른 점 | 세 도구 전부, 항상 |

다섯 `team.md`에는 범용 기본값이 들어 있다. 팀이 바꾸면 바뀐 줄이 이기고, 레포의 실제 설정(lint·tsconfig·`AGENTS.md`)이 `team.md`보다 우선한다. kit의 다른 파일은 안 고친다.

## 자주 걸리는 것

| 상황 | 대처 |
|---|---|
| `/dev` 끝났는데 짧은 말투가 남음 | "normal mode" 한 번. Claude·Codex는 `~/.config/agent-kit/hooks`에 `plain=on`을 적으면 훅이 자동 처리 |
| `/dev` 없이도 caveman이 켜짐 | caveman·ponytail 자체 훅이 켜진 것. `/setup`이 끄는 법을 알려 줌 |
| 어떤 외부 규칙이 적용됐는지 모르겠음 | 명령 첫 줄 `재료: …`를 본다 |
| `crew`에 너무 큰 일 | 기능 3개·반나절을 넘으면 `/spec`으로 쪼개서 기능마다 `crew build` |
| 커밋·PR 본문이 짧은 말투 | `/write`로 다시 |
| 스택을 잘못 판단함 | `backend:python`처럼 직접 지정 |
| vendor 파일이 `references/…`를 가리키는데 없음 | 가져오지 않은 부속 파일. 무시한다 |
| 브라우저 확인이 안 됨 | Playwright가 없거나 dev 서버를 못 띄움. 코드 리뷰만 하고 그렇다고 적는다 |

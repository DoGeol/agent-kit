# 작업 진행 예시

[← orchestration-kit](../README.md)

현재 구현된 Skill로 작업을 진행하는 흐름을 예시 하나로 따라간다. 규칙의 원본은 [`policies/`](../policies/README.md)다. 이 문서는 사용법을 보여 줄 뿐 규칙을 정하지 않는다.

예시 상황: 화면 저장소 `shop-web`과 API 저장소 `shop-api`가 있다. "비밀번호 재설정 기능"을 추가한다.

```text
USER
 └─ Portfolio Coordinator (workspace-hub)      업무 등록·위임·보고 수집
     ├─ shop-api Coordinator ── Orca ── Worker  구현·검증·보고
     └─ shop-web Coordinator ── Orca ── Worker
```

## 0. 처음 한 번만 하는 준비

Plugin을 설치한다 (user 범위, 모든 저장소에서 쓴다).

```
claude plugin install orchestration-kit@dg-agent-kit
```

저장소마다 setup Skill을 한 번 실행한다.

| 어디서 | 말하기 | 결과 |
|---|---|---|
| `workspace-hub` | "이 저장소 오케스트레이션 Portfolio로 초기화해줘" | `portfolio/PROJECTS.md`, `TASKS.md`, `DASHBOARD.md` 등 생성 |
| `shop-api` | "Project로 초기화하고 hub에 연결해줘. taskPrefix는 API" | `.ai/` 생성, hub에 등록 |
| `shop-web` | 같은 요청, taskPrefix는 WEB | 같은 결과 |

- 없는 파일만 만든다. 기존 `CLAUDE.md`, `AGENTS.md`는 덮어쓰지 않는다. 진입점 문구 추가는 승인을 받는다.
- Orca 저장소 등록은 확인을 받고 한다.
- Codex Worker를 쓸 저장소면 원본 저장소 경로를 Codex 신뢰 목록에 한 번 등록할지 묻는다. 한 번 등록하면 그 저장소의 새 Worktree 전체에 적용된다.

## 1. Portfolio: 업무를 나눠 맡긴다

`workspace-hub`에서 Claude를 열고 말한다.

> 비밀번호 재설정 기능 추가. 이메일로 링크 보내고 새 비밀번호 설정 화면까지. 우선순위 high

Portfolio Coordinator가 하는 일:

1. `PORT-0010`을 등록하고 프로젝트별로 나눈다.
2. 위임 명세를 만든다.
   - `handoffs/outbox/shop-api/PORT-0010.md`: 재설정 토큰 API. 제안 역할 `backend`.
   - `handoffs/outbox/shop-web/PORT-0010.md`: 요청 화면과 새 비밀번호 화면. 제안 역할 `frontend` + `designer`.
3. API 계약이 두 프로젝트에 걸리므로 `shop-api`를 먼저 하라고 적는다.

Portfolio는 코드를 고치지 않는다. 나누고 맡기고 결과를 모은다.

## 2. Project: 실제 작업

`shop-api`에서 Claude를 따로 열고 말한다.

> hub의 PORT-0010 위임 받아서 진행해줘

Project Coordinator가 하는 일:

1. **수락**: 명세의 `projectId`가 `shop-api`인지 확인하고, `.ai/TASKS.md`에 `API-0012`를 만들어 `PORT-0010`과 연결한다. 수락하지 못하면 같은 ID를 `blocked`로 두고 `blocked` 보고를 낸다.
2. **라우팅**: 하위 작업마다 실행 방식, 위치, 역할, 등급, Provider를 정한다.

   | 하위 작업 | 실행 방식 | 역할 | 등급 / Provider |
   |---|---|---|---|
   | 토큰 발급·검증 API | Orca Worker, 새 Worktree | `backend` | `default` / codex |
   | 테스트 보강 | Orca Worker, 새 Worktree | `qa` | `fast` / claude `haiku` |
   | 계약 리뷰 | Orca Worker, 읽기 전용 | `reviewer` | `strong` / claude `opus` |

   이 Worker 계획(3개, codex·claude, `strong` 1개)을 사용자에게 보여 주고 승인받는다.
3. **실행**: 역할 파일 본문과 Worker 제한(쓰기 범위, 커밋·Push 금지)을 Task 명세에 넣고 Orca Worker를 시작해 감독한다. 시작 직전에 `kit.sh usage codex`로 사용량을 읽고, 도는 동안 `kit.sh usage-watch codex`를 백그라운드로 띄워 둔다. 감시가 주의나 한도 임박으로 멈추면 Worker에 중단을 요청하고 다음 Provider로 넘긴다.
4. **검증**: Worker가 "통과"라고 적어도 Coordinator가 테스트와 동작을 직접 확인하고, 역할 수용 기준을 하나씩 대조한다.
5. **커밋·반영·보고**: 반영 방식(`.ai/ORCHESTRATION.md`의 `integration`)에 따른다.
   - `direct-merge`: Coordinator가 커밋하고 기준 브랜치에 병합한 뒤 `.ai/reports/shop-api-API-0012-r01.md`를 커밋한다. Push는 사용자 승인 뒤에 한다.
   - `pull-request`: 작업 브랜치에 결과와 보고서를 커밋하고, 사용자 승인을 받아 Push와 PR을 연다. 병합은 프로젝트 규칙대로 하고 Coordinator가 스스로 하지 않는다. PR이 병합되면 Portfolio가 보고서를 읽는다.
   - 값이 없으면 Coordinator가 저장소 규칙과 병합 기록으로 정하고, 분명하지 않으면 Portfolio에 묻는다.

`shop-web`도 같은 방식으로 진행한다. 화면 변경이 크면 Worker를 나눈다.

1. `designer` Worker가 설계 문서만 쓴다.
2. Coordinator가 설계를 수락한다.
3. `frontend` Worker가 구현한다.

작은 화면 수정이면 Worker 1개에 `frontend` + 보조 `designer`로 맡긴다. 규칙은 [roles.md](../policies/roles.md#조합-한-worker와-여러-worker).

## 3. Portfolio: 결과를 모은다

`workspace-hub`에서 말한다.

> 보고 수집해줘

양쪽 보고서를 읽고 `PORT-0010`을 `completed`로 바꾼다. `DASHBOARD.md`와 후속 업무를 갱신한다. 같은 보고서는 다시 처리하지 않는다.

## 다른 사람과 같이 쓰는 저장소 (개인 모드)

팀 저장소에 Kit 파일을 넣고 싶지 않으면 setup에서 개인 모드를 고른다.

> 이 저장소 개인 모드로 초기화하고 hub에 연결해줘

- 상태 폴더는 내 hub의 `projects/<projectId>/.ai/`에 생긴다. 팀 저장소의 파일은 그대로다.
- Coordinator 세션은 저장소(또는 그 Worktree)에서 project Skill로 시작한다. Skill이 `kit.sh where`로 상태 폴더를 찾는다.
- 브랜치·커밋·PR은 그 저장소 관례만 따른다. Kit ID나 Kit 이야기는 넣지 않는다. 동료에게는 평소처럼 올린 PR만 보인다.
- 보고서는 hub에 커밋한다. Portfolio는 hub에서 바로 읽는다.

## Portfolio 없이 쓰기

한 저장소 안의 작은 일은 그 저장소 세션에서 바로 시킨다.

> `/health`에 HEAD 지원 추가해줘

Coordinator가 Direct, Subagent, Worker 중 하나를 고르고 보고서까지 남긴다. Portfolio는 나중에 보고를 수집할 때 이 보고서를 같이 가져간다.

## Worker의 모델과 effort를 정하는 방법

Coordinator가 하위 작업마다 아래 순서로 정한다. 표와 값의 원본은 [routing.md](../policies/routing.md#모델과-effort)다.

1. **등급을 고른다.** 일의 성격으로 `fast` / `default` / `strong` 중 하나를 routing.md의 등급 표에서 고른다. 예: 기계적 수정은 `fast`, 계약 리뷰는 `strong`. 역할 파일의 `기본 등급`은 힌트일 뿐이다.
2. **Provider를 고른다.** 요청에 지정이 있으면 따르고, 없으면 Provider 순서에서 사용량 여유가 있는 첫 후보를 고른다. 리뷰는 구현한 Provider가 아닌 쪽을 먼저 고른다 ([routing.md](../policies/routing.md#provider-선택)).
3. **등급을 모델로 바꾼다.** routing.md의 Provider별 표를 따른다. 예: Claude `fast`는 `haiku`, Codex `fast`는 `gpt-6-luna` + effort `low`. `default`는 모델과 effort를 넘기지 않고 사용자 기본 설정을 쓴다. AGY는 effort가 모델 ID에 들어 있다 (예: `gemini-3.8-flash-low`).
4. **프로젝트 Override를 확인한다.** `.ai/ORCHESTRATION.md`의 `프로젝트별 Override`에 값이 있으면 그것을 따른다. 예: `default 등급: claude sonnet, effort high`.
5. **effort는 지원할 때만 넘긴다.** Orca는 `--effort`만 넘길 수 없고 `--model`과 함께 넘긴다.
6. **실제 적용값을 기록한다.** Orca `worker-start` 응답의 `launch.effective`를 `TASKS.md`의 `실행 방식` 열에 적는다. 예: `Independent Session (Orca codex worker, role: backend, fast: gpt-6-luna + low, 새 Worktree)`.
7. **Worker 계획을 승인받는다.** Task마다 Worker 수, Provider, `strong` 등급 사용을 사용자에게 보여 주고 승인받는다. 승인한 범위 안에서는 다시 묻지 않는다.

## 아직 사람이 하는 일

- Project 세션은 프로젝트마다 직접 연다. Coordinator 하나는 한 번에 Run 하나를 감독한다.
- 위임 명세를 Project 세션에 넘기는 것은 사람이 하거나, Project Coordinator 세션이 살아 있으면 Portfolio가 세션 간 메시지로 경로를 보낸다 (Claude Code 세션에서 확인). 사람이 할 때는 "PORT-0010 받아서 진행" 한 줄이면 된다.
- 보고 수집은 요청하거나 Portfolio 세션을 시작할 때 한다. 자동 알림은 없다.
- 에이전트 설정 변경, Orca 등록, 외부 배포, Push는 그때마다 승인한다.

# 실행 라우팅

[← 공통 정책](README.md)

두 가지를 따로 판단한다. **누가 실행하나**, 그리고 **어디서 실행하나**. [확정] 새 Session ≠ 새 Worktree.

| 상황 | 실행 주체 | Worktree |
|---|---|---|
| 간단한 설명, 작은 수정 | Direct (Coordinator 직접) | 현재 |
| 일회성 조사, 코드 탐색, 로그 분석, 짧은 리뷰 | Subagent | 현재 (읽기 전용) |
| 여러 단계 구현, 장시간 작업, 다른 모델, 동료와 직접 대화 | Independent Session | 수정하면 보통 새 Worktree |
| 다른 모델의 교차 검증 | Codex·AGY Session | 읽기 전용이면 현재 |
| 여러 Worker가 같은 저장소를 동시에 수정 | 각자 Session | 각자 Orca Worktree |
| 같은 파일을 두고 의견 충돌 | 작성자 1명 + 리뷰어 | 작성자 Worktree만 수정 |
| 여러 읽기 전용 세션 | Session | 같은 Worktree 가능 |
| 기존 Task의 관련 후속 구현 | 기존 Session 재사용 검토 | 기존 |
| 관련 없는 새 기능, 맥락이 과도하게 쌓인 세션 | 새 Session | 판단 |

판단 순서:

1. 작고 파일 범위가 좁으며 Coordinator 맥락으로 충분한가? → Direct.
2. 결과를 짧은 요약·리뷰로 받으면 되는가? → Subagent.
3. 그 밖에는 Independent Session. 다른 시각이나 전문성이 필요하면 Codex·AGY를 고려한다.
4. 그다음 따로: 동시에 충돌할 수 있는 코드 수정이 있으면 새 Worktree, 아니면 현재 Worktree.

## 병렬 실행 규칙

- [권장] 동시 Worker는 프로젝트당 최대 3개.
- Worker마다 파일 소유 범위를 정한다. lockfile·공유 타입처럼 공유 파일은 수정자를 한 명 지정한다.
- 프로젝트 내부 계약을 먼저 합의한 뒤 독립 작업으로 나눈다.
- 실패나 지연이 있어도 같은 편집 작업에 Worker를 중복 투입하지 않는다.
- 다른 Worktree의 결과는 자동 공유되지 않는다. 병합 시점과 승인자를 정한다.
- Worker는 커밋·브랜치 변경·Push를 하지 않는다. Coordinator가 검증한 뒤 그 Worktree에서 소유 범위 파일만 이름으로 지정해 커밋하고(`git add -A` 금지) 기준 브랜치에 병합한다. 커밋 메시지와 브랜치 이름은 프로젝트 규칙(`.ai/PROJECT.md`, 기존 기여 문서)을 따른다. 병합 조건은 [permissions.md](permissions.md#안전-규칙).
- 병렬 결과를 잇는 공유 파일 수정(링크, 목차 등)은 병합 뒤 Coordinator가 한다.
- 병합이 끝난 Worktree를 정리할지는 사용자에게 확인한다. 미커밋·미병합 작업이 있는 Worktree는 [permissions.md](permissions.md#안전-규칙)를 따른다.
- Portfolio에서 위임받은 업무도 실행 방식은 Project Coordinator가 정한다.
- Orca로 Worker를 감독할 때는 설치된 Orca 버전의 가이드를 먼저 읽는다 (`orca skills get orchestration --full`). 이 문서에 Orca 명령 문법을 고정하지 않는다.
- Worker를 시작하기 전에 같은 Task의 기존 Worker가 있는지 Orca에서 확인한다.

## 모델과 effort

작업마다 **등급**을 먼저 정하고, 등급을 Provider의 모델로 바꾼다.

- [확정] 추론이 크게 필요 없는 작업(테스트·PoC, 기계적 수정, 단순 문서)은 빠른 모델로 실행한다.
- [권장] 나머지 등급과 effort 값. 프로젝트별로 `.ai/ORCHESTRATION.md`의 Override에서 바꾼다.

| 등급 | 작업 | 모델 | effort |
|---|---|---|---|
| `fast` | 테스트·PoC, 기계적 수정(이름 변경, 포맷, 템플릿 채우기), 단순 문서, 탐색·로그 분석·짧은 리뷰 | 빠른 모델 | 지원하면 low, 아니면 생략 |
| `default` | 일반 구현 Worker, Coordinator | 사용자 기본 (넘기지 않음) | 사용자 기본 |
| `strong` | 아키텍처 결정, 계약(프로젝트 내부·프로젝트 간) 리뷰, 교차 검증, 원인 불명 장애 분석 | 가장 강한 모델 | high 이상 |

Provider별 모델 (별칭은 도구가 최신 버전으로 해석한다):

| 등급 | Claude | Codex | AGY |
|---|---|---|---|
| `fast` | `haiku` | `gpt-6-luna` + effort `low` | `gemini-3.8-flash-low` |
| `default` | 넘기지 않음 | 넘기지 않음 | 넘기지 않음 |
| `strong` | `opus` | `gpt-6-astra` + effort `high` | `gemini-4-argon-high` |

- `default`는 모델·effort를 넘기지 않는다. Worker는 사용자의 에이전트 기본 설정을 따른다.
- Codex 모델 ID는 별칭이 없어 세대마다 바뀐다. 쓸 수 있는 ID와 설명은 Codex 모델 목록에서 확인한다 ("Fast and affordable" 계열을 `fast`로). Orca Codex Worker에서 `gpt-6-luna` + `low`가 실제 적용되고 완료까지 동작했다. `strong`은 "Frontier intelligence" 계열(`gpt-6-astra`)이다.
- AGY 모델 ID는 effort를 이름에 담는다 (`-low`·`-medium`·`-high`). effort를 따로 넘기지 않는다. 목록은 `agy models`로 확인한다. Gemini 계열과 Claude·GPT 계열은 AGY 안에서 한도를 따로 쓰므로, AGY에서는 Gemini 계열을 기본으로 한다.
- [검증됨] Codex `strong`, AGY `fast`·`strong`은 Orca Worker에서 실제 적용값(`launch.effective`)과 읽기 전용 작업 완료까지 확인했다. 등급에 맞는 품질은 아직 비교하지 않았다.
- effort는 그 모델이 지원할 때만 넘긴다. 지원 여부를 모르면 생략하고 실제 적용값을 확인한다.
- Orca는 `--effort`만 넘길 수 없다. `--model`이 같이 있어야 한다. effort만 바꾸려면 사용자 기본 모델 이름을 명시한다.
- `TASKS.md`의 `실행 방식` 열에 역할([roles.md](roles.md))과 등급을 같이 적는다. 예: `Independent Session (Orca claude worker, role: frontend, fast: haiku, 새 Worktree)`.

- 요청값과 실제 적용값을 구분한다. 실행 도구가 돌려준 실제 적용값(Orca는 `worker-start` 응답의 `launch.effective`)을 `TASKS.md`의 `실행 방식` 열에 적는다. 요청값만 보고 적용됐다고 쓰지 않는다.
- Worker 계획(Worker 수, Provider 후보 순서, `strong` 등급)은 Task마다 사용자 승인을 받는다 ([permissions.md](permissions.md#결정권)). Provider 고르는 법은 [Provider 선택](#provider-선택).

## Provider 선택

역할과 등급을 정한 뒤 하위 작업마다 Provider를 고른다. 역할 명세는 Provider와 무관하므로 어느 Provider든 같은 명세를 받는다.

### 정하는 순서

1. **요청에 지정이 있으면 따른다.**
   - 사용자가 지정하면 그대로 쓴다 (예: "이건 codex로", "리뷰는 opus로").
   - 위임 명세의 `제안 Provider`는 Portfolio 결정으로 보고 따른다. 쓸 수 없으면(한도, 준비 안 됨) Portfolio에 알린다.
   - `.ai/ORCHESTRATION.md` Override에 역할별 지정이 있으면 따른다 (예: `reviewer: claude`).
2. **지정이 없으면 Coordinator가 고른다.**
   1. 후보: Provider 순서(Override, 없으면 아래 기본 순서) 중 그 등급의 모델이 있는 Provider.
   2. 뺀다: 준비 안 됨(설치 안 됨, Codex 원본 저장소 신뢰 미등록 등), 방금 읽은 사용량이 주의 이상([기준](#기준), 소모 속도 반영), Coordinator 몫 보호 대상.
   3. 리뷰·교차 검증은 그 결과를 만든 Provider가 아닌 후보를 먼저 고른다.
   4. 남은 후보 중 순서상 첫 번째를 쓴다. 후보가 없으면 기다리거나 Portfolio에 확인한다.
3. **고른 이유를 남긴다.** `TASKS.md`의 `실행 방식` 열에 한 줄로 적는다. 예: `codex (자동: claude 5h 72%로 제외, 순서 2번째)`. 적은 사용률은 그때의 근거일 뿐이고 다음 판단에 쓰지 않는다.

Worker 계획 승인([permissions.md](permissions.md#결정권))은 이 후보 순서까지 포함한다. 작업 중에 같은 등급 안에서 순서상 다음 후보로 바꾸는 것은 다시 묻지 않는다. 순서 밖 Provider나 등급 낮추기는 [Portfolio 확인](#portfolio-확인)을 거친다.

### 기본 순서

[권장] 모든 등급에서 `claude` → `codex` → `antigravity`. 프로젝트는 Override의 `Provider 순서`, `제외 Provider`로 바꾼다. Portfolio는 주간 사용량을 보고 `PRIORITIES.md`에 이번 주 Provider 비중을 적을 수 있고, Project는 그것을 순서에 반영한다.

### 역할별 검증 현황

[검증됨] 이 Kit의 PoC에서 완료와 수락까지 확인한 조합이다.

| Provider | 확인한 역할 |
|---|---|
| Claude (`haiku`) | `frontend`+`designer`, `qa`, `docs` |
| Codex | `backend` |
| AGY | `reviewer`(읽기 전용), `backend` |

표에 없는 조합도 쓸 수 있다. 쓰면 결과를 다른 Provider가 리뷰하거나 Coordinator가 평소보다 자세히 확인하고, 수락하면 이 표에 더한다.

### Coordinator 몫

[권장] Coordinator와 같은 Provider의 Worker는 그 Provider의 5시간 사용률이 70% 이상이면 새로 시작하지 않는다. Coordinator가 먼저 멈추는 것을 막는다.

## 사용량

구독 한도(5시간·주간)에 걸리면 Worker와 Coordinator가 일을 멈춘다. 시작 전과 작업 중에 확인한다.

### 읽는 방법

셸에서 `scripts/kit.sh usage [claude|codex|antigravity ...]`로 읽는다 (생략하면 셋 다). 줄마다 `usage`, Provider, 상태, 5시간 %, 주간 %, 5시간 초기화까지 남은 분, 출처가 탭으로 나뉜다. 상태는 `ok`(정상)·`caution`(주의)·`danger`(위험)·`unknown`(못 읽음, 마지막 칸이 이유)이다. 모델을 호출하지 않으므로 비용이 없다.

[검증됨] Provider마다 출처가 다르다:

| Provider | 출처 | 걸리는 시간 |
|---|---|---|
| Claude | Orca `account list --json`의 값. Claude Code가 응답마다 Orca에 보내므로 Claude 세션이 돌고 있으면 최신이다. `updatedAt`이 15분(`KIT_USAGE_STALE_MIN`)보다 오래됐으면 `claude -p /usage`로 읽는다 | 1초 안쪽, 대체 시 5초 안팎 |
| Codex | `codex app-server`의 `account/rateLimits/read`. Orca가 Codex를 띄우는 활성 계정 홈을 쓴다 (`KIT_CODEX_HOME`으로 바꾼다) | 1초 안쪽 |
| AGY | `agy -p /usage --output-format json`. 1.1.11 미만에서는 읽지 않는다. Orca가 같은 기준을 쓰고, 그 이전 버전은 `/usage`를 프롬프트로 처리해 한도를 쓴다고 Orca 코드에 적혀 있다 (AGY 문서로는 확인하지 않음) | 7초 안팎 |

- Orca가 보여 주는 Codex·AGY 값은 쓰지 않는다. [검증됨] 몇 시간 동안 갱신되지 않은 채 `status: ok`로 남은 적이 있다.
- 값은 Provider별 활성 계정 기준이다. Claude Coordinator와 Claude Worker는 같은 계정 한도를 나눠 쓴다.
- 판단할 때마다 새로 읽는다. 전에 읽은 값이나 `TASKS.md`에 적은 값으로 판단하지 않는다.
- `unknown`이면 그 Provider를 주의로 본다.

### 확인 시점

읽는 데 비용이 없으므로 시작과 완료마다 읽는다.

| 시점 | 읽는 Provider |
|---|---|
| Coordinator 세션 시작·재진입 | 전부 |
| Worker 계획 승인 전 | 후보 순서의 Provider 전부 |
| Worker 시작 직전 | 그 Worker의 Provider |
| `worker_done`을 받을 때 | 그 Worker의 Provider, Coordinator의 Provider |
| 체크포인트·인계를 쓸 때 | 전부 |
| Worker 실행 중 | 아래 작업 중 감시 |

### 작업 중 감시

Worker를 시작하면 그 Worker의 Provider를 감시한다. Coordinator와 같은 Provider면 Coordinator 몫도 함께 지켜진다.

```sh
scripts/kit.sh usage-watch [--interval 120] [--until caution] [--for 240] <provider>...
```

- 멈출 때까지 아무것도 출력하지 않는다. 멈추는 경우: 상태가 `--until` 이상, 지금 소모 속도로 5시간 초기화 전에 100%에 닿을 것으로 보임(`projected`), 두 번 연속 `unknown`, `--for`분 경과(`timeout`). 멈추면 `watch`와 이유 한 줄, 그 뒤에 사용량 줄을 출력한다.
- 기다리는 동안은 셸과 `sleep`만 남는다. 읽을 때만 위 표의 명령이 잠깐 돈다. AGY(7초)와 Claude 대체 경로(5초)는 상대적으로 무거우므로, 가볍게 하려면 그 Provider만 따로 띄우고 `--interval`을 늘린다. Claude Worker가 긴 도구 실행 하나에 오래 머물면 Orca 값이 15분을 넘겨 대체 경로로 읽힐 수 있다.
- 백그라운드로 실행하고 끝나면 알림을 받는 기능이 있으면 감시를 그렇게 띄우고, Worker 완료 대기(`check --wait`)도 같은 방식으로 띄운다. 둘 중 먼저 끝나는 쪽에 반응하므로 대기 중에 Coordinator가 깨어날 필요가 없다. 이 기능이 없으면 완료 대기를 10~15분으로 나누고 깰 때마다 `kit.sh usage`로 읽는다.
- 감시가 멈추면 아래 기준과 작업 중 한도 대응을 따른다. 실행 중인 Worker가 남아 있으면 감시를 다시 띄우고, Worker가 모두 끝나면 감시를 멈춘다.
- [검증됨] `sample-api`의 Claude Worker로 두 갈래를 확인했다. 감시가 먼저 멈춘 경우: 깨어남 → 중단 요청 → Worker가 진행 파일을 쓰고 `failed`로 완료 → 같은 Worktree에서 `--retry-of`로 재시작 → 진행 파일을 보고 끝난 단계를 건너뜀. 완료 대기가 먼저 끝난 경우: 결과 처리 뒤 감시를 멈춤.

### 기준

[권장] 기본값. `.ai/ORCHESTRATION.md` Override로 바꾸고, `kit.sh`에는 환경 변수 `KIT_USAGE_CAUTION`(70)·`KIT_USAGE_DANGER`(85)·`KIT_USAGE_WEEKLY`(90)로 넘긴다.

| 상태 | 기준 | 할 일 |
|---|---|---|
| 정상 | 5시간 70% 미만, 주간 90% 미만 | 계획대로 진행 |
| 주의 | 5시간 70% 이상 85% 미만 | 그 Provider로 새 `strong` Worker를 시작하지 않는다. 남은 일이 초기화 전에 끝날지 보고 대안을 준비한다 |
| 위험 | 5시간 85% 이상, 주간 90% 이상, 또는 Provider가 한도 도달로 알림 | 그 Provider로 새 Worker를 시작하지 않는다. 아래 작업 중 한도 대응을 따른다 |

두 번 읽은 값의 차이로 소모 속도를 보고, 초기화 전에 100%에 닿을 것 같으면 한 단계 높은 상태로 본다 (`usage-watch`의 `projected`).

### 작업 중 한도 대응

Worker가 쓰는 Provider가 위험이면:

1. 그 Provider로 실행 중인 Worker에게 중단 요청을 보낸다 (Orca `send --to dispatch:<id>`). [검증됨] Worker는 다음 확인 지점에서 진행 상황을 결과 파일에 적고 `--outcome failed`로 완료를 보낸다.
2. Worktree와 미커밋 변경은 지우지 않는다.
3. 이어갈 방법을 고른다. 품질이나 일정에 영향이 있으면 아래 Portfolio 확인을 거친다.
   - 초기화 시각까지 기다린 뒤 같은 Provider로 재시작
   - 다른 Provider로 재시작 (같은 역할 명세와 진행 파일 경로). 후보 순서 안의 다음 Provider면 확인 없이 한다
   - 다른 계정으로 전환한 뒤 재시작 (사용자가 Orca 화면에서 전환한다. 새 세션부터 적용된다)
   - 등급 낮추기
4. 같은 Task를 같은 Worktree에서 `--retry-of`로 다시 시작한다. 명세에 진행 파일 경로와 "이미 끝낸 단계는 다시 하지 않는다"를 넣는다.

Coordinator가 쓰는 Provider가 위험이면:

1. 새 Worker를 시작하지 않는다. 같은 Provider의 Worker는 위 1번대로 멈춘다. 다른 Provider의 Worker는 계속 둔다 (완료 메시지는 Orca에 쌓이고 다음 세션에서 받는다).
2. [lifecycle.md](lifecycle.md#체크포인트)의 인계 항목까지 체크포인트를 채우고 기준 브랜치에 커밋한다.
3. Portfolio 세션이 살아 있으면 알리고, 사용자에게 재개 가능 시각을 알린다.
4. 재개는 초기화 뒤 같은 Provider로, 또는 사용자가 계정을 바꾼 새 세션에서 한다.

예고 없이 한도에 걸렸을 때: Worker가 진행 없이 멈추면 Orca `worker-read`로 출력을 보고 한도 문구(Claude: `You've hit your session limit`)를 찾고 `kit.sh usage`로 읽는다. 한도면 위 Worker 절차의 2번부터 따른다.

Claude의 자동 재개: Claude Code 대화형 세션(claude.ai 구독 로그인)은 5시간 한도에 걸리면 기본으로 그 자리에서 기다렸다가 초기화 뒤 하던 일을 이어 간다 (설정 `autoContinueAtUsageLimit`, Claude Code 2.1.234 이상). `claude -p`는 기다리지 않는다. Orca는 Claude Worker를 사용자 기본값대로 터미널(대화형)로 띄우고 `--settings`를 넘기지 않으므로 이 조건에 맞는다 (설정 확인). 실제로 이어 가는지는 한도에 걸렸을 때 관찰해 이 문장을 고친다.

- 한도에 걸린 Claude Worker는 초기화 뒤 스스로 이어 갈 수 있다. 다른 Provider로 같은 일을 재시작하기 전에 원래 Worker를 먼저 release하거나 멈춘다. 두 Worker가 같은 Worktree를 고치지 않게 한다.
- 초기화까지 기다리기로 했으면 Claude Worker는 그대로 둬도 된다. 초기화 뒤 진행이 없으면 위 Worker 절차를 따른다.
- 기다리는 화면에 나오는 `/usage-credits` 같은 결제 선택지는 쓰지 않는다 ([쓰지 않는 것](#쓰지-않는-것)).

### Portfolio 확인

등급 낮추기, 후보 순서 밖의 Provider, 기다림으로 인한 일정 지연처럼 품질이나 일정에 영향이 있는 선택은 Project Coordinator가 Portfolio에 확인을 요청한다. Portfolio 세션이 살아 있으면 세션 간 메시지로, 없으면 사용자에게 묻는다. 요청에 적는다: Task, Provider별 사용량과 초기화 시각, 남은 일, 선택지마다 품질·일정 영향. 결정은 `TASKS.md`의 `실행 방식`과 `STATUS.md`(또는 `decisions/`)에 남긴다.

### 쓰지 않는 것

- [확정] 한도 초기화 크레딧(Codex `rateLimitResetCredits` 등)과 추가 사용량 결제는 쓰지 않는다.

## 반영 방식

결과를 기준 브랜치에 넣는 방식이다. 프로젝트마다 `.ai/ORCHESTRATION.md`의 `integration`에 적는다.

| 값 | 흐름 | 완료 시점 |
|---|---|---|
| `direct-merge` | Coordinator가 Worker 결과를 커밋해 기준 브랜치에 병합하고, 보고서도 기준 브랜치에 커밋한다. Push는 승인 뒤에 한다 | 병합하고 보고서를 커밋했을 때 |
| `pull-request` | 아래 PR 흐름 | PR이 병합됐을 때 |

### 정하는 법

`integration`이 `unset`이거나 없으면 첫 Task 전에 정한다.

1. 프로젝트 규칙과 기록을 읽는다: `AGENTS.md`·`CLAUDE.md`·`CONTRIBUTING.md`, 최근 병합 기록(대부분 PR 병합인지), CI 설정, 브랜치 보호(읽을 수 있으면).
2. 근거가 한쪽을 분명히 가리키면 Coordinator가 정한다. `integration` 값과 근거 한 줄을 `.ai/ORCHESTRATION.md`에 적는다. 예: "기준 브랜치 직접 커밋 금지 (AGENTS.md), 최근 병합 8건 모두 PR".
3. 근거가 없거나 서로 다르면 Portfolio에 묻는다. Portfolio 세션이 없으면 사용자에게 묻는다.
4. 프로젝트 규칙이 이 Kit보다 엄격하면 프로젝트 규칙을 따른다 (예: 병합은 사용자가 요청할 때만, 커밋 메시지 형식, 커밋 전 검사).

### PR 흐름 (`pull-request`)

1. Task마다 원격 기준 브랜치(`origin/<기준>`)에서 새 Worktree와 작업 브랜치를 만든다. 브랜치 이름은 프로젝트 규칙을 따르고, 없으면 `<projectTaskId 소문자>-<요약>`. 개인 모드는 Kit ID를 넣지 않고 저장소 관례만 따른다. 실행 도구가 브랜치 이름에 접두어를 붙이면(예: Orca의 사용자 이름 접두어) Push 전에 저장소 관례로 바꾼다.
2. Worker는 작업 브랜치에서 갈라진 Worktree에서 일한다. Coordinator가 Worker 결과를 작업 브랜치에 병합한다 (작업 트리가 깨끗할 때).
3. 프로젝트의 커밋 전 검사가 있으면 커밋 전에 돌린다.
4. 완료 보고서(`status: completed`)를 작업 브랜치에 넣는다. PR이 병합되면 기준 브랜치에 들어가 Portfolio가 읽는다. 개인 모드는 보고서를 PR에 넣지 않는다. PR이 병합되면 hub에 보고서를 커밋한다.
5. Push와 PR 생성은 매번 사용자 승인을 받는다 ([permissions.md](permissions.md#결정권)). Push만 승인되면 PR은 사용자가 연다. 이때 브랜치 이름을 `TASKS.md`에 적고, 다음 세션에서 `gh pr list --head <브랜치>`로 PR을 찾는다. CI가 PR에서만 도는 저장소는 Push만으로는 CI가 돌지 않는다. 공유 모드는 PR 본문에 `projectTaskId`와 보고서 경로를 적는다. 개인 모드는 PR 제목·본문·커밋 메시지에 Kit ID와 Kit 언급을 넣지 않는다.
6. CI가 있으면 결과를 확인한다. 실패하면 고친 커밋을 같은 PR에 더한다.
7. Coordinator는 PR을 스스로 병합하지 않는다. 병합은 프로젝트 규칙을 따르고, 규칙이 없으면 사용자에게 묻는다.
8. Task 상태: PR을 열면 `in-review`로 두고 PR 주소를 `TASKS.md`의 `Orca 참조` 열에 함께 적는다. 병합되면 `completed`. 병합은 Coordinator 세션이 끝난 뒤에 일어날 수 있으므로, 다음 세션 시작 때 `in-review` Task의 PR 상태를 확인한다 (예: `gh pr view <주소> --json state`). 병합됐으면 `completed`로 바꾸고 보고서를 반영한다 (개인 모드는 이때 hub에 발행). PR이 병합되지 않고 닫히면 다음 보고서(`-r02`)를 `cancelled`나 `blocked`로 써서 새 PR로 낸다.
9. 공유 모드의 `reportsRef`는 원격 추적 브랜치(예: `origin/main`)로 둔다. Portfolio는 `pending` 전에 그 저장소를 `git fetch`한다. 개인 모드는 `reportsRef`를 쓰지 않는다.

## 완료의 세 단계

| 단계 | 요건 | 기록 |
|---|---|---|
| Worker 완료 | 정확한 Task·Dispatch의 `worker_done`과 산출물 | Orca |
| Project 수락 | Diff·테스트·리뷰·통합 확인, 기술 문서 갱신 | `.ai/STATUS.md`, `TASKS.md`, 완료 보고 |
| Portfolio 종결 | 보고 수집, 상위 업무·후속 업무 정리 | `portfolio/TASKS.md`, `DASHBOARD.md` |

`worker_done`만 보고 완료로 처리하지 않는다. Project 수락 절차:

1. 결과가 정확한 Task·Dispatch와 연결되는지 확인한다.
2. Diff, 테스트 결과, 남은 문제를 확보한다.
3. 다른 Worker의 계약과 충돌하지 않는지 검토한다.
4. 필요하면 추가 리뷰나 통합 테스트를 한다.
5. Coordinator가 병합을 결정하고 확정 문서를 갱신한다.

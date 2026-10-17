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
| `fast` | `haiku` | `gpt-6-luna` + effort `low` | 미정 |
| `default` | 넘기지 않음 | 넘기지 않음 | 넘기지 않음 |
| `strong` | `opus` | 미정 | 미정 |

- `default`는 모델·effort를 넘기지 않는다. Worker는 사용자의 에이전트 기본 설정을 따른다.
- Codex 모델 ID는 별칭이 없어 세대마다 바뀐다. 쓸 수 있는 ID와 설명은 Codex 모델 목록에서 확인한다 ("Fast and affordable" 계열을 `fast`로). Orca Codex Worker에서 `gpt-6-luna` + `low`가 실제 적용되고 완료까지 동작했다.
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
   2. 뺀다: 준비 안 됨(설치 안 됨, Codex 원본 저장소 신뢰 미등록 등), 사용량 주의 이상이거나 예상 소모를 더하면 85%를 넘음, Coordinator 몫 보호 대상.
   3. 리뷰·교차 검증은 그 결과를 만든 Provider가 아닌 후보를 먼저 고른다.
   4. 남은 후보 중 순서상 첫 번째를 쓴다. 후보가 없으면 기다리거나 Portfolio에 확인한다.
3. **고른 이유를 남긴다.** `TASKS.md`의 `실행 방식` 열에 한 줄로 적는다. 예: `codex (자동: claude 5h 72%로 제외, 순서 2번째)`.

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

### 소모량 기록과 예상

- Worker를 시작할 때와 끝날 때 그 Provider의 5시간 사용률을 `실행 방식` 열에 적는다. 예: `codex 5h 30→42%`.
- 예상 소모는 같은 역할·등급의 최근 기록으로 잡는다. [권장] 기록이 없으면 15%로 본다.

### Coordinator 몫

[권장] Coordinator와 같은 Provider의 Worker는 그 Provider의 5시간 사용률이 70% 이상이면 새로 시작하지 않는다. Coordinator가 먼저 멈추는 것을 막는다.

## 사용량

구독 한도(5시간·주간)에 걸리면 Worker와 Coordinator가 일을 멈춘다. 시작 전과 작업 중에 확인한다.

### 읽는 방법

- [검증됨] `orca account list --json`의 `result.rateLimits.<provider>` (`claude`, `codex`, `antigravity`): `session`(5시간)과 `weekly`의 `usedPercent`·`resetsAt`(밀리초), 모델별 주간(예: `fableWeekly`), `status`, `updatedAt`. Orca 앱이 몇 분마다 갱신하고 모델을 호출하지 않으므로 비용이 없다.
- 값은 Provider별 활성 계정 기준이다. 다른 계정은 `inactiveClaudeAccounts`·`inactiveCodexAccounts`에 나온다 (계정이 하나뿐인 환경이라 검증 필요).
- Orca에 연결할 수 없을 때: Claude는 `claude -p "/usage" --output-format stream-json --verbose`의 `usage_report.rate_limits` (비용 0), Codex는 세션 기록 `sessions/**/rollout-*.jsonl`의 `rate_limits` (마지막 Codex 실행 시점 값). AGY는 대체 방법이 없다.
- Claude Coordinator와 Claude Worker는 같은 계정 한도를 나눠 쓴다.

### 확인 시점

- Worker 계획을 승인받기 전, Worker를 시작하기 전.
- 작업 중: Worker 완료를 기다릴 때 대기 시간을 10~15분으로 나눠 깰 때마다 확인한다. `worker_done`을 받을 때마다 확인한다.

### 기준

[권장] 기본값. `.ai/ORCHESTRATION.md` Override로 바꾼다.

| 상태 | 기준 | 할 일 |
|---|---|---|
| 정상 | 5시간 70% 미만, 주간 90% 미만 | 계획대로 진행 |
| 주의 | 5시간 70% 이상 85% 미만 | 그 Provider로 새 `strong` Worker를 시작하지 않는다. 남은 일이 초기화 전에 끝날지 보고 대안을 준비한다 |
| 위험 | 5시간 85% 이상, 주간 90% 이상, 또는 `status`가 한도 상태 | 그 Provider로 새 Worker를 시작하지 않는다. 아래 작업 중 한도 대응을 따른다 |

두 번 읽은 값의 차이로 소모 속도를 보고, 초기화 전에 100%에 닿을 것 같으면 한 단계 높은 상태로 본다.

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

예고 없이 한도에 걸렸을 때: Worker가 진행 없이 멈추면 Orca `worker-read`로 출력을 보고 한도 문구(Claude: `You've hit your session limit`)나 `rateLimits.status`를 확인한다. 한도면 위 Worker 절차의 2번부터 따른다.

### Portfolio 확인

등급 낮추기, 후보 순서 밖의 Provider, 기다림으로 인한 일정 지연처럼 품질이나 일정에 영향이 있는 선택은 Project Coordinator가 Portfolio에 확인을 요청한다. Portfolio 세션이 살아 있으면 세션 간 메시지로, 없으면 사용자에게 묻는다. 요청에 적는다: Task, Provider별 사용량과 초기화 시각, 남은 일, 선택지마다 품질·일정 영향. 결정은 `TASKS.md`의 `실행 방식`과 `STATUS.md`(또는 `decisions/`)에 남긴다.

### 쓰지 않는 것

- [확정] 한도 초기화 크레딧(Codex `rateLimitResetCredits` 등)과 추가 사용량 결제는 쓰지 않는다.

## 완료의 세 단계

| 단계 | 요건 | 기록 |
|---|---|---|
| Worker 완료 | 정확한 Task·Dispatch의 `worker_done`과 산출물 | Orca |
| Project 수락 | Diff·테스트·리뷰·통합 확인, 기술 문서 갱신 | `.ai/STATUS.md`, `TASKS.md`, 완료 보고 |
| Portfolio 종결 | 보고 수집, 상위 업무·후속 업무 정리 | `portfolio/TASKS.md`, `DASHBOARD.md` |

`worker_done`만 보고 완료로 처리하지 않는다. Project 수락 절차:

1. 결과가 정확한 Task·Dispatch와 연결되는지 확인한다.
2. Diff, 테스트 결과, 남은 이슈를 확보한다.
3. 다른 Worker의 계약과 충돌하지 않는지 검토한다.
4. 필요하면 추가 리뷰나 통합 테스트를 한다.
5. Coordinator가 병합을 결정하고 확정 문서를 갱신한다.

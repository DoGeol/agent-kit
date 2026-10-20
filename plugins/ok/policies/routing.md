# 실행 라우팅

[← 공통 정책](README.md)

작업마다 세 가지를 정한다: **등급**(S/M/L, 절차의 크기), **단계별 실행 주체**(Subagent 또는 Worker와 그 Provider), **모델 등급**(`fast`/`default`/`strong`). 셋은 따로 정한다.

## 트랙과 등급

| 트랙 | 언제 | 누가 고치나 |
|---|---|---|
| quick (`/ok:quick`) | 파일 3개 이하, 반나절 이내, 계약·저장 데이터 변경 없음 | Coordinator가 직접. Subagent·Worker를 부르지 않는다 |
| plan (`/ok:plan`) | 그 밖 | 기능 세션(Worker)이 기능마다 |

[확정] 작은 변경(diff 300줄 이하, 계약·저장 데이터 변경 없음)은 Worker 1개 또는 Coordinator 직접으로 계획·구현·시험까지 한다. 계획(`strong`)과 실행(`fast`) Worker를 나누는 것은 큰 변경(L)에만 한다.

계획 트랙의 등급은 작업 파일의 `risk`·`size`로 정한다. 애매하면 한 단계 위로. 진행 중 범위가 커지면(파일 10개 이상) 올리고 `status.md`에 한 줄 적는다. 내리지는 않는다.

| 등급 | 조건 | 요구 정리 기준 | 설계 문서 | 설계 리뷰 | critic | 마무리 다듬기 |
|---|---|---|---|---|---|---|
| **S** | `risk: low`이고 `size: small` | 애매함 10% | Coordinator 직접, 약 50줄 | 1명 | 조건부 1라운드 | 없음 |
| **M** | S·L 아님 | 10% | planner, 약 150줄 | 최대 3명(qa 포함) | 조건부 2라운드 | Coordinator 워크트리에서 코드 리뷰 ∥ 보안 |
| **L** | `risk: high` 또는 `size: large` | 5% | planner, 필요한 만큼 | 필요한 역할만 | 조건부 2라운드 | 마무리 Worker: 다듬기 → 코드 리뷰 ∥ 보안 |

## 단계별 실행 주체

[확정] 기본은 아래 표다. Claude Subagent는 같은 세션 안에서 빨리 끝나고 터미널을 만들지 않는다. 코드를 고치는 단계와 오래 걸리는 단계만 Orca Worker로 띄운다.

| 단계 키 | 단계 | 기본 실행 주체 | 역할 |
|---|---|---|---|
| `spec` | 설계 문서 (M·L) | Subagent | planner (구조를 새로 정하면 architect 먼저) |
| `review` | 설계 리뷰 | Subagent, 동시에 | spec의 `reviewers` |
| `critic` | 비판 리뷰·합의 | Subagent | critic |
| `build` | 기능 구현 (기능마다) | Worker `claude` | 기능에 맞는 역할 (frontend, backend …) |
| `code-review` | 기능별 코드 리뷰 | Subagent | reviewer (+ critic) |
| `finish` | 마무리 다듬기 (L) | Worker `claude` | reviewer + 해당 구현 역할 |
| `security` | 보안 검사 (`security: true`) | Subagent | security |
| `qa-run` | 머지 뒤 테스트 실행 | Subagent | qa-run |

### 덮어쓰기

경우에 따라 단계마다 실행 주체를 바꾼다. 아래 순서로 먼저 찾은 값을 쓴다.

1. 사용자가 이번 요청에서 말한 것: `/ok:start`·`/ok:plan` 인자 `--with review=codex,build=antigravity` 또는 말("리뷰는 codex로", "구현은 AGY로").
2. 작업 파일 `providers:`.
3. `project.md`의 `providers:`.
4. 위 기본 표.

값:

| 값 | 뜻 |
|---|---|
| `claude` | 기본 실행 주체 그대로 (Subagent 단계는 Subagent, Worker 단계는 Claude Worker) |
| `claude-worker` | Subagent 단계를 Claude Worker로 (맥락이 크거나 Coordinator 한도를 아낄 때) |
| `codex`, `antigravity` | 그 Provider의 Orca Worker로. Subagent 단계면 Coordinator 워크트리의 읽기 전용 Worker([coordinator.md](coordinator.md#6-orca-명령)), 결과는 `.ok/`에 써서 Coordinator가 hub로 옮긴다 |
| `cross` | 검토 대상을 만든 Provider가 아닌 후보 중 순서상 첫 번째 (예: Claude가 쓴 spec을 Codex가 critic). 후보는 `project.md`의 `order` |
| `off` | 그 단계를 건너뛴다. `review`·`critic`·`code-review`·`finish`·`security`만. 건너뛰면 작업 파일 `## 실행`에 이유를 적는다 |

- 형식: `단계=값`을 쉼표로 잇는다. 예: `providers: review=cross, critic=codex, build=claude`.
- 바꾼 단계도 같은 역할 파일, 같은 산출 형식(첫 줄 `VERDICT:` 등)을 쓴다. 역할 명세는 Provider와 무관하다.
- 리뷰·교차 검증은 대상을 만든 Provider가 아닌 후보를 먼저 고르면 다른 시각을 얻는다. 기본은 비용과 속도 때문에 Claude Subagent다.
- 고른 Provider가 쓸 수 없으면(설치 안 됨, Codex 원본 레포 신뢰 미등록, 사용량 주의 이상) 순서상 다음 후보로 바꾸고 `## 실행`에 `<단계> <원래 값> → <바꾼 값> (<이유>)`를 적는다. 사용자가 이번 요청에서 직접 지정한 Provider면 바꾸기 전에 한 줄 묻는다.
- 승인 카드([plan Skill](../skills/plan/SKILL.md) 5단계)에 이번 작업의 단계별 실행 주체를 한 줄로 보인다. 승인한 뒤 위 규칙 안의 교체는 다시 묻지 않는다.

## 병렬 실행 규칙

- [권장] 동시 Worker는 작업당 최대 4개(기능 세션), 프로젝트 전체로 6개. 읽기 전용 Worker도 센다. Subagent는 세지 않는다.
- 기능은 서로 기대지 않게 나눈다(plan 2단계). 기댄다면 한 기능으로 합친다. 같은 파일을 두 기능 세션이 고치지 않는다.
- lockfile·공유 타입처럼 공유 파일은 고칠 기능을 하나 정한다.
- 실패나 지연이 있어도 같은 편집 작업에 Worker를 중복 투입하지 않는다.
- Worker는 자기 워크트리 브랜치에만 커밋하고 push하지 않는다. Coordinator가 Coordinator 워크트리에서 기능 브랜치를 머지한다. 충돌은 Coordinator가 풀지 않고 그 기능 세션에 맡긴다.
- 다른 워크트리의 결과는 자동 공유되지 않는다. 앞 기능 결과가 필요한 뒤 기능은 처음부터 한 기능으로 묶는다.

## 모델과 effort

작업마다 **등급**을 먼저 정하고, 등급을 Provider의 모델로 바꾼다.

- [확정] 추론이 크게 필요 없는 작업(테스트·PoC, 기계적 수정, 단순 문서)은 빠른 모델로 실행한다.
- [권장] 나머지 등급과 effort 값. 프로젝트별로 `project.md`에 적어 바꾼다.

| 등급 | 작업 | 모델 | effort |
|---|---|---|---|
| `fast` | 테스트·PoC, 기계적 수정(이름 변경, 포맷, 템플릿 채우기), 단순 문서, 탐색·로그 분석·짧은 리뷰 | 빠른 모델 | 지원하면 low, 아니면 생략 |
| `default` | 일반 구현 Worker, Coordinator | 사용자 기본 (넘기지 않음) | 사용자 기본 |
| `strong` | 아키텍처 결정, 계약(프로젝트 내부·프로젝트 간) 리뷰, 교차 검증, 원인 불명 장애 분석 | 가장 강한 모델 | high 이상 |

### Provider별 모델

별칭은 도구가 최신 버전으로 해석한다.

| 등급 | Claude | Codex | AGY |
|---|---|---|---|
| `fast` | `haiku` | `gpt-6-luna` + effort `low` | `gemini-3.8-flash-low` |
| `default` | 넘기지 않음 | 넘기지 않음 | 넘기지 않음 |
| `strong` | `opus` | `gpt-6-astra` + effort `high` | `gemini-4-argon-high` |

- `default`는 모델·effort를 넘기지 않는다. Worker는 사용자의 에이전트 기본 설정을 따른다.
- [확정] 계획과 QA 시트 작성은 `strong`(Claude는 `opus` 또는 `fable`), 그 계획·시트대로 시험을 작성·실행하는 일은 `fast` 또는 `default`(Claude는 `haiku` 또는 `sonnet`)로 나눈다. 2026-10-19 결정으로 작성과 실행을 다른 Worker로 띄우는 것은 큰 변경(L)에만 한다. S·M은 아래 표처럼 Subagent가 계획·시트를 쓰고 기능 세션이 시험과 구현을 한다. Codex·AGY도 같은 등급으로 나눈다. 이 분리에 쓰는 `strong`은 Task마다 다시 묻지 않는다. 비용을 줄이려는 비교 실험에서는 사용자 승인으로 작성 등급을 낮출 수 있다. [검증됨] Claude Code `--model fable`은 `claude-fable-5-1`로 동작한다. 짧은 호출 한 번에 약 0.58 USD가 들어 `opus`보다 비싸다.
- Codex 모델 ID는 별칭이 없어 세대마다 바뀐다. 쓸 수 있는 ID와 설명은 Codex 모델 목록에서 확인한다 ("Fast and affordable" 계열을 `fast`로). Orca Codex Worker에서 `gpt-6-luna` + `low`가 실제 적용되고 완료까지 동작했다. `strong`은 "Frontier intelligence" 계열(`gpt-6-astra`)이다.
- AGY 모델 ID는 effort를 이름에 담는다 (`-low`·`-medium`·`-high`). effort를 따로 넘기지 않는다. 목록은 `agy models`로 확인한다. Gemini 계열과 Claude·GPT 계열은 AGY 안에서 한도를 따로 쓰므로, AGY에서는 Gemini 계열을 기본으로 한다.
- [검증됨] Codex `strong`, AGY `fast`·`strong`은 Orca Worker에서 실제 적용값(`launch.effective`)과 읽기 전용 작업 완료까지 확인했다.
- 등급별 품질 비교 (1회, 실제 프로젝트의 CLI 업데이트 영향 분류, 같은 명세, 미리 정한 10점 채점표): Codex `fast` 9.5점·2분, Codex `strong` 10점·6분, AGY `fast` 8.5점·4분, AGY `strong` 9.5점·9분. 네 Worker 모두 핵심 위험을 찾았다. `strong` 두 Worker만 후속 위험(평가 스크립트가 중단되는 경로, 공통 계약 문서의 후속 검토)까지 찾았다. Codex `strong`은 이 작업 하나에 5시간 사용량을 약 20% 썼다. AGY 두 Worker는 합쳐서 5시간 1%, 주간 4%를 썼다. 시험이 1회뿐이므로 일반 규칙으로 삼지 않는다. 다만 표의 `fast` 범위(탐색·분류)가 맞고, 깊이가 필요한 분석은 사용량 여유를 보고 `strong`을 고르는 근거로 쓴다.
- effort는 그 모델이 지원할 때만 넘긴다. 지원 여부를 모르면 생략하고 실제 적용값을 확인한다.
- Orca는 `--effort`만 넘길 수 없다. `--model`이 같이 있어야 한다. effort만 바꾸려면 사용자 기본 모델 이름을 명시한다.
### 계획 트랙의 단계·등급별 기본값

Claude 기준 `모델/effort`. 다른 Provider로 바꾼 단계는 같은 칸의 등급(`fast`·`default`·`strong`)을 그 Provider 모델로 바꾼다. Subagent는 `Agent` 호출의 `model`·`effort`로, Worker는 `--model`·`--effort`로 그 호출만 덮어쓴다. 세션의 effort는 부모 세션 이하로만 지정된다.

| 단계·역할 | S | M | L |
|---|---|---|---|
| 설계 문서 (planner) | Coordinator 직접 | `strong` fable/medium | `strong` fable/high |
| 설계 리뷰 architect | opus/medium | fable/medium | fable/high |
| 설계 리뷰 frontend·backend·researcher·security·infra | opus/medium | opus/medium | opus/medium |
| 설계 리뷰 designer | sonnet/medium | sonnet/medium | sonnet/medium |
| QA 시트 (qa) | 부르지 않음 (Coordinator가 spec의 검사 목록) | `strong` opus/medium | `strong` opus/high |
| critic | opus/medium | opus/medium | opus/medium |
| 기능 세션 (build) | `default` sonnet | `default` sonnet | `default` sonnet/high |
| 코드 리뷰 reviewer | opus/medium | opus/medium | opus/high, `risk: high`면 fable/high |
| 마무리 (finish) | 없음 | 없음 (Coordinator 워크트리에서 리뷰 ∥ 보안) | opus/high |
| qa-run | `fast` haiku | `fast` haiku | `fast` haiku |

| 신호 | 조치 |
|---|---|
| 같은 실행 주체가 같은 작업에서 2회 실패 | [상향 사다리](#실패했을-때-상향-사다리) |
| 구현 뒤 코드 리뷰 high 지적이 2개 이상, 또는 리뷰 반영 2회째 | 그 작업의 남은 단계를 한 등급 위 값으로 |
| L에서 리뷰 지적끼리 충돌 | architect를 fable/high로 한 번 더 불러 중재 |
| 입력이 큼 (긴 로그·문서) | 1차 haiku나 sonnet이 요약 → 2차 강한 모델이 요약만 읽고 판단 |
| 간단 트랙 | Coordinator 그대로. Subagent를 부르지 않는다 |

- 작업 파일 `## 실행`에 역할([roles.md](roles.md))과 등급을 같이 적는다. 예: `build F1 frontend claude/claude-sonnet-5-5 (default)`.

- 요청값과 실제 적용값을 구분한다. 실행 도구가 돌려준 실제 적용값(Orca는 `worker-start` 응답의 `launch.effective`)을 작업 파일 `## 실행`에 적는다. 요청값만 보고 적용됐다고 쓰지 않는다.
- 단계별 실행 주체, Provider 후보 순서, `strong` 등급, 상향 상한은 작업마다 승인 카드에 들어간다 ([permissions.md](permissions.md#승인-관문)). Provider 고르는 법은 [Provider 선택](#provider-선택).

## Provider 선택

역할과 등급을 정한 뒤 하위 작업마다 Provider를 고른다. 역할 명세는 Provider와 무관하므로 어느 Provider든 같은 명세를 받는다.

### 정하는 순서

1. **요청에 지정이 있으면 따른다.**
   - 사용자가 지정하면 그대로 쓴다 (예: "이건 codex로", "리뷰는 opus로").
   - 작업 파일·`project.md`의 `providers:`가 있으면 따른다 ([덮어쓰기](#덮어쓰기)).
2. **지정이 없으면 Coordinator가 고른다.**
   1. 후보: Provider 순서(`project.md`의 `order`, 없으면 아래 기본 순서) 중 그 등급의 모델이 있는 Provider.
   2. 뺀다: 준비 안 됨(설치 안 됨, Codex 원본 저장소 신뢰 미등록 등), 방금 읽은 사용량이 주의 이상([기준](#기준), 소모 속도 반영), Coordinator 몫 보호 대상.
   3. 리뷰·교차 검증은 그 결과를 만든 Provider가 아닌 후보를 먼저 고른다.
   4. 남은 후보 중 순서상 첫 번째를 쓴다. 후보가 없으면 기다리거나 사용자에게 묻는다.
3. **고른 이유를 남긴다.** 작업 파일 `## 실행`에 한 줄로 적는다. 예: `codex (자동: claude 5h 72%로 제외, 순서 2번째)`. 적은 사용률은 그때의 근거일 뿐이고 다음 판단에 쓰지 않는다.

승인 카드([permissions.md](permissions.md#승인-관문))는 이 후보 순서까지 포함한다. 작업 중에 같은 등급 안에서 순서상 다음 후보로 바꾸는 것은 다시 묻지 않는다. 순서 밖 Provider나 등급 낮추기는 [사용자 확인](#사용자-확인)을 거친다.

### 기본 순서

[권장] 모든 등급에서 `claude` → `codex` → `antigravity`. 프로젝트는 `project.md`의 `order`로 바꾼다 (빼고 싶은 Provider는 순서에서 지운다).

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

셸에서 `<KIT>/scripts/ok.sh usage [claude|codex|antigravity ...]`로 읽는다 (생략하면 셋 다). 줄마다 `usage`, Provider, 상태, 5시간 %, 주간 %, 5시간 초기화까지 남은 분, 출처가 탭으로 나뉜다. 상태는 `ok`(정상)·`caution`(주의)·`danger`(위험)·`unknown`(못 읽음, 마지막 칸이 이유)이다. 읽기가 sandbox에 막혔으면 이유 칸이 `sandbox: `로 시작한다. 모델을 호출하지 않으므로 비용이 없다.

[검증됨] Provider마다 출처가 다르다:

| Provider | 출처 | 걸리는 시간 |
|---|---|---|
| Claude | Orca `account list --json`의 값. Claude Code가 응답마다 Orca에 보내므로 Claude 세션이 돌고 있으면 최신이다. `updatedAt`이 15분(`OK_USAGE_STALE_MIN`)보다 오래됐으면 `claude -p /usage`로 읽는다 | 1초 안쪽, 대체 시 5초 안팎 |
| Codex | `codex app-server`의 `account/rateLimits/read`. Orca가 Codex를 띄우는 활성 계정 홈을 쓴다 (`OK_CODEX_HOME`으로 바꾼다) | 1초 안쪽 |
| AGY | `agy -p /usage --output-format json`. 1.1.11 미만에서는 읽지 않는다. Orca가 같은 기준을 쓰고, 그 이전 버전은 `/usage`를 프롬프트로 처리해 한도를 쓴다고 Orca 코드에 적혀 있다 (AGY 문서로는 확인하지 않음) | 7초 안팎 |

- Orca가 보여 주는 Codex·AGY 값은 쓰지 않는다. [검증됨] 몇 시간 동안 갱신되지 않은 채 `status: ok`로 남은 적이 있다.
- 값은 Provider별 활성 계정 기준이다. Claude Coordinator와 Claude Worker는 같은 계정 한도를 나눠 쓴다.
- 판단할 때마다 새로 읽는다. 전에 읽은 값이나 작업 파일에 적은 값으로 판단하지 않는다.
- `unknown`이고 이유가 `sandbox:`로 시작하면 sandbox 밖에서 다시 읽고 그 값을 쓴다. 다시 읽어도 `unknown`이면 주의로 본다.

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
<KIT>/scripts/ok.sh usage-watch [--interval 120] [--until caution] [--for 240] <provider>...
```

- 멈출 때까지 아무것도 출력하지 않는다. 멈추는 경우: 상태가 `--until` 이상, 지금 소모 속도로 5시간 초기화 전에 100%에 닿을 것으로 보임(`projected`), 두 번 연속 `unknown`, `--for`분 경과(`timeout`). 멈추면 `watch`와 이유 한 줄, 그 뒤에 사용량 줄을 출력한다.
- 기다리는 동안은 셸과 `sleep`만 남는다. 읽을 때만 위 표의 명령이 잠깐 돈다. AGY(7초)와 Claude 대체 경로(5초)는 상대적으로 무거우므로, 가볍게 하려면 그 Provider만 따로 띄우고 `--interval`을 늘린다. Claude Worker가 긴 도구 실행 하나에 오래 머물면 Orca 값이 15분을 넘겨 대체 경로로 읽힐 수 있다.
- 백그라운드로 실행하고 끝나면 알림을 받는 기능이 있으면 감시를 그렇게 띄우고, Worker 완료 대기(`check --wait`)도 같은 방식으로 띄운다. 둘 중 먼저 끝나는 쪽에 반응하므로 대기 중에 Coordinator가 깨어날 필요가 없다. 이 기능이 없으면 완료 대기를 10~15분으로 나누고 깰 때마다 `ok.sh usage`로 읽는다.
  - [검증됨] `check`는 확인 처리(ack)하지 않은 가장 오래된 메시지 묶음을 돌려준다 (`replayed: true`면 같은 묶음을 다시 받은 것). 묶음을 처리했으면 다음 `check`에 `--ack <deliveryId>`를 붙인다. 붙이지 않으면 뒤에 온 메시지가 계속 가려진다. 메시지는 `check` 응답의 `result.messages`에 있다.
  - 한 Run에 Worker가 여럿일 때 `check --wait`가 곧바로 돌아온 적이 있다. 처음에는 `heartbeat` 메시지 때문으로 봤지만, ack하지 않은 묶음이 다시 나온 것일 수 있다. `--ack`를 쓴 뒤 다시 확인한다.
  - 대기 반복은 "Task 하나라도 상태가 바뀌면 깨어남"으로 만든다: 시작할 때 `task-list --run <id>`에서 `dispatched`가 아닌 Task 목록을 기억하고 30초마다 비교한다. "`dispatched`가 하나도 없을 때"로 만들면 기다리는 도중 Worker를 하나 더 띄운 순간부터 앞 Worker의 완료를 놓친다. [검증됨] 이렇게 Worker 하나의 완료를 10분 놓쳤다.
  - Worker를 띄운 뒤 턴을 끝내기 전에 `check`를 한 번 더 한다. 실행 중인 명령 사이에 온 메시지는 알림 없이 쌓일 수 있다.
- `projected`는 `--until`과 상관없이 멈춘다. 처음 읽은 값보다 3%p 이상 올랐을 때만 판정한다. 사용률이 1% 단위 정수라 시작 직후 1%p만 올라도 속도가 크게 부풀기 때문이다 (시작 2분 뒤 1%p 변화로 `projected-146%`가 난 적이 있다). 처음 읽은 값부터의 속도로 계산하므로 `strong` Worker가 짧게 몰아 쓰면 쉽게 걸린다 ([검증됨] Codex `strong` 하나가 6분에 약 20%를 써서 `projected-796%`가 됐다). 멈추면 남은 일의 양을 본다. 곧 끝날 Worker면 계속 두고 감시를 다시 띄운다. 오래 걸릴 Worker면 위험과 같이 대응한다.
- 감시가 멈추면 아래 기준과 작업 중 한도 대응을 따른다. 실행 중인 Worker가 남아 있으면 감시를 다시 띄우고, Worker가 모두 끝나면 감시를 멈춘다.
- [검증됨] `sample-api`의 Claude Worker로 두 갈래를 확인했다. 감시가 먼저 멈춘 경우: 깨어남 → 중단 요청 → Worker가 진행 파일을 쓰고 `failed`로 완료 → 같은 Worktree에서 `--retry-of`로 재시작 → 진행 파일을 보고 끝난 단계를 건너뜀. 완료 대기가 먼저 끝난 경우: 결과 처리 뒤 감시를 멈춤.

### 기준

[권장] 기본값. `ok.sh`에는 환경 변수 `OK_USAGE_CAUTION`(70)·`OK_USAGE_DANGER`(85)·`OK_USAGE_WEEKLY`(90)로 넘긴다.

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
3. 이어갈 방법을 고른다. 품질이나 일정에 영향이 있으면 아래 사용자 확인을 거친다.
   - 초기화 시각까지 기다린 뒤 같은 Provider로 재시작
   - 다른 Provider로 재시작 (같은 역할 명세와 진행 파일 경로). 후보 순서 안의 다음 Provider면 확인 없이 한다
   - 다른 계정으로 전환한 뒤 재시작 (사용자가 Orca 화면에서 전환한다. 새 세션부터 적용된다)
   - 등급 낮추기
4. 같은 Task를 같은 Worktree에서 `--retry-of`로 다시 시작한다. 명세에 진행 파일 경로와 "이미 끝낸 단계는 다시 하지 않는다"를 넣는다.

Coordinator가 쓰는 Provider가 위험이면:

1. 새 Worker를 시작하지 않는다. 같은 Provider의 Worker는 위 1번대로 멈춘다. 다른 Provider의 Worker는 계속 둔다 (완료 메시지는 Orca에 쌓이고 다음 세션에서 받는다).
2. `status.md` 체크포인트와 작업 파일 `## Orca`에 인계를 적는다: Worker별 dispatch와 상태, 워크트리·브랜치·커밋 안 한 변경, 머지한 기능과 남은 기능, 결과 파일 경로, Provider별 사용량과 재개 가능 시각. hub가 git이면 자기 경로를 커밋한다.
3. 사용자에게 재개 가능 시각을 알린다.
4. 재개는 초기화 뒤 같은 Provider로, 또는 사용자가 계정을 바꾼 새 세션에서 한다.

예고 없이 한도에 걸렸을 때: Worker가 진행 없이 멈추면 Orca `worker-read`로 출력을 보고 한도 문구(Claude: `You've hit your session limit`)를 찾고 `ok.sh usage`로 읽는다. 한도면 위 Worker 절차의 2번부터 따른다.

Claude의 자동 재개: Claude Code 대화형 세션(claude.ai 구독 로그인)은 5시간 한도에 걸리면 기본으로 그 자리에서 기다렸다가 초기화 뒤 하던 일을 이어 간다 (설정 `autoContinueAtUsageLimit`, Claude Code 2.1.234 이상). `claude -p`는 기다리지 않는다. Orca는 Claude Worker를 사용자 기본값대로 터미널(대화형)로 띄우고 `--settings`를 넘기지 않으므로 이 조건에 맞는다 (설정 확인). 실제로 이어 가는지는 한도에 걸렸을 때 관찰해 이 문장을 고친다.

- 한도에 걸린 Claude Worker는 초기화 뒤 스스로 이어 갈 수 있다. 다른 Provider로 같은 일을 재시작하기 전에 원래 Worker를 먼저 release하거나 멈춘다. 두 Worker가 같은 Worktree를 고치지 않게 한다.
- 초기화까지 기다리기로 했으면 Claude Worker는 그대로 둬도 된다. 초기화 뒤 진행이 없으면 위 Worker 절차를 따른다.
- 기다리는 화면에 나오는 `/usage-credits` 같은 결제 선택지는 쓰지 않는다 ([쓰지 않는 것](#쓰지-않는-것)).

### 사용자 확인

등급 낮추기, 후보 순서 밖의 Provider, 기다림으로 인한 일정 지연처럼 품질이나 일정에 영향이 있는 선택은 사용자에게 묻는다(결정 파일 + 질문 카드, [coordinator.md](coordinator.md#3-사용자-결정)). 적는다: 작업, Provider별 사용량과 초기화 시각, 남은 일, 선택지마다 품질·일정 영향.

### 쓰지 않는 것

- [확정] 한도 초기화 크레딧(Codex `rateLimitResetCredits` 등)과 추가 사용량 결제는 쓰지 않는다.

## 실패했을 때 (상향 사다리)

Worker 결과가 수락 기준을 못 넘으면 같은 설정으로 되풀이하지 않고 한 칸씩 올린다.

- 올리는 신호: 명세의 확인 명령·시험 실패, 같은 오류 반복, reviewer나 Coordinator가 같은 수용 기준으로 거절. Worker의 "확신 낮음" 보고는 이 신호와 같이 있을 때만 쓴다.
- 올리지 않는 신호: 인증·권한·사용량 한도 (사용자에게 알리거나 [작업 중 한도 대응](#작업-중-한도-대응)), 네트워크 오류·타임아웃 (같은 설정으로 2번까지 다시), 사람만 답할 정보 부족·명세 모순 (질문하거나 planner·architect로 돌려보냄), 에이전트 준비 단계 막힘 (Orca 가이드의 recovery 절차, [coordinator.md](coordinator.md#6-orca-명령)).

| 단 | 할 일 | 조건 |
|---|---|---|
| 1 | 같은 등급으로 1번 더. 실패 증거(실패한 명령과 출력, 거절 이유, 시도한 것)를 명세 맨 앞에 붙이고 "원인을 먼저 찾고 고친다"를 적는다 | 맥락이 남은 같은 Worker에 후속 Task로 맡기는 것을 먼저 검토한다 |
| 2 | effort 한 단계 올림 | 시도 중 일부라도 통과한 적이 있을 때만. 매번 같은 실패면 건너뛴다. Orca는 `--effort`를 `--model`과 함께만 넘긴다. AGY는 모델 ID의 `-low`·`-high`를 바꾼다 |
| 3 | 등급 한 단계 올림 (`fast` → `default` → `strong`) | effort는 새 모델 기본값부터. `strong`은 승인 대상이다 |
| 4 | 승인한 후보 순서 안의 다른 Provider로, 같은 등급 | 남은 후보가 없으면 건너뛴다 |
| 5 | 멈추고 사용자에게 묻는다: 단마다 시도·증거·사용량을 요약하고 선택지(계속 / 범위 축소 / 직접 처리)를 준다 | Task를 `blocked`로 둔다 |

- 단마다 1번씩, 같은 단을 되풀이하지 않는다. 5단이 끝이다.
- `default`까지 올리는 것과 승인한 후보 순서 안의 Provider 교체는 묻지 않고 한다. `strong`으로 올리는 것과 후보 밖 Provider는 승인 대상이다. Worker 계획을 승인받을 때 상향 상한(예: "`strong`까지")을 같이 받아 두면 그 안에서는 다시 묻지 않는다. 상한 밖이면 그 단에서 승인을 구한다.
- 올릴 Provider의 사용량이 [주의](#기준) 이상이면 그 Provider로 올리지 않는다.
- 단마다 작업 파일 `## 실행`에 한 줄을 더한다: `상향 <단>: <신호 요약> → <실제 적용값> → <결과>`.
- 근거로 가져온 절차: 실패 증거를 붙인 재시도(self-repair 연구, [Olausson 외 2023](https://arxiv.org/abs/2306.09896)), 가끔 성공할 때만 추론량을 늘림([Snell 외 2024](https://arxiv.org/abs/2408.03314)), 싼 모델부터 검증 실패 때 올림([FrugalGPT](https://arxiv.org/abs/2305.05176)), 재시도하지 않을 오류 구분([OpenHands stuck detector](https://docs.openhands.dev/sdk/guides/agent-stuck-detector), MIT). 4단(Provider 교체)은 직접 근거가 없는 Kit의 선택이다.
- [검증됨] 판단 시험 (Coordinator 역할 `sonnet` 1, 실패 상황 7개: 같은 실패 반복, 가끔 성공, 한도 429, 명세 모순, `strong` 필요, 주의 사용량 Provider. 미리 정한 7점 채점표): 이전 규칙 5점, 사다리 규칙 7점. 이전 규칙에서는 `default`로 올리는 것도 사용자에게 묻고, 가끔 성공하는 실패에 effort를 올리지 않고 같은 설정으로 되풀이했다. 첫 사다리 문구는 6점이었다. 상한을 받지 않았을 때 `default` 상향까지 묻게 읽혀서, "`default`까지와 후보 안 Provider 교체는 묻지 않는다"를 더한 뒤 7점이었다. 실제 Worker 실패를 일으켜 사다리를 끝까지 탄 시험은 아직 하지 않았다.


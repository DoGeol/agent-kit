# 세션 수명과 업무 상태

[← 공통 정책](README.md)

## Coordinator 세션

[권장] Resume 우선 → 길어지면 체크포인트 후 Compact → 재개할 수 없거나 맥락이 오염되면 Fresh + 체크포인트로 복구.

| 상태 | 선택 |
|---|---|
| 처음 여는 프로젝트 | Fresh. 프로젝트 문서로 시작 |
| 정상 종료된 이전 세션 | Resume |
| 이미 실행 중인 Coordinator | 그 세션으로 돌아간다. 두 번째 Coordinator를 만들지 않는다. `scripts/kit.sh coordinator <저장소>`로 찾는다 |
| 맥락이 길어짐 | 체크포인트 후 Compact |
| 오래된 가정이 쌓임, 재개 실패 | 체크포인트 후 Fresh |

세션 대화 기록은 영구 원본이 아니다. 복구는 Markdown과 Orca 조회로 한다.

## 재진입 절차

1. 상태 폴더를 찾는다 (`scripts/kit.sh where <저장소>`, 공유 모드는 저장소, 개인 모드는 hub의 `projects/<projectId>/`). 그 안의 `.ai/ORCHESTRATION.md`, `PROJECT.md`, `ARCHITECTURE.md`, `STATUS.md`, `TASKS.md`를 읽는다. Orca를 쓰면 같은 저장소에 Run에 바인딩된 다른 Coordinator가 있는지 `scripts/kit.sh coordinator`로 먼저 본다. 있으면 새로 바인딩하지 않고 사용자에게 알린다.
2. `STATUS.md`의 `## 체크포인트`를 읽는다.
3. `in-review` Task에 PR 주소가 있으면 PR 상태를 확인한다. 병합됐으면 `completed`로 바꾸고 보고서를 반영한다 ([routing.md](routing.md#pr-흐름-pull-request)).
4. Orca를 쓰는 경우 체크포인트의 Run에 다시 바인딩하고(`run-use`) 쌓인 메시지를 받은 뒤, Orca 상태를 조회해 진행 중 Task·Worker와 맞춘다. 다르면 Orca를 따른다. `scripts/kit.sh audit <hub>`로 끝나지 않은 Task가 남은 Run과 상태 어긋남을 보고, 정리·체크포인트 갱신은 제안만 한다. Orca에 연결할 수 없으면 그 사실을 기록하고, 실행 상태를 확정하지 않는다.
5. 종료 증거가 없는 Worker를 다시 실행하지 않는다. 다만 Orca 런타임이 재시작된 뒤 Worker 터미널이 `consumer_fenced`로 메시지를 받지 못하면 그 Worker는 재사용하지 않는다. 진행 파일을 확인하고 같은 Task를 새 Worker로 `--retry-of` 시작한 뒤 이전 Worker를 정리한다 (Orca 이슈 #30013, 우회).
6. 미해결 결정과 사용자 승인 대기 항목을 먼저 보여준다. 답이 온 사용자 결정 요청은 `kit.sh decision-take`로 받아, 승인한 범위 안에서는 다시 묻지 않고 진행한다.

## 체크포인트

`TASKS.md`의 상태 값을 바꿀 때마다, 같은 커밋에서 `STATUS.md`의 `## 체크포인트`를 덮어쓴다 (이 절만 교체). 직접 Compact·Fresh 하기 전과 세션을 끝낼 때도 쓴다. 자동 압축은 예고 없이 오므로 그 직전에 쓰는 것에 기대지 않는다. 상태가 바뀔 때마다 쓰면 압축 시점과 상관없이 체크포인트가 최신으로 남는다. `scripts/kit.sh audit`의 `drift … checkpoint` 줄은 이 규칙을 어긴 커밋이 있다는 뜻이다. 체크포인트를 다시 쓴다. Portfolio 체크포인트는 `DASHBOARD.md`다 ([reporting.md](reporting.md)). 체크포인트에 적는 항목:

- `observedAt`: 기록 시각 (ISO 8601)
- 진행 중 Task와 Orca 참조 (Run·Task·Dispatch ID)
- 미해결 결정 (사용자 결정 요청은 `decisionId`와 상태)
- 블로커
- 다음 안전한 행동
- 인계 (사용량 한도나 세션 종료로 작업 중에 멈출 때): Worker별 Dispatch ID와 상태, Worktree 경로·브랜치·미커밋 변경 여부, 병합한 하위 작업과 남은 하위 작업, Worker 결과·진행 파일 경로, Provider별 사용량과 재개 가능 시각. 없으면 `없음`

오래된 체크포인트는 사실이 아니라 단서다.

- Portfolio와 Project의 세션 수명은 독립이다. Portfolio가 꺼져 있어도 Project는 일하고 보고서를 남긴다.
- [권장] Coordinator Provider 교체는 활성 Worker를 모두 정리한 뒤에만 한다.

## 업무 ID

Orca가 제공하는 기능이 아니라 이 Kit의 규약이다. 형식은 `scripts/kit.sh`가 검사하므로 Override로 바꾸지 않는다.

| ID | 형식 | 예 | 소유 |
|---|---|---|---|
| `projectId` | 소문자 kebab-case (`^[a-z0-9][a-z0-9-]*$`). 저장소 경로·폴더명과 무관하며 바꾸지 않는다 | `sample-app` | Project |
| `portfolioTaskId` | `PORT-` + 4자리 일련번호 | `PORT-0001` | Portfolio |
| `projectTaskId` | `<taskPrefix>-` + 4자리 일련번호. `taskPrefix`는 대문자로 시작하는 대문자·숫자 | `SAMPLE-0001` | Project |
| `reportId` | `<projectId>-<projectTaskId>-r<2자리 개정번호>` | `sample-app-SAMPLE-0001-r01` | Project |
| `decisionId` | `<projectTaskId>-d` + 2자리 일련번호 | `SAMPLE-0001-d01` | Project |
| Orca Run·Task·Dispatch ID | Orca가 발급 | - | Orca |

- 업무 ID와 Orca 실행 ID를 섞지 않는다. Orca ID는 참조로만 적는다.
- 일련번호는 해당 `TASKS.md`의 마지막 번호 + 1.
- `taskPrefix`는 `.ai/ORCHESTRATION.md`에 있다.

## 상태 값

### Portfolio 업무 (`portfolio/TASKS.md`, 위임 명세)

| 값 | 뜻 |
|---|---|
| `backlog` | 등록만 함 |
| `assigned` | 위임 명세 작성. Project 수락 전 |
| `accepted` | Project가 수락하고 `projectTaskId`를 연결함 |
| `in-progress` | Project의 진행이 확인됨 |
| `needs-review` | 보고 증거 부족, 보고 간 충돌, Hub 상태와 불일치 |
| `blocked` | Project가 `blocked`를 보고함 |
| `completed` | Portfolio 종결. 필수 하위 보고가 모두 `completed`이고 증거가 있음 |
| `cancelled` | 취소 |

파일을 썼거나 전달했다는 사실만으로 `accepted`·`in-progress`로 바꾸지 않는다.

### Project 업무 (`.ai/TASKS.md`)

`backlog` → `assigned` → `in-progress` → `in-review` → `completed`. 예외: `blocked`, `failed`, `cancelled`.

- `in-review`: Worker 완료 후 Project 검증 중.
- `completed`: Project 수락 (검증·통합·문서 갱신 완료).
- `failed`: 재시도 가능한 실행 실패. Portfolio 업무 실패로 바로 올리지 않는다.

### 완료 보고 (`status`)

| 값 | 뜻 |
|---|---|
| `completed` | Project가 검증·통합하고 수락함 |
| `blocked` | 진행 불가. 해결 조건을 적는다 |
| `needs-review` | 일부만 검증됨, 또는 Portfolio·사용자 판단이 필요함 |
| `cancelled` | 중단 |

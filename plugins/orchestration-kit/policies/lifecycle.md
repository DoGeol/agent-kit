# 세션 수명과 업무 상태

[← 공통 정책](README.md)

## Coordinator 세션

[권장] Resume 우선 → 길어지면 체크포인트 후 Compact → 재개할 수 없거나 맥락이 오염되면 Fresh + 체크포인트로 복구.

| 상태 | 선택 |
|---|---|
| 처음 여는 프로젝트 | Fresh. 프로젝트 문서로 시작 |
| 정상 종료된 이전 세션 | Resume |
| 이미 실행 중인 Coordinator | 그 세션으로 돌아간다. 두 번째 Coordinator를 만들지 않는다 |
| 맥락이 길어짐 | 체크포인트 후 Compact |
| 오래된 가정이 쌓임, 재개 실패 | 체크포인트 후 Fresh |

세션 대화 기록은 영구 원본이 아니다. 복구는 Markdown과 Orca 조회로 한다.

## 재진입 절차

1. `.ai/ORCHESTRATION.md`, `PROJECT.md`, `ARCHITECTURE.md`, `STATUS.md`, `TASKS.md`를 읽는다.
2. `STATUS.md`의 `## 체크포인트`를 읽는다.
3. Orca를 쓰는 경우 체크포인트의 Run에 다시 바인딩하고(`run-use`) 쌓인 메시지를 받은 뒤, Orca 상태를 조회해 진행 중 Task·Worker와 맞춘다. 다르면 Orca를 따른다. Orca에 연결할 수 없으면 그 사실을 기록하고, 실행 상태를 확정하지 않는다.
4. 종료 증거가 없는 Worker를 다시 실행하지 않는다.
5. 미해결 결정과 사용자 승인 대기 항목을 먼저 보여준다.

## 체크포인트

Compact·Fresh 전, 큰 작업을 마친 뒤 `STATUS.md`의 `## 체크포인트`를 덮어쓴다 (이 절만 교체):

- `observedAt`: 기록 시각 (ISO 8601)
- 진행 중 Task와 Orca 참조 (Run·Task·Dispatch ID)
- 미해결 결정
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

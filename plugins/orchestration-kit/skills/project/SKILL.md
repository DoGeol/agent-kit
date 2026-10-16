---
name: project
description: 프로젝트의 중앙 Coordinator로 일할 때 사용한다. 프로젝트 컨텍스트 확인, 작업 분해, Direct/Subagent/Session/Orca Worktree 선택, Orca Task·Worker 감독, Worker 협업 조정, 결과 검증, 완료 보고서 발행, .ai/ 문서 갱신. "Coordinator로 시작", "이 작업 분배해줘", "위임받은 PORT 업무 처리", "완료 보고 작성" 같은 요청.
---

# Project Coordinator

이 저장소의 논리적 Coordinator 1개로 일한다. `.ai/ORCHESTRATION.md`가 없거나 `role: project`가 아니면 멈추고 setup Skill을 안내한다.

정책 원본 (필요한 때 읽는다):

- [../../policies/README.md](../../policies/README.md): 역할, 데이터 원본
- [../../policies/routing.md](../../policies/routing.md): 실행 방식 선택, 완료의 세 단계
- [../../policies/roles.md](../../policies/roles.md): Worker 역할 선택·조합·명세 주입
- [../../policies/lifecycle.md](../../policies/lifecycle.md): 재진입, 체크포인트, ID, 상태 값
- [../../policies/communication.md](../../policies/communication.md): Worker 협업, 메시지
- [../../policies/permissions.md](../../policies/permissions.md): 결정권, 승인
- [../../policies/reporting.md](../../policies/reporting.md): 완료 보고 규격

## 1. 세션 시작·재진입

[lifecycle.md](../../policies/lifecycle.md#재진입-절차)의 재진입 절차를 따른다. 요약해서 보여준다: 진행 중 Task, 미해결 결정, 블로커, 승인 대기. Orca 상태를 확인하지 못했으면 그렇다고 말한다.

## 2. 업무 접수

- **Portfolio 위임**: 사용자가 준 위임 명세(`handoffs/outbox/<projectId>/PORT-NNNN.md`)를 읽는다. 완료 조건이 검증 가능한지, 범위가 프로젝트 안인지 판단한다.
  - 수락: `.ai/TASKS.md`에 새 `projectTaskId`를 만들고 `portfolioTaskId` 열을 채운다 (`assigned`). Portfolio 파일은 쓰지 않는다.
  - 수락 불가: 사용자에게 이유를 알리고, 필요하면 `blocked` 보고를 낸다.
- **직접 요청**: `.ai/TASKS.md`에 `projectTaskId`를 만들고 `portfolioTaskId`는 `-`로 둔다. 보고 시 `origin: project-direct`.

번호는 `TASKS.md`의 마지막 번호 + 1. 접두어는 `.ai/ORCHESTRATION.md`의 `taskPrefix`.

## 3. 분석과 라우팅

1. 업무를 수용 기준이 있는 하위 작업으로 나눈다.
2. 하위 작업마다 [routing.md](../../policies/routing.md)로 실행 주체(Direct / Subagent / Independent Session)와 위치(현재 / 새 Worktree)를 따로 정한다.
3. 하위 작업마다 [roles.md](../../policies/roles.md)로 역할과 조합 방식(Worker 1개에 주·보조 역할 / 설계 → 구현 여러 Worker)을 정한다. 역할 원본은 [../../roles/](../../roles/), 프로젝트 보강은 `.ai/roles/<id>.md`.
4. 병렬 Worker는 파일 소유 범위를 정하고, 공유 파일 수정자를 한 명 지정한다. 기본 상한 3개.
5. 비용이 드는 병렬화(새 Worker·Worktree)는 계획을 사용자에게 보여주고 진행한다.
6. `TASKS.md`의 `실행 방식` 열에 선택을 적는다. 역할도 같이 적는다 (`role: frontend+designer`).

## 4. 실행 감독

- Orca를 쓰기 전에 설치된 버전의 가이드를 읽는다: `orca skills get orchestration --full`. 명령 문법은 그 가이드를 따른다.
- 저장소가 Orca에 등록돼 있지 않으면 Worker를 놓을 수 없다. 등록은 사용자에게 확인한 뒤 한다.
- Worker를 시작하기 전에 같은 Task의 기존 Worker가 있는지 확인한다. 중복 실행하지 않는다.
- Worker에게 주는 Task 명세는 그 자체로 완결돼야 한다: 대상, 변경, 제약(건드리지 말 것), 소유 범위, 관찰 가능한 수용 기준. 커밋은 Coordinator가 한다고 적는다. Worker가 테스트용 프로세스를 띄울 수 있으면 "종료는 자기가 띄운 PID만, 이름·패턴 종료(`pkill` 등) 금지"와 "Worktree와 임시 디렉터리 밖에 쓰지 않음"을 적는다. Worker의 샌드박스 설정이 넓을 수 있다.
- 명세 맨 앞에 역할 절을 넣는다. 역할 파일 본문을 읽어 그대로 붙인다 (경로만 주지 않는다). 순서와 형식은 [roles.md](../../policies/roles.md#명세에-넣기). Worker 시작 뒤 명세가 잘리지 않았는지 확인한다.
- 하위 작업마다 등급(`fast` / `default` / `strong`)을 정하고 [routing.md](../../policies/routing.md#모델과-effort)의 Provider별 모델로 바꾼다. `.ai/ORCHESTRATION.md` Override가 있으면 그것을 따른다. 실제 적용값을 `실행 방식` 열에 적는다.
- Orca Run·Task·Dispatch ID를 `TASKS.md`의 `Orca 참조` 열에 적는다.
- Worker 시작이 에이전트 준비 단계에서 막히면(예: Codex의 작업 폴더 신뢰 확인 `agent-trust-workspace`, 업데이트 안내 `agent-update-prompt`) 응답의 recovery대로 그 터미널을 release하고 사용자에게 알린다. 에이전트 설정 변경·업데이트는 사용자 결정이다. 해결 뒤 같은 Task를 `--retry-of`로 다시 시작한다. Codex 신뢰는 경로마다 따로 정해진다. 상위 폴더를 신뢰해도 그 아래 새 Worktree에는 적용되지 않았다. 해결되지 않으면 같은 Task를 다른 Provider로 다시 시작할 수 있다.
- Coordinator 하나는 한 번에 Run 하나에 바인딩된다. 새 Run을 만들면 바인딩이 옮겨 가서 앞 Run의 `worker-start`가 거부된다 (`consumer_fenced`). 앞 Run의 Worker를 모두 정리한 뒤 `run-use`로 바꾼다. 여러 프로젝트를 동시에 감독하려면 프로젝트마다 Coordinator 세션을 따로 둔다.
- `worker_done`이 오면 Task·Dispatch ID가 기대한 것과 같은지 확인한다. 이것은 Worker 완료일 뿐이다 (`in-review`).
- 수락하거나 실패를 확정하면 Worker마다 다음 소유자를 정한다: 같은 Worker에 후속 작업, 유지, 또는 release. 그다음 메시지를 확인 처리한다. 정리되지 않은 Worker가 남아 있으면 세션을 끝내지 않는다.
- Worker끼리 자유롭게 협의하게 둔다. [permissions.md](../../policies/permissions.md)의 승인 대상 변경 요청(`DECISION_REQUEST`)이 오면 결정하고 `decisions/ADR-NNNN-<제목>.md`에 남긴 뒤 영향받는 Worker 모두에 알린다. 프로젝트 간 영향이 있으면 Portfolio 결정 사항으로 사용자에게 올린다.
- 응답 없는 Worker는 상태와 생존 증거를 먼저 확인한다.

## 5. 검증과 수락

`worker_done`이 오면 Task를 `in-review`로 바꾸고 [routing.md](../../policies/routing.md#완료의-세-단계)의 수락 절차를 따른다. 테스트·Diff를 직접 확인하고, 명세에 넣은 역할의 수용 기준을 항목마다 확인한다. Worker가 통과라고 적은 항목도 직접 본다. 통과하면 병합하고 `completed`, 실패하면 재작업 또는 `failed`·`blocked`. 재작업은 맥락이 남아 있는 같은 Worker에 후속 Task로 맡기는 것을 먼저 검토한다. 결과가 형식은 맞아도 정책·계약과 어긋나면 수락하지 않는다.

## 6. 문서 갱신과 완료 보고

1. 결정은 `decisions/`, 구조 변경은 `ARCHITECTURE.md`, 상태는 `STATUS.md`·`TASKS.md`에 반영한다.
2. 의미 있는 Task 완료·블로커·취소 시 보고서를 쓴다: 템플릿 [../../templates/reports/project-report.md](../../templates/reports/project-report.md), 위치 `.ai/reports/<reportId>.md`, 규칙은 [reporting.md](../../policies/reporting.md).
   - `reportId` = `<projectId>-<projectTaskId>-r01`. 같은 Task의 다음 보고는 `-r02`.
   - 검증하지 않은 항목을 숨기지 않는다. 역할 체크리스트 결과를 `Acceptance evidence`에 적는다.
   - 임시 파일에 쓴 뒤 이름을 바꾼다. 발행한 보고서는 고치지 않는다.
3. 보고서와 문서 변경을 `reportsRef` 브랜치에 커밋할지 사용자에게 확인한다. Worker 브랜치에만 둔 보고서는 Portfolio가 읽지 않는다.
4. Portfolio가 꺼져 있어도 된다. 다음 Pull에서 수집된다.

## 7. 체크포인트

Compact·Fresh 전, 큰 작업을 마친 뒤 `STATUS.md`의 `## 체크포인트` 절을 갱신한다.

## 하지 않는 것

- Portfolio 저장소 파일 쓰기
- 사용자 승인 없는 운영 배포, 데이터 삭제, 비용 발생, 권한 변경, Push
- 근거 없는 진행률 표시

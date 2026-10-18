# 완료 보고와 Portfolio Pull

[← 공통 정책](README.md)

ID와 상태 값은 [lifecycle.md](lifecycle.md#업무-id).

## 완료 보고 (Project)

위치: `.ai/reports/<reportId>.md`. 파일 이름은 `reportId`와 같다. 템플릿 `templates/reports/project-report.md`.

frontmatter 필수 필드:

| 필드 | 값 |
|---|---|
| `schema` | `project-report/v1` |
| `reportId` | `<projectId>-<projectTaskId>-rNN` |
| `projectId` | `.ai/ORCHESTRATION.md`의 값 |
| `portfolioTaskId` | `origin: portfolio`이면 `PORT-NNNN`, `project-direct`이면 `null` (`TASKS.md`의 `-`도 보고서에서는 `null`) |
| `projectTaskId` | `<taskPrefix>-NNNN` |
| `origin` | `portfolio` \| `project-direct` |
| `status` | `completed` \| `blocked` \| `needs-review` \| `cancelled` |
| `verifiedAt` | `completed`는 Project가 검증을 마친 시각, 그 밖의 상태는 판단한 시각. ISO 8601 |
| `coordinator` | 보고한 Coordinator의 Provider (`claude`, `codex`, `agy`) |

본문 필수 절: `Summary`, `Changes`, `Acceptance evidence`, `Decisions`, `Risks / Blockers`, `Follow-ups`, `References`.

규칙:

- `completed` 보고는 Project 수락 뒤에만 쓴다. `blocked`·`cancelled`·`needs-review`는 그 시점에 쓴다.
- `Acceptance evidence`에 테스트 종류·결과와 Commit·PR 참조를 적는다. 검증하지 않은 항목은 따로 적는다.
- 발행: 같은 폴더의 임시 파일에 쓴 뒤 이름을 바꾸고, `reportsRef` 브랜치에 커밋한다. 개인 모드는 hub의 현재 브랜치에 자기 경로만 커밋한다 ([permissions.md](permissions.md#문서-수정-권한)). Worker 브랜치에만 있는 보고서는 정식 보고가 아니다.
- 발행한 보고서는 고치지 않는다. 정정·추가는 개정번호를 올린 새 보고서(`-r02`)로 낸다.
- 비밀·개인정보·원문 로그를 넣지 않는다.
- 같은 내용을 `.ai/STATUS.md`·`TASKS.md`에도 반영한다.

## 보고 시점

| 사건 | Project | Portfolio |
|---|---|---|
| 작은 Worker Subtask 완료 | 내부 기록만 | 없음 |
| 주요 Project Task 완료 | 검증 후 `completed` 보고 | 다음 Pull에서 수집 |
| 블로커 | 즉시 `blocked` 보고 | 다음 Pull에서 우선 검토 |
| 마일스톤 완료 | `STATUS.md` 갱신 | Pull에서 진행도 갱신 |

보고서 하나는 `projectTaskId` 하나를 다룬다. 여러 Task가 함께 끝나면 Task마다 보고서를 내고 같은 근거를 참조한다.

## Portfolio Pull

트리거: 사용자 요청 또는 Portfolio 세션 시작. 자동 감시·알림은 MVP 범위 밖이다.

1. 미처리 보고서 목록을 만든다. `scripts/kit.sh pending <hub>`가 `portfolio/PROJECTS.md`의 `active` 프로젝트마다 다음을 한다:
   - 개인 모드 프로젝트(hub에 `projects/<projectId>/.ai/`가 있음)는 hub의 `HEAD`에서 읽는다. [검증됨] tila-agent-kit 보고서 하나를 이 경로로 읽어 Portfolio 업무 등록, `DASHBOARD.md` 갱신, 처리 마커까지 마쳤고, 다시 수집해도 같은 보고서가 나오지 않았다.
   - Git 저장소면 `reportsRef` 커밋에서 `.ai/reports/`를 읽는다. `reportsRef`가 원격 추적 브랜치(`origin/main` 등)면 Portfolio가 먼저 `git fetch`한다. `kit.sh`는 네트워크를 쓰지 않는다. 커밋되지 않은 작업 트리 파일은 정식 보고가 아니다. Git이 아니면 폴더를 직접 읽는다.
   - frontmatter 필수 필드, 파일 이름 = `reportId`, `status` 값을 검사한다. 어긋나면 `invalid`로 내보낸다.
   - `handoffs/processed/<reportId>.md`가 있으면 건너뛴다.
2. `invalid` 보고는 처리하지 않고 사용자에게 보여준다. 사용자가 확인하면 `outcome: invalid` 마커를 남겨 다음 Pull에 다시 나오지 않게 한다. 정정은 Project가 새 개정번호로 낸다.
3. 같은 `projectTaskId`의 보고가 여럿이면 개정번호 순으로 처리한다. 더 높은 개정번호가 이미 처리됐으면 상태를 바꾸지 않고 `outcome: superseded` 마커만 남긴다. 오래된 보고가 최신 상태를 덮지 않는다.
4. `portfolio/TASKS.md`의 보고서 열에 이 `reportId`가 이미 있으면 이전 Pull이 마커 직전에 끊긴 것이다. 갱신을 건너뛰고 7단계 마커만 만든다. 없으면 대상 업무를 찾는다. `origin: portfolio`는 `portfolioTaskId`로 찾는다. `project-direct`는 새 Portfolio 업무를 만들거나 기존 업무에 연결한다. 불분명하면 사용자에게 묻는다.
5. 상태를 정한다. 증거 없는 `completed`, Portfolio 상태와 충돌하는 보고는 `needs-review`로 받는다. 자동으로 덮어쓰지 않는다.
6. `portfolio/TASKS.md`, `DASHBOARD.md`, 필요하면 `PRIORITIES.md`를 갱신한다.
7. 6단계가 끝난 뒤에만 처리 마커를 만든다: `scripts/kit.sh mark <hub> <projectId> <reportId> <outcome> [메모]` (`outcome`: `applied` \| `superseded` \| `needs-review` \| `invalid`). 6단계 변경과 마커는 한 커밋에 넣는다. 중간에 실패하면 마커를 만들지 않는다. 다음 Pull에서 다시 처리된다.
8. 각 프로젝트의 `.ai/TASKS.md`에서 위임 수락(`portfolioTaskId` 연결)을 확인하고, `.ai/STATUS.md`를 `DASHBOARD.md`에 요약한다. 관찰 시각을 같이 적는다.
9. `PROJECTS.md`의 `lastPulled`를 갱신한다.
10. `DASHBOARD.md`의 `Last pull`을 지금 시각과 처리·남긴 건수로 바꾼다.
11. `scripts/kit.sh audit <hub>`의 `run`(끝나지 않은 Task, 즉 `completed`·`failed`가 아닌 Task가 남은 Run)·`drift`(체크포인트보다 새 `TASKS.md`, 보고서 없는 `completed`) 줄을 사용자에게 보인다. 정리는 Run 소유 Project Coordinator가 사용자 확인 뒤에 한다. `drift … checkpoint`는 그 Project가 체크포인트를 다시 쓰고, `drift … unreported`는 그 Task의 보고서를 발행한다 ([lifecycle.md](lifecycle.md#체크포인트)).

Portfolio 체크포인트: Portfolio에는 `STATUS.md`가 없다. `DASHBOARD.md`의 `Last pull`과 `진행 중`·`블로커` 절이 체크포인트다. `portfolio/TASKS.md` 상태를 바꿀 때마다 같은 커밋에서 이 절들을 맞춘다 ([lifecycle.md](lifecycle.md#체크포인트)).

상위 업무 종결: 같은 `portfolioTaskId`로 위임한 모든 프로젝트의 `completed` 보고가 처리돼야 `completed`로 바꾼다.

처리 마커 `handoffs/processed/<reportId>.md`:

```markdown
---
schema: processed-report/v1
reportId: sample-app-SAMPLE-0001-r01
projectId: sample-app
processedAt: 2026-10-16T17:00:00+09:00
outcome: applied
---
PORT-0001: in-progress → completed
```

`outcome`: `applied` | `superseded` | `needs-review` | `invalid`.

동시성: [권장] Portfolio 파일은 한 번에 Portfolio 세션 하나만 갱신한다. 여러 작성자가 필요해지면 잠금 전략을 따로 정한다 (미결정). 사용자 결정 답은 결정 명령이 묻는 중 표지(`<decisionId>.asking/`)로 세션끼리 막는다.

## 진행도

마일스톤과 검증 상태로 보고한다. 마일스톤 가중치가 있을 때만 `Σ완료 가중치 / Σ전체 가중치`로 %를 쓴다. 근거가 없으면 `미산정`. `blocked`는 %와 따로 표시한다.

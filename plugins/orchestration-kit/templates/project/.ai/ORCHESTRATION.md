---
schema: orchestration-config/v1
role: project
projectId: {{PROJECT_ID}}
taskPrefix: {{TASK_PREFIX}}
reportsRef: {{REPORTS_REF}}
mode: {{MODE}}
integration: unset
policyVersion: {{POLICY_VERSION}}
initializedAt: {{NOW}}
---

# Orchestration 설정

이 프로젝트는 orchestration-kit 공통 정책(`policies/`)을 따른다. 정책 본문을 여기에 복제하지 않는다.

- `projectId`: 바꾸지 않는다. 저장소를 옮겨도 그대로 쓴다.
- `taskPrefix`: `projectTaskId` 접두어 (`{{TASK_PREFIX}}-0001`).
- `reportsRef`: 정식 보고서와 확정 문서를 반영하는 기준 브랜치. Portfolio는 이 브랜치에서 보고서를 읽는다. PR로 반영하는 프로젝트는 원격 추적 브랜치(`origin/main`)로 둔다.
- `mode`: `shared`면 이 상태 폴더가 프로젝트 저장소 안에 있다. `personal`이면 Portfolio hub의 `projects/<projectId>/`에 있고 프로젝트 저장소에는 Kit 파일이 없다. 이때 `reportsRef`는 `-`이고 보고서는 hub에 커밋한다.
- `integration`: 결과를 기준 브랜치에 넣는 방식. `direct-merge` 또는 `pull-request`. `unset`이면 첫 Task 전에 Coordinator가 정한다.
- 반영 방식 근거: 없음

## 프로젝트별 Override
<!-- 공통 정책의 [권장] 값을 이 프로젝트에서 바꿀 때만 적는다. 예: 동시 Worker 상한 2 / default 등급: claude sonnet, effort high / Provider 순서: codex, claude / 제외 Provider: antigravity / reviewer: claude. 역할 보강은 여기 말고 .ai/roles/<id>.md에 쓴다 -->
없음

---
schema: orchestration-config/v1
role: project
projectId: {{PROJECT_ID}}
taskPrefix: {{TASK_PREFIX}}
reportsRef: {{REPORTS_REF}}
policyVersion: {{POLICY_VERSION}}
initializedAt: {{NOW}}
---

# Orchestration 설정

이 프로젝트는 orchestration-kit 공통 정책(`policies/`)을 따른다. 정책 본문을 여기에 복제하지 않는다.

- `projectId`: 바꾸지 않는다. 저장소를 옮겨도 그대로 쓴다.
- `taskPrefix`: `projectTaskId` 접두어 (`{{TASK_PREFIX}}-0001`).
- `reportsRef`: 정식 보고서와 확정 문서를 반영하는 기준 브랜치. Portfolio는 이 브랜치에서 보고서를 읽는다.

## 프로젝트별 Override
<!-- 공통 정책의 [권장] 값을 이 프로젝트에서 바꿀 때만 적는다. 예: 동시 Worker 상한 2 / 일반 구현 Worker: 모델 <provider model id>, effort high -->
없음

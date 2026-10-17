# 공통 정책

orchestration-kit의 **유일한 정책 원본**이다. 특정 에이전트에 묶이지 않는 Markdown이며, `skills/`는 이 문서를 읽고 실행하는 Adapter다. Skill이나 프로젝트의 `CLAUDE.md`·`AGENTS.md`에 정책 본문을 복제하지 않는다. 경로만 안내한다.

## 표기

- **[확정]** 사용자가 확정한 사항. 바꾸려면 사용자 승인이 필요하다.
- **[검증됨]** 설치된 도구에서 동작을 확인한 사항. 도구 버전이 바뀌면 다시 확인한다.
- **[권장]** 현재 기본값. 사용자 확정 전이며, 프로젝트별 `.ai/ORCHESTRATION.md`의 Override로 바꿀 수 있다.

미구현 기능(자동 동기화, 상주 감시, 자동 Bootstrap, UI·DB·MCP 서버)을 구현된 것처럼 말하지 않는다.

## 용어

헷갈리기 쉬운 말은 아래 뜻으로만 쓴다.

| 용어 | 뜻 | 기록 위치 |
|---|---|---|
| 이슈 | GitHub 저장소의 Issues. 다른 뜻으로 쓰지 않는다 | GitHub. 검토 기록은 `ISSUES.md` (issue-review Skill) |
| 블로커 | Task 진행을 막는 것. Task 상태 `blocked` | `TASKS.md`, 보고서 `Risks / Blockers` |
| 남은 문제·위험 | 완료했지만 알려야 할 한계나 위험 | 보고서 `Risks / Blockers` |
| 후속 업무 | 이번 Task 밖에서 할 일 | 보고서 `Follow-ups`, `backlog` |
| 결정 요청 | Worker가 Coordinator에게 승인을 구하는 변경 | 메시지 `DECISION_REQUEST`, `decisions/` |

## 문서

| 문서 | 내용 |
|---|---|
| [permissions.md](permissions.md) | 결정권, 승인, 문서 수정 권한, 안전 규칙 |
| [routing.md](routing.md) | Direct / Subagent / Session / Worktree 선택, 모델·effort 등급, 완료의 세 단계 |
| [roles.md](roles.md) | Worker 역할(frontend, designer 등) 선택·조합·명세 주입. 역할 원본은 [`../roles/`](../roles/) |
| [lifecycle.md](lifecycle.md) | Coordinator 세션 수명, 재진입, 체크포인트, 업무 ID와 상태 값 |
| [communication.md](communication.md) | 통신 경로, 메시지 규칙, 에스컬레이션 |
| [delegation.md](delegation.md) | Portfolio → Project 위임 |
| [reporting.md](reporting.md) | 완료 보고, Portfolio Pull, 중복 방지, 진행도 |

## 구조와 역할

```text
USER
 └─ Portfolio Coordinator (workspace-hub, 기본 Claude)
     └─ Project Coordinator (프로젝트당 논리적 1개, 기본 Claude)
         └─ Worker / Subagent (Claude, Codex, AGY)
Orca: Run / Task / Dispatch / Worker / Worktree 실행 상태
```

| 계층 | 하는 일 | 하지 않는 일 |
|---|---|---|
| Portfolio | 프로젝트 등록, 업무 등록·분배, 우선순위, 상태·보고 수집, 최종 사용자 보고. 조회·요약·분류·문서 정리는 직접 한다 | 프로젝트 코드 구현, 프로젝트 기술 문서 수정, Worktree 생성 |
| Project Coordinator | 계획, Task 분해, 실행 방식 선택, Worker 감독, 검증·통합, 기술 결정, 기술 문서 갱신, 완료 보고 발행 | 프로젝트 간 우선순위·자원 배분 확정 |
| Worker / Subagent | 할당 범위의 구현·조사·리뷰, 동료와 협의, 검증 결과 제출 | 승인 없이 계약(프로젝트 내부·프로젝트 간)·아키텍처 변경, 다른 Worker 담당 파일 편집 |
| Orca | 실행 상태 관리 | Portfolio 업무 지식 저장 |

- [확정] Orca + Claude Code가 기본이다. Codex와 AGY는 필요할 때 추가한다.
- [확정] 각 프로젝트에 논리적 Project Coordinator가 1개 있다. 프로젝트 내부 기술 결정은 Project Coordinator가 확정한다.
- [확정] Portfolio는 하이브리드다. 조회·정리는 직접 하고, 개발은 Project Coordinator에 위임한다.
- [확정] 사용자가 프로젝트 세션에서 직접 시작한 업무도 허용한다. Portfolio가 나중에 수집한다.
- [권장] AGY는 먼저 읽기 전용 분석·리뷰로 쓴다. Worker 시작 → 메시지 → `worker_done` → 정리까지 로컬에서 통과한 뒤 구현에 쓴다. 읽기 전용 리뷰(Orca agent `antigravity`, `reviewer` 역할)와 새 Worktree 구현 Worker(`backend` 역할)가 이 흐름을 통과했다.

## 데이터 원본

| 데이터 | 원본 위치 |
|---|---|
| 기술 설계, 결정(ADR), 프로젝트 Task·검증 | Project 상태 폴더 `.ai/` (공유 모드는 Project Repo, 개인 모드는 hub `projects/<projectId>/`) |
| 프로젝트 간 업무, 우선순위, 프로젝트 등록, 통합 상태 | Portfolio Repo `portfolio/` |
| 실행 중인 Worker·Task·Dispatch 상태 | Orca 조회 결과 |
| 대화 기록 | 각 도구의 Session·Transcript (영구 원본 아님) |
| 완료 증거 | Commit, Diff, 테스트 결과, Project 완료 보고 |

- [확정] 프로젝트 지식과 업무 기록은 Markdown 중심으로 남긴다. 세션이 끝나도 Markdown으로 복구할 수 있어야 한다.
- Markdown과 Orca가 다르면 실행 상태는 Orca를 따른다.
- Worktree 안의 `.ai/` 변경은 다른 Worktree에 보이지 않는다. 확정 문서와 보고서는 Project Coordinator가 기준 브랜치(`.ai/ORCHESTRATION.md`의 `reportsRef`)에 반영한다. 개인 모드는 아래를 따른다.

### 공유 모드와 개인 모드

프로젝트마다 setup에서 한 번 정한다.

| | 공유 모드 (`mode: shared`) | 개인 모드 (`mode: personal`) |
|---|---|---|
| 상태 폴더(`.ai/`) | 프로젝트 저장소 안 | Portfolio hub의 `projects/<projectId>/.ai/` |
| 프로젝트 저장소에 남는 것 | `.ai/`, 진입점 문구 | 없음. Git 공통 폴더의 상태 경로 파일(`orchestration-kit-state`)과 로컬 무시 목록(`info/exclude`)의 `.orch-progress/` 한 줄뿐이며 둘 다 커밋되지 않는다 |
| 보고서 발행 | `reportsRef` 브랜치에 커밋 | hub의 현재 브랜치에 커밋 |
| 맞는 저장소 | 개인 저장소, 팀 전체가 Kit을 쓰는 저장소 | 다른 사람과 같이 쓰는 저장소 (조직·팀 저장소, 원격 소유자가 본인이 아님) |

- 상태 폴더는 `scripts/kit.sh where <저장소>`로 찾는다. Worktree에서도 같은 결과가 나온다. `.ai/` 경로가 나오는 모든 규칙은 이 상태 폴더의 `.ai/`를 뜻한다.
- 개인 모드의 hub는 사용자 개인의 비공개 저장소여야 한다. 팀이 같이 쓰는 hub면 개인 모드 상태도 팀에 보인다.
- 개인 모드는 저장소당 프로젝트 하나다. 새로 `clone`한 저장소에는 상태 경로 파일이 없으므로 다시 초기화한다 (`init`은 같은 hub 상태 폴더를 다시 가리킨다).
- 모드 전환은 수동이며 사용자 승인을 받는다. 개인 → 공유: hub의 상태 폴더를 저장소 `.ai/`로 옮겨 커밋하고 상태 경로 파일을 지운다. 공유 → 개인: 반대로 옮기고 저장소에서 `.ai/`를 지우는 커밋을 낸다.
- Portfolio에는 프로젝트 기술 문서를 복제하지 않는다. 요약·링크·증거만 둔다.
- 채팅을 그대로 옮기지 않는다. 결정, 실행 근거, 남은 일만 요약한다.

### 초기화된 파일

| 역할 | 파일 |
|---|---|
| Project | `.ai/ORCHESTRATION.md`, `PROJECT.md`, `ARCHITECTURE.md`, `STATUS.md`, `TASKS.md`, `decisions/`, `reports/` |
| Portfolio | `.ai/ORCHESTRATION.md`, `portfolio/PROJECTS.md`, `TASKS.md`, `DASHBOARD.md`, `PRIORITIES.md`, `handoffs/outbox/`, `handoffs/processed/` |

`.ai/ORCHESTRATION.md`의 `role`로 현재 저장소의 역할을 판단한다.

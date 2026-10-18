# orchestration-kit

Orca + Claude Code 기반 멀티 AI 오케스트레이션 키트. 여러 프로젝트의 업무를 Portfolio가 모아 보고, 각 프로젝트의 Coordinator가 실제 구현·검증을 맡는다. Codex와 Antigravity(AGY)로 넓힐 수 있게 정책과 프로젝트 데이터는 특정 에이전트에 묶이지 않는 Markdown으로 둔다.

```text
USER
 └─ Portfolio Coordinator (workspace-hub)
     ├─ Project A Coordinator ── Orca ── Claude / Codex / AGY
     └─ Project B Coordinator ── Orca ── Claude / Codex / AGY
```

## 구성

```text
orchestration-kit/
├─ .claude-plugin/plugin.json   Claude Code Plugin Manifest
├─ hooks/register.tsx           Claude Code 현황판 mod (입력창 위 한 줄 + pane). Claude 전용
├─ types/index.d.ts             현황판 mod의 상태 타입. Claude 전용
├─ skills/                      Agent Skills 형식. 정책을 실행하는 Adapter
│  ├─ portfolio/SKILL.md
│  ├─ project/SKILL.md
│  ├─ setup/SKILL.md
│  └─ issue-review/SKILL.md
├─ policies/                    공통 정책 원본 (벤더 중립)
├─ roles/                       Worker 역할 프로필 (frontend, designer, backend, qa, planner, reviewer, docs)
├─ templates/                   초기화·위임·보고 템플릿
│  ├─ project/                  Project 저장소에 만들 .ai/ 파일
│  ├─ portfolio/                Portfolio 저장소에 만들 파일
│  ├─ handoffs/                 위임 명세
│  └─ reports/                  완료 보고
├─ docs/                        사용 예시
├─ scripts/kit.sh               초기화(공유·개인 모드)·상태 위치·등록·미처리 보고 목록·현황판 데이터·처리 마커·사용량 읽기와 감시 (POSIX sh, 덮어쓰기 없음)
└─ tests/                       로컬 검사 (run.sh), 현황판 mod 테스트 (board.test.ts)
```

Skill은 Plugin 폴더 안의 상대 경로(`../../policies/...`)로 정책을 읽는다. Plugin을 설치하면 폴더 전체가 함께 복사되므로 설치 위치에서도 그대로 읽힌다 (GitHub 마켓플레이스 설치본에서 Skill의 정책 읽기와 `kit.sh init`을 확인했다). 정책은 `policies/`에만 있고 Skill에 복제하지 않는다.

## Skill

| Skill | 호출 | 하는 일 |
|---|---|---|
| setup | `/orchestration-kit:setup` | 저장소를 Portfolio 또는 Project로 초기화, 환경 점검, `CLAUDE.md`·`AGENTS.md` 진입점 제안, Portfolio 연결 |
| project | `/orchestration-kit:project` | 컨텍스트 확인, 작업 분해, Direct/Subagent/Session/Worktree 선택, Orca Worker 감독, 검증, 완료 보고 |
| portfolio | `/orchestration-kit:portfolio` | 프로젝트 등록·목록, 업무·우선순위, 위임, 완료 보고 Pull, 전체 요약 |
| issue-review | `/orchestration-kit:issue-review` | GitHub 저장소 이슈를 마지막 확인 이후분만 모아 분류·검토하고 다음 행동 제안. 요청할 때만, 댓글·닫기는 승인 뒤 |

"이 저장소 오케스트레이션 초기화해줘", "전체 현황 보여줘"처럼 말해도 description으로 골라진다.

## 현황판

Claude Code 세션의 입력창 위, mods-hud 카드 아래에 한 줄이 붙는다. 어느 세션에서나 같은 Portfolio 전체 정보이고, 처리할 것만 센다.

```text
◆ 포트폴리오  블로커 1  보고 대기 7  위임 미수락 1  검토 필요 1  Worker 2 진행
```

- 0인 항목은 숨긴다. 모두 0이면 줄이 없다. Orca Worker 세션에서는 뜨지 않고, Worker로 확인되면 읽기도 멈춘다. Orca를 읽지 못하면 Worker 세션인지 알 수 없어 줄이 뜰 수 있다.
- 색: 빨강 블로커, 노랑 사람이 처리할 것, 파랑 진행 중.
- `포트폴리오`를 누르거나 `/portfolio-board`를 실행하면 pane이 열린다. 처리할 것(프로젝트별 한 줄씩), 진행 중 Worker(프로젝트·Task·Provider/모델), 전체 프로젝트(진행 Task 수, 체크포인트·Pull 경과 시간, 다음 작업). Project 세션에서는 그 프로젝트가 각 구역 맨 위에 온다.
- 30초마다 `kit.sh board <hub>`를 실행한다. 읽기만 하고 모델을 부르지 않는다. 결과가 바뀔 때만 다시 그린다. 읽기에 실패하면 pane에 이유가 나온다. hub 4개 프로젝트에서 한 번에 1~2.5초.
- hub 위치: Portfolio 세션과 개인 모드 Project는 스스로 찾는다. 공유 모드 Project 세션은 `/config`에서 orchestration-kit의 `hubPath`를 설정해야 줄이 뜬다.
- 항목의 출처: 블로커는 각 `TASKS.md`의 `blocked`, 검토 필요는 프로젝트 `TASKS.md`의 `in-review`와 Portfolio `TASKS.md`의 `needs-review` (작업 트리 기준), 보고 대기는 `kit.sh pending`, 위임 미수락은 `handoffs/outbox/<projectId>/`에 있지만 그 프로젝트 `TASKS.md`가 아직 가리키지 않는 PORT (Portfolio에서 `cancelled`·`completed`인 PORT는 뺀다), Worker는 Coordinator가 붙은 Orca Run의 활성 Worker. Worker의 Task는 `Orca 참조` 열에 같은 Orca Task ID가 있는 행이다.

## 역할

Project Coordinator는 하위 작업마다 Worker 역할을 고른다: `frontend`, `designer`, `backend`, `qa`, `planner`, `reviewer`, `docs`. 역할 파일(`roles/<id>.md`)에는 관점, 산출물, 수용 기준, 하지 않는 것이 있다. Coordinator는 이 본문을 Task 명세 맨 앞에 넣고, 같은 수용 기준으로 결과를 검증한다.

- 역할은 명세 본문으로 전달하므로 Claude·Codex·AGY Worker가 같은 방식으로 받는다. Orca `--agent`는 Provider 선택이다.
- 역할, 모델 등급, Provider는 따로 정한다.
- 작은 UI 수정은 Worker 1개에 `frontend` + 보조 `designer`, 큰 개편은 `designer`가 설계 문서를 쓰고 `frontend`가 구현한다.
- 프로젝트별 보강(스택, 디자인 시스템)은 프로젝트의 `.ai/roles/<id>.md`에 쓴다.
- 긴 직군 지식은 저장소의 Agent Skill(`.agents/skills/`, Claude용 `.claude/skills/` symlink)로 두고 명세에는 이름만 적는다. Provider별로 읽는 위치가 다르다 ([roles.md](policies/roles.md#직군-지식-skill)).

규칙은 [policies/roles.md](policies/roles.md). Claude Worker(Haiku), Codex Worker, AGY Worker(읽기 전용 리뷰, 새 Worktree 구현)에서 역할 명세 주입, 체크리스트 결과 보고, 체크리스트 기반 수락까지 확인했다.

## 설치

```
/plugin install orchestration-kit --marketplace DoGeol/agent-kit
```

또는 셸에서 `claude plugin install orchestration-kit@dg-agent-kit`. 범위는 user를 고른다. 한 번 설치하면 모든 저장소에서 쓸 수 있다.

설치는 Skill을 쓸 수 있게 할 뿐이다. 저장소 초기화, Coordinator 실행, Worker 실행은 각각 따로 한다.

## 저장소 초기화

저장소마다 한 번 setup Skill을 실행한다. 직접 실행해도 된다:

```bash
kit=~/.claude/plugins/cache/dg-agent-kit/orchestration-kit/<version>/scripts/kit.sh   # 설치 위치
$kit init portfolio ~/workspace/workspace-hub
$kit init project ~/workspace/sample-app sample-app        # taskPrefix 기본값: SAMPLE
$kit register ~/workspace/workspace-hub ~/workspace/sample-app
```

- 없는 파일만 만든다. 기존 `CLAUDE.md`, `AGENTS.md`, `.ai/`는 건드리지 않는다.
- 진입점 문구는 출력으로만 제안한다. setup Skill이 사용자 승인을 받고 끝에 덧붙인다.
- 이미 다른 역할이나 `projectId`로 초기화된 저장소는 거부한다.

만들어지는 파일:

| 역할 | 파일 |
|---|---|
| Project | `.ai/ORCHESTRATION.md`, `PROJECT.md`, `ARCHITECTURE.md`, `STATUS.md`, `TASKS.md`, `decisions/`, `reports/` |
| Portfolio | `.ai/ORCHESTRATION.md`, `portfolio/PROJECTS.md`, `TASKS.md`, `DASHBOARD.md`, `PRIORITIES.md`, `handoffs/outbox/`, `handoffs/processed/` |

## 흐름

1. Portfolio: 업무 `PORT-0001` 등록 → `handoffs/outbox/<projectId>/PORT-0001.md` 위임 명세 → 사용자가 대상 프로젝트의 Coordinator 세션에 전달.
2. Project: 수락하면 `.ai/TASKS.md`에 `SAMPLE-0001` 연결 → 라우팅·실행·검증 → `.ai/reports/sample-app-SAMPLE-0001-r01.md` 발행 → 기준 브랜치에 커밋.
3. Portfolio: `kit.sh pending`으로 미처리 보고 확인 → `TASKS.md`·`DASHBOARD.md` 갱신 → `kit.sh mark`로 처리 마커. 같은 보고는 다시 목록에 나오지 않는다.

예시 하나로 처음부터 끝까지 따라가는 설명과 Worker 모델·effort 정하는 순서는 [docs/workflow-example.md](docs/workflow-example.md).

Portfolio가 꺼져 있어도 Project는 일하고 보고서를 남긴다. 자동 알림은 없다. Pull은 사용자 요청이나 Portfolio 세션 시작 때 한다.

## 검사

```bash
plugins/orchestration-kit/tests/run.sh
claude plugin validate plugins/orchestration-kit
claude plugin test plugins/orchestration-kit
claude plugin validate .
```

## Codex·AGY 확장

정책(`policies/`), 템플릿, `scripts/kit.sh`, 프로젝트의 `.ai/`는 에이전트와 무관하다. 확장할 때는 이 폴더에 각 도구의 Manifest만 더한다. 현황판 mod(`hooks/`, `types/`)는 Claude Code 전용이고, 그 데이터는 `kit.sh board`라서 다른 도구에서도 읽을 수 있다. Claude·Codex·AGY의 `plugin.json`은 형식이 서로 다르므로 같은 파일을 재사용하지 않는다. Skill 폴더를 따로 떼어 링크하면 `../../policies` 경로가 깨지므로, 폴더 전체를 설치 단위로 쓴다.

## 아직 없는 것

Orca 병렬 Worktree 자동 실행, Worker 협업 자동화, 자동 Bootstrap, 자동 동기화·알림, Coordinator Provider 교체. MCP 서버와 DB는 쓰지 않는다.

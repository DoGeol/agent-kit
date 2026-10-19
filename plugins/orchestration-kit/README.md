# orchestration-kit

Orca + Claude Code 기반 멀티 AI 오케스트레이션 키트. 여러 프로젝트의 업무를 Portfolio가 모아 보고, 각 프로젝트의 Coordinator가 실제 구현·검증을 맡는다. Codex와 Antigravity(AGY)로 넓힐 수 있게 정책과 프로젝트 데이터는 특정 에이전트에 묶이지 않는 Markdown으로 둔다.

```text
USER
 └─ Portfolio Coordinator (hub 저장소)
     ├─ Project A Coordinator ── Orca ── Worker (Claude / Codex / AGY, 역할: frontend·qa…)
     └─ Project B Coordinator ── Orca ── Worker
```

## 개념

| 용어 | 뜻 |
|---|---|
| Agent Skill | `SKILL.md` 한 파일(frontmatter `name`·`description` + 절차)이 든 폴더. 에이전트는 평소 description만 보고 있다가 요청이 맞으면 본문을 읽고 따른다. [Agent Skills](https://agentskills.io) 규격이라 Claude Code·Codex·AGY가 같은 파일을 읽는다. 이 Kit의 Skill은 `policies/`를 읽고 실행하는 절차서이고, 정책 본문은 Skill에 복제하지 않는다 |
| Portfolio | 여러 프로젝트를 위에서 보는 층. 프로젝트 등록, 프로젝트 간 업무(`PORT-0001`)·우선순위, 위임, 완료 보고 수집을 한다. 코드는 고치지 않는다 |
| hub | Portfolio로 초기화한 저장소 (예: `~/workspace/workspace-hub`). `portfolio/` 문서와 위임 명세(`handoffs/`)가 있고, 개인 모드 프로젝트의 상태 폴더(`projects/<projectId>/.ai/`)도 여기에 둔다. 현황판은 hub를 읽는다 |
| Project | Kit으로 초기화한 작업 저장소 하나. 상태 폴더 `.ai/`에 프로젝트 설명, Task(`SAMPLE-0001`), 결정, 완료 보고가 있다 |
| Coordinator | 그 층을 맡은 에이전트 세션. Portfolio Coordinator는 hub에서, Project Coordinator는 프로젝트 저장소에서 연다. Project Coordinator가 계획·분해·검증·보고를 하고 구현은 Worker에 맡긴다 |
| Worker | Coordinator가 Orca로 띄우는 실행 세션(Claude·Codex·AGY). 명세 맨 앞에 역할 파일(`roles/<id>.md`)이 들어가 그 관점과 수용 기준으로 일한다 |
| 보강 | 프로젝트만의 역할 규칙 `.ai/roles/<id>.md`. adopt Skill이 프로젝트의 규칙 문서·검사 명령·Skill에서 만든다 |
| 공유·개인 모드 | 상태 폴더 위치. 공유는 프로젝트 저장소 안 `.ai/`(커밋됨), 개인은 hub 안(프로젝트 저장소에 커밋되는 것 없음). 남과 같이 쓰는 저장소는 개인 모드 |
| Orca | Worker·Task·Worktree 실행 상태를 관리하는 도구. 업무 지식은 Markdown에, 실행 상태는 Orca에 둔다 |

자세한 계층 규칙과 데이터 원본은 [policies/README.md](policies/README.md).

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
│  ├─ issue-review/SKILL.md
│  └─ adopt/SKILL.md
├─ policies/                    공통 정책 원본 (벤더 중립)
├─ roles/                       Worker 역할 프로필 (frontend, designer, backend, qa, planner, architect, reviewer, docs)
├─ templates/                   초기화·위임·보고·디자인 원칙 양식
│  ├─ project/                  Project 저장소에 만들 .ai/ 파일
│  ├─ portfolio/                Portfolio 저장소에 만들 파일
│  ├─ handoffs/                 위임 명세
│  ├─ reports/                  완료 보고
│  └─ design/                   프로젝트 디자인 원칙 문서 양식 (초기화 때 만들지 않음)
├─ docs/                        사용 예시
├─ scripts/kit.sh               초기화(공유·개인 모드)·상태 위치·등록·미처리 보고 목록·현황판 데이터·처리 마커·사용량 읽기와 감시·보강 출처 확인·저장소의 Coordinator 찾기(`coordinator`)·끝나지 않은 Run과 상태 어긋남 점검(`audit`) (POSIX sh, 덮어쓰기 없음)
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
| adopt | `/orchestration-kit:adopt` | 프로젝트의 규칙 문서·검사 수단·Skill을 찾아 역할 보강(`.ai/roles/<id>.md`)과 대응표로 연결. 원본이 바뀌면 다시 실행. 프로젝트 문서는 요청·승인 때만 |

"이 저장소 오케스트레이션 초기화해줘", "전체 현황 보여줘"처럼 말해도 description으로 골라진다.

## 현황판

Claude Code 세션의 입력창 위, mods-hud 카드 아래에 한 줄이 붙는다. Portfolio 전체의 처리할 것을 센다. Project 세션에서는 자기 프로젝트가 먼저 나온다.

```text
◆ 포트폴리오  블로커 1  보고 대기 7  위임 미수락 1  검토 필요 1 · 진행 3 ●●● · 멈춤 1 · 프로젝트 5 · 확인 3초 전
◆ 포트폴리오  처리할 것 없음 · 진행 0 · 프로젝트 5 · 확인 3초 전   ← 처리할 것과 진행이 모두 0
◆ 포트폴리오  api Task 3 · 블로커 1  보고 대기 7 · 진행 ? · 확인 실패 · 마지막 성공 2분 전   ← api 프로젝트 세션, Orca를 읽지 못함
```

두 plugin은 입력창 위 자리를 나눠 쓴다. 각 plugin은 아래 plugin이 그린 것을 버리지 않고 자기 것을 덧붙인다(mods-hud는 카드 아래에, 이 plugin은 맨 아래에). 그래서 어느 쪽이 바깥에 로드돼도 카드와 줄이 함께 보인다.

- 처리할 것은 0인 항목을 숨기고, 모두 0이면 `처리할 것 없음`이 나온다. hub를 찾은 세션에는 줄이 항상 있다. Orca Worker 세션에서는 뜨지 않고, Worker로 확인되면 읽기도 멈춘다. Orca를 읽지 못하면 Worker 세션인지 알 수 없어 줄이 뜰 수 있다.
- 색: 빨강 블로커·`멈춤`, 노랑 사람이 처리할 것, 파랑 `진행`. `진행 N` 뒤의 점은 업무 하나마다 하나: 초록(5분 안에 활동), 노랑(5~15분), 빨강(15분 넘음, 멈춤 의심), 회색(`ask` 답을 기다리는 중, 멈춤 아님), `?`(활동 시각을 모름). 점은 `멈춤 N`과 pane의 글자를 보태는 표시이고, 상태는 글자로도 적힌다. 점은 8개까지 보이고 나머지는 `+N`.
- `멈춤 N`은 빨강 업무와, Worker가 사람 입력(승인·선택 프롬프트)을 기다리는 업무의 수다. 한 업무에 Worker가 여럿이면 가장 최근에 활동한 Worker의 색이 업무의 색이다. 긴 포그라운드 명령 하나를 15분 넘게 돌리는 Worker는 활동 신호가 없어 빨강으로 보일 수 있다.
- 읽지 못한 값은 0이나 `없음`이 아니라 `?`로 보인다: Orca를 읽지 못하면 `진행 ?`, 일부 Run만 못 읽으면 `진행 3?`. `kit.sh board`가 실패하면 마지막 성공 데이터를 흐리게 두고 `확인 실패 · 마지막 성공 N분 전`이 뜬다.
- `확인 N초 전`은 마지막 확인에서 지난 시간이고 1초마다 바뀐다(Claude Code 터미널·desktop). 30초가 넘으면 노란색. 이 기능이 없는 화면에서는 `확인 HH:MM:SS`로 보인다.
- `포트폴리오`를 누르거나 `/portfolio-board`를 실행하면 pane이 열린다. 맨 위에 `확인 HH:MM:SS (N초 전) · 데이터 변경 HH:MM`(데이터 변경은 보이는 데이터가 마지막으로 바뀐 시각이고, Orca가 Worker를 다시 본 것은 변경이 아니다). 그 아래로 처리할 것(프로젝트별 한 줄씩), 진행 중(업무 단위: 프로젝트 / 업무, 활동 N분 전, Worker 수와 Provider), 멈춤·이상, 프로젝트 N (active)(진행 Task 수, 체크포인트·Pull 경과 시간, 다음 작업). Project 세션에서는 그 프로젝트가 각 구역 맨 위에 온다.
- 멈춤·이상 N은 멈춤 의심 업무와 사람 입력이 필요한 업무만 센다(띠의 `멈춤 N`과 같은 수). pane을 연 뒤에는 `kit.sh audit`(무거워서 5분마다)가 찾은 Coordinator 없는 Run과 상태 어긋남이 그 아래 `Run 점검 N · 상태 어긋남 M` 소제목과 자기 건수로 따로 붙는다. pane을 열기 전에는 `audit`를 실행하지 않는다.
- 10초마다 `kit.sh board <hub>`를 실행한다. 읽기만 하고 모델을 부르지 않는다. 읽을 Orca Run은 Coordinator 터미널이 살아 있는 Run과 열린 Task가 가리키는 Run뿐이라 확인 1회에 `orca` 호출이 2 + (그런 Run 수)번, 실제 hub 한 곳에서 1초 안팎. 읽기에 실패하면 pane에 이유가 나온다.
- hub 위치: Portfolio 세션과 개인 모드 Project는 스스로 찾는다. 공유 모드 Project는 `register`가 Git 공통 폴더에 남긴 포인터(`orchestration-kit-hub`)로 찾는다(`kit.sh hub <폴더>`). 포인터가 없던 프로젝트는 hub에서 `register`를 다시 실행하면 생긴다. `/config`의 `hubPath`는 이 모두보다 우선한다. Kit와 무관한 저장소는 `hubPath`를 설정할 때만 줄이 뜬다.
- 세션 도중 hub가 생기면(초기화 전에 시작한 세션) 다음 턴이 끝날 때나 pane을 열 때 다시 찾는다. 찾은 뒤에는 그 세션 동안 바꾸지 않는다.
- pane이 비어 있으면 이유가 나온다: 읽는 중, 이 저장소는 Kit 프로젝트가 아님, 프로젝트인데 hub를 찾지 못함(할 일 안내 포함), 읽기 실패(오류 줄).
- 항목의 출처: 블로커는 각 `TASKS.md`의 `blocked`, 검토 필요는 프로젝트 `TASKS.md`의 `in-review`와 Portfolio `TASKS.md`의 `needs-review` (작업 트리 기준), 보고 대기는 `kit.sh pending`, 위임 미수락은 `handoffs/outbox/<projectId>/`에 있지만 그 프로젝트 `TASKS.md`가 아직 가리키지 않는 PORT (Portfolio에서 `cancelled`·`completed`인 PORT는 뺀다), 진행 중은 Orca `worker-list`에서 `workerState`가 끝난 값(`succeeded`·`failed`·`stopped`·`abandoned`)이 아니고 liveness가 `exited`가 아닌 Worker다. 터미널 회계 값(`terminalState`)은 보지 않으므로 사람이 Worker 터미널을 넘겨받아도(`retained`) 일하는 Worker가 세어진다. 활동 시각은 같은 응답의 `evidence.lastObservedAt`, 회색은 `attention`의 `input`, 사람 입력 필요는 `activity`가 `blocked`이거나 `attention`에 `approval`이 있을 때다. Worker의 업무는 `Orca 참조` 열에 같은 Orca Task ID 또는 Dispatch ID가 있는 행이고, 그 행의 portfolioTaskId(없으면 projectTaskId)를 쓴다. 행이 없으면 `업무 연결 모름`이다.

`kit.sh board`의 `worker` 줄은 `worker<TAB>projectId<TAB>projectTaskId<TAB>runId<TAB>state<TAB>provider/model<TAB>terminal<TAB>portfolioTaskId<TAB>title<TAB>liveness<TAB>lastObservedAt<TAB>activity<TAB>attention`이다. 앞 7열은 전과 같고 8열부터는 덧붙인 것이며 없는 값은 `-`다. 일부 Run을 못 읽으면 `workers<TAB>partial<TAB>이유` 줄이 함께 나온다.

## 역할

Project Coordinator는 하위 작업마다 Worker 역할을 고른다: `frontend`, `designer`, `backend`, `qa`, `planner`, `architect`, `reviewer`, `docs`. 역할 파일(`roles/<id>.md`)에는 관점, 산출물, 수용 기준, 하지 않는 것이 있다. Coordinator는 이 본문을 Task 명세 맨 앞에 넣고, 같은 수용 기준으로 결과를 검증한다.

- 역할은 명세 본문으로 전달하므로 Claude·Codex·AGY Worker가 같은 방식으로 받는다. Orca `--agent`는 Provider 선택이다.
- 역할, 모델 등급, Provider는 따로 정한다.
- 작은 UI 수정은 Worker 1개에 `frontend` + 보조 `designer`, 큰 개편은 `designer`가 설계 문서를 쓰고 `frontend`가 구현한다.
- 프로젝트별 보강(스택, 디자인 시스템)은 프로젝트의 `.ai/roles/<id>.md`에 쓴다. adopt Skill이 프로젝트에 이미 있는 규칙 문서·검사 명령·Skill을 찾아 보강(역할마다 핵심 15줄 이하, 출처 커밋 포함)과 대응표(`.ai/ADOPT.md`)로 만든다. Coordinator는 세션을 시작할 때 `kit.sh adopt-check <저장소>`로 출처가 바뀌었는지 보고, 바뀌면 adopt를 다시 실행하자고 제안한다.
- 구조를 새로 정해야 하면 `architect`가 설계 문서(경계, 계약, 버린 대안, 이전·되돌리기, 결정 기록 초안)를 쓰고, 사용자가 승인한 뒤 `planner`가 실행 계획으로 바꾼다.
- 화면 결정의 기준은 프로젝트의 디자인 원칙 문서다 (양식 `templates/design/DESIGN-PRINCIPLES.md`). designer는 결정마다 원칙 ID를 적고, frontend는 원칙마다 점검 결과를 적는다. 원칙이 없으면 designer가 기존 화면에서 초안을 만들어 사용자 승인을 받는다.
- Worker가 수락 기준을 못 넘으면 상향 사다리를 탄다: 실패 증거를 붙여 같은 등급 1번 → effort → 등급 → 다른 Provider → 사용자에게 묻기 ([routing.md](policies/routing.md#실패했을-때-상향-사다리)).
- 계획과 QA 시트는 `strong` 등급으로, 그대로 시험을 쓰고 돌리는 일은 `fast`·`default` 등급으로 Worker를 나눠 띄운다 ([routing.md](policies/routing.md)).
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
$kit init project --personal ~/workspace/workspace-hub ~/work/team-app team-app   # 개인 모드
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

개인 모드 Project는 이 파일을 hub의 `projects/<projectId>/.ai/`에 만들고, 프로젝트 저장소에는 커밋되지 않는 상태 경로 파일과 로컬 무시 목록 한 줄만 남긴다. 저장소에 규칙 문서나 Skill이 있으면 setup이 끝날 때 adopt를 이어서 실행할지 묻는다.

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

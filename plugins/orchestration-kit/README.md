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
├─ .claude-plugin/plugin.json   Claude Code Plugin Manifest (이 폴더의 유일한 Claude 전용 파일)
├─ skills/                      Agent Skills 형식. 정책을 실행하는 Adapter
│  ├─ portfolio/SKILL.md
│  ├─ project/SKILL.md
│  └─ setup/SKILL.md
├─ policies/                    공통 정책 원본 (벤더 중립)
├─ roles/                       Worker 역할 프로필 (frontend, designer, backend, qa, reviewer, docs)
├─ templates/                   초기화·위임·보고 템플릿
│  ├─ project/                  Project 저장소에 만들 .ai/ 파일
│  ├─ portfolio/                Portfolio 저장소에 만들 파일
│  ├─ handoffs/                 위임 명세
│  └─ reports/                  완료 보고
├─ scripts/kit.sh               초기화·등록·미처리 보고 목록·처리 마커 (POSIX sh, 덮어쓰기 없음)
└─ tests/run.sh                 로컬 검사
```

Skill은 Plugin 폴더 안의 상대 경로(`../../policies/...`)로 정책을 읽는다. Plugin을 설치하면 폴더 전체가 함께 복사되므로 설치 위치에서도 그대로 읽힌다. 정책은 `policies/`에만 있고 Skill에 복제하지 않는다.

## Skill

| Skill | 호출 | 하는 일 |
|---|---|---|
| setup | `/orchestration-kit:setup` | 저장소를 Portfolio 또는 Project로 초기화, 환경 점검, `CLAUDE.md`·`AGENTS.md` 진입점 제안, Portfolio 연결 |
| project | `/orchestration-kit:project` | 컨텍스트 확인, 작업 분해, Direct/Subagent/Session/Worktree 선택, Orca Worker 감독, 검증, 완료 보고 |
| portfolio | `/orchestration-kit:portfolio` | 프로젝트 등록·목록, 업무·우선순위, 위임, 완료 보고 Pull, 전체 요약 |

"이 저장소 오케스트레이션 초기화해줘", "전체 현황 보여줘"처럼 말해도 description으로 골라진다.

## 역할

Project Coordinator는 하위 작업마다 Worker 역할을 고른다: `frontend`, `designer`, `backend`, `qa`, `reviewer`, `docs`. 역할 파일(`roles/<id>.md`)에는 관점, 산출물, 수용 기준, 하지 않는 것이 있다. Coordinator는 이 본문을 Task 명세 맨 앞에 넣고, 같은 수용 기준으로 결과를 검증한다.

- 역할은 명세 본문으로 전달하므로 Claude·Codex·AGY Worker가 같은 방식으로 받는다. Orca `--agent`는 Provider 선택이다.
- 역할, 모델 등급, Provider는 따로 정한다.
- 작은 UI 수정은 Worker 1개에 `frontend` + 보조 `designer`, 큰 개편은 `designer`가 설계 문서를 쓰고 `frontend`가 구현한다.
- 프로젝트별 보강(스택, 디자인 시스템)은 프로젝트의 `.ai/roles/<id>.md`에 쓴다.

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

Portfolio가 꺼져 있어도 Project는 일하고 보고서를 남긴다. 자동 알림은 없다. Pull은 사용자 요청이나 Portfolio 세션 시작 때 한다.

## 검사

```bash
plugins/orchestration-kit/tests/run.sh
claude plugin validate plugins/orchestration-kit
claude plugin validate .
```

## Codex·AGY 확장

정책(`policies/`), 템플릿, `scripts/kit.sh`, 프로젝트의 `.ai/`는 에이전트와 무관하다. 확장할 때는 이 폴더에 각 도구의 Manifest만 더한다. Claude·Codex·AGY의 `plugin.json`은 형식이 서로 다르므로 같은 파일을 재사용하지 않는다. Skill 폴더를 따로 떼어 링크하면 `../../policies` 경로가 깨지므로, 폴더 전체를 설치 단위로 쓴다.

## 아직 없는 것

Orca 병렬 Worktree 자동 실행, Worker 협업 자동화, 자동 Bootstrap, 자동 동기화·알림, Coordinator Provider 교체, 대시보드 UI. MCP 서버와 DB는 쓰지 않는다.

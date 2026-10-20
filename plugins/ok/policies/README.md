# 공통 정책

ok(orchestration kit)의 정책 원본이다. Skill(`skills/`)은 이 문서를 읽고 실행하는 절차서이고, 정책 본문을 복제하지 않는다.

## 표기

- **[확정]** 사용자가 확정한 사항. 바꾸려면 사용자 승인이 필요하다.
- **[검증됨]** 설치된 도구에서 동작을 확인한 사항. 도구 버전이 바뀌면 다시 확인한다.
- **[권장]** 현재 기본값. 프로젝트의 `project.md`로 바꿀 수 있다.

## 문서

| 문서 | 내용 |
|---|---|
| [coordinator.md](coordinator.md) | Coordinator 세션의 상시 규칙: 브리핑, 토론, 결정, 상태 기록, Orca 명령, 정리, 마무리 |
| [routing.md](routing.md) | 등급(S/M/L), 단계별 실행 주체와 Provider, 덮어쓰기, 모델·effort, 사용량, 상향 사다리 |
| [roles.md](roles.md) | 역할 목록, 명세에 넣는 법, 프로젝트 보강, 직군 Skill, 디자인 원칙 |
| [permissions.md](permissions.md) | 결정권, 승인 관문, Worker 권한, 안전 규칙 |

## 구조

```text
USER
 └─ 접수 세션 (hub 폴더에서 연 Claude Code 세션)        /ok:start 로 일을 맡긴다
     └─ Coordinator 세션 (작업 하나에 하나, Orca 새 워크트리)   /ok:plan 또는 /ok:quick
         ├─ Subagent (Claude, 같은 세션 안)             설계 리뷰·critic·코드 리뷰·qa-run
         └─ Worker (Orca, Claude·Codex·AGY)             기능 구현, 덮어쓰기로 리뷰도
Orca: Run / Task / Dispatch / Worker / Worktree 실행 상태
```

- [확정] Orca + Claude Code가 기본이다. 접수 세션과 Coordinator는 Claude Code다. Worker는 Claude·Codex·AGY 중에서 단계마다 고른다 ([routing.md](routing.md#단계별-실행-주체)).
- [확정] 승인 관문은 작업당 하나다 ([permissions.md](permissions.md#승인-관문)).
- 접수 세션은 세션을 여는 일만 한다. 설계·구현은 Coordinator가 맡긴 Subagent·Worker가 하고, Coordinator는 계획·분배·검증·정리를 한다. 간단 트랙(`/ok:quick`)만 Coordinator가 직접 고친다.
- 업무 지식은 hub의 Markdown에, 실행 상태는 Orca에 둔다. 둘이 다르면 실행 상태는 Orca를 따른다. 세션 대화는 원본이 아니다. 세션이 끝나도 hub 파일로 이어 갈 수 있어야 한다.

## hub 구성

```text
<HUB>/
  hub.json                         등록 프로젝트: [{id, title, repo, base}]
  AGENTS.md, CLAUDE.md             접수 세션 진입점
  projects/<id>/
    project.md                     설명과 설정 (test, finish, providers, order)
    status.md                      현재 상태 (## 체크포인트, ## 최근 7일 변경)
    learnings.md                   배운 것 (덧붙이기만)
    tasks/<slug>.md                작업 파일
    tasks/<slug>/                  brief.md, spec.md, qa-sheet.md, review-<역할>.md, debate*.md, review-summary.md, worker-<fid>.md
    decisions/<slug>-dNN.md        사용자 결정
    reports/<slug>-<역할|fid>.md   보고 (Subagent·Worker 결과)
    roles/<역할>.md, ADOPT.md      프로젝트 보강 (adopt Skill)
    DESIGN-PRINCIPLES.md           디자인 원칙 (있으면)
```

- 레포에는 커밋되는 파일이 없다. `ok.sh add`가 레포의 git 공통 폴더에 hub 포인터(`ok-hub`)와 `info/exclude`의 `.ok/` 한 줄만 남긴다. 둘 다 모든 워크트리에서 보이고 git에 올라가지 않는다.
- `.ok/`는 Worker가 자기 워크트리 안에 결과를 쓰는 폴더다 ([coordinator.md](coordinator.md#worker-결과-받기)).
- hub가 git 저장소면 Coordinator는 자기 `projects/<id>/`만 커밋한다 ([permissions.md](permissions.md#hub-쓰기)).

### 쓰기 소유

| 파일 | 쓰는 쪽 |
|---|---|
| `hub.json`, `projects/<id>/project.md` 만들기 | `ok.sh add` (init Skill) |
| `projects/<id>/` 의 나머지 | 그 프로젝트의 Coordinator |
| `reports/<slug>-<역할>.md` | 그 Subagent (자기 파일 하나). Worker 결과는 Coordinator가 옮겨 쓴다 |
| `review-*.md`, `debate*.md`, `qa-sheet.md` | 그 리뷰어·critic·qa |
| `roles/`, `ADOPT.md` | adopt Skill |

접수 세션은 `projects/`를 읽기만 한다. 한 프로젝트에 Coordinator가 여럿이면(작업이 여럿) 각자 자기 작업 파일만 고치고, `status.md`는 자기 줄만 고친다.

## 파일 형식

### 작업 파일 `tasks/<slug>.md`

```yaml
---
id: <slug>
title: <요청 한 줄>
status: planned | assigned | in-progress | in-review | blocked | completed | cancelled
track: plan | quick
risk: low | medium | high       # 결제·권한·데이터 삭제·외부 연동이 걸리면 high
size: small | medium | large    # 파일 10개 이상 또는 서비스 2개 이상이면 large
tier: S | M | L                 # plan만
owner: coordinator
providers:                      # 이 작업의 Provider 덮어쓰기 (routing.md), 없으면 비움
finish:                         # pr | branch | pr-merge (승인 카드의 답)
sessions: []                    # Orca dispatch:<id>
agents: []                      # Subagent <역할>:<id>
depends: []                     # 이 작업 브랜치가 기대는 다른 작업 slug
branch: <작업 브랜치>
worktree: <Coordinator 워크트리 절대 경로>
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
# <제목>

<요청 원문>

## 시작
기준 브랜치: <ref>, 작업 공간: 새 워크트리 | 현재 폴더

## 완료 조건
## Orca
run: <runId>, F1: dispatch <id> / handle <handle>, ...
## 마무리
```

- slug: 영문 소문자 2~4단어를 하이픈으로 (예: `login-sso`). 같은 이름이 있으면 `-2`.
- `status` 흐름: `planned` → (요구 정리·spec·리뷰) → `blocked`(승인 대기) → `assigned` → `in-progress` → `in-review`(머지 뒤 검증) → `completed`.

### 상태 파일 `status.md`

```markdown
---
updated: ISO 8601
---
# <id> 상태

## 체크포인트
- 진행 중: <slug> (<단계>, run <runId>), ...  없으면 없음
- 열린 결정: <파일명>, ...
- 블로커: ...
- 다음 안전한 행동: ...

## 최근 7일 변경
- YYYY-MM-DD <한 줄>
```

`## 체크포인트`는 네 줄을 유지한다. 오래된 체크포인트는 사실이 아니라 단서다.

### 결정 파일 `decisions/<slug>-dNN.md`

```yaml
---
task: <slug>
status: open | answered
asked_at: ISO 8601
options: ["A: ...", "B: ..."]
blocked: [<slug>]
answer:
---
# <질문 한 줄>

<질문 한 단락, 선택지별 근거>
```

### 보고 파일 `reports/<slug>-<역할|fid>.md`

```yaml
---
task: <slug>
role: <역할 또는 f1, finish, qa ...>
session: <Subagent id 또는 dispatch:<id>>
provider: claude | codex | antigravity
outcome: succeeded | failed | blocked
files: []
next: <한 줄>
finished_at: ISO 8601
applied: false        # Coordinator가 반영하면 true
---
OUTCOME: <outcome>
<3줄 요약>
```

## 용어

| 용어 | 뜻 |
|---|---|
| 접수 세션 | hub 폴더에서 연 세션. `/ok:start`로 Coordinator 세션을 연다 |
| Coordinator | 작업 하나를 맡은 세션. Orca가 레포의 새 워크트리에 띄운다. 그 워크트리를 Coordinator 워크트리, 그 브랜치를 작업 브랜치라 한다 |
| 기능 세션 | spec의 기능(F1, F2…) 하나를 구현하는 Orca Worker. 작업 브랜치에서 갈라진 워크트리에서 일한다 |
| Subagent | Coordinator 세션 안에서 도는 Claude 하위 에이전트 (`ok:<역할>`) |
| 역할 | 관점·산출물·수용 기준 묶음 (`roles/<id>.md`). Subagent와 Worker가 같은 파일을 받는다 |
| Provider | Worker를 돌리는 에이전트: `claude`, `codex`, `antigravity`(AGY) |
| 이슈 | GitHub 저장소의 Issues만 뜻한다 (issue-review Skill) |
| 블로커 | 작업 진행을 막는 것. 작업 상태 `blocked` |

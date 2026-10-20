# ok (orchestration kit)

여러 레포의 일을 hub 한 곳에서 맡기고, 작업마다 Coordinator 세션 하나가 계획·리뷰·구현·정리를 끝까지 맡는 Claude Code Plugin. 구현 Worker는 Orca로 띄우고 Claude·Codex·Antigravity(AGY) 중에서 단계마다 고른다. 모든 Skill은 사용자가 이름으로 부를 때만 돈다.

```text
USER
 └─ 접수 세션 (hub 폴더)            /ok:start <id> plan|quick <요청>
     └─ Coordinator 세션 (작업당 하나, Orca 새 워크트리)    /ok:plan · /ok:quick
         ├─ Subagent (Claude)       spec · 설계 리뷰 · critic · 코드 리뷰 · qa-run
         └─ Worker (Orca)           기능마다: claude | codex | antigravity
```

## 명령

| 명령 | 하는 일 |
|---|---|
| `/ok:init` | hub 만들기(`hub`), 레포 등록(`project <레포> <id>`), 옛 orchestration-kit hub 옮기기(`migrate`), 등록 상태(`status`) |
| `/ok:start <id> plan\|quick [--base <브랜치>] [--here] [--with 단계=provider,...] <요청>` | 접수 세션에서 그 레포의 새 Orca 워크트리에 Coordinator 세션을 연다. 인자가 없으면 질문 카드로 고른다 |
| `/ok:plan [--with …] <요청>` | 계획 트랙: 작업 파일·등급(S/M/L) → 요구 정리(애매함 %) → spec(기능·서브태스크) → 설계 리뷰 동시 + critic 토론 → **승인 카드 한 번** → 기능마다 Worker가 테스트 먼저 구현 → 기능별 코드 리뷰·머지 → 마무리 다듬기·qa-run → 정리·PR |
| `/ok:quick <요청>` | 간단 트랙: Coordinator가 직접 고친다(파일 3개·반나절 이내). 넘으면 멈추고 `/ok:plan`을 권한다 |
| `/ok:status [id]` | 진행 중 작업, 열린 결정, 반영 안 된 보고, 살아 있는 Worker를 읽어 요약 |
| `/ok:adopt` | 레포의 규칙 문서·검사 명령·Skill을 역할별 보강으로 가져온다 |
| `/ok:issue-review [owner/name]` | GitHub 이슈를 마지막 확인 이후분만 모아 분류·검토 |

보통 흐름: hub에서 `/ok:init` → `/ok:init project ~/code/app app` → `/ok:start app plan 로그인에 SSO 추가` → 열린 Orca 탭에서 질문에 답하고 승인 카드에 "시작" → 끝나면 접수 세션 카드 메모에 보고가 올라온다.

## 직접 호출만

오케스트레이션은 사용자가 명시적으로 요청했을 때만 시작한다 ([policies/permissions.md](policies/permissions.md#시작-조건-명시적-요청만)).

| Agent | 수단 |
|---|---|
| Claude Code Skill | 모든 `SKILL.md`에 `disable-model-invocation: true`. 모델은 설명을 보지 못하고 Skill 도구로 부를 수 없다. 메시지 맨 앞에 친 `/ok:…`만 돈다 |
| Claude Code Subagent | 자동 위임을 끄는 옵션이 없다. 그래서 `ok:<역할>` 정의가 브리핑 첫 줄 `ok-brief: <projectId>/<slug>`가 없으면 일하지 않는다 |
| Codex · AGY | ok Skill을 읽지 않는다. Coordinator가 띄운 Worker 명세로만 일한다. 레포에 Codex용 Skill을 둔다면 `agents/openai.yaml`의 `policy.allow_implicit_invocation: false`로 직접 호출만 허용할 수 있다. AGY에는 그런 옵션이 문서에 없다 |

## Claude와 다른 에이전트 같이 쓰기

기본은 Claude Subagent(빠르고 터미널을 만들지 않음)로 리뷰하고, 기능 구현만 Orca Worker로 띄운다. 단계마다 바꿀 수 있다 ([policies/routing.md](policies/routing.md#덮어쓰기)).

| 단계 키 | 기본 | 바꾸는 예 |
|---|---|---|
| `spec`, `review`, `critic`, `code-review`, `security`, `qa-run` | Claude Subagent | `review=codex` (읽기 전용 Codex Worker), `critic=cross` (spec을 쓴 Provider가 아닌 쪽) |
| `build`, `finish` | Claude Worker | `build=antigravity`, `build=codex` |

정하는 곳(먼저 찾은 값): 이번 요청의 `--with`나 말("리뷰는 codex로") → 작업 파일 `providers:` → `projects/<id>/project.md`의 `providers:` → 기본. 승인 카드에 단계별 실행 주체가 한 줄로 보이고, 카드의 "실행 주체 바꾸기"로 그 자리에서 바꿀 수 있다. 사용량이 주의 이상인 Provider는 순서상 다음 후보로 바뀌고 이유가 작업 파일 `## 실행`에 남는다.

## hub

```text
<HUB>/hub.json                      등록 프로젝트
<HUB>/projects/<id>/project.md      설정 (test, finish, providers, order)
                    status.md       체크포인트
                    learnings.md
                    tasks/<slug>.md, tasks/<slug>/   brief, spec, qa-sheet, review-*, debate*, worker-*
                    decisions/, reports/, roles/
```

레포에는 커밋되는 파일이 없다. 등록이 레포의 git 공통 폴더에 hub 포인터(`ok-hub`)와 `info/exclude`의 `.ok/` 한 줄만 남긴다. 형식은 [policies/README.md](policies/README.md).

## 구성

```text
ok/
├─ .claude-plugin/plugin.json
├─ skills/        init, start, plan (clarify.md, testing.md), quick, status, adopt, issue-review
├─ agents/        Subagent 정의 13개 (얇음: 모델·도구 기본값, ok-brief 확인)
├─ roles/         역할 원본 13개 + review-format.md. Subagent와 Worker가 같은 파일을 받는다
├─ policies/      coordinator, routing, roles, permissions, README(구조·형식)
├─ templates/     hub, project, design
├─ scripts/ok.sh  init · add · where · status · usage · usage-watch · adopt-check · migrate (POSIX sh, 없는 파일만 만듦)
└─ tests/run.sh
```

## 설치

```
claude plugin install ok@dg-agent-kit
```

범위는 user. 설치는 Skill을 쓸 수 있게 할 뿐이고, hub 만들기·등록·작업 시작은 각각 명령으로 한다. 필요한 것: Orca(실행 중), `jq`, `git`, PR을 만들려면 `gh`. Codex·AGY Worker를 쓰려면 각 CLI와 Orca 설정.

## orchestration-kit에서 옮기기

1. `claude plugin uninstall orchestration-kit@dg-agent-kit` 뒤 `ok`를 설치한다. Skill 이름이 `/orchestration-kit:*`에서 `/ok:*`로 바뀐다. 현황판 mod(입력창 위 포트폴리오 줄, pane, `/decide`)는 없어졌다.
2. hub 폴더에서 `/ok:init migrate`. 미리보기를 보고 승인하면: `hub.json`과 `projects/<id>/` 기본 파일을 만들고, 열린 Task와 아직 맡기지 않은 PORT 업무를 `tasks/*.md`로 옮기고, 역할 보강을 복사하고, 옛 `portfolio/`·`handoffs/`·`.ai/`는 지우지 않고 `archive/`로 옮긴다. 레포에는 포인터와 exclude 줄만 더한다.
3. 옛 공유 모드 레포의 `.ai/`와 git 공통 폴더의 `orchestration-kit-*` 포인터 파일은 그대로 남는다. 지울지는 사용자가 정한다.

| 옛 | 새 |
|---|---|
| Portfolio 위임 명세 → 사람이 Project 세션에 전달 → 수락 | `/ok:start`가 Coordinator 세션을 바로 연다 |
| Project Coordinator (프로젝트당 하나, 오래 감) | Coordinator (작업당 하나, 끝나면 보고) |
| `.ai/TASKS.md` 표, `PORT-`·`SAMPLE-` ID | `tasks/<slug>.md` 파일 하나씩 |
| 완료 보고 Pull, 처리 마커 | 보고 `applied: false`를 Coordinator가 반영 뒤 `true` |
| Worker 계획 승인 + Push·PR·병합마다 승인 | 승인 카드 한 번 (마무리 방식 포함) |
| `/decide` | 결정 파일 + 그 세션의 질문 카드 |

## 검사

```bash
plugins/ok/tests/run.sh
claude plugin validate plugins/ok
```

## 없는 것

웹 현황판, 슬랙·외부 업무 수집, 세션 기록 훅, Claude 데스크톱 앱 세션(Orca만 쓴다), Coordinator를 Codex·AGY로 돌리기. cw에서 가져온 것은 hub·접수 세션·작업당 Coordinator·계획/간단 트랙·요구 정리·설계 리뷰와 critic 토론·기능 세션·마무리 흐름이다.

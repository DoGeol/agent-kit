# 구조와 설계 결정

Claude Code·Codex·Antigravity(AGY) 세 도구에서 같은 키트를 쓰기 위한 구조. 2026-10 기준으로 확인한 사실 위에서 잡았다. 사용법은 [usage.md](usage.md).

## 1. 전제: 세 도구에서 되는 것

| | Claude Code | Codex | AGY |
|---|---|---|---|
| `SKILL.md` | 됨 | 됨 (`$이름`, `/skills`) | 됨 (슬래시 명령으로 바뀜) |
| `AGENTS.md` 규칙 | 됨 | 됨 (폴더마다 쌓임) | 됨 (워크스페이스 규칙, 상한 약 12,000자) |
| 훅 | 됨 | 됨, 설정 형식이 Claude와 같음 | **없음** |
| 플러그인 설치 | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` + `.agents/plugins/marketplace.json` | `gemini-extension.json` (`agy plugin install <git url>`) |
| 서브에이전트 | `agents/*.md` | 있음, 정의 파일 형식 미확인 | 2차 자료상 `.agents/agents/*.md`, 미확인 |

원칙:

1. **동작은 텍스트로 만든다.** Skill·규칙·역할·작업 파일. 세 도구가 모두 읽는다.
2. **훅은 보조다.** Claude·Codex에서 말투 잔류를 막는 정도로만 쓴다. 훅이 없어도 Skill만으로 같은 일이 된다.
3. **Skill 폴더는 자기 완결이다.** 설치 사본에는 플러그인 폴더만 들어가고 `link.sh`는 Skill 폴더 하나씩 링크하므로, Skill이 읽는 규칙·vendor·역할·스택은 `build.sh`가 그 Skill 폴더 안에 사본으로 넣는다(`_rules/`·`_vendor/`·`_roles/`·`_stacks/`). Skill 본문은 자기 폴더 기준 상대 경로만 쓰고 도구 전용 변수(`$ARGUMENTS`)를 쓰지 않는다. 어긋남은 `check.sh`가 잡는다.
4. **트리거만, 자동 발동 없음.** description에 "직접 입력했을 때만"을 적는다. 서브에이전트는 자동 위임을 끌 수 없어 브리핑 첫 줄 `kit-brief:` 가드로 막는다.

## 2. 구조

```text
agent-kit/
├─ .claude-plugin/ .codex-plugin/ .agents/plugins/ gemini-extension.json   세 도구 매니페스트 (루트 = 플러그인 kit)
├─ skills/<name>/      SKILL.md + 사본(_rules _vendor _roles _stacks). dev spec write check crew design mock debug setup
├─ rules/              우리 규칙 원본: dev spec write check crew design mock debug ask
├─ roles/              직군 원본 6개 + review-format.md + <직군>/reference.md. _archive/는 옛 ok 역할
├─ agents/             roles/에서 생성한 Claude 서브에이전트 (kit-brief 가드, review 역할은 읽기 전용 도구)
├─ stacks/<name>/      STACK.md + team.md + vendor/. react animation design(+rules/) mobile python java node
├─ vendor/             manifest.tsv(저장소·커밋·경로) + 원본 사본 9개 저장소, 폴더마다 LICENSE
├─ hooks/              plain.sh (선택, 기본 꺼짐)
├─ plugins/mods-hud/   Claude 전용 mod (그대로)
└─ scripts/            vendor.sh(fetch·check·update) build.sh(사본·agents 생성) check.sh link.sh vendor-map.tsv
```

플러그인은 둘: `kit`(루트, 세 도구)과 `mods-hud`(Claude). 옛 `ok`(Orca 오케스트레이션)는 지웠고 역할 문서만 `roles/`로 옮겼다. 나머지는 git 기록(`e393647`)에 있다.

## 3. 핵심 설계

### 트리거 Skill

상태를 저장하는 모드 대신 **요청에 붙이는 트리거**(`/dev …`)로 한다. 상태·훅이 없어 세 도구에서 똑같이 돈다.

- `/dev`는 caveman·ponytail이 설치돼 있으면 읽고 따른다("Skill 목록에 있으면 이름으로, 없으면 Skill 폴더에서 SKILL.md를 찾아"). 없으면 `rules/dev.md`만으로 간다. 같은 작업이 이어지는 동안 유지되고, 다른 주제나 `/write`·`/spec`이 오면 풀린다. 세션 밖으로 나가는 글(커밋·PR·슬랙)은 항상 일반 문장.
- caveman·ponytail·im-not-ai는 훅·CLI·스크립트가 딸려 있어 vendor에 넣지 않고 **원본 설치**한다. `/setup`이 확인·안내한다. 자체 훅은 끔(`PONYTAIL_DEFAULT_MODE=off`, `/caveman off`).
- `/spec`은 넓히고(grilling 질문·선택지) → 적고(to-spec 틀) → 깎는다(ponytail 세 질문은 **깎는 단계에서만**). caveman은 `/spec`·`/write`·`/design` 어디에도 없다.
- 글쓰기는 한국어 기본. `rules/write.md`는 im-not-ai 진단 규칙(73개)에서 추린 16가지 패턴. 다듬기는 im-not-ai `/humanize`를 권하기만 한다.

### 직군 × 스택

- 역할(`roles/<직군>.md`, 스택 무관)과 스택 팩(`stacks/<스택>/`)을 호출할 때 붙인다: `crew build backend:python …`. 조합마다 에이전트를 만들지 않는다.
- 스택은 호출 인자 → 직군 + 레포 파일(`pyproject.toml`, `build.gradle`·`pom.xml`, `package.json`의 `react-native`·`expo`/`react`) → 묻기 순으로 정한다.
- 브리핑은 **절대 경로만** 넘기고 내용을 복사하지 않는다. 첫 줄 `kit-brief: <직군>[:<스택>]`, `읽을 것:`·`역할:`·`스택:`·`형식:`·`참고:`·`범위:`·`산출:`·`작업:`. 산출은 레포의 `.kit/<slug>/`.
- 서브에이전트가 없는 도구에서는 본 세션이 역할 파일을 읽고 그 역할로 순서대로 한다.
- **병렬**은 직군이 둘일 때 카드로 묻는다(병렬·순차·하나로). 병렬이면 본 세션이 `contract.md`를 먼저 뽑고, 조율은 메시지가 아니라 `contract-changes.md`를 거쳐 본 세션이 한다(같은 건 3회까지). 에이전트끼리 직접 대화시키지 않는다: 기록이 안 남고, 도구마다 지원이 다르고, 멈출 기준이 없다.
- 스택 진입 파일은 `STACK.md`다. `SKILL.md`로 두면 도구가 Skill로 등록한다. `check.sh`가 중첩 `SKILL.md`를 잡는다.

### vendor

- `vendor/manifest.tsv`에 저장소·커밋·경로를 적고 `vendor.sh fetch`로 받는다. 쓰는 폴더만, 폴더마다 LICENSE. `vendor.sh update <이름>`은 diff를 보이고 사람이 검토한 뒤 커밋을 올린다. 사용자는 kit 버전 업데이트로 받는다.
- 트리거 하나에 방법론 하나(뼈대). 나머지는 특정 단계의 참고. 본문 맨 위 재료 표에 `파일 · 쓰는 절 · 단계 · 덮어쓰는 점`을 적고, 첫 줄에 `재료: …`를 찍어 보이게 한다. 항상 읽는 텍스트(`_rules`+`_vendor`)는 Skill당 20KB 예산, `_roles`·`_stacks`는 선택적으로 읽어 예산 밖.
- 뺀 것과 이유: superpowers `subagent-driven-development`(32KB)·`writing-plans`(10KB)는 예산 초과라 핵심만 `rules/crew.md`에, `brainstorming`·`test-driven-development`는 grilling·`rules/dev.md`와 겹침, Vercel `writing-guidelines`·`web-design-guidelines`는 원격 URL 의존, blader humanizer(32KB)는 예산 초과라 영어 글은 `rules/write.md` 한 절로, anthropics `docx`·`pdf`·`pptx`·`xlsx`는 오픈 라이선스 아님, VoltAgent 페르소나는 체크리스트만 직접 씀(java).

### 묻는 방식과 인자 안내

- 카드가 있으면 카드, 없으면 번호 목록. 추천 첫 번째 + "(추천)", 2~4개, 한 번에 4개까지, 사실은 묻지 않고 찾는다(`rules/ask.md`).
- 값 자동완성은 세 도구 다 없다. description에 형식과 값 목록을 넣어 팝업에 보이게 하고(Claude는 `argument-hint`도), 빠뜨리면 카드로 묻는다.

## 4. Skill 이름

Claude 플러그인은 `/kit:dev`처럼 접두어가 붙어 안 겹치지만, Codex(`$이름`)·AGY(`/이름`)는 맨 이름이라 내장 명령과 겹치면 안 된다. Claude 바이너리(2.1.306), `openai/codex` `slash_command.rs`, `google-gemini/gemini-cli` 명령 소스로 대조했다.

| 이름 | 결과 |
|---|---|
| `plan` → **`spec`** | Claude(plan mode)·Codex·Gemini CLI 모두 내장 |
| `review` → **`check`** | Codex 내장 |
| `dev` `write` `crew` `design` `mock` `debug` `setup` | 겹치지 않음(`write`는 Claude에서 tool 이름으로만 보임) |

피할 이름: `plan` `review` `init` `goal` `brief` `status` `config` `memory` `skills` `agents`.

## 5. 확인 안 된 것 (실제 도구에서)

이 저장소 안에서는 `claude plugin validate .`, `check.sh`, 훅 스크립트까지만 확인했다. 아래는 각 도구에서 직접 돌려 봐야 한다. 공식 문서 사이트(openai.com, antigravity.google)는 작업 환경의 네트워크 정책에 막혀 못 읽었다.

- [ ] **Claude**: `claude plugin marketplace add ~/agent-kit && claude plugin install kit@dg-agent-kit` → `/kit:setup`, `/kit:spec 테스트`. `crew build backend …`가 `kit-brief` 가드를 지나 서브에이전트로 도는지. `hooks/plain.sh`를 `plain=on`으로 켜고 stdout이 컨텍스트로 들어가는지.
- [ ] **Codex**: `codex plugin marketplace add DoGeol/agent-kit` → `$dev`가 뜨는지. Skill을 `/dev`로도 부를 수 있는지(그러면 이름 충돌 범위가 넓어짐). 팝업이 인자 힌트를 보이는지. `/hooks`에서 kit 훅을 신뢰하면 `${CLAUDE_PLUGIN_ROOT}`가 오는지. 마켓플레이스에 플러그인이 하나만 있어도 되는지. 서브에이전트 정의 형식과 병렬·워크트리 가능 여부. 사용자 질문(카드) 도구가 있는지.
- [ ] **AGY**: `agy plugin install …` → `/dev`가 뜨는지, 저장소 전체(`plugins/`·`docs/`·`vendor/`)가 설치돼도 문제가 없는지. `/help`로 내장 명령 확인(`/goal`·`/effort`·`/codesearch` 등 2차 자료). 규칙 상한 12,000자. 서브에이전트·질문 도구 유무.
- [ ] **외부 Skill**: caveman 플러그인의 SessionStart 훅이 `/caveman off` 뒤에도 다음 세션에 켜는지. ponytail이 `off`일 때 매 턴 무엇을 주입하는지. `/setup` 표가 실제 설치 경로를 맞게 찾는지.
- [ ] **Claude 서브에이전트끼리 메시지**: 형제끼리 직접 되는지(돼도 알림용으로만).
- [ ] **`link.sh` 경로**: Codex·AGY에서 링크된 Skill이 `_vendor/` 사본을 제대로 읽는지.
- [ ] **`/check design` 브라우저 확인**: Playwright가 없는 환경에서 코드 리뷰만으로 떨어지는지.
- [x] Emil `prototype` 실행 환경: dev 서버면 격리 라우트, 없으면 단독 HTML. 둘 다 됨.
- [x] 플러그인 루트 `hooks/hooks.json` 자동 로드: 스크립트가 설정 없이는 아무것도 출력하지 않아 기본 꺼짐.
- [x] 옛 ok `DESIGN-PRINCIPLES.md`: `stacks/design/team.md`의 틀로 가져와 범용 원칙으로 채움.

## 6. 결정 기록

| 쟁점 | 결정 |
|---|---|
| 모드 vs 트리거 | 트리거. 여러 턴 켜 두고 싶어지면 그때 `/dev on`을 더한다 |
| Claude에서 부르는 이름이 둘(`/kit:dev` vs `/dev`) | Claude는 플러그인만. `link.sh` 기본 대상에서 `~/.claude/skills`를 뺌 |
| `/dev` 적용 범위 | "같은 작업이 이어지는 동안". 써 보고 조정 |
| vendor를 상대 경로로 읽기 | `build.sh`가 Skill 폴더 안 `_vendor/`에 사본. 루트 `vendor/`는 원본 보관 |
| 생성된 `agents/`가 자동 위임에 걸림 | `kit-brief:` 가드를 생성 템플릿에 |
| roles 13개 중 쓰는 건 6개 | 나머지 `roles/_archive/` |
| 큰 vendor 파일 | 20KB 예산. 넘는 것은 핵심만 우리 규칙에 적거나 선택적으로 읽는 `_stacks`에 |
| `team.md` | 범용 기본값으로 채움(0.6.1). 팀이 바꾸면 바뀐 줄이 이기고 레포 설정이 더 우선 |
| 에이전트끼리 조율 | 메시지가 아니라 `contract.md`·`contract-changes.md` 파일. 3회 상한 |
| `ok` 플러그인 | 삭제. 오케스트레이션은 `crew`가 한 세션 안에서 가볍게 |
| 테스트 | Claude는 `claude plugin eval`로 자동화 예정, Codex·AGY는 명령마다 1회 수동. 결과는 위 확인 목록에 날짜와 함께 |
| 저장소 규칙(`AGENTS.md`) | 루트 kit은 세 도구 공용, `argument-hint`만 예외 허용, 사본은 고치지 않음, kit이 바뀌면 version 세 곳 |

## 7. 진행 기록

| 버전 | 내용 |
|---|---|
| 0.1.0 | 세 도구 매니페스트, `/dev` `/spec` `/write` `/setup`, `rules/`, `vendor.sh`·`build.sh`·`check.sh`, `AGENTS.md`·README 개정 |
| 0.2.0 | `roles/` 6개 정리(frontmatter), `agents/` 생성 + `kit-brief` 가드 |
| 0.3.0 | `/check`, `crew`(계약 먼저, 병렬·순차 카드, `.kit/`) |
| 0.4.0 | `stacks/react`·`animation`·`design`, 폴더 복사·중첩 SKILL.md 검사 |
| 0.5.0 | `/design`, `/mock`(Emil prototype 뼈대) |
| 0.6.0 | `stacks/python`·`java`·`node`, `/debug`, 선택 훅 |
| 0.6.1 | `team.md` 5개 범용 기본값 |
| 0.7.0 | `stacks/design/rules/` 8개, 브라우저 확인(webapp-testing), 컴포넌트 원칙, `/design audit`, 애니메이션 기회·페이지 전환·iOS 느낌, `stacks/mobile` |

다음 후보: 실제 도구 확인 결과 반영, `claude plugin eval` 테스트, 자주 쓰는 조합의 이름 붙인 에이전트, 프롬프트를 보고 `/dev`를 자동으로 붙이는 판별(오판·비용 때문에 뒤로 미룸).

## 8. 참고한 것

- ponytail: 루트 하나로 여러 도구 플러그인, Claude·Codex 공용 hooks.json, `PONYTAIL_DEFAULT_MODE`
- caveman: 규칙 사본 생성 + drift 테스트, 도구별 프로필 컴파일
- superpowers: 작업마다 새 서브에이전트, 보고를 믿지 않고 산출 확인, 서브에이전트 없을 때 분기, 병렬 원칙
- Vercel react-best-practices: 규칙 하나에 파일 하나(영향도·틀린 예·맞는 예·이유), 카테고리 접두사
- Emil Kowalski: 애니메이션 수치 기준, 시안 피커, 컴포넌트 원칙
- mattpocock grilling: 결정 나무, 한 라운드에 지금 물을 수 있는 것 전부
- im-not-ai: 한국어 AI 티 분류 10개·73개 패턴

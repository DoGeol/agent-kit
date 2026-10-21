# agent-kit 구조 개편안

Claude Code·Codex·Antigravity(AGY) 세 도구에서 같은 키트를 쓰기 위한 구조. 2026-10 기준으로 확인한 사실 위에서 잡았다.

## 전제: 세 도구에서 되는 것

| | Claude Code | Codex | AGY |
|---|---|---|---|
| `SKILL.md` | 됨 | 됨 (`$이름`, `/skills`) | 됨 (슬래시 명령으로 바뀜) |
| `AGENTS.md` 규칙 | 됨 | 됨 (폴더마다 쌓임) | 됨 (워크스페이스 규칙, 상한 약 12,000자) |
| 훅 | 됨 | 됨, 설정 형식이 Claude와 같음 | **없음** |
| 플러그인 설치 | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` + `.agents/plugins/marketplace.json` | `gemini-extension.json` (`agy plugin install <git url>`) |
| 서브에이전트 | `agents/*.md` | 있음, 정의 파일 형식 미확인 | 2차 자료상 `.agents/agents/*.md`, 미확인 |

원칙 세 가지:

1. **동작은 텍스트로 만든다.** 스킬·규칙·역할·작업 파일. 세 도구가 모두 읽는다.
2. **훅은 보조다.** Claude·Codex에서 모드를 유지하고 상태를 그리는 데만 쓴다. 훅이 없어도 스킬만으로 같은 일이 된다(덜 단단할 뿐).
3. **설치 사본에는 그 플러그인 폴더만 들어간다.** 플러그인이 플러그인 밖 파일을 읽으면 안 된다. 공유 파일은 생성해서 넣고 어긋나면 테스트가 잡는다.

## 목표 구조

```text
agent-kit/
├─ .claude-plugin/
│   ├─ marketplace.json      kit(루트), mods-hud, ok
│   └─ plugin.json           루트 = 플러그인 "kit" (Claude)
├─ .codex-plugin/plugin.json 루트 = 플러그인 "kit" (Codex)
├─ .agents/plugins/marketplace.json
├─ gemini-extension.json     루트 = 플러그인 "kit" (AGY, contextFileName 없음)
│
├─ skills/                   공통 Skill (세 도구). 지금은 비어 있음
│   ├─ dev/                  /dev <요청>: caveman·ponytail을 끌어와 코드 작업 (이 턴만)
│   ├─ plan/                 /plan <요청>: superpowers brainstorming·grill-me로 spec 한 장
│   ├─ write/                /write <요청>: 일반 문장. 기획서·메시지·PR 본문
│   ├─ review/               /review [대상]: reviewer 역할 + ponytail-review (+ review-animations)
│   └─ crew/                 직군×스택으로 일 맡기기 (서브에이전트 없으면 같은 세션에서)
├─ rules/                    트리거 본문의 재료이자 외부 Skill이 없을 때의 축약 규칙
│   ├─ dev.md                짧은 답, 최소 구현, 테스트 먼저
│   ├─ write.md              일반 문장, AI 티 나는 문장 피하기
│   └─ plan.md               질문 몰아서 하기, 산출은 spec
├─ roles/                    직군 원본 (plugins/ok/roles에서 옮김). 스택과 무관
│   ├─ frontend.md backend.md designer.md planner.md qa.md reviewer.md security.md …
│   └─ review-format.md
├─ stacks/                   스택 팩. 역할에 붙여 쓴다
│   ├─ react/      SKILL.md + rules/ (Vercel react-best-practices 중 고른 것 + 팀 규칙 team.md)
│   ├─ animation/  SKILL.md + rules/ (Emil Kowalski animate 기준)
│   ├─ python/     uv · pytest · ruff · 타입
│   ├─ java/       Spring Boot · Gradle · JUnit
│   └─ node/       TypeScript · pnpm · vitest
├─ vendor/                   그대로 들여온 외부 Skill. 폴더마다 LICENSE, 고정 커밋
│   └─ <owner>-<repo>/
├─ hooks/                    선택. Claude·Codex 공용 (같은 hooks.json)
│   └─ hooks.json            UserPromptSubmit: /dev가 아닌 턴에 "일반 문장" 한 줄 (caveman 말투 잔류 방지)
├─ agents/                   Claude 서브에이전트. roles/ + stacks/에서 **생성** (손으로 안 고침)
├─ plugins/                  Claude 전용. 지금 쓰는 것을 그대로 유지한다
│   ├─ mods-hud/             mod. 파일·명령·설치 방법 모두 그대로
│   └─ ok/                   오케스트레이션 (Claude + Orca 전용). 흐름 그대로
│       └─ roles/            roles/에서 **생성**한 사본. tests/run.sh가 어긋남을 잡는다
├─ scripts/
│   ├─ link.sh               (있음) skills/ → 각 도구 폴더
│   ├─ build.sh              roles+stacks → agents/, plugins/ok/roles/, AGENTS.md 조각
│   ├─ vendor.sh             vendor/ 갱신 (고정 커밋에서)
│   └─ check.sh              생성물 어긋남 · 라이선스 파일 · frontmatter 검사
└─ docs/
```

플러그인은 셋이 된다.

| 플러그인 | 내용 | 도구 |
|---|---|---|
| `kit` (루트) | skills · rules · roles · stacks · hooks · agents | Claude · Codex · AGY |
| `mods-hud` | 현황판 mod | Claude |
| `ok` | Orca 오케스트레이션 | Claude |

루트를 플러그인으로 쓰는 건 ponytail과 같은 방식이다(`marketplace.json`의 `source: "./"`). 플러그인을 하나로 설치해 세 도구가 같은 Skill을 본다.

## 핵심 설계 네 가지

### 1. 트리거 Skill (`skills/dev`·`plan`·`write`·`review`, `rules/`)

불편 2·3번(기획·메시지에서는 caveman이 안 돌았으면, 개발에서만 caveman·ponytail)을 푼다. 상태를 저장하는 모드 대신 **요청에 붙이는 트리거**로 한다. 상태·훅이 없어 세 도구에서 똑같이 돈다.

| 트리거 | 끌어오는 Skill | 산출 |
|---|---|---|
| `/dev <요청>` | caveman, ponytail, karpathy-guidelines | 코드 + 테스트 |
| `/plan <요청>` | superpowers `brainstorming`·`writing-plans`, mattpocock `grill-me` | spec 한 장 |
| `/write <요청>` | Vercel `writing-guidelines`, `avoid-ai-writing`, internal-comms | 일반 문장 문서·메시지 |
| `/review [대상]` | reviewer 역할, `ponytail-review`, 프론트면 `review-animations` | 지적 목록 |

- **본문 형식**: `요청: $ARGUMENTS` → "`caveman`·`ponytail` Skill이 있으면 읽고 따른다(이름으로 부르거나 그 SKILL.md를 연다). 없으면 `rules/dev.md`의 축약 규칙으로" → 처리 → "이 턴에만. 커밋 메시지·PR 본문은 일반 문장".
- **부르는 법**: Claude `/dev`, Codex `$dev`, AGY `/dev`(슬래시 명령 변환). 다른 Skill을 끌어오는 문장을 도구 중립으로 쓰면 같은 파일이 세 곳에서 된다.
- **frontmatter**: `name`·`description`만(저장소 규칙). description에 "사용자가 /dev를 직접 입력했을 때만"을 적어 자동 발동을 막는다.
- **잔류 방지**: caveman은 "stop caveman까지 켜져 있다"고 자기 Skill에 적어 뒀다. `/dev`의 "이 턴에만"이 대부분 막는다. 더 단단히 하려면 Claude·Codex에서만 `hooks/`의 UserPromptSubmit 한 줄(`/dev`가 아니면 일반 문장). 선택이고 나중에 붙여도 된다. AGY는 본문 지시에 맡긴다.
- **외부 Skill의 자체 훅은 끔**: ponytail `PONYTAIL_DEFAULT_MODE=off`, caveman `caveman off`. 안 끄면 `/dev` 없이도 켜진다.
- **세션 밖으로 나가는 글은 항상 일반 문장**: 커밋 메시지, PR 본문, 슬랙 초안. `rules/dev.md`에 박는다.
- 여러 턴 동안 계속 켜 두고 싶어지면 그때 `/dev on`(폴더 모드 파일 + 훅)을 더한다. 지금은 만들지 않는다.

### 2. 직군 × 스택 (`roles/`, `stacks/`, `skills/crew`)

불편 4번과 "백엔드도 Python·Java·Node로 나누기"를 푼다. 조합마다 에이전트를 만들지 않고 호출할 때 붙인다.

```text
crew build backend:python <요청>
crew review frontend:react
crew build backend <요청>        ← 스택 생략: 레포 파일로 판단
```

- **역할**(`roles/<직군>.md`): 하는 일, 산출물, 수용 기준, 하지 않는 것. 스택과 무관. ok의 지금 역할 파일이 그대로 원본이다.
- **스택 팩**(`stacks/<스택>/`): `SKILL.md`(언제 읽나 + 규칙 목록, 영향도 순) + `rules/`(규칙 하나에 파일 하나: 영향도·틀린 예·맞는 예·이유) + `team.md`(팀 고유 규칙). Vercel `react-best-practices`의 72개 규칙 형식을 따른다.
- **스택 정하기**(먼저 찾은 값): 호출 인자 → 프로젝트 설정 `stack:` → 레포 파일(`pyproject.toml`→python, `build.gradle`·`pom.xml`→java, `package.json`→node, 거기에 `react` 의존성→react).
- **전달**: 받는 쪽에 `역할: roles/backend.md`, `스택: stacks/python/SKILL.md` 경로 두 줄. ok의 "역할 + 보강"과 같은 방식이라 세 도구 어디서든 된다.
- **실행 주체**: Claude는 생성된 `agents/<직군>.md`로 서브에이전트, Codex·AGY는 서브에이전트가 있으면 그것, 없으면 **같은 세션에서 역할 파일을 읽고 순서대로**. superpowers `subagent-driven-development`의 분기와 같다.
- **AGY 상한**: 항상 켜지는 규칙은 12,000자 안에 둔다. 스택 규칙 전부를 `AGENTS.md`에 넣지 않고 상위 10개 목록만 넣고 나머지는 필요할 때 읽게 한다.

### 3. 외부 Skill 들여오기 (`vendor/`)

| 방식 | 대상 | 이유 |
|---|---|---|
| 원본 설치기로 그대로 | caveman, ponytail | 훅·CLI가 딸려 있고 자주 바뀐다. 우리는 모드에서 켜고 끄기만 |
| `vendor/`에 복사 | 작은 텍스트 Skill: superpowers 일부, mattpocock `grill-me`·`to-spec`, addyosmani `code-reviewer`, Vercel `react-best-practices`·`writing-guidelines`, Emil `animate`·`review-animations`, `karpathy-guidelines` | 고정 커밋에서 받아 재현된다. 폴더마다 LICENSE |
| 응용 | 우리 Skill이 "vendor의 X를 읽고 따른 뒤 아래 다른 점만" | ok 보강 파일과 같은 방식. 원본을 안 고치니 갱신이 쉽다 |

- 오픈 라이선스가 아닌 것은 복사하지 않는다(anthropics/skills의 `docx`·`pdf`·`pptx`·`xlsx`).
- VoltAgent 류 페르소나 정의(280줄 "You are a senior…")는 복사하지 않고 체크리스트만 뽑아 `roles/`·`stacks/`에 넣는다.
- `scripts/vendor.sh`가 `vendor/manifest.json`(repo, commit, 경로)대로 받는다. `check.sh`가 LICENSE 없는 폴더를 잡는다.

### 4. ok 손보기 (불편 1번: 오래 걸리고 중간에 볼 게 없음)

구조는 그대로 두고 네 가지를 더한다. 자세한 것은 ok README에 둔다.

1. **`build` 트랙**: quick과 plan 사이. spec 한 장 → 승인 → 구현 → 리뷰 1회. critic 토론과 리뷰어 여러 명은 L 등급이거나 high 지적이 있을 때만.
2. **첫 기능 먼저 끝내기**: 첫 기능을 구현·테스트·머지까지 끝내고 멈춰 보여 준다. 확인 뒤 나머지를 동시에.
3. **진행 파일**: Worker가 서브태스크마다 `tasks/<slug>/progress.md`에 한 줄(`14:02 F1-2 테스트 통과`). `/ok:status`와 mods-hud가 그대로 보여 준다.
4. **단계별 시간**: 작업 파일 `## 실행`에 시작·끝 시각. 어디서 시간이 가는지 숫자로 본 뒤 줄인다.

ok는 `roles/`를 플러그인 밖에서 읽을 수 없으므로 `build.sh`가 `plugins/ok/roles/`에 사본을 만든다. `tests/run.sh`에 어긋남 검사를 더한다(caveman이 `SKILL.md`에서 규칙 사본을 만들고 drift 테스트로 잡는 것과 같다).

## 지금 구조에서 바뀌는 것

| 지금 | 바뀐 뒤 |
|---|---|
| `skills/` 비어 있음 | `dev`·`plan`·`write`·`review`·`crew` |
| `plugins/ok/roles/` 원본 | `roles/` 원본, ok 안은 생성 사본 |
| `plugins/ok/agents/` 손으로 작성 | 루트 `agents/`를 roles에서 생성, ok는 그대로 쓰되 역할 경로만 바뀜 |
| 역할만 있고 스택 없음 | `stacks/` 추가, `crew`가 조합 |
| caveman·ponytail 항상 켜짐 | 기본 끔, `/dev` 턴에서만 |
| `mods-hud` | 그대로 (Claude 전용 mod는 계속 `plugins/`에) |
| 마켓플레이스 플러그인 2개 | 3개(`kit` 루트 추가). Codex·AGY 매니페스트 추가 |
| `AGENTS.md` "plugins/는 Claude 전용", "skills/ frontmatter는 name·description만" | 루트 플러그인은 세 도구 공용. `skills/` 규칙은 유지(도구 전용 필드 금지), `plugins/*`만 Claude 필드 허용 |

안 바뀌는 것: `mods-hud` 전부, ok의 흐름과 hub 형식, `link.sh`.

## 진행 순서

작게 나눠 각각 따로 PR로 한다. 앞 단계가 끝나야 다음이 의미 있다.

| # | 일 | 결과 | 검사 |
|---|---|---|---|
| 1 | 루트 플러그인 `kit` + `skills/dev`·`plan`·`write`·`review` + `rules/` | 세 도구에서 `/dev 요청`이 caveman·ponytail을 끌어옴, `/write`는 일반 문장 | `claude plugin validate .`, Codex·AGY에 설치해 네 트리거 확인 |
| 2 | `roles/`로 옮기고 `build.sh`·`check.sh` | ok 테스트 통과, 생성 사본 어긋남 검사 | `plugins/ok/tests/run.sh` |
| 3 | `stacks/react` + `stacks/animation` + `roles/frontend.md` 다듬기 | 첫 스택 팩. 형식이 정해짐 | `crew review frontend:react`로 실제 diff 리뷰 |
| 4 | `skills/crew` | 직군×스택 호출. 서브에이전트 없으면 같은 세션 | 세 도구에서 같은 요청 |
| 5 | `stacks/python`·`java`·`node` | 3번 형식 그대로 | |
| 6 | `vendor/` + `vendor.sh` | 외부 Skill 고정 커밋으로. 트리거가 vendor 경로를 가리킴 | `check.sh` 라이선스 |
| 7 | ok: `build` 트랙, progress.md, 첫 기능 먼저, 시간 기록 | 1번 불편 해소 | ok 테스트 |

1번이 가장 작고 체감이 크다. 4번 전에 Codex·AGY의 서브에이전트 정의 형식을 공식 문서에서 확인한다(이 세션에서는 네트워크 정책으로 못 읽었다).

## 열린 질문

- **스택 팩 `team.md`**: 팀의 React 규칙(상태 관리, 폴더 구조, 이름 짓기)과 백엔드 규칙을 사용자가 준다.
- **트리거 없이 자동 판별**: 프롬프트를 보고 개발인지 판단해 `/dev`를 자동으로 붙이는 것. 오판과 비용 때문에 뒤로 미룬다.
- **Codex 마켓플레이스에 플러그인 여러 개**: 루트 `kit`만 Codex·AGY에 올리고 `mods-hud`·`ok`는 Claude 마켓플레이스에만 둔다. Codex 마켓플레이스가 여러 플러그인을 받는지는 확인하지 않았다.
- **`crew`와 `ok`의 경계**: `crew`는 한 세션 안, 어느 도구나. `ok`는 작업당 세션·Orca·hub. `crew`가 커지면 "`/ok:start`로 가세요" 한 줄로 넘긴다.

## 참고한 것

- ponytail: 루트 하나로 Claude·Codex·AGY·Gemini 플러그인, Claude·Codex 공용 hooks.json, 모드 파일 + UserPromptSubmit 추적, `PONYTAIL_DEFAULT_MODE`
- caveman: `SKILL.md`에서 규칙 사본 생성 + drift 테스트, 도구별 프로필 컴파일
- superpowers `subagent-driven-development`: 작업마다 새 서브에이전트, 리뷰 두 단계, 서브에이전트 없을 때 분기
- Vercel `react-best-practices`: 규칙 하나에 파일 하나, 카테고리 접두사, `AGENTS.md` 합본
- Emil Kowalski `animate`: 애니메이션 기준(100회/일이면 없음, transform·opacity만, `ease-in` 금지, 300ms 이하, reduced-motion)
- wshobson/agents: 스택별 지식 Skill 묶음(python 16개)

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
2. **훅은 보조다.** Claude·Codex에서 말투 잔류를 막는 정도로만 쓴다. 훅이 없어도 스킬만으로 같은 일이 된다(덜 단단할 뿐).
3. **Skill 폴더는 자기 완결이다.** 설치 사본에는 플러그인 폴더만 들어가고, `link.sh`는 Skill 폴더 하나씩 링크한다. 그래서 Skill이 읽는 vendor·규칙 파일은 `build.sh`가 그 Skill 폴더 안에 사본으로 넣고, 어긋나면 `check.sh`가 잡는다. Skill 본문은 자기 폴더 기준 상대 경로만 쓴다(도구 전용 변수 금지).

## 목표 구조

```text
agent-kit/
├─ .claude-plugin/
│   ├─ marketplace.json      kit(루트), mods-hud
│   └─ plugin.json           루트 = 플러그인 "kit" (Claude)
├─ .codex-plugin/plugin.json 루트 = 플러그인 "kit" (Codex)
├─ .agents/plugins/marketplace.json
├─ gemini-extension.json     루트 = 플러그인 "kit" (AGY, contextFileName 없음)
│
├─ skills/                   공통 Skill (세 도구). 지금은 비어 있음. 각 폴더에 build.sh가 넣은 vendor 사본(_vendor/) 포함
│   ├─ dev/                  /dev <요청>: caveman·ponytail을 끌어와 코드 작업
│   ├─ spec/                 /spec <요청>: grill-me로 질문 → spec 한 장 (옛 이름 plan, 충돌로 바꿈)
│   ├─ write/                /write <요청>: 한국어 일반 문장. 기획서·메시지·PR 본문
│   ├─ check/                /check [직군[:스택]] [대상]: 리뷰 (옛 이름 review, 충돌로 바꿈)
│   ├─ crew/                 직군×스택으로 일 맡기기 (서브에이전트 없으면 같은 세션에서)
│   ├─ design/               /design <화면>: 레이아웃 질문 → design-brief
│   ├─ mock/                 /mock <UI 조각>: 시안 3개 만들어 고르기
│   └─ setup/                /setup: caveman·ponytail·im-not-ai 설치 확인과 안내
├─ rules/                    트리거 본문의 재료이자 외부 Skill이 없을 때의 축약 규칙
│   ├─ dev.md                짧은 답, 최소 구현, 테스트 먼저
│   ├─ write.md              한국어 일반 문장, AI 티 나는 문장 피하기
│   ├─ spec.md               질문 몰아서 하기, 산출은 spec
│   └─ ask.md                묻는 방식: 카드 있으면 카드, 추천 첫 번째, 한 카드에 4개까지
├─ roles/                    직군 원본 (옛 ok에서 옮김, 손질 필요). 스택과 무관
│   ├─ frontend.md backend.md designer.md planner.md qa.md reviewer.md security.md …
│   └─ review-format.md
├─ stacks/                   스택 팩. 역할에 붙여 쓴다
│   ├─ react/      SKILL.md + rules/ (Vercel react-best-practices 중 고른 것 + 팀 규칙 team.md)
│   ├─ animation/  SKILL.md + rules/ (Emil Kowalski animate 기준)
│   ├─ design/     SKILL.md + rules/ (간격·타이포·색 토큰·상태·반응형) + team.md
│   ├─ python/     uv · pytest · ruff · 타입
│   ├─ java/       Spring Boot · Gradle · JUnit
│   └─ node/       TypeScript · pnpm · vitest
├─ vendor/                   그대로 들여온 외부 Skill. 폴더마다 LICENSE, 고정 커밋
│   └─ <owner>-<repo>/
├─ hooks/                    선택. Claude·Codex 공용 (같은 hooks.json)
│   └─ hooks.json            UserPromptSubmit: /dev가 아닌 턴에 "일반 문장" 한 줄 (caveman 말투 잔류 방지)
├─ agents/                   Claude 서브에이전트. roles/에서 **생성** (손으로 안 고침). 브리핑 첫 줄 `kit-brief:`가 없으면 일하지 않는 가드 포함
├─ plugins/                  Claude 전용. 지금 쓰는 것을 그대로 유지한다
│   └─ mods-hud/             mod. 파일·명령·설치 방법 모두 그대로
├─ scripts/
│   ├─ link.sh               (있음) skills/ → 각 도구 폴더
│   ├─ build.sh              roles+stacks → agents/, AGENTS.md 조각
│   ├─ vendor.sh             vendor/ 갱신 (고정 커밋에서)
│   └─ check.sh              생성물 어긋남 · 라이선스 파일 · frontmatter 검사
└─ docs/
```

플러그인은 둘이 된다.

| 플러그인 | 내용 | 도구 |
|---|---|---|
| `kit` (루트) | skills · rules · roles · stacks · hooks · agents | Claude · Codex · AGY |
| `mods-hud` | 현황판 mod | Claude |

옛 `ok`(Orca 오케스트레이션)는 지웠다. 역할 문서만 `roles/`로 옮겼고 나머지는 git 기록에 있다.

루트를 플러그인으로 쓰는 건 ponytail과 같은 방식이다(`marketplace.json`의 `source: "./"`). 플러그인을 하나로 설치해 세 도구가 같은 Skill을 본다.

## 핵심 설계 세 가지

### 1. 트리거 Skill (`skills/dev`·`spec`·`write`·`check`, `rules/`)

불편 2·3번(기획·메시지에서는 caveman이 안 돌았으면, 개발에서만 caveman·ponytail)을 푼다. 상태를 저장하는 모드 대신 **요청에 붙이는 트리거**로 한다. 상태·훅이 없어 세 도구에서 똑같이 돈다. 트리거마다 무엇을 끌어오는지는 아래 "트리거별 재료" 표가 기준이다.

| 트리거 | 산출 |
|---|---|
| `/dev <요청>` | 코드 + 테스트 |
| `/spec <요청>` | spec 한 장 |
| `/write <요청>` | 한국어 일반 문장 문서·메시지 |
| `/check [직군[:스택]] [대상]` | 지적 목록 |

- **본문 형식**: `요청: $ARGUMENTS` → "`caveman`·`ponytail` Skill이 있으면 읽고 따른다(이름으로 부르거나 그 SKILL.md를 연다). 없으면 `rules/dev.md`의 축약 규칙으로" → 처리 → "이 턴에만. 커밋 메시지·PR 본문은 일반 문장".
- **부르는 법**: Claude `/dev`, Codex `$dev`, AGY `/dev`(슬래시 명령 변환). 다른 Skill을 끌어오는 문장을 도구 중립으로 쓰면 같은 파일이 세 곳에서 된다.
- **frontmatter**: `name`·`description`만(저장소 규칙). description에 "사용자가 /dev를 직접 입력했을 때만"을 적어 자동 발동을 막는다.
- **적용 범위**: `/dev`를 친 작업이 이어지는 동안(테스트 → 구현 → 수정의 후속 턴) 유지하고, 사용자가 다른 주제를 꺼내거나 `/write`·`/spec`을 치면 풀린다. "이 턴만"으로 하면 구현처럼 여러 턴 걸리는 일에 매번 다시 쳐야 한다(검토 쟁점 2).
- **잔류 방지**: caveman은 "stop caveman까지 켜져 있다"고 자기 Skill에 적어 뒀다. 본문의 적용 범위 문장이 대부분 막는다. 더 단단히 하려면 Claude·Codex에서만 `hooks/`의 UserPromptSubmit 한 줄. AGY는 본문 지시에 맡긴다.
- **외부 Skill의 자체 훅은 끔**: ponytail `PONYTAIL_DEFAULT_MODE=off`(확인됨), caveman은 방법 미확인(후속 확인). 안 끄면 `/dev` 없이도 켜진다.
- **세션 밖으로 나가는 글은 항상 일반 문장**: 커밋 메시지, PR 본문, 슬랙 초안. `rules/dev.md`에 박는다.

**글쓰기는 한국어가 기본이다.** `/write`·`/spec`의 산출물과 `/check`의 지적은 한국어로 쓴다(역할 파일도 이미 한국어). 한국어 AI 티는 영어와 다르다(번역투 "~에 대하여"·"~를 통해", 이중 피동 "~되어진다", "가지고 있다", 접속사 남발, 문장 길이 균일). 그래서:

- `rules/write.md`는 im-not-ai의 진단 규칙 10개 분류(73개)에서 자주 걸리는 것을 추려 담는다. 외부 설치 없이도 초안 단계에서 피하게 한다.
- 다듬기는 im-not-ai를 **원본 설치**해서 `/humanize`(light·standard·heavy 자동 선택)·`/humanize-scan`(진단만)으로 한다. Python 스크립트와 작업 폴더가 필요해 SKILL.md 복사로는 안 돈다.
- `/write`는 초안까지만 하고 "`/humanize`로 다듬으세요" 한 줄로 끝낸다. 한 턴에 둘 다 돌리면 길어지고, 초안을 사람이 먼저 보는 게 낫다.
- 영어 글은 blader humanizer(vendor)의 패턴을 쓴다. Vercel `writing-guidelines`는 영어 문장 규칙이라 구조(제목·단락·목록) 부분만 참고한다.
- 커밋 메시지가 한국어면 im-not-ai의 `commit-ko` 규칙을 `rules/dev.md`에서 가리킨다.

### 1-1. `/spec`에서 ponytail은 끝에만

`/spec`은 넓히고(질문·대안) → 적고 → 깎는다. ponytail의 세 질문(꼭 있어야 하나 → 레포에 이미 있나 → 표준 라이브러리로 되나)은 **깎는 단계에서만** 기능마다 적용해 `안 하는 것`·`나중에`를 채운다. 앞 단계에서 켜면 "모호한 요청은 최소 버전으로"라는 ponytail 규칙이 물어봐야 할 것을 잘라 버린다. caveman은 `/spec` 어디에도 넣지 않는다(spec은 사람이 읽는 문서).

### 2. 직군 × 스택 (`roles/`, `stacks/`, `skills/crew`)

불편 4번과 "백엔드도 Python·Java·Node로 나누기"를 푼다. 조합마다 에이전트를 만들지 않고 호출할 때 붙인다.

```text
crew build backend:python <요청>
crew check frontend:react
crew build backend <요청>        ← 스택 생략: 직군 + 레포 파일로 판단
```

- **역할**(`roles/<직군>.md`): 하는 일, 산출물, 수용 기준, 하지 않는 것. 스택과 무관. 옛 ok의 역할 파일을 옮겨 왔으므로 ok 전용 문구(`plan 8단계`, `<KIT>`, `reports/` 경로)를 걷어내야 한다. 처음 쓰는 직군은 `frontend`·`backend`·`designer`·`qa`·`reviewer`·`security` 여섯이다. ok 흐름용이던 `planner`·`critic`·`qa-run`·`researcher`·`docs`·`infra`·`architect`는 `roles/_archive/`로 내리고 필요해지면 되살린다.
- **스택 팩**(`stacks/<스택>/`): `SKILL.md`(언제 읽나 + 규칙 목록, 영향도 순) + `rules/`(규칙 하나에 파일 하나: 영향도·틀린 예·맞는 예·이유) + `team.md`(팀 고유 규칙). Vercel `react-best-practices`의 72개 규칙 형식을 따른다.
- **스택 정하기**(먼저 찾은 값): 호출 인자 → 프로젝트 설정 `stack:` → 직군 + 레포 파일(`pyproject.toml`→python, `build.gradle`·`pom.xml`→java, `package.json`에 `react`→frontend는 react, `package.json`만→backend는 node). 모노레포처럼 섞이면 묻는다(`rules/ask.md`).
- **전달**: 받는 쪽에 `역할: roles/backend.md`, `스택: stacks/python/SKILL.md` 경로 두 줄. 파일 내용을 프롬프트에 복사하지 않으므로 세 도구 어디서든 된다.
- **실행 주체**: Claude는 생성된 `agents/<직군>.md`로 서브에이전트, Codex·AGY는 서브에이전트가 있으면 그것, 없으면 **같은 세션에서 역할 파일을 읽고 순서대로**. superpowers `subagent-driven-development`의 분기와 같다.
- **병렬 맡기기**: spec에 직군이 둘 이상이면 `crew build spec.md`가 카드로 묻는다 — 병렬(계약 먼저, 기능이 서로 독립일 때 추천) / 순차(계약이 흔들릴 때) / 하나로(변경이 작을 때). 병렬이면:
  1. 본 세션이 spec에서 맞닿는 부분만 `contract.md`로 뽑는다(엔드포인트, 요청·응답 모양, 오류 코드, 이벤트). 애매하면 여기서 묻는다.
  2. 직군마다 동시에 띄운다. 각자에게 역할·스택·spec·contract·자기 기능 ID 경로만. 서로 안 겹치는 경로나 워크트리에서 작업. frontend는 계약대로 mock을 먼저 세운다. 둘 다 계약 테스트를 쓴다.
  3. 조율은 **메시지가 아니라 파일**: 계약을 바꿔야 하면 `contract-changes.md`에 한 줄(무엇·왜·영향). 본 세션이 판단해 계약을 고치고 상대에게 알린다. 같은 건으로 3회 넘으면 사용자에게 카드. 메시지는 "파일에 적었다" 알림으로만(가능한 도구에서).
  4. 둘 다 끝나면 본 세션이 머지 → 계약 테스트 → `/check`.
  서브에이전트가 없는 도구에서는 병렬 선택지가 뜨지 않고 같은 세션에서 계약 → backend → frontend 순서로 한다. 직군은 처음엔 둘까지. 에이전트끼리 직접 대화시키지 않는 이유: 기록이 안 남고, 도구마다 지원이 다르고(서브에이전트끼리 메시지는 Claude에서도 미확인), 멈출 기준이 없다.
- **자동 위임 가드**: Claude는 플러그인 `agents/`를 자동 위임 후보로 삼고 이를 끄는 옵션이 없다(옛 ok에서 겪음). 생성된 에이전트는 브리핑 첫 줄이 `kit-brief: <역할>/<스택>`이 아니면 "kit 브리핑이 아니어서 일하지 않습니다" 한 줄만 돌려준다. `crew`만 이 줄을 붙인다.
- **AGY 상한**: 항상 켜지는 규칙은 12,000자 안에 둔다. 스택 규칙 전부를 `AGENTS.md`에 넣지 않고 상위 10개 목록만 넣고 나머지는 필요할 때 읽게 한다.

### 3. 외부 Skill 들여오기 (`vendor/`)

| 방식 | 대상 | 이유 |
|---|---|---|
| 원본 설치기로 그대로 | caveman, ponytail, im-not-ai | 훅·CLI·스크립트가 딸려 있고 자주 바뀐다. 우리는 트리거에서 켜고 끄기만 |
| `vendor/`에 복사 | 작은 텍스트 Skill (아래 표) | 고정 커밋에서 받아 재현된다. 폴더마다 LICENSE |
| 응용 | 우리 Skill이 "vendor의 X를 읽고 따른 뒤 아래 다른 점만" | 원본을 안 고치니 갱신이 쉽다 |

vendor 목록(확인한 라이선스 기준, 쓰는 폴더만 가져온다):

| 폴더 | 가져올 것 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| `epoko77-im-not-ai/` | `references/diagnosis-rules.md`만 (한국어 AI 티 73개) | MIT | `rules/write.md` 재료. 본체는 원본 설치 |
| `blader-humanizer/` | `SKILL.md` (영어 패턴 26개) | MIT | `/write` 영어 글 |
| `obra-superpowers/` | `verification-before-completion`, `subagent-driven-development`, `writing-plans`(`crew plan`만), `systematic-debugging`(나중 `/debug`) | MIT | `/dev`, `crew` |
| `mattpocock-skills/` | `grill-me`, `to-spec`, `diagnosing-bugs`(나중 `/debug`) | MIT | `/spec`, `/design` |
| `addyosmani-agent-skills/` | `agents/code-reviewer.md`, `agents/security-auditor.md` | MIT | `/check`, `crew check security` |
| `vercel-labs-agent-skills/` | `react-best-practices`(rules 72개), `composition-patterns`, `react-view-transitions`, `web-design-guidelines`, `writing-guidelines`(구조만) | MIT | `stacks/react`, `/check design`, `/write` |
| `emilkowalski-skills/` | `animate`, `review-animations`, `animation-performance`, `emil-design-eng`, `prototype`, `break-ui`, `pick-ui-library` | MIT | `stacks/animation`, `roles/designer.md`, `/mock`, `/design`, `/check design` |
| `forrestchang-karpathy/` | `karpathy-guidelines` | MIT | `/dev` |
| `anthropics-skills/` | `skill-creator`, `frontend-design`, `webapp-testing` | Apache-2.0 | 새 Skill, `/design`, `crew check qa` |
| `wshobson-agents/` | `python-development/skills/*` 중 고른 것, `nodejs-backend-patterns`, `typescript-advanced-types` | MIT | `stacks/python`·`node` |

넣지 않는 것과 이유: anthropics `docx`·`pdf`·`pptx`·`xlsx`(오픈 라이선스 아님), VoltAgent 언어별 페르소나(280줄 "You are a senior…", 체크리스트만 뽑아 `stacks/`에 직접 씀), superpowers `brainstorming`·`test-driven-development`(grill-me·`rules/dev.md`와 겹침), wshobson `avoid-ai-writing`(humanizer와 겹침), addyosmani `code-simplification`(ponytail과 겹침), 나머지는 필요해지면 추가.

- `scripts/vendor.sh`가 `vendor/manifest.json`(repo, commit, 경로)대로 받는다. `check.sh`가 LICENSE 없는 폴더와 manifest에 없는 폴더를 잡는다.
- 갱신은 kit 저장소에서만 한다: `vendor.sh update <이름>` → diff 확인 → manifest 커밋 올림 → `plugin.json` 버전 올림. 사용자는 플러그인 업데이트로 받는다. vendor가 바뀌어도 kit 버전을 올려야 전달된다.
- vendor는 `skills/`에 등록하지 않으므로 사용자에게 명령으로 보이지 않고 자동 발동도 안 한다(Vercel `web-design-guidelines`처럼 자동 발동형 description을 가진 것도 포함). 트리거가 자기 폴더의 `_vendor/` 사본을 경로로 읽는다.

불편 1번(오케스트레이션이 오래 걸리고 중간에 볼 게 없음)은 ok를 지우면서 사라진다. `crew`가 한 세션 안에서 가볍게 맡기는 쪽을 맡고, 단계가 끝날 때마다 결과를 보여 준다. 더 큰 흐름이 필요해지면 그때 `crew` 위에 얹는다(superpowers `subagent-driven-development`를 참고하되 중간 확인 지점을 둔다).

## Skill 이름 (초안, 확인 뒤 확정)

Claude는 플러그인 Skill에 접두어가 붙어(`/kit:dev`) 내장 명령과 안 겹친다. Codex(`$이름`)와 AGY(`/이름`), 그리고 `link.sh`로 맨 이름을 링크한 Claude는 접두어가 없어 겹칠 수 있다. 내장 명령 목록을 확인한 결과:

| 후보 | Claude 내장 | Codex 내장 | Gemini CLI 내장 (AGY 전신) | 판단 |
|---|---|---|---|---|
| `dev` | 없음 | 없음 | 없음 | **그대로** |
| `plan` | **있음** (plan mode) | **있음** | **있음** | 바꾼다 → `spec` (산출물 이름이라 직관적) |
| `write` | tool 이름으로만 보임, 명령은 미확인 | 없음 | 없음 | 그대로, 확인 필요 |
| `review` | 없음 (`ultrareview`·`security-review`는 있음) | **있음** | 없음 | 바꾼다 → `check` (확정 전) |
| `design` | 없음 (`design-consent` 등 접두 유사) | 없음 | 없음 | 그대로 |
| `mock`, `crew`, `kit` | 없음 | 없음 | 없음 | 그대로 |
| `debug` (나중) | 없음 | `debug-config`만 | 없음 | 그대로 |

피할 이름: `plan`, `review`, `init`, `goal`, `brief`, `status`, `config`, `memory`, `skills`, `agents`.

확인 출처: Claude Code 바이너리(2.1.306)의 명령 정의, `openai/codex` `codex-rs/tui/src/slash_command.rs`, `google-gemini/gemini-cli` `packages/cli/src/ui/commands/`. 모두 2026-10-21 main.

## 후속 확인 목록

다음 작업을 시작할 때 먼저 본다. 이 세션에서는 공식 문서 사이트(openai.com, antigravity.google)가 네트워크 정책에 막혀 못 읽었다.

- [ ] **AGY 내장 명령**: `agy`에서 `/help`를 쳐서 실제 목록 확인. 위 표는 Gemini CLI 소스 기준이라 AGY에서 더해진 것(`/goal`, `/effort`, `/codesearch` 등 2차 자료)이 빠져 있다. `/design`·`/mock`·`/check`·`/spec`·`/dev`·`/crew`·`/kit`가 없는지.
- [ ] **Codex에서 Skill 호출 형태**: `$dev`만인지, `/dev`로도 되는지. `/`로도 되면 `review`뿐 아니라 모든 충돌이 문제. `codex`에서 `/skills` 확인.
- [ ] **Codex·AGY 서브에이전트 정의 파일 형식**: 공식 문서. `crew` 3단계 전에 필요. 병렬 실행이 되는지, 에이전트마다 워크트리를 줄 수 있는지도.
- [ ] **Claude 서브에이전트끼리 메시지**: 본 세션→서브에이전트는 되는데, 형제끼리 직접 되는지. 돼도 알림용으로만 쓴다.
- [ ] **Codex 마켓플레이스에 플러그인 여러 개**: 루트 `kit` 하나만 올리면 되는지.
- [ ] **AGY 규칙 상한 12,000자**: 공식 문서에서 확인. `stacks/` 목록 길이에 영향.
- [ ] **`link.sh` 경로에서 Claude 맨 이름 충돌**: `~/.claude/skills/spec`이 플러그인 없이 `/spec`으로 뜨는지, 내장과 겹치면 어느 쪽이 이기는지.
- [ ] **`/write`**: Claude 바이너리의 `write`가 명령인지 tool인지. `/help`로 확인.
- [ ] **Emil `prototype`의 실행 환경**: 피커가 프로젝트 dev 서버를 요구하는지, 단독 HTML로도 되는지. `/mock` 설계에 영향.
- [ ] **Codex·AGY의 사용자 질문 도구**: Codex에 선택지 카드 도구가 있는지(plan 모드의 사용자 질문 도구로 알려짐), AGY는 무엇인지. 없으면 번호 목록으로 간다.
- [ ] **옛 ok `templates/design/DESIGN-PRINCIPLES.md`**: git 기록(`e393647`)에서 꺼내 `stacks/design/team.md` 출발점으로 쓸지.
- [ ] **Codex·AGY 팝업의 인자 힌트**: `$crew`·`/crew` 팝업이 description 외에 인자 힌트를 보여 주는지. 보여 주면 그 필드도 쓴다.
- [ ] **caveman 기본 끔 방법**: Claude 플러그인의 SessionStart 훅이 매 세션 켠다. `caveman off`가 훅까지 끄는지, 아니면 플러그인을 빼고 Skill만 둬야 하는지. ponytail 훅이 off 상태에서 매 턴 무엇을 주입하는지도.
- [ ] **AGY 플러그인 설치 범위**: `agy plugin install <git url>`이 저장소 전체를 받는지, `skills/`만 보는지. 전체면 `plugins/mods-hud`·`docs`·`vendor`가 따라가는데 문제가 없는지.
- [ ] **`claude plugin validate .`**: 루트가 마켓플레이스이면서 플러그인일 때 둘 다 검증하는지.
- [ ] **플러그인 루트 `hooks/hooks.json` 자동 로드**: Claude가 설치 즉시 읽으면 "선택"이 아니다. 훅 안에서 설정 파일(`~/.config/agent-kit/hooks=off`)로 끄게 하거나 별도 플러그인으로 뺀다.

## 디자인 (초안)

| 트리거 | 뼈대 (vendor) | 덮어쓰기 |
|---|---|---|
| `/design <화면>` | mattpocock `grill-me` + anthropics `frontend-design` 방향 질문 | 질문 순서: 목적 → 독자 → 내용 우선순위 → 제약(기존 토큰·컴포넌트) → 분위기. 2단계에서 구성 2~3개 비교표(라이브러리는 Emil `pick-ui-library`). 산출 `design-brief.md` |
| `/mock <UI 조각>` | Emil `prototype` | 시안 3개, 축(레이아웃·밀도·성격·모션)에 이름. 프로젝트 토큰 재사용, 한국어 더미 문구, 고른 것만 코드 반영 |
| `/check design` | Vercel `web-design-guidelines` + Emil `break-ui`(최악 데이터) + `review-animations` | 지적 형식은 `review-format.md` |

`stacks/design/`: `SKILL.md`(규칙 상위 목록) + `rules/`(간격 스케일, 타이포 단계, 색 토큰, 빈·로딩·오류 상태, 반응형 기준, 터치 크기) + `team.md`(팀 원칙). `/dev frontend`·`/check design`·`designer` 역할이 같이 읽는다. 나중에: `mobile`(Vercel `react-native-skills`, Emil `mobile-native`), `sql`, `infra`.

## vendor를 트리거에 녹이는 규칙

| 규칙 | 뜻 |
|---|---|
| 트리거 하나에 방법론 하나 | 뼈대는 vendor 하나. 나머지는 특정 단계의 참고 |
| "따른다"보다 "이 단계에서만 참고" | 절차는 우리 Skill이 갖고, vendor는 단계 하나에 규칙을 공급 |
| 재료 표를 본문 맨 위에 | `vendor 파일 · 쓰는 절 · 어느 단계 · 덮어쓰는 점` |
| 충돌은 명시 | 두 vendor가 반대 말을 하면 어느 게 이기는지 적는다 |
| 예산 | 트리거가 읽는 vendor 텍스트 합계 상한(3,000토큰). `check.sh`가 잰다 |
| 하나로 시작 | 부족한 사례가 나올 때만 하나 더 |
| 보이게 | 트리거 시작 줄 `재료: grill-me(질문) · ponytail 세 질문(깎기)` |
| 테스트 | 트리거마다 고정 프롬프트 2~3개 + 기대 성질 체크리스트. vendor 올릴 때 돌린다 |

트리거별 재료(초안):

| 트리거 | 뼈대 | 단계별 참고 | 설치형(있으면) |
|---|---|---|---|
| `/dev` | `rules/dev.md` | karpathy(시작 전), superpowers `verification-before-completion`(끝) | ponytail(구현), caveman(말투) |
| `/spec` | mattpocock `grill-me` | `to-spec`(형식) | ponytail 세 질문(깎기) |
| `/write` | `rules/write.md`(한국어) | blader humanizer(영어일 때), Vercel `writing-guidelines`(구조만) | im-not-ai(초안 뒤 `/humanize` 권함) |
| `/check` | `roles/reviewer.md` + `review-format.md` | addyosmani `code-reviewer`(5관점 순서), 스택 규칙, Emil `review-animations` | ponytail-review |
| `crew` | superpowers `subagent-driven-development` (단, 단계마다 멈춰 보여 줌) | `writing-plans`(`crew plan`만) | |
| `/design` | `grill-me` | `frontend-design`, `pick-ui-library` | |
| `/mock` | Emil `prototype` | | |

뺀 것과 이유: superpowers `brainstorming`·`test-driven-development`(grill-me·`rules/dev.md`와 겹침), wshobson `avoid-ai-writing`(humanizer와 겹침).

## 사용자에게 묻는 방식 (공통 규칙)

`/spec`·`/design`·`crew`·`/setup`처럼 사용자가 골라야 하는 자리는 전부 같은 형식으로 묻는다. `rules/ask.md`에 두고 각 트리거가 가리킨다.

- **질문 카드가 있으면 카드로**(Claude `AskUserQuestion`, Codex의 사용자 질문 도구, AGY도 있으면). 없으면 번호 목록으로 묻고 번호로 답받는다. Skill 본문에는 도구 이름을 쓰지 않고 "질문 카드가 있으면 그것으로, 없으면 번호 목록으로"라고 적는다.
- **추천을 첫 번째에**, 라벨 끝에 "(추천)". 선택지는 2~4개. 각 선택지에 한 줄: 무엇이 일어나나, 되돌릴 수 있나, 비용·위험.
- 서로 독립인 질문은 **한 카드에 4개까지** 묶는다. 서로 기대는 질문은 다음 카드로.
- 자유 답이 필요한 질문("할 일을 한 줄로")은 선택지 대신 "기타" 칸으로.
- 답이 모호하면 다시 묻는다. 되돌리기 어려운 일이면 특히.
- 혼자 정할 수 있는 일은 묻지 않는다. 묻는 것은 범위·우선순위·되돌리기 어려운 선택뿐.

**인자 안내.** 값 자동완성은 세 도구 다 없다. 대신 두 겹으로 한다.

1. **팝업 힌트**: description 문장에 형식과 값 목록을 넣는다(세 도구 팝업이 description을 보여 줌). 예: `crew build|check|plan <직군>[:<스택>] <요청>. 직군: frontend backend designer qa reviewer security. 스택: react animation design python java node`. Claude 전용 `argument-hint`도 같은 문구로 넣는다(다른 도구는 무시, 저장소 규칙에 예외로 적는다).
2. **빠뜨리면 카드**: 직군을 빼면 요청 내용·레포 파일로 추천을 1번에 놓고 묻는다. 스택만 빼면 레포 파일로 판단해 진행하고 첫 줄에 "스택: python(pyproject.toml)"처럼 표시한다. 둘 다 적으면 묻지 않는다. `/check`(생략 → 현재 diff), `/design`·`/mock`(대상 생략 → 묻기)도 같다.

예 (`/spec` 1단계):

```
Q1. 취소 가능 시점은?
  1. 배송 전까지 (추천) — 가장 흔한 정책, 나중에 넓힐 수 있음
  2. 결제 직후만 — 구현이 가장 작음
  3. 언제든 — 환불·재고 처리가 복잡해짐
Q2. 부분 취소?
  1. 아니오, 전체만 (추천)
  2. 예, 품목 단위
  3. 예, 수량 단위
```

`/design`의 2단계 "구성 2~3개 비교"와 `/mock`의 "시안 고르기"도 같은 카드다: 선택지마다 축 이름과 장단점 한 줄, 추천 첫 번째.

## 설치 안내 (`/setup`)

caveman·ponytail·im-not-ai는 kit에 넣지 않고 사용자가 설치한다. `/setup`이 각 도구의 Skill 폴더와 플러그인 폴더를 보고 있는 것·없는 것을 표로 보이고, 없는 것은 그 도구의 설치 명령을 출력한다. 설치는 사용자가 한다. 없어도 트리거는 돌고 그 부분만 빠진다. README 설치 절: 필수 kit / 권장 caveman·ponytail(개발), im-not-ai(한국어 글). (Skill 이름이 `kit`이면 Claude에서 `/kit:kit`이 되어 `setup`으로 둔다.)

## 검토 쟁점 (결정 필요)

문서를 한 번 훑어 찾은 것. 각 항목에 추천을 적었다. 결정되면 본문에 반영하고 여기서 지운다.

| # | 쟁점 | 추천 |
|---|---|---|
| 1 | **Claude에서 부르는 이름이 둘.** 플러그인이면 `/kit:dev`, `link.sh`면 `/dev`. 둘 다 설치하면 같은 Skill이 두 번 뜬다. 또 `link.sh`는 Skill만 링크해 `agents/`·`hooks/`가 빠진다 | Claude는 **플러그인만**. `link.sh`는 Codex·AGY용으로 두고 Claude 대상 폴더(`~/.claude/skills`)를 기본값에서 뺀다. README에 "Claude는 `/kit:dev`"로 적는다 |
| 2 | **`/dev` 적용 범위.** "이 턴만"은 여러 턴 걸리는 구현에 매번 다시 쳐야 함. "작업이 이어지는 동안"은 경계가 흐림 | 본문에 "같은 작업이 이어지는 동안 유지, 다른 주제나 `/write`·`/spec`이 오면 해제"로 쓰고 써 보면서 조정. 안 되면 그때 `/dev on`·`/dev off` |
| 3 | **vendor를 상대 경로로 읽기.** `link.sh`로 Skill 폴더를 심볼릭 링크하면 `../../vendor`가 링크 위치 기준으로 풀려 못 찾을 수 있다 | 원칙 3대로 `build.sh`가 각 Skill 폴더 안 `_vendor/`에 사본을 넣는다. Skill은 `_vendor/grill-me/SKILL.md`처럼 자기 폴더 안만 가리킨다. 루트 `vendor/`는 원본 보관용 |
| 4 | **생성된 `agents/`가 Claude 자동 위임에 걸림** | 본문에 반영함(`kit-brief:` 가드). `build.sh` 템플릿에 넣는다 |
| 5 | **진행 순서 모순.** 1단계 `/spec`이 vendor(grill-me)를 쓰는데 vendor는 6단계. 3단계 검사가 4단계 `crew`를 쓴다 | 순서를 아래처럼 다시 잡음 |
| 6 | **테스트 부담.** 트리거 7개 × 도구 3개 수동 | Claude만 `claude plugin eval`로 자동. Codex·AGY는 트리거마다 1회 수동, 결과를 `docs/checks.md`에 날짜와 함께 적는다 |
| 7 | **`stacks/*/SKILL.md`가 Codex·AGY에서 Skill로 안 보임** (`skills/` 밖) | 의도대로. 스택은 트리거가 경로로 읽는 재료이지 명령이 아니다. 직접 부르고 싶어지면 그때 `skills/`에 얇은 트리거를 둔다 |
| 8 | **AGENTS.md 저장소 규칙 개정 필요.** "plugins/는 Claude 전용", "skills/ frontmatter는 name·description만", "플러그인이 바뀌면 version" | 1단계 PR에서 같이 고친다: 루트 kit은 세 도구 공용, `skills/`·`stacks/`·`roles/`는 도구 전용 필드 금지(예외: `argument-hint`는 다른 도구가 무시하므로 허용), `plugins/*`만 Claude 필드 허용, vendor·rules가 바뀌어도 kit version 올림 |
| 9 | **`rules/ask.md` 예시의 2열 표.** 카드 없는 도구에서 모델이 그대로 찍으면 읽기 어렵다 | 예시를 세로 번호 목록으로 바꾼다 |
| 10 | **roles 13개 중 crew가 쓰는 건 6개** | 본문에 반영함(`roles/_archive/`) |

## 다 반영하면 이렇게 쓴다

처음 말한 불편 다섯 가지와 뒤에 물은 네 가지가 어디서 풀리는지, 실제 호출로 본다. 세 도구에서 같은 파일이 돈다(Claude `/dev`, Codex `$dev`, AGY `/dev`).

| 상황 | 호출 | 뒤에서 일어나는 일 |
|---|---|---|
| 기능 하나 구현 | `/dev 주문 취소 API 추가` | `skills/dev`가 설치된 `caveman`·`ponytail`을 읽고 따른다 → 레포 파일로 스택 판단(`pyproject.toml`→`stacks/python`) → 테스트 먼저 → 최소 변경. 커밋 메시지는 일반 문장. 다음 턴은 다시 보통 말투 |
| 요구 구체화 | `/spec 주문 취소를 만들 건데 구체화하고 싶어` | grill-me 방식으로 질문 카드(추천 첫 번째) → spec 초안 → ponytail 세 질문으로 깎기 → `spec.md`. caveman 안 켜짐 |
| 기획서·슬랙 메시지 | `/write 취소 정책 변경 공지 초안` → `/humanize` | 한국어 초안(`rules/write.md`의 번역투·피동·접속사 규칙 피함) → im-not-ai가 다듬음 |
| 프론트 리뷰 | `/check frontend:react` | `roles/reviewer.md` + `stacks/react` 규칙 + `stacks/animation`(애니메이션 코드가 있으면 `review-animations`) → 지적마다 위치·실패 상황·확신도 |
| 백엔드 직군에 스택 지정해 맡기기 | `crew build backend:java 결제 재시도 큐` | 받는 쪽에 `역할: roles/backend.md`, `스택: stacks/java/SKILL.md` 두 줄. Claude는 생성된 `agents/backend.md` 서브에이전트, Codex·AGY는 서브에이전트가 있으면 그것, 없으면 같은 세션에서 순서대로. 단계가 끝날 때마다 결과를 보여 준다 |
| 리뷰를 다른 직군에 | `crew check security` | 읽기 전용. `roles/security.md`로 지적 목록만 |
| 화면 설계 | `/design 주문 목록 화면` → `/mock 주문 카드` | 레이아웃 질문 카드 → `design-brief.md` → 시안 3개를 피커로 보고 고름 → 고른 것만 코드 |
| 유명 스킬 그대로 | `/setup` | caveman·ponytail·im-not-ai 설치 확인과 안내. 작은 텍스트 Skill은 vendor 사본으로 이미 들어 있음 |
| 팀 규칙 반영 | `stacks/react/team.md` 편집 | 상태 관리·폴더 구조·이름 짓기. `/dev`·`/check`가 같이 읽는다 |
| 현황판 | (Claude) | `mods-hud` 그대로. 서브에이전트 상태·사용량 |

없어진 것: 작업마다 Coordinator 세션·Orca·hub·승인 카드(옛 ok). 그 대신 한 세션 안에서 트리거와 `crew`로 단계마다 보면서 간다.

## 지금 구조에서 바뀌는 것

| 지금 | 바뀐 뒤 |
|---|---|
| `skills/` 비어 있음 | `dev`·`spec`·`write`·`check`·`crew`·`design`·`mock`·`setup` |
| `roles/` (옛 ok 역할, ok 문구 섞임) | ok 문구를 걷어낸 직군 원본 |
| 역할만 있고 스택 없음 | `stacks/` 추가, `crew`가 조합 |
| caveman·ponytail 항상 켜짐 | 기본 끔, `/dev` 턴에서만 |
| `mods-hud` | 그대로 (Claude 전용 mod는 계속 `plugins/`에) |
| 마켓플레이스 플러그인 1개 | 2개(`kit` 루트 추가). Codex·AGY 매니페스트 추가 |
| `AGENTS.md` "plugins/는 Claude 전용", "skills/ frontmatter는 name·description만" | 루트 플러그인은 세 도구 공용. `skills/` 규칙은 유지(도구 전용 필드 금지), `plugins/*`만 Claude 필드 허용 |

안 바뀌는 것: `mods-hud` 전부, `link.sh`.

## 진행 순서

작게 나눠 각각 따로 PR로 한다. 앞 단계가 끝나야 다음이 의미 있다.

| # | 일 | 결과 | 검사 |
|---|---|---|---|
| 0 | 후속 확인 목록 중 이름·호출 형태·caveman 끄기 | Skill 이름 확정 | 각 도구에서 `/help` |
| 1 | 세 도구 매니페스트(루트 `kit`) + `vendor/manifest.json`·`vendor.sh`(1단계 트리거가 쓰는 것만: grill-me, to-spec, karpathy, verification-before-completion, humanizer) + `build.sh`(`_vendor/` 사본)·`check.sh` + `rules/` + `skills/dev`·`spec`·`write`·`setup` + `AGENTS.md` 개정 | 세 도구에서 `/dev`·`/spec`·`/write`·`/setup` | `claude plugin validate .`, `check.sh`, Codex·AGY 설치해 네 트리거 1회씩 |
| 2 | `roles/` 정리(6개 남기고 `_archive/`), `build.sh`에 `agents/` 생성 + `kit-brief` 가드 | 직군 원본 확정 | `check.sh` 어긋남 |
| 3 | `skills/check` + `skills/crew`(vendor: code-reviewer, security-auditor, subagent-driven-development) | 리뷰와 직군 호출 | 세 도구에서 같은 diff 리뷰 |
| 4 | `stacks/react`·`animation`·`design` + `roles/frontend.md`·`designer.md` 다듬기 (vendor: Vercel, Emil) | 첫 스택 팩. 형식 확정 | `/check frontend:react`로 실제 diff |
| 5 | `skills/design`·`mock` (vendor: frontend-design, prototype, break-ui, pick-ui-library) | 화면 설계 흐름 | `/mock`으로 시안 3개 실제 생성 |
| 6 | `stacks/python`·`java`·`node` (vendor: wshobson 일부) | 4번 형식 그대로 | |
| 7 | `hooks/`(선택), `/debug` | | |

0·1번이 한 묶음이다. 3번 전에 Codex·AGY의 서브에이전트 정의 형식을 공식 문서에서 확인한다(이 세션에서는 네트워크 정책으로 못 읽었다).

## 열린 질문

- **스택 팩 `team.md`**: 팀의 React 규칙(상태 관리, 폴더 구조, 이름 짓기)과 백엔드 규칙을 사용자가 준다.
- **트리거 없이 자동 판별**: 프롬프트를 보고 개발인지 판단해 `/dev`를 자동으로 붙이는 것. 오판과 비용 때문에 뒤로 미룬다.
- **`crew`의 상한**: 한 세션 안에서 몇 개까지 맡기나. 넘으면 어떻게 할지는 써 보고 정한다.
- **Claude 설치 경로 하나로**: 검토 쟁점 1. 플러그인만으로 갈지.

## 참고한 것

- ponytail: 루트 하나로 Claude·Codex·AGY·Gemini 플러그인, Claude·Codex 공용 hooks.json, 모드 파일 + UserPromptSubmit 추적, `PONYTAIL_DEFAULT_MODE`
- caveman: `SKILL.md`에서 규칙 사본 생성 + drift 테스트, 도구별 프로필 컴파일
- superpowers `subagent-driven-development`: 작업마다 새 서브에이전트, 리뷰 두 단계, 서브에이전트 없을 때 분기
- Vercel `react-best-practices`: 규칙 하나에 파일 하나, 카테고리 접두사, `AGENTS.md` 합본
- Emil Kowalski `animate`: 애니메이션 기준(100회/일이면 없음, transform·opacity만, `ease-in` 금지, 300ms 이하, reduced-motion)
- wshobson/agents: 스택별 지식 Skill 묶음(python 16개)

# agent-kit

코딩 에이전트용 개인 키트. Claude Code, Codex, Antigravity(AGY)에서 같은 Skill을 쓴다.

- 루트가 플러그인 **kit**이다. 명령 9개(`/dev` `/spec` `/write` `/check` `crew` `/design` `/mock` `/debug` `/setup`), 직군 6개, 스택 7개. 세 도구 공용.
- `plugins/`는 Claude Code 전용 mod(`mods-hud`).
- 외부 Skill(superpowers, Vercel, Emil Kowalski, anthropics, wshobson …)은 `vendor/`에 커밋을 고정해 두고, 각 Skill이 필요한 단계에서만 읽는다.

모든 Skill은 이름으로 불러야만 돈다. 자동으로 끼어들지 않는다. 글은 한국어가 기본이다.

| 문서 | 내용 |
|---|---|
| [docs/usage.md](docs/usage.md) | 사용법: 부르는 법, 명령 9개, 흐름 예, 질문 카드, 팀 규칙 넣는 곳 |
| [docs/restructure.md](docs/restructure.md) | 구조와 설계 결정, 확인 안 된 것, 진행 기록 |
| [skills/README.md](skills/README.md) · [roles/README.md](roles/README.md) · [stacks/README.md](stacks/README.md) · [vendor/README.md](vendor/README.md) | 각 폴더의 규칙 |

## 설치

**Claude Code**

```
/plugin install kit --marketplace DoGeol/agent-kit
/plugin install mods-hud --marketplace DoGeol/agent-kit
```

마켓플레이스 추가를 물으면 `y`, 범위는 user. Skill은 `/kit:dev`처럼 부른다. 업데이트: `claude plugin update kit`.

**Codex**

```
codex plugin marketplace add DoGeol/agent-kit
codex plugin add kit@dg-agent-kit
```

Skill은 `$dev`처럼 부른다. 훅을 쓰려면 `/hooks`에서 신뢰한다. 업데이트로 훅이 바뀌면 Codex가 다시 신뢰를 묻는다. 플러그인 설치가 안 되면 아래 링크 방식.

**Antigravity**

```
agy plugin install https://github.com/DoGeol/agent-kit
```

Skill은 `/dev`처럼 부른다.

**링크로 (Codex·AGY)**

```bash
git clone https://github.com/DoGeol/agent-kit.git ~/agent-kit
~/agent-kit/scripts/build.sh && ~/agent-kit/scripts/link.sh
```

`skills/` 아래 폴더를 `~/.codex/skills`(Codex)·`~/.gemini/config/skills`(AGY)에 링크한다. AGY는 `~/.agents/skills`를 읽지 않는다. `git pull` 뒤 `build.sh`만 다시 돌리면 된다. Claude Code는 플러그인으로만 설치한다(둘 다 하면 Skill이 두 번 뜬다).

**같이 쓰면 좋은 외부 Skill** (설치는 각자): caveman·ponytail(개발 말투·최소 구현), im-not-ai(한국어 글 다듬기). `/setup`이 설치 여부와 명령을 알려 준다. 없어도 kit은 돈다. 설치했으면 자체 훅은 끄고(`PONYTAIL_DEFAULT_MODE=off`, `CAVEMAN_DEFAULT_MODE=off`. `/caveman off`는 그 세션만 끈다) `/dev`가 필요할 때만 켜게 둔다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `/dev <요청>` | 테스트 먼저, 최소 변경으로 코드를 고친다. caveman·ponytail이 있으면 같이 쓴다. 커밋 메시지·PR 본문은 일반 문장 |
| `/spec <요청>` | 질문 라운드(추천이 첫 번째인 선택지) → `docs/specs/<slug>.md` spec 한 장 → 범위 깎기 |
| `/write <요청>` | 한국어 일반 문장으로 기획서·공지·메시지·PR 본문. 번역투·이중 피동 같은 AI 티를 피한다 |
| `/check [직군[:스택]] [대상]` | 현재 diff(또는 브랜치·경로·PR)를 읽기 전용으로 리뷰. 지적마다 위치·실패 상황·고치는 법·확신도. `design`이면 브라우저에서 상태별 확인 |
| `crew build\|check\|plan <직군>[:<스택>] <요청>` | 직군에 맡긴다. 서브에이전트가 있으면 그것으로, 없으면 같은 세션에서. 직군이 둘이면 계약을 먼저 뽑고 병렬·순차를 묻는다 |
| `/design <화면>` · `/design audit` | 화면 하나를 질문으로 굳히고 구성 2~3개를 비교해 `docs/design/<slug>.md`. `audit`는 컴포넌트·토큰 점검과 원칙 초안 |
| `/mock <UI 조각>` | 서로 다른 축의 동작하는 시안 3개를 피커 뒤에 두고, 고른 것만 코드에 반영 (`x5`, `riff`, `keep`) |
| `/debug <증상>` | 이 버그에만 켜지는 신호부터 만들고 원인 조사 → 가설 하나씩 → 고침 → 회귀 테스트 |
| `/setup` | caveman·ponytail·im-not-ai 설치 확인과 설치 명령 |

직군: `frontend` `backend` `qa` `designer` `reviewer` `security`. 스택: `react` `animation` `design` `mobile` `python` `java` `node`(레포 파일로 판단, 생략 가능). 팀 규칙은 `stacks/<스택>/team.md`에 범용 기본값이 들어 있고, 팀에 맞게 바꾸면 그것이 이긴다.

서브에이전트 가드(Claude Code·AGY, 항상 켜짐): kit 직군 서브에이전트는 사용자가 그 세션에서 crew 명령을 친 뒤, 명령에 적힌 직군만, crew가 저장한 브리핑으로만 돈다. 모델이 혼자 부르면 훅이 막는다. python3가 필요하고, 없으면 kit 서브에이전트 호출은 막힌다. 자세한 내용은 [`hooks/README.md`](hooks/README.md).

선택 훅(Claude·Codex): `~/.config/agent-kit/hooks`에 `plain=on`을 적으면 `/dev`가 아닌 턴에 "일반 문장으로" 한 줄을 넣어 짧은 말투 잔류를 막는다. 기본은 꺼짐.

## 플러그인 (Claude Code 전용)

| 플러그인 | 설명 |
|---|---|
| [mods-hud](plugins/mods-hud) | 입력창 위 현황판: 세션 요약, 서브에이전트, 오케스트레이션, 브랜치, 사용량 |

## 구성

```text
agent-kit/
├─ .claude-plugin/   plugin.json (kit) · marketplace.json (kit, mods-hud)
├─ .codex-plugin/    plugin.json (kit, hooks 등록)
├─ .agents/plugins/  marketplace.json (Codex)
├─ gemini-extension.json                 (AGY)
├─ skills/<name>/    SKILL.md + _rules/ _vendor/ _roles/ _stacks/ (build.sh가 만든 사본)
├─ rules/            dev · spec · write · check · crew · design · mock · debug · ask (우리 규칙 원본)
├─ roles/            직군 원본 6개 + review-format.md + <직군>/reference.md. _archive/는 옛 것
├─ agents/           roles/에서 build.sh가 만든 AGY 서브에이전트 (AGY 도구 이름)
├─ claude-agents/    같은 역할의 Claude Code 서브에이전트 (Claude 도구 이름, 역할 모델). .claude-plugin/plugin.json이 이것만 읽는다
├─ stacks/<name>/    STACK.md + team.md + vendor/. react · animation · design(+rules/ 8개) · mobile · python · java · node
├─ vendor/           manifest.tsv + 외부 Skill 원본 9개 저장소 (커밋 고정, LICENSE 포함)
├─ hooks/            서브에이전트 가드(crew_mark.py, agent-guard.sh·.py), 선택 훅 plain.sh (기본 꺼짐)
├─ plugins/mods-hud/ Claude Code mod
├─ scripts/          build.sh · check.sh · vendor.sh · vendor-map.tsv · link.sh · dev-mode.sh · try.sh · hooks/pre-commit
└─ docs/             usage.md · restructure.md · issues/ (mods-hud)
```

흐름: `rules/`·`roles/`·`stacks/`·`vendor/`가 원본 → `scripts/vendor-map.tsv`대로 `build.sh`가 각 Skill 폴더와 `agents/`·`claude-agents/`에 사본을 만든다 → `check.sh`가 어긋남·라이선스·frontmatter·크기 예산을 검사한다. 사본은 고치지 않는다.

<details>
<summary>로컬 개발</summary>

Claude Code는 이 폴더를 marketplace로 더하면 바로 읽는다.

```bash
claude plugin marketplace add ~/agent-kit
claude plugin install kit@dg-agent-kit
```

Codex·AGY도 이 폴더를 바로 읽게 하려면:

```bash
scripts/dev-mode.sh on       # Codex: kit 플러그인을 끄고 Skill 링크 / AGY: 플러그인 폴더를 이 레포 링크로 / git pre-commit 켬
scripts/dev-mode.sh status   # 세 도구가 kit을 어디서 읽는지 (아무것도 바꾸지 않음)
scripts/dev-mode.sh off      # 링크를 지우고 GitHub main에서 다시 설치 (Codex는 훅 신뢰를 다시 물을 수 있음)
```

고친 뒤 `scripts/build.sh`를 돌리고 새 세션을 연다(Claude는 `/reload-plugins`). 커밋하면 pre-commit 훅이 `build.sh`와 `check.sh`를 돌린다. `build.sh`가 사본을 고쳤으면 커밋을 멈추니 `git add` 뒤 다시 커밋한다. `KIT_VALIDATE=1`이면 `claude plugin validate .`도 돈다. 훅만 켜려면 `git config core.hooksPath scripts/hooks`. 손으로 돌리기:

```bash
scripts/build.sh && scripts/check.sh
claude plugin validate .
claude plugin validate plugins/mods-hud && claude plugin test plugins/mods-hud   # mods-hud를 고쳤을 때
```

세 도구에서 명령 시험: `scripts/try.sh`가 프로젝트를 버려도 되는 사본으로 복사해 비대화로 돌리고, 도구 호출·마지막 답·파일이 바뀌었는지를 요약한다. 사본 안에서는 권한 확인을 건너뛴다.

```bash
export KIT_TRY_PROJECT=~/some-project              # git 레포
scripts/try.sh claude '/kit:spec 로그인 화면'       # codex는 '$spec …', agy는 '/spec …'
scripts/try.sh claude '1번으로' <session-id>         # 같은 사본에서 이어서
scripts/try.sh clean                                # 사본과 Codex 신뢰 항목 지우기
```

비대화에서는 질문 카드를 띄우지 않고 번호 목록으로 묻는다. 카드는 대화형으로 확인한다.

kit이 바뀌면 `.claude-plugin/plugin.json`·`.codex-plugin/plugin.json`·`gemini-extension.json`의 version을 같이 올린다. 외부 Skill 갱신: `scripts/vendor.sh check`로 뒤처진 것을 보고, `scripts/vendor.sh update <이름>`으로 diff를 확인한 뒤 `build.sh`, 버전 올리고 커밋. 사용자는 플러그인 업데이트로 받는다.

</details>

## 라이선스

MIT. `vendor/` 아래는 각 폴더의 LICENSE(MIT 또는 Apache-2.0). 목록은 [vendor/README.md](vendor/README.md).

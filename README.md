# agent-kit

코딩 에이전트용 개인 키트. Claude Code, Codex, Antigravity(AGY)에서 같은 Skill을 쓴다.

- 루트 = 플러그인 **kit**: 트리거 Skill `dev`·`spec`·`write`·`setup`. 세 도구 공용.
- `plugins/`: Claude Code 전용 mod (`mods-hud`).
- `rules/`·`vendor/`: Skill이 읽는 규칙과 외부 Skill 사본. `scripts/build.sh`가 각 Skill 폴더 안에 복사한다.

모든 Skill은 이름으로 불러야만 돈다. 자동으로 끼어들지 않는다. 사용법은 [docs/usage.md](docs/usage.md), 설계는 [docs/restructure.md](docs/restructure.md).

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

Skill은 `$dev`처럼 부른다. (플러그인 설치가 안 되면 아래 `link.sh`.)

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

`skills/` 아래 폴더를 `~/.codex/skills`·`~/.agents/skills`에 링크한다. `git pull` 뒤 `build.sh`만 다시 돌리면 된다. Claude Code는 플러그인으로만 설치한다(둘 다 하면 Skill이 두 번 뜬다).

**같이 쓰면 좋은 외부 Skill**: caveman·ponytail(개발), im-not-ai(한국어 글). `/setup`이 설치 여부와 명령을 알려 준다. 없어도 kit은 돈다.

## Skill

| 명령 | 하는 일 |
|---|---|
| `/dev <요청>` | 테스트 먼저, 최소 변경으로 코드를 고친다. caveman·ponytail이 있으면 같이 쓴다 |
| `/spec <요청>` | 질문 라운드(추천이 첫 번째인 선택지) → `docs/specs/<slug>.md` spec 한 장 → 범위 깎기 |
| `/write <요청>` | 한국어 일반 문장으로 기획서·공지·메시지·PR 본문. AI 티 나는 패턴을 피한다 |
| `/check [직군[:스택]] [대상]` | 현재 diff(또는 브랜치·경로·PR)를 읽기 전용으로 리뷰. 지적마다 위치·실패 상황·고치는 법·확신도 |
| `crew build\|check\|plan <직군>[:<스택>] <요청>` | 직군(frontend backend qa designer reviewer security)에 맡긴다. 서브에이전트가 있으면 그것으로, 없으면 같은 세션에서. 직군이 둘이면 계약을 먼저 뽑고 병렬·순차를 묻는다 |
| `/design <화면>` | 화면 하나를 질문(목적→독자→우선순위→제약→분위기)으로 굳히고 구성 2~3개를 비교해 `docs/design/<slug>.md` 설계 문서 |
| `/mock <UI 조각>` | 서로 다른 축의 동작하는 시안 3개를 피커 뒤에 두고, 고른 것만 코드에 반영 (`x5`, `riff`, `keep`) |
| `/debug <증상>` | 이 버그에만 켜지는 신호(실패 테스트, 요청 스크립트)부터 만들고 원인 조사 → 가설 하나씩 → 고침 → 회귀 테스트 |
| `/setup` | caveman·ponytail·im-not-ai 설치 확인과 설치 명령 |

스택 팩 `stacks/react`·`animation`·`design`·`python`·`java`·`node`는 `/dev`·`/check`·`crew`·`/debug` 등이 레포 파일로 판단해 읽는다. 팀 규칙은 `stacks/<스택>/team.md`에 적는다(지금은 틀만 있다).

선택 훅(Claude·Codex): `~/.config/agent-kit/hooks`에 `plain=on`을 적으면 `/dev`가 아닌 턴에 "일반 문장으로" 한 줄을 넣어 짧은 말투 잔류를 막는다. 기본은 꺼짐.

## 플러그인 (Claude Code 전용)

| 플러그인 | 설명 |
|---|---|
| [mods-hud](plugins/mods-hud) | 입력창 위 현황판: 세션 요약, 서브에이전트, 오케스트레이션, 브랜치, 사용량 |

## 구성

```text
agent-kit/
├─ .claude-plugin/   plugin.json (kit) · marketplace.json (kit, mods-hud)
├─ .codex-plugin/    plugin.json (kit)
├─ .agents/plugins/  marketplace.json (Codex)
├─ gemini-extension.json                 (AGY)
├─ skills/<name>/    SKILL.md + _rules/ _vendor/ _roles/ _stacks/ (build.sh가 만든 사본)
├─ rules/            dev · spec · write · check · crew · design · mock · debug · ask
├─ stacks/<name>/    STACK.md + team.md(팀 규칙) + vendor/(사본). react · animation · design · python · java · node
├─ hooks/            선택 훅 (plain.sh, 기본 꺼짐)
├─ vendor/           manifest.tsv + 외부 Skill 원본 (커밋 고정, LICENSE 포함)
├─ roles/            직군 원본 6개 (frontend backend qa designer reviewer security) + review-format.md
├─ agents/           roles/에서 build.sh가 만든 Claude 서브에이전트 (kit-brief 가드)
├─ plugins/mods-hud/
├─ scripts/          build.sh · check.sh · vendor.sh · link.sh
└─ docs/             usage.md · restructure.md · issues/
```

<details>
<summary>로컬 개발</summary>

```bash
claude plugin marketplace add ~/agent-kit
claude plugin install kit@dg-agent-kit
```

고친 뒤 `/reload-plugins`. 커밋 전:

```bash
scripts/build.sh && scripts/check.sh
claude plugin validate .
claude plugin validate plugins/mods-hud && claude plugin test plugins/mods-hud   # mods-hud를 고쳤을 때
```

외부 Skill 갱신: `scripts/vendor.sh check`로 뒤처진 것을 보고, `scripts/vendor.sh update <이름>`으로 diff를 확인한 뒤 `build.sh`, 버전 올리고 커밋.

</details>

## 라이선스

MIT. `vendor/` 아래는 각 폴더의 LICENSE.

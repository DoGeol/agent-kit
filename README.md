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
| `/setup` | caveman·ponytail·im-not-ai 설치 확인과 설치 명령 |

예정: `/check`(리뷰), `crew`(직군×스택으로 맡기기), `/design`·`/mock`(화면 설계와 시안), `stacks/`(react·design·python·java·node). 순서는 [docs/restructure.md](docs/restructure.md#진행-순서).

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
├─ skills/<name>/    SKILL.md + _rules/ + _vendor/ (build.sh가 만든 사본)
├─ rules/            dev · spec · write · ask
├─ vendor/           manifest.tsv + 외부 Skill 원본 (커밋 고정, LICENSE 포함)
├─ roles/            직군 문서 (다음 단계에서 정리)
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

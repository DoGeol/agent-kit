# agent-kit

코딩 에이전트용 개인 키트. 특정 도구에 묶이지 않는다.

- `skills/`: [Agent Skills](https://agentskills.io) 형식(`SKILL.md`) 스킬. Claude Code, Codex, Antigravity에서 쓴다.
- `plugins/`: Claude Code 전용 플러그인과 mod.

## 설치

**Claude Code 플러그인**

```
/plugin install mods-hud --marketplace DoGeol/agent-kit
```

마켓플레이스 추가를 물으면 `y`, 범위는 user를 고른다. 터미널과 데스크탑 앱의 모든 세션에 적용된다.

**스킬 (Claude Code, Codex, Antigravity)**

```bash
git clone https://github.com/DoGeol/agent-kit.git ~/agent-kit
~/agent-kit/scripts/link.sh
```

`link.sh`가 `skills/` 아래 폴더를 각 도구의 스킬 폴더에 링크한다. `git pull`만 하면 모든 도구에 바로 반영된다. 스킬 작성법은 [skills/README.md](skills/README.md).

## 플러그인

| 플러그인 | 설명 |
|---|---|
| [mods-hud](plugins/mods-hud) | 입력창 위 현황판: 세션 요약, 서브에이전트, 오케스트레이션, 브랜치, 사용량 |

업데이트: `claude plugin update mods-hud`

<details>
<summary>로컬 개발</summary>

이 폴더를 마켓플레이스로 등록하면 Claude Code가 설치 사본 대신 폴더를 직접 읽는다. 고친 뒤 `/reload-plugins`.

```bash
claude plugin marketplace add ~/agent-kit
claude plugin install mods-hud@dg-agent-kit
```

커밋 전 검사:

```bash
claude plugin validate plugins/mods-hud
claude plugin test plugins/mods-hud
```

</details>

## 라이선스

MIT

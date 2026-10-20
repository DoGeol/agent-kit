# agent-kit

코딩 에이전트용 개인 키트. 특정 도구에 묶이지 않는다.

- `skills/`: [Agent Skills](https://agentskills.io) 형식(`SKILL.md`) 스킬. Claude Code, Codex, Antigravity에서 쓴다. 아직 등록된 스킬은 없다.
- `plugins/`: Claude Code 플러그인과 mod.

Agent Skill은 `SKILL.md`(frontmatter `name`·`description` + 절차)가 든 폴더다. 에이전트는 평소 description만 보고 있다가 요청이 맞으면 본문을 읽고 따른다. 같은 파일을 여러 도구가 읽는다.

## 설치

**Claude Code 플러그인**

```
/plugin install mods-hud --marketplace DoGeol/agent-kit
/plugin install ok --marketplace DoGeol/agent-kit
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
| [ok](plugins/ok) | orchestration kit. hub의 접수 세션에서 `/ok:start`로 작업마다 Coordinator 세션을 Orca 워크트리에 열고, `/ok:plan`(요구 정리 → spec → 설계 리뷰·critic → 승인 한 번 → 기능별 Worker 구현 → 코드 리뷰·머지·PR) 또는 `/ok:quick`으로 끝낸다. 리뷰는 Claude Subagent, 구현은 Claude·Codex·AGY Worker가 기본이고 단계마다 바꿀 수 있다. 모든 Skill은 이름으로 부를 때만 돈다. orchestration-kit의 새 이름이다 ([옮기기](plugins/ok/README.md#orchestration-kit에서-옮기기)) |

설치: `/plugin install <플러그인> --marketplace DoGeol/agent-kit`. 업데이트: `claude plugin update <플러그인>`

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

claude plugin validate plugins/ok
plugins/ok/tests/run.sh          # ok에는 mod가 없어 plugin test 대상이 아니다

claude plugin validate .   # 마켓플레이스
```

</details>

## 라이선스

MIT

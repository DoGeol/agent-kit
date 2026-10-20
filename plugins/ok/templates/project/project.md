---
id: {{ID}}
test:
finish: pr
providers:
order: claude, codex, antigravity
---
# {{ID}}

<!-- 이 프로젝트를 한두 문단으로. Coordinator가 처음 작업할 때 채운다. -->

- `test`: 테스트·타입체크 명령. 비우면 Coordinator가 레포 문서(CLAUDE.md, AGENTS.md, package.json 등)에서 찾는다.
- `finish`: 작업이 끝났을 때 기본 마무리. `pr`(원격이 있으면 PR), `pr-merge`(PR 뒤 CI 통과하면 병합), `branch`(브랜치만 남김). 원격이 없으면 `branch`로 한다. 계획 트랙은 승인 카드에서 다시 고른다.
- `providers`: 단계별 Provider 덮어쓰기. 예: `review=codex, critic=cross, build=claude`. 값과 단계 이름은 ok Plugin의 `policies/routing.md`.
- `order`: Provider 후보 순서.

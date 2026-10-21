---
name: dev
description: 사용자가 "/dev <요청>"을 직접 입력했을 때만 돈다. 코드를 고치는 작업을 테스트 먼저·최소 변경으로 하고, caveman·ponytail이 설치돼 있으면 그 규칙을 같이 쓴다. 같은 작업이 이어지는 동안 유지되고 다른 주제가 오면 풀린다.
argument-hint: "<요청>   고칠 파일 경로를 적으면 더 정확"
---

# /dev

요청: 명령 뒤에 적힌 문장. 비었으면 "무엇을 고칠지 한 줄로 적어 주세요"로 멈춘다.

| 재료 | 쓰는 곳 |
|---|---|
| `_rules/dev.md` | 전체 절차 (뼈대) |
| `_vendor/karpathy-guidelines.md` | 시작 전: 1절(생각 먼저)·2절(단순하게) |
| ponytail (설치돼 있으면) | 구현: 최소 구현 규칙 |
| caveman (설치돼 있으면) | 답하는 말투 |
| `_vendor/verification-before-completion.md` | 끝: 관문 |

## 절차

1. 첫 줄에 재료를 적는다: `재료: dev.md · karpathy · ponytail(있음/없음) · caveman(있음/없음)`.
2. `_rules/dev.md`를 읽고 따른다.
3. ponytail과 caveman이 설치돼 있는지 본다: Skill 목록에 있으면 이름으로 부르고, 아니면 사용자 Skill 폴더(`~/.claude/skills`, `~/.codex/skills`, `~/.agents/skills`)와 플러그인 폴더에서 그 `SKILL.md`를 찾아 읽는다. 있으면 따른다. 없으면 `_rules/dev.md`만으로 간다. 없다고 멈추지 않는다.
4. `_vendor/karpathy-guidelines.md`의 1·2절대로 가정과 더 단순한 길을 먼저 말한다. 해석이 둘이면 `ask.md` 형식 없이 짧게 묻는다.
5. 레포 파일로 스택을 판단한다(`pyproject.toml` python, `build.gradle`·`pom.xml` java, `package.json`에 `react-native`·`expo`면 mobile, `react`면 react, 그 밖은 node). `_stacks/<스택>/STACK.md`가 있으면 읽는다(화면 코드면 `_stacks/design/STACK.md`의 걸리는 패턴 규칙도, 모션이 있으면 `_stacks/animation/STACK.md`도). 없으면 레포 규칙 문서만 따른다.
6. 테스트 먼저 → 구현 → 테스트·타입체크·lint 실행.
7. `_vendor/verification-before-completion.md`의 관문: 실제로 돌린 명령과 결과 없이는 "끝났다"고 하지 않는다.
8. 보고는 3줄: 바꾼 파일, 돌린 명령과 결과, 남은 것. 커밋 메시지·PR 본문은 일반 문장.

## 하지 않는 것

- 요청 밖 파일 수정, 의존성 추가, 리팩터링.
- 커밋·푸시(사용자가 요청했을 때만).
- `/spec`·`/write`의 일(요구 정리, 문서 작성). 그쪽이면 "`/spec`으로 하세요" 한 줄.

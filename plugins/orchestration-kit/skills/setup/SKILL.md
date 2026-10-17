---
name: setup
description: 저장소를 orchestration-kit의 Portfolio(workspace-hub) 또는 Project 역할로 초기화하고 Portfolio에 프로젝트를 연결할 때 사용한다. "오케스트레이션 초기화", "이 프로젝트 등록", "workspace-hub 만들기", "Project ID 설정", "Orca 환경 점검" 같은 요청. 기존 파일은 덮어쓰지 않는다.
---

# Setup

저장소 하나를 Portfolio 또는 Project로 초기화한다. Plugin 설치와는 별개이며, 저장소마다 한 번 실행한다. 초기화해도 Coordinator·Worker는 실행하지 않는다.

먼저 읽는다: [../../policies/README.md](../../policies/README.md) (역할, 초기화 파일), [../../policies/permissions.md](../../policies/permissions.md) (안전 규칙).

## 1. 현재 상태 확인

1. 대상 폴더(기본: 현재 작업 폴더)를 사용자와 확정한다.
2. 셸에서 확인한다:
   - `git -C <dir> status --short`, 현재 브랜치
   - `CLAUDE.md`, `AGENTS.md`, `.ai/` 존재 여부와 내용 요약
   - `.ai/ORCHESTRATION.md`가 있으면 이미 초기화된 것이다. `role`과 `projectId`를 보여주고, 빠진 파일만 채울지 묻는다.
3. 환경을 점검하고 결과를 그대로 적는다. 실패해도 초기화는 계속할 수 있다.
   - `claude --version`
   - `orca --version`, `orca status --json` (연결 거부·권한 오류는 "미검증"으로 기록. Orca를 재시작하지 않는다)
   - 선택: `codex --version`, `agy --version`
   - Codex Worker를 쓸 Project면 원본 저장소 경로를 Codex 신뢰 목록(`~/.codex/config.toml`의 `[projects."<원본 경로>"] trust_level = "trusted"`)에 등록할지 묻는다. Codex는 Worktree의 신뢰를 원본 저장소 경로로 판단하므로 한 번 등록하면 그 저장소의 새 Worktree 전체에 적용된다. 이미 같은 경로 항목이 있으면 더하지 않는다. 사용자 승인 없이 고치지 않는다.
   - 저장소에 `.agents/skills/`나 `.claude/skills/`가 있으면 Provider별로 보이는 Skill을 알려 준다. 한쪽에만 있는 Skill을 세 Provider가 같이 쓰게 하려면 `.claude/skills/<이름>` → `../../.agents/skills/<이름>` symlink를 제안하고, 승인 뒤 만든다 ([../../policies/roles.md](../../policies/roles.md#직군-지식-skill)).

## 2. 역할과 ID 확정

- 역할: `portfolio`(여러 프로젝트의 업무·우선순위 관리 저장소) 또는 `project`(코드 저장소).
- Project면 `projectId`를 사용자와 정한다. 소문자 kebab-case, 폴더명과 무관하게 바꾸지 않을 이름 ([../../policies/lifecycle.md](../../policies/lifecycle.md#업무-id)).
- `taskPrefix`(기본: `projectId` 첫 단어의 대문자)를 확인한다.

## 3. 초기화

셸에서 실행한다 (경로는 이 Skill 폴더 기준):

```sh
../../scripts/kit.sh init project <dir> <projectId> [taskPrefix]
../../scripts/kit.sh init portfolio <dir>
```

- 없는 파일만 만든다. 있는 파일은 `skip`으로 표시하고 건드리지 않는다.
- 이미 다른 `role`·`projectId`로 초기화된 저장소는 거부한다. 이때 바꾸지 말고 사용자에게 알린다.
- 출력의 `reportsRef`(정식 보고서를 올릴 기준 브랜치)를 사용자에게 확인한다. 다르면 `.ai/ORCHESTRATION.md`만 고친다.

## 4. CLAUDE.md / AGENTS.md 진입점

1. 출력의 진입점 문구(`---8<---` 사이)를 사용자에게 보여준다.
2. 승인받은 파일에만 **끝에 덧붙인다**. 기존 내용을 고치거나 지우지 않는다. 같은 `## Orchestration` 절이 이미 있으면 덧붙이지 않는다.
3. 파일이 없으면 만들지 묻는다. 정책 본문은 복제하지 않는다.

## 5. Portfolio 연결 (Project만, 사용자 확인 후)

Portfolio 저장소 경로를 묻고, 사용자가 확인하면:

```sh
../../scripts/kit.sh register <hubDir> <projectDir>
```

- 같은 `projectId`·경로면 "이미 등록됨"으로 끝난다.
- `projectId`가 다른 경로로 등록돼 있거나 경로가 다른 ID로 등록돼 있으면 거부한다. 사용자에게 알린다.

## 6. 마무리

다음을 보고한다:

- 만든 파일, 건너뛴 파일
- 환경 점검 결과 (성공·실패·미검증)
- 사용자가 할 일: `.ai/PROJECT.md`·`ARCHITECTURE.md` 채우기, 새 파일 커밋, Coordinator 세션 시작 (project 또는 portfolio Skill)

새 파일을 커밋할지는 사용자에게 묻는다. 직접 Push하지 않는다.

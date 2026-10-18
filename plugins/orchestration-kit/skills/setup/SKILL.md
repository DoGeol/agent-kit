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
   - `../../scripts/kit.sh where <dir>`로 이미 초기화됐는지와 모드를 확인한다 (Portfolio 저장소는 `.ai/ORCHESTRATION.md`의 `role`). 초기화돼 있으면 모드·`role`·`projectId`를 보여주고, 같은 모드로 빠진 파일만 채울지 묻는다. 다른 모드로 다시 초기화하지 않는다.
3. 환경을 점검하고 결과를 그대로 적는다. 실패해도 초기화는 계속할 수 있다.
   - `claude --version`
   - `orca --version`, `orca status --json` (연결 거부·권한 오류는 "미검증"으로 기록. Orca를 재시작하지 않는다)
   - 선택: `codex --version`, `agy --version`
   - 선택: `../../scripts/kit.sh usage` (Provider별로 사용량을 읽을 수 있는지. `unknown`이면 마지막 칸의 이유를 기록한다)
   - Codex Worker를 쓸 Project면 원본 저장소 경로를 Codex 신뢰 목록(`~/.codex/config.toml`의 `[projects."<원본 경로>"] trust_level = "trusted"`)에 등록할지 묻는다. Codex는 Worktree의 신뢰를 원본 저장소 경로로 판단하므로 한 번 등록하면 그 저장소의 새 Worktree 전체에 적용된다. 신뢰하면 그 저장소와 모든 Worktree에서 Codex가 저장소의 `.codex/` 설정·hooks·규칙을 불러온다. 이 점을 사용자에게 말한다. 이미 같은 경로 항목이 있으면 더하지 않는다. 사용자 승인 없이 고치지 않는다.

## 2. 역할과 ID 확정

- 역할: `portfolio`(여러 프로젝트의 업무·우선순위 관리 저장소) 또는 `project`(코드 저장소).
- Project면 `projectId`를 사용자와 정한다. 소문자 kebab-case, 폴더명과 무관하게 바꾸지 않을 이름 ([../../policies/lifecycle.md](../../policies/lifecycle.md#업무-id)).
- `taskPrefix`(기본: `projectId` 첫 단어의 대문자)를 확인한다.
- Project면 모드를 정한다 ([../../policies/README.md](../../policies/README.md#공유-모드와-개인-모드)). 사용자가 말했으면 따른다. 아니면 원격 주소의 소유자와 저장소 규칙 문서를 보고 추천한 뒤 확인받는다: 다른 사람과 같이 쓰는 저장소(원격 소유자가 본인이 아님, 조직·팀 저장소)는 개인 모드, 개인 저장소나 팀 전체가 Kit을 쓰는 저장소는 공유 모드. 모르면 개인 모드를 추천한다 (흔적이 남지 않는다).
- 개인 모드면 hub가 사용자 개인의 비공개 저장소인지 확인한다. 팀이 같이 쓰는 hub면 개인 모드를 쓰지 않는다.

## 3. 초기화

셸에서 실행한다 (경로는 이 Skill 폴더 기준):

```sh
../../scripts/kit.sh init project <dir> <projectId> [taskPrefix]                     # 공유 모드
../../scripts/kit.sh init project --personal <hubDir> <dir> <projectId> [taskPrefix]  # 개인 모드
../../scripts/kit.sh init portfolio <dir>
```

- 개인 모드는 상태 폴더를 hub의 `projects/<projectId>/`에 만든다. 프로젝트 저장소의 추적 파일은 바꾸지 않고, Git 공통 폴더에 상태 경로 파일과 로컬 무시 목록 한 줄만 더한다. 사용자 작업이 진행 중인 checkout에서 실행해도 된다. 4단계 진입점 문구와 아래 `reportsRef`·PR 반영은 건너뛴다. hub에 생긴 파일은 사용자 확인 뒤 hub에 커밋한다.

- 없는 파일만 만든다. 있는 파일은 `skip`으로 표시하고 건드리지 않는다.
- 이미 다른 `role`·`projectId`로 초기화된 저장소는 거부한다. 이때 바꾸지 말고 사용자에게 알린다.
- 공유 모드: 출력의 `reportsRef`(정식 보고서를 올릴 기준 브랜치)를 사용자에게 확인한다. 다르면 `.ai/ORCHESTRATION.md`만 고친다.
- [반영 방식](../../policies/routing.md#반영-방식)(`integration`)을 정한다. 저장소 규칙과 병합 기록이 분명하면 값과 근거를 적고, 아니면 `unset`으로 두고 사용자에게 알린다. `pull-request`면 `reportsRef`를 원격 추적 브랜치(예: `origin/main`)로 바꾼다.
- 공유 모드에서 저장소가 기준 브랜치 직접 커밋을 막으면(`pull-request`) 초기화 파일도 PR로 반영한다. 사용자 작업이 진행 중인 checkout이면 원격 기준 브랜치에서 새 Worktree를 만들어 거기서 초기화한다 ([permissions.md](../../policies/permissions.md#안전-규칙)).

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
- 공유 모드 Git 저장소는 Git 공통 폴더에 hub 포인터(`orchestration-kit-hub`)를 남긴다. 이미 등록된 프로젝트도 다시 실행하면 남는다.
- `projectId`가 다른 경로로 등록돼 있거나 경로가 다른 ID로 등록돼 있으면 거부한다. 사용자에게 알린다.

## 6. 마무리

다음을 보고한다:

- 만든 파일, 건너뛴 파일
- 환경 점검 결과 (성공·실패·미검증)
- 사용자가 할 일: `.ai/PROJECT.md`·`ARCHITECTURE.md` 채우기, 새 파일 커밋, Coordinator 세션 시작 (project 또는 portfolio Skill)

새 파일을 커밋할지는 사용자에게 묻는다. 직접 Push하지 않는다.

저장소에 규칙 문서(`AGENTS.md`, 디자인 정책 문서, lint·검사 스크립트)나 Skill이 있으면, 이어서 [adopt Skill](../adopt/SKILL.md)로 역할 보강을 만들지 묻는다. Skill 위치 정리(symlink)도 adopt가 한다.

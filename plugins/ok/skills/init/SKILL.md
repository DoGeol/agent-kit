---
name: init
description: 사용자가 "/ok:init"을 직접 입력했을 때만 돈다. 빈 폴더를 ok hub로 만들거나(hub), 레포를 hub 프로젝트로 등록한다(project). 옛 orchestration-kit hub를 옮기는 미리보기·적용(migrate)도 한다. 없는 파일만 만들고 덮어쓰지 않는다.
argument-hint: "[hub [DIR] | project <레포 경로> <id> [--base <브랜치>] | migrate [--apply] | status]"
disable-model-invocation: true
---

# /ok:init — hub 만들기와 레포 등록

인자: $ARGUMENTS

`<KIT>`는 `${CLAUDE_PLUGIN_ROOT}`다. 스크립트는 셸에서 `<KIT>/scripts/ok.sh`로 실행한다. 답은 한국어. 코드·Coordinator·Worker는 실행하지 않는다.

## 모드 고르기

인자가 없으면 현재 폴더로 정한다: `hub.json`이 있으면 `status`, `portfolio/PROJECTS.md`가 있으면(옛 Kit hub) `migrate`, git 레포면 `project`, 빈 폴더면 `hub`. 애매하면 `AskUserQuestion`으로 묻는다.

## hub

1. 대상: 인자의 DIR, 없으면 현재 폴더. git 레포의 작업 트리 안이면 "hub는 레포 밖 폴더에 둡니다" 한 줄과 함께 다른 폴더를 묻는다.
2. `ok.sh init <DIR>` 출력의 create·skip 줄을 그대로 보인다.
3. hub를 git 저장소로 둘지 묻는다(추천: 예, 기록이 남는다). 예면 `git -C <DIR> init`, 첫 커밋은 사용자가 하겠다고 하면 한다.
4. 다음: "레포 등록은 이 hub 세션에서 `/ok:init project <레포 경로> <id>`".

## project

1. 인자: 레포 경로와 id. 이 세션이 레포 안에서 열렸으면 레포는 현재 레포이고 hub 경로를 묻는다(`OK_HUB`가 있으면 그것). id가 없으면 레포 폴더 이름을 소문자 kebab-case로 바꾼 것을 추천으로 묻는다.
2. 등록 전에 보여 준다: hub, 레포(본 체크아웃), id, 기준 브랜치(`--base`, 없으면 원격 기본 브랜치), 바뀌는 것(hub `hub.json` 한 항목, `projects/<id>/` 파일 3개, 레포 git 공통 폴더의 `ok-hub` 포인터, `info/exclude`에 `.ok/` 한 줄). 레포의 추적 파일은 바꾸지 않는다고 적는다. `AskUserQuestion`으로 "등록할까요?" — "등록 (추천)", "취소".
3. `ok.sh add <HUB> <레포> <id> [--base <브랜치>] [--title <제목>]`. 출력을 그대로 보인다.
4. `projects/<id>/project.md`의 `test`를 레포 문서(CLAUDE.md, AGENTS.md, package.json scripts 등)에서 찾아 제안하고, 승인하면 채운다.
5. 레포에 규칙 문서나 Skill(`.agents/skills`, `.claude/skills`)이 있으면 "`/ok:adopt`로 역할 보강을 만들 수 있습니다" 한 줄.
6. Codex Worker를 쓸 생각이면: Codex는 원본 레포 경로가 신뢰 목록에 있어야 Orca 워크트리에서 돈다. 셸에서 `codex` 설정을 보고 없으면 한 줄로 알린다(설정은 사용자가 한다).

## migrate (옛 orchestration-kit hub)

1. `ok.sh migrate <HUB>`(미리보기)의 출력을 보인다. 옛 파일은 지우지 않고 hub 안 `archive/`로 옮긴다는 것, 열린 업무가 `tasks/*.md`로 옮겨진다는 것, 레포에는 포인터와 exclude 줄만 더해진다는 것을 한 줄씩 덧붙인다.
2. hub가 git 저장소면 `git -C <HUB> status --porcelain`이 비었는지 본다. 커밋 안 한 변경이 있으면 먼저 커밋할지 묻는다.
3. `AskUserQuestion`: "이대로 옮길까요?" — "옮기기 (추천)", "취소".
4. `ok.sh migrate <HUB> --apply`. 출력의 `주의:` 줄(옛 진입점 문구 등)을 따로 모아 보인다. hub의 `AGENTS.md`·`CLAUDE.md`를 `<KIT>/templates/hub/`의 문구로 바꿀지 diff를 보여 주고 묻는다.
5. 옛 공유 모드 프로젝트 레포의 `.ai/`는 그대로 남는다. 지울지는 사용자가 정한다(팀 저장소 파일).
6. hub가 git이면 커밋할지 묻는다.

## status

`ok.sh status <HUB>` 요약과 `hub.json`의 프로젝트 목록을 보인다. 등록할 레포가 있으면 `project` 모드 안내.

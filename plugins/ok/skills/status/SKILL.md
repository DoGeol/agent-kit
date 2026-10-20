---
name: status
description: 사용자가 "/ok:status [프로젝트 id]"를 직접 입력했을 때만 돈다. hub의 프로젝트별 진행 중 작업, 열린 결정, 반영 안 된 보고, 살아 있는 Orca Worker를 읽어서 요약한다. 아무것도 바꾸지 않는다.
argument-hint: "[프로젝트 id]"
disable-model-invocation: true
---

# /ok:status — 현황

인자: $ARGUMENTS

`<KIT>`는 `${CLAUDE_PLUGIN_ROOT}`다. 읽기만 한다. 답은 한국어.

1. hub: 셸에서 `<KIT>/scripts/ok.sh where <현재 폴더>`의 첫 칸. 레포 세션이면 그 프로젝트만 본다(인자가 없을 때).
2. `<KIT>/scripts/ok.sh status <HUB> [id]`. 줄 종류: `project`, `task`(완료·취소 아님), `decision`(열림), `report`(`applied: false`).
3. 진행 중 작업마다 작업 파일 `## Orca`에 run이 있으면 `orca orchestration worker-list --run <runId> --json`으로 살아 있는 Worker 수와 상태를 본다. Orca를 읽지 못하면 "Orca 확인 못 함"으로 적고 0으로 쓰지 않는다.
4. 보여 준다 (프로젝트마다 한 덩어리, 할 일이 있는 프로젝트 먼저):
   - 사람이 할 것: 열린 결정(파일 · 제목), `blocked` 작업
   - 진행 중: 작업 · 트랙·등급 · 상태 · Worker n (Provider)
   - 미반영 보고: 파일 · outcome
   - 마지막 갱신: status.md `updated`
5. 끝에 할 일이 있으면 한 줄: 결정은 그 작업의 Coordinator 세션에서 답한다(또는 결정 파일 `answer:`).

하지 않는 것: 작업을 시작하거나 결정에 대신 답하기(대리 답변은 사용자가 위임했을 때만, permissions.md).

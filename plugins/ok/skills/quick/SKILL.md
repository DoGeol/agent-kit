---
name: quick
description: 간단 트랙. 사용자가 "/ok:quick <요청>"을 직접 입력했을 때만(또는 /ok:start가 연 Coordinator 세션의 첫 지시로) 돈다. Coordinator가 Subagent·Worker 없이 직접 고친다. 파일 3개·반나절을 넘을 것 같으면 한 줄 알리고 멈춘다.
argument-hint: "<요청>   파일 3개·반나절 이내"
disable-model-invocation: true
---

# /ok:quick — 간단 트랙

요청: $ARGUMENTS

`<KIT>`는 `${CLAUDE_PLUGIN_ROOT}`다. 시작 전에 `<KIT>/policies/coordinator.md`를 읽는다. hub·프로젝트는 그 0절대로 찾는다. `<P>`는 `<HUB>/projects/<id>`다. 요청이 비었으면 한 줄 묻고 멈춘다. 답은 한국어.

## 절차

1. **크기 판단을 먼저 한다.** 고치기 전에 관련 파일을 찾아 본다. 파일 3개 초과, 반나절 초과, 또는 계약·저장 데이터 변경이 예상되면 아무것도 고치지 않고 `계획 트랙으로 가겠습니다: /ok:plan <요청>` 한 줄만 말하고 멈춘다.
2. `<P>/tasks/<slug>.md`를 만든다(slug는 첫 지시의 `slug:`, 없으면 영문 소문자 2~4단어). `track: quick`, `status: in-progress`, `size: small`, `finish:`는 `project.md`의 `finish`(없으면 원격이 있을 때 `pr`, 없을 때 `branch`), `branch`·`worktree`는 이 폴더 값.
3. **테스트 먼저**(레포에 테스트 환경이 있을 때): 핵심 경우만 1~3개(정상 1, 실제로 일어날 경계·오류 1~2). 층 고르기는 `<KIT>/skills/plan/testing.md` 1절. 새 워크트리면 테스트를 먼저 커밋한다(`test: …`, 레포 커밋 규칙이 있으면 그것). 테스트 환경이 없으면 새 프레임워크를 들이지 않고 보고에 수동 확인 절차를 적는다. 테스트 파일은 3개에 세지 않는다.
4. Coordinator가 **직접** 고친다. Subagent·Worker를 부르지 않는다. 테스트를 통과시키려고 맞추지 않는다(입력 하드코딩·테스트 전용 분기 금지). 테스트가 틀렸으면 고치되 보고에 "바꾼 테스트와 이유"를 적고 기대값을 약하게 바꾸지 않는다.
5. 테스트를 돌린다. 커밋은 작업 공간에 따라 다르다(첫 지시의 `작업 공간:`).
   - 새 워크트리: 이 워크트리 브랜치에 커밋한다. 커밋하지 않으면 워크트리를 지울 때 변경이 사라진다.
   - 현재 폴더(`--here`, 또는 사용자가 레포 세션에서 직접 부름): 커밋은 사용자가 요청했을 때만.
6. 보고 `<P>/reports/<slug>-coordinator.md`(형식은 `<KIT>/policies/README.md`, `role: coordinator`, `provider: claude`, `applied: true`). 본문 첫 줄 `OUTCOME: <outcome>`, 3줄 요약.
7. 작업 파일 `status: completed`(실패면 `blocked`), `status.md` 체크포인트와 최근 변경, 배운 것이 있으면 `learnings.md` 한 줄. hub가 git이면 자기 경로 커밋.
8. 새 워크트리면 coordinator.md 11절 마무리(작업 파일 `finish`대로, 묻지 않는다)와 보고 한 줄. 현재 폴더면 마무리 없이 보고 한 줄만 이 세션에 쓴다(접수 세션 카드 메모는 `/ok:start`로 열린 세션일 때만).

## 하지 않는 것

- Subagent·Worker 호출.
- 3개 넘는 파일 수정. 중간에 넘게 되면 거기서 멈추고 1번 문구를 말한다.
- hub 파일을 레포에 커밋.

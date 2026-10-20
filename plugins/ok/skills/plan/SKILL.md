---
name: plan
description: 계획 트랙. 사용자가 "/ok:plan <요청>"을 직접 입력했을 때만(또는 /ok:start가 연 Coordinator 세션의 첫 지시로) 돈다. 작업 파일과 등급(S/M/L) → 요구 정리 → spec → 설계 리뷰·critic 토론 → 승인 카드 한 번 → 기능마다 Orca Worker(Claude·Codex·AGY)로 테스트 먼저 구현 → 기능별 코드 리뷰·머지 → 마무리 다듬기·qa-run·정리·PR.
argument-hint: "[--with 단계=provider,...] <요청>   보통 /ok:start 가 넣어 줌"
disable-model-invocation: true
---

# /ok:plan — 계획 트랙

요청: $ARGUMENTS

`<KIT>`는 `${CLAUDE_PLUGIN_ROOT}`다. 시작 전에 `<KIT>/policies/coordinator.md`를 읽는다(매 턴 지키는 규칙). 단계별 실행 주체·모델은 `<KIT>/policies/routing.md`, 관문과 권한은 `<KIT>/policies/permissions.md`, 파일 형식은 `<KIT>/policies/README.md`. 아래 `<P>`는 `<HUB>/projects/<id>`다. 답은 한국어.

- 요청이 비었으면 "요청을 한 줄로 적어 주세요" 한 줄로 멈춘다.
- `--with 단계=값,...`이 있으면 떼어 작업 파일 `providers:`에 적는다([덮어쓰기](../../policies/routing.md#덮어쓰기)). 요청 문장 안의 "리뷰는 codex로" 같은 말도 같다.
- hub·프로젝트는 coordinator.md 0절대로 찾는다. 못 찾으면 한 줄 알리고 멈춘다.
- 첫 지시에 `작업 공간:`이 없고 이 폴더가 레포 본 폴더(`git worktree list` 첫 줄)면 아무것도 만들지 않고 멈춘다: "새 워크트리에서 다시 시작해 주세요: 접수 세션에서 `/ok:start <id> plan <요청>`".
- 이 Skill의 모든 Subagent 브리핑과 Worker 명세는 첫 줄 `ok-brief: <id>/<slug>`, `읽을 것: <P>/tasks/<slug>.md`, 다음 `읽을 것:`에 `<P>/tasks/<slug>.md`를 넣는다(coordinator.md 1절). 아래에 "같은 브리핑"·"리뷰 파일"처럼 줄여 쓴 곳도 같다. 빠지면 ok Subagent가 일하지 않는다.

## 1단계 — 작업 파일

1. `<P>/status.md`를 읽어 진행 중 작업과 열린 결정을 본다. 같은 레포 진행 중 작업이 있으면 제목을 한 줄로 알린다(막지 않는다).
2. slug: 첫 지시의 `slug:`, 없으면 요청에서 영문 소문자 2~4단어. 이미 있으면 `-2`.
3. `<P>/tasks/<slug>.md`를 만든다(형식은 README.md). `status: planned`, `track: plan`, `risk`, `size`, `tier`, `branch`, `worktree`, 본문에 요청 원문·`## 시작`·`## 완료 조건` 초안.
4. **등급**: routing.md [트랙과 등급](../../policies/routing.md#트랙과-등급) 표로 S/M/L. 애매하면 한 단계 위.
5. 요청이 간단 트랙 크기(파일 3개 이하, 반나절, 계약·저장 데이터 변경 없음)로 보이면 "간단 트랙이 맞아 보입니다: `/ok:quick <요청>`" 한 줄을 덧붙이고 계속한다(사용자가 바꾸면 그때 멈춘다).
6. `status.md` 체크포인트 `진행 중`에 `<slug> (요구 정리)`.

## 1.5단계 — 요구 정리

`<KIT>/skills/plan/clarify.md`를 읽고 그대로 한다. 결과는 `<P>/tasks/<slug>/brief.md`. 사용자가 답하지 않으면 기다린다.

## 2단계 — spec

- **S**: Coordinator가 직접 `<P>/tasks/<slug>/spec.md`를 쓴다. 형식은 `<KIT>/roles/planner/reference.md`, 약 50줄. 검사 목록은 `<KIT>/skills/plan/testing.md` 3절 형식. `reviewers`는 1명(바뀌는 곳에 맞춰 architect·frontend·backend·infra 중, `security: true`면 security).
- **M·L**: `spec` 단계 실행 주체(기본 Subagent `ok:planner`, 포그라운드). 브리핑(절대 경로만):
  ```
  ok-brief: <id>/<slug>
  역할: <KIT>/roles/planner.md
  참고: <KIT>/roles/planner/reference.md
  보강: <P>/roles/planner.md   ← 있으면
  읽을 것: <P>/tasks/<slug>.md, <P>/tasks/<slug>/brief.md, <P>/status.md, <P>/project.md
  테스트 기준: <KIT>/skills/plan/testing.md
  산출: <P>/tasks/<slug>/spec.md
  등급: M (약 150줄, reviewers 최대 3명 qa 포함) | L (분량 제한 없음, 필요한 리뷰어만)
  ```
  구조를 새로 정해야 하면(새 저장 데이터, 프로젝트 간 계약) architect에게 설계 문서(`<P>/tasks/<slug>/design.md`)를 먼저 받고 planner 브리핑에 넣는다.
- 작업 파일 `agents`에 id, 체크포인트 갱신(`status`는 `planned` 그대로).

## 3단계 — 설계 리뷰와 토론

### 3.1 리뷰어

spec frontmatter `reviewers`를 따른다. S 1명(+ security), M 최대 3명(qa 포함), L 적힌 역할만. `security: true`면 security는 상한과 상관없이 넣는다. `reviewers`가 비었으면 planner에게 다시 고르게 한다.

`review` 단계 실행 주체가 Subagent면 **한 메시지에서 리뷰어 수만큼 `Agent`를 동시에** 보낸다(`run_in_background: true`, `subagent_type: "ok:<역할>"`, 모델·effort는 routing.md 등급 표). 브리핑:

```
ok-brief: <id>/<slug>
역할: <KIT>/roles/<역할>.md
형식: <KIT>/roles/review-format.md
보강: <P>/roles/<역할>.md   ← 있으면
읽을 것: <P>/tasks/<slug>.md, <P>/status.md, <P>/tasks/<slug>/brief.md, <P>/tasks/<slug>/spec.md, 레포 <Coordinator 워크트리>
산출: <P>/tasks/<slug>/review-<역할>.md   (qa는 qa-sheet.md도, 테스트 기준 <KIT>/skills/plan/testing.md)
등급: <S|M|L>
```

덮어쓰기로 Worker(`codex`·`antigravity`·`claude-worker`·`cross`)가 된 리뷰어는 Coordinator 워크트리의 읽기 전용 Worker로 띄운다(coordinator.md 6·7절). 명세 `## 작업`에 위 브리핑을 넣고, 결과 파일 이름은 `.ok/review-<역할>.md`. `worker_done`이 오면 그 파일을 `<P>/tasks/<slug>/review-<역할>.md`로 옮긴다. Subagent와 Worker를 섞어도 된다.

리뷰어를 **모두** 받은 뒤에만 3.2로 간다. 하나가 실패하면 그것만 다시 부른다. 같은 리뷰어가 2회 실패하면 상향 사다리.

### 3.2 critic 토론

부르는 조건(하나라도): 리뷰어가 2명 이상(qa 포함), 또는 high 지적이 하나라도 있음. 둘 다 아니면 4단계로 간다. 라운드 상한 S 1회, M·L 2회.

1. **1차**: `critic` 단계 실행 주체(기본 `ok:critic` 포그라운드). 브리핑: 첫 줄 `ok-brief: <id>/<slug>`, `읽을 것: <P>/tasks/<slug>.md`, `역할: <KIT>/roles/critic.md`, `단계: 1차, 설계 리뷰`, 작업·brief·spec·`review-*.md` 경로, 산출 `<P>/tasks/<slug>/debate.md`. `critic=cross`면 spec을 쓴 Provider가 아닌 Provider의 읽기 전용 Worker로.
2. 반박·보완·새 지적(C…)이 있으면 **그 지적을 낸 리뷰어만** 다시 부른다(Subagent면 같은 에이전트에 `SendMessage`로 이어서, 못 이으면 새로). 브리핑 `토론 답`, debate 경로, 답 파일 `<P>/tasks/<slug>/debate-reply-<역할>.md`. 동시에 보낸다.
3. **마무리**: critic에 `단계: 마무리`, debate·답 파일 경로. 첫 줄 `CONSENSUS: done|disputed`.
4. `disputed`이고 라운드가 남았으면 이견 줄만 2~3을 한 번 더.
5. 남은 이견: S·M은 Coordinator가 근거를 보고 정해 debate에 `Coordinator 결정: …`. L이거나 범위·사용자 의도가 걸리면 5단계 선택지로.

## 4단계 — 통합

Coordinator가 직접 `<P>/tasks/<slug>/review-summary.md`를 쓴다: 첫 줄 `VERDICT: pass|issues`, `## 반영안`(합의-반영, critic이 없었으면 리뷰 지적 중 고칠 것), `## 사용자 선택지`(`A: … / B: …`), `## 기각`(이유 한 줄). 반영안은 spec(과 qa-sheet)에 바로 고친다. 반영안이 spec 구조를 크게 바꾸면 L은 planner를 한 번 불러 그 절만 고치게 한다.

## 5단계 — 승인 카드 (관문 하나)

1. `<P>/decisions/<slug>-d01.md`를 먼저 쓴다. 본문 첫 줄 `# <slug> 개발 시작 승인`.
2. **실행 계획 한 줄**을 만든다: 기능 수, 단계별 실행 주체(`review=claude×3, critic=claude, build=claude×2 sonnet, code-review=claude, qa-run=haiku` 식), Provider 후보 순서, `strong`을 쓰는 단계, 상향 상한(기본 "`default`까지 자동, `strong`·후보 밖은 그때 묻기"). 셸에서 `<KIT>/scripts/ok.sh usage`로 쓸 Provider의 사용량을 읽어 주의 이상이면 줄에 적고 대안을 넣는다.
3. `AskUserQuestion` 한 번(질문 4개까지):
   - 사용자 선택지마다 질문 하나(추천안 첫 번째, 라벨 끝 "(추천)"). 넘치면 "나머지는 모두 추천안으로" 질문 하나로 묶는다.
   - "작업이 끝나면 작업 브랜치 `<작업 브랜치>`를 어떻게 할까요?"(헤더 `마무리`): 원격이 있으면 "PR 만들기 (추천)" / "브랜치만 남기기" / "PR 만들고 CI 통과 뒤 병합". 원격이 없으면 "브랜치만 남기기"만 두고 본문에 "원격이 없어 PR은 만들 수 없습니다". `project.md`의 `finish`가 있으면 그것을 추천으로.
   - 마지막: "이대로 개발을 시작할까요?"(헤더 `시작`). 질문 본문에 실행 계획 한 줄과 미정 개수. 선택지 "시작 (추천)", "실행 주체 바꾸기"(설명: 다음 메시지로 `review=codex`처럼 적어 주세요), "멈춤".
4. 답을 결정 파일 `answer:`에 적고 `status: answered`. 작업 파일 `finish`, `providers`를 채우고 spec에 반영 사항을 적는다.
   - "시작": 작업 파일 `status: assigned` → 6단계.
   - "실행 주체 바꾸기": 다음 메시지를 덮어쓰기로 받아 실행 계획 줄을 다시 보이고 같은 카드의 마지막 질문만 다시 묻는다.
   - "멈춤": `status: blocked`로 두고 끝낸다.

카드 답이 오기 전까지 작업 파일은 `blocked`, 체크포인트 `열린 결정`에 파일명. 이 카드 뒤로는 permissions.md의 "매번 묻는 것" 말고는 묻지 않는다.

## 6단계 — 기능 세션 열기

1. 작업 브랜치 확인(coordinator.md 0절). Coordinator 워크트리가 레포 본 폴더(`git worktree list` 첫 줄)면 사용자 체크아웃을 건드리지 않도록 멈추고 "새 워크트리에서 다시 시작해 주세요: 접수 세션에서 `/ok:start <id> plan <요청>`" 한 줄. 기준 브랜치가 다른 진행 중 작업의 작업 브랜치면 `depends`에 그 slug.
2. 기능은 서로 기대지 않으므로 **모두 동시에** 연다. 기대는 기능이 남아 있으면 열기 전에 한 기능으로 합쳐 spec을 고친다.
3. coordinator.md 0절 4번(Orca 세션 확인) → 이 작업의 Run이 없으면 `run-create`(작업당 하나, 3.1에서 Worker로 만든 Run이 있으면 그것). 기능마다 `<P>/tasks/<slug>/worker-<fid>.md`를 coordinator.md 7절 형식으로 쓴다(`<fid>`는 spec의 기능 id `F1`). 역할은 기능의 주 역할([roles.md 고르기](../../policies/roles.md#고르기)). `## 작업` 본문:

   ```
   작업 <slug>의 기능 <fid> <기능 이름> 구현. 대상: <레포>. 이 기능의 서브태스크(spec `## 기능`의 <fid>-1, <fid>-2 …)만 한다. 다른 기능은 고치지 않는다. 층(화면·API·저장·설정)은 가리지 않는다.
   먼저 읽을 것(절대 경로):
   - 작업 <P>/tasks/<slug>.md, 요구 정리 <P>/tasks/<slug>/brief.md, spec <P>/tasks/<slug>/spec.md
   - QA 시트 <P>/tasks/<slug>/qa-sheet.md (S는 spec의 검사 목록), 리뷰 통합 <P>/tasks/<slug>/review-summary.md, 결정 <P>/decisions/<slug>-d01.md
   - 테스트 기준 <KIT>/skills/plan/testing.md
   진행:
   1. 서브태스크를 순서대로. 서브태스크마다 QA 시트의 그 ID 줄로 테스트를 먼저 쓰고 커밋(test: <fid>-n …) → 구현하고 커밋(feat: <fid>-n …) → 레포 테스트 명령 전체 통과. 커밋 메시지 형식은 레포 규칙이 있으면 그것.
   2. 서브태스크를 시작하기 전, 테스트를 돌린 뒤, worker_done 직전에 check로 Coordinator 지시를 읽는다.
   테스트 규칙: 시트의 핵심 경우만, 이름에 시트 ID. 동작(입력 → 결과)을 검증하고 구현 세부에 묶지 않는다. 구현을 테스트에 맞추지 않는다(입력 하드코딩·테스트 전용 분기 금지). 테스트가 틀렸으면 고치되 보고에 "바꾼 테스트와 이유". 기대값을 약하게 바꾸지 않는다. 테스트 환경이 없으면 새 프레임워크를 들이지 않고 수동 확인 절차를 적는다.
   레포 규칙(이번 일에 걸리는 것): <레포 AGENTS.md·CLAUDE.md에서 옮긴 줄>
   완료 기준: 레포 테스트·타입체크 명령(<명령>) 통과. 결과 파일 .ok/report-<fid>.md: 보고 frontmatter(task, role: <fid>, provider, outcome, files, next, finished_at, applied: false), 첫 줄 OUTCOME, 3줄 요약, 서브태스크별 커밋(test·feat), 시트 ID ↔ 테스트 이름, 역할 수용 기준 항목별 결과, 브랜치명·마지막 커밋.
   ```

4. `build` 실행 주체(기본 `claude`, 덮어쓰기면 그 Provider)로 `worker-start --worktree new-child --name <slug>-<fid> --base-branch <작업 브랜치> --agent <provider>`. 모델·effort는 routing.md 등급 표. 응답의 `launch.effective`를 `## 실행`에 적는다.
5. 작업 파일 `status: in-progress`, `sessions`, `## Orca`(run, 기능별 dispatch·handle), 체크포인트. 턴을 끝내지 않고 7단계로.

## 7단계 — 기다리기

턴 안에서 `check --wait`를 되풀이한다(coordinator.md 6절). 받은 묶음을 모두 처리한 뒤 다음 대기에 `--ack`.

- `question`: 직접 답하거나, 사용자 결정이면 결정 파일 + 질문 카드 → `reply`.
- `escalation`: status.md 블로커에 적고 판단한다. 못 정하면 결정 파일.
- `worker_done`: coordinator.md 8절(결과 받기) → `worker-retain` → 그 기능의 8단계를 바로 시작한다(다른 기능 세션은 계속 돈다).
- 빈 대기 3번이면 `worker-list --run`. 확실한 종료 증거 없이 다시 띄우지 않는다.

## 8단계 — 기능별 코드 리뷰·머지

1. **reviewer**: `code-review` 실행 주체(기본 `ok:reviewer` 백그라운드). 브리핑: 첫 줄 `ok-brief: <id>/<slug>`, `읽을 것: <P>/tasks/<slug>.md`, `역할: <KIT>/roles/reviewer.md`, `형식: <KIT>/roles/review-format.md`, 레포 <Coordinator 워크트리>, 기능 브랜치(보고의 실제 이름), 비교 기준 <작업 브랜치>, 기능 id, spec·qa-sheet·review-summary·기능 보고 경로, 산출 `<P>/reports/<slug>-review-<fid>.md`. Worker로 바뀌었으면 Coordinator 워크트리의 읽기 전용 Worker(같은 `.git`이라 `git diff <작업 브랜치>...<기능 브랜치>`가 된다). `code-review=cross`면 그 기능을 만든 Provider가 아닌 Provider.
2. **critic 1회**: reviewer가 `issues`면 critic(같은 첫 두 줄) `단계: 1차, <fid> 코드`, 같은 레포·브랜치·기준, 리뷰 파일, 산출 `<P>/reports/<slug>-debate-<fid>.md`. 반박·새 지적이 있으면 reviewer `토론 답`(답 파일 `<P>/reports/<slug>-debate-reply-<fid>.md`) → critic `마무리`. 남은 이견은 Coordinator가 정한다(사용자 의도가 걸리면 결정 파일). `pass`면 critic을 부르지 않는다.
3. **반영**: 합의-반영이 있으면 `<P>/tasks/<slug>/fix-<fid>-<n>.md`에 "토론 파일 <경로>의 `## 반영 목록` 반영(테스트 먼저), 같은 결과 파일 갱신, worker_done"을 쓰고 `task-create` → `worker-start --task <새 task> --terminal <그 세션 handle>`(같은 세션 재사용) → 7단계 대기. 반영 보고가 오면 reviewer만 한 번 더 본다(토론 없이). 3회 상한, 넘으면 결정 파일.
4. **머지**: Coordinator 워크트리에서 `git merge --no-ff refs/heads/<기능 실제 브랜치>`. 충돌은 풀지 않고 그 기능 세션에 맡긴다. 머지한 기능 세션은 retain 상태로 둔다.

모든 기능이 머지되면 9단계.

## 9단계 — 마무리 다듬기 (작업 브랜치 전체에 한 번)

| 등급 | 할 것 |
|---|---|
| S | 하지 않는다 |
| M | Worker 없이(브리핑 첫 두 줄은 위와 같다): reviewer(`단계: 전체 리뷰`, 비교 `<기준 브랜치>...<작업 브랜치>`, 산출 `<P>/reports/<slug>-finish-review.md`) ∥ security 코드 모드(`security: true`일 때, 산출 `<P>/reports/<slug>-security.md`)를 동시에. 결과를 `<P>/reports/<slug>-finish.md`에 표(도구 \| 지적 수 \| 고칠 것 \| 넘긴 것(이유))로. 고칠 것은 그 코드가 속한 기능 세션에 8단계 3번처럼 보낸 뒤 다시 머지 |
| L | 마무리 Worker(`finish` 실행 주체) 하나: 아래 지시 |

L 마무리 Worker: `--name <slug>-finish`, 기준 `<작업 브랜치>`, 역할 reviewer + 기능의 주 구현 역할. `## 작업`:

```
작업 <slug>의 마무리 다듬기. 대상: <레포>, 이 워크트리 브랜치, 비교 기준 <기준 브랜치>.
먼저 읽을 것: spec, QA 시트, 테스트 기준 (절대 경로).
1. 전체 diff에서 중복·불필요 코드를 줄인다. 겉으로 보이는 동작(상태 코드·응답 모양·화면 출력)과 테스트 기대값은 바꾸지 않는다. 바꿨으면 되돌린다. 세션에 /simplify 같은 Skill이 있으면 써도 된다. 테스트 통과 뒤 커밋(refactor: 마무리 다듬기).
2. 전체 diff를 리뷰한다(reviewer 역할 기준). security: true면 보안 관점도(security 역할 파일 <KIT>/roles/security.md).
3. 지적마다: 재현 조건이 맞고 spec 범위 안이면 테스트 먼저 쓰고 고친다. 아니면 고치지 않고 이유를 적는다.
4. 레포 테스트 명령 전체 통과.
5. 결과 .ok/report-finish.md: 표(단계 | 지적 수 | 고침 | 안 고침(이유)), 브랜치명·마지막 커밋.
```

결과가 오면 Coordinator 워크트리에서 `git merge --no-ff refs/heads/<마무리 브랜치>`.

## 10단계 — 확인·정리·마무리

1. `qa-run`(기본 `ok:qa-run`): 브리핑 첫 줄 `ok-brief: <id>/<slug>`, `읽을 것: <P>/tasks/<slug>.md`, `역할: <KIT>/roles/qa-run.md`, Coordinator 워크트리 경로, 테스트·타입체크 명령(`project.md`의 `test`, 없으면 레포 문서), 산출 `<P>/reports/<slug>-qa.md`. 실패면 그 기능 세션에 반영을 보내고 다시 머지한 뒤 qa-run을 한 번 더.
2. 정리: coordinator.md 10절.
3. `status.md` 체크포인트·최근 변경, `learnings.md` 한 줄, 반영한 보고 `applied: true`, 작업 파일 `status: completed`. hub가 git이면 자기 경로 커밋(permissions.md).
4. 마무리와 보고: coordinator.md 11절(작업 파일 `finish`대로, 다시 묻지 않는다). 보고 줄: `<id> · <slug> 완료 — 기능 <n>개, 리뷰 <pass/issues>, 마무리 <지적 n·고침 m>, qa <통과/실패>, 작업 브랜치 <브랜치> (기준 <기준>, 브랜치만 남김|PR <URL>|병합 <커밋>), 보고: <P>/reports/<slug>-*.md`.

## 하지 않는 것

- Coordinator가 레포 코드를 고치거나 커밋하지 않는다(머지 커밋만).
- 승인 카드 전에 Worker를 띄우지 않는다. 1~5단계는 Subagent(또는 덮어쓴 읽기 전용 Worker)만.
- 사용자가 부르지 않은 다른 작업을 시작하지 않는다.

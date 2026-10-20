---
name: start
description: 접수 세션(hub 폴더에서 연 세션)에서 일을 맡긴다. 사용자가 "/ok:start <프로젝트 id> plan|quick <요청>"을 직접 입력했을 때만 돈다. 그 레포의 새 Orca 워크트리에 이번 작업 전용 Coordinator 세션을 열고 첫 지시로 /ok:plan 또는 /ok:quick을 넣는다. 인자가 없으면 질문 카드로 고른다.
argument-hint: "[<프로젝트 id> plan|quick [--base <브랜치>] [--here] [--with 단계=provider,...] <요청>]   비우면 고르기"
disable-model-invocation: true
---

# /ok:start — 일 맡기기 (접수 세션)

인자: $ARGUMENTS

`<KIT>`는 `${CLAUDE_PLUGIN_ROOT}`다. 이 Skill은 사용자가 접수 세션에 직접 입력한 턴에서만 돈다. 세션을 여는 일만 하고 설계·구현은 하지 않는다. 답은 한국어.

## 1. 인자 읽기

- 형식: `<프로젝트 id> [plan|quick] [--base <브랜치>] [--here] [--with 단계=값,...] <요청>`. 트랙이 없으면 `plan`.
  - 작업 공간은 기본 **새 워크트리**다: 기준 브랜치에서 새 작업 브랜치와 폴더를 만들고 Coordinator 세션을 거기서 연다.
  - `--base <브랜치>`: 기준 브랜치. 없으면 `hub.json`의 그 프로젝트 `base`.
  - `--here`: quick만. 새 워크트리 대신 레포 본 폴더(지금 체크아웃된 브랜치)에서 한다. plan에서는 무시한다.
  - `--with`: 단계별 Provider 덮어쓰기. 그대로 첫 지시에 넘긴다(`<KIT>/policies/routing.md` 덮어쓰기). 요청 문장 안의 "리뷰는 codex로" 같은 말도 그대로 요청에 남긴다.
- hub: 셸에서 `<KIT>/scripts/ok.sh where <현재 폴더>`. 첫 칸이 hub이고 둘째 칸이 `-`여야 한다(접수 세션은 hub 폴더에서 연다). 아니면 "hub 폴더에서 연 세션에서 부르세요" 한 줄로 멈춘다.
- `hub.json`의 `projects[]`에서 id를 찾아 `repo`·`base`를 얻는다. 없으면 "등록된 프로젝트: …" 한 줄과 `/ok:init`으로 등록 안내를 하고 멈춘다.
- 요청이 비었으면 "요청을 한 줄로 적어 주세요" 한 줄로 멈춘다(고르기 모드는 예외).

### 1.1 고르기 (인자가 비었을 때)

1. 카드 1 — `AskUserQuestion` 한 번에 두 질문:
   - "어느 프로젝트에 맡길까요?"(헤더 `프로젝트`): `hub.json`의 프로젝트. 4개를 넘으면 `projects/<id>/status.md`의 `updated`가 최근인 4개, 나머지는 본문 끝에 "그 밖: a, b (기타에 id 입력)".
   - "어떤 트랙으로 할까요?"(헤더 `트랙`): "plan (추천)" — 요구 정리·설계 리뷰·승인 한 번·기능 세션·코드 리뷰, "quick" — Coordinator가 직접 고침, 파일 3개·반나절 이내.
2. 고른 레포의 브랜치 후보를 1.2절로 만든다.
3. 카드 2 — "어느 브랜치를 기준으로 워크트리를 만들까요?"(헤더 `기준 브랜치`, 후보 최대 4개, 첫 번째 추천). quick이면 "어디서 작업할까요?"(헤더 `작업 공간`): "새 워크트리 (추천)", "현재 폴더"(지금 체크아웃된 `<현재 브랜치>`에서).
4. 카드 3 — "할 일을 '기타' 칸에 한 줄로 적어 주세요. (<id> · <트랙> · <기준>에서 새 워크트리|현재 폴더)"(헤더 `할 일`). 선택지: "다시: <최근 작업 제목>"(같은 프로젝트 `tasks/*.md` 중 `updated`가 가장 최근), "취소". 기타 글이면 그것이 요청이다.

### 1.2 브랜치 후보

1. 원격이 있으면 `git -C <레포> fetch origin --prune --quiet`(실패하면 "원격을 못 받아 로컬 기준으로 고릅니다" 한 줄 알리고 계속).
2. 겹치지 않게 모은다: 프로젝트 `base`(추천) → 같은 프로젝트 진행 중 작업의 작업 브랜치 중 로컬에 있는 것("이어서: <작업 제목>") → 현재 체크아웃된 브랜치 → 최근 브랜치(`git -C <레포> for-each-ref --sort=-committerdate --count=8 --format='%(refname:lstrip=3)' refs/remotes/origin`, 원격이 없으면 `refs/heads`의 `%(refname:short)`).

### 1.3 기준 ref

고른 브랜치 `<b>`: `origin/<b>`가 있으면 그것, 없고 로컬 `<b>`가 있으면 `<b>`, 둘 다 없으면 "브랜치 <b>가 없습니다" 한 줄로 멈춘다. 로컬 브랜치는 건드리지 않는다.

## 2. 같은 프로젝트 진행 중 작업

셸에서 `<KIT>/scripts/ok.sh status <HUB> <id>`의 `task` 줄이 있으면 제목을 한 줄로 알린다("같은 레포에서 진행 중: …"). 막지 않는다. `--here`면 "같은 폴더에서 변경이 섞일 수 있다", 그 밖에는 "같은 파일을 고치면 머지할 때 충돌할 수 있다"를 붙인다.

## 3. Orca 확인

`orca status --json`의 `result.runtime.reachable`이 `true`여야 한다. 아니면 "Orca가 켜져 있지 않아 Coordinator 세션을 열 수 없습니다. Orca를 켠 뒤 다시 입력해 주세요." 한 줄로 멈춘다. `orca` 명령은 sandbox 밖에서 실행해도 되는 명령이다.

## 4. 첫 지시

```
/ok:<plan|quick> <plan이고 --with 값이 있으면 그대로. quick에는 넣지 않는다> <요청>
hub: <HUB>, 프로젝트: <id>, 기준 브랜치: <기준 ref>, 작업 공간: <새 워크트리|현재 폴더>, slug: <slug>.
이 세션은 접수 세션의 /ok:start로 열렸다. 끝나면 마지막 보고 한 줄을 접수 세션 카드 메모로 남긴다(Coordinator 규칙 11절). 답·질문·보고는 한국어.
```

- `<slug>`: 요청에서 영문 소문자 2~4단어를 하이픈으로(예: `login-sso`). 이미 `projects/<id>/tasks/<slug>.md`가 있으면 `-2`.
- `--here`면 `기준 브랜치:` 자리에 `현재 체크아웃(<현재 브랜치>)`.
- 터미널로 열린 세션은 여러 줄 프롬프트가 첫 줄에서 끊길 수 있다. 끊기면 다음부터 줄바꿈 대신 " / "로 이어 한 줄로 보낸다.

## 5. Coordinator 세션 열기

1. `orca repo list --json`의 `path`에 레포가 없으면 `orca repo add --path <레포> --json`.
2. 모델: 기본 `claude-opus-5-5`. 요청에 "시험" 또는 "간단한 모델"이 있으면 `claude-sonnet-5-5`.
3. 연다:
   - 새 워크트리(plan, quick 기본): 브랜치 이름은 plan `epic-<slug>`, quick `<slug>` (Orca 설정의 브랜치 접두가 앞에 붙는다).
     ```
     orca worktree create --repo path:<레포> --name <브랜치 이름> --base-branch <기준 ref> --no-parent --agent claude --model <모델> --prompt "<첫 지시>" --activate --json
     ```
   - `--here`: `orca agent launch --agent claude --worktree path:<레포> --model <모델> --prompt "<첫 지시>" --focus --json`
4. 결과(`result`):
   - `worktree create`: `ok: true`이고 `launch`(옛 버전은 `agentTerminalHandle`)가 있으면 성공. `agent launch`: `ok: true`이고 `prompt.outcome`이 `journaled` 또는 `handed-to-terminal`이면 성공.
   - 성공: "Coordinator 세션을 Orca에 열었습니다: <id> · <요청 요약> (<모델>, <기준>에서 새 워크트리 <작업 브랜치>|현재 폴더 <현재 브랜치>). 그 탭에서 질문에 답해 주세요. 끝나면 이 접수 세션 카드 메모에 보고가 올라옵니다." 한 줄.
   - 응답이 끊겨 `operationId`만 있으면 같은 명령에 `--retry-launch <operationId>`. 새로 만들지 않는다.
   - 다른 오류는 `error.message` 원문 그대로 한 줄.

## 하지 않는 것

- 접수 세션에서 설계·구현을 하지 않는다. Run을 만들거나 Worker를 띄우지 않는다(그것은 Coordinator 세션의 일).
- 레포 파일을 고치지 않는다. git은 `fetch`와 브랜치 목록 보기만.
- 사용자가 `/ok:start`를 치지 않았는데 이 절차를 시작하지 않는다.

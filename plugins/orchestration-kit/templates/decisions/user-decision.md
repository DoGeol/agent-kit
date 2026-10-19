---
schema: user-decision/v1
decisionId: <projectTaskId>-dNN
projectId: <projectId>
projectTaskId: <PREFIX>-NNNN
createdAt: YYYY-MM-DDTHH:MM:SS+09:00
irreversible: false
---

# <결정 제목>

## 배경
<현재 상태, 왜 지금 정해야 하는지, 막힌 Task가 무엇을 기다리는지>

## 질문 1: <짧은 이름>
<무엇을 정하는지 한 줄>

1. <선택지 이름> (추천) — 결과: <...> / 되돌림: <...> / 비용: <...>
2. <선택지 이름> — 결과: <...> / 되돌림: <...> / 비용: <...>

<!-- 이 파일은 `.ai/user-decisions/<decisionId>.md`에 쓴다. 같은 폴더의 `.<decisionId>.md.tmp`에 쓴 뒤 이름을 바꾼다. 쓴 뒤 고치지 않는다: 바꾸려면 새 decisionId로 다시 쓴다.
     공유 모드는 원본 checkout의 `.ai/`에 쓴다 (Worktree의 `.ai/`는 현황판이 읽지 않는다). 비밀·고객 원문은 넣지 않는다.
     질문은 서로 독립인 것 4개까지, 질문마다 선택지 2~4개, 추천은 첫 번째.
     irreversible: true면 아래 절이 필수다 (저장소, 브랜치, 명령을 그대로).
     ## 실행 내용 (질문 N의 M번)
     - 저장소: <projectId 또는 저장소 기준 상대 경로>
     - 브랜치: <from> → <to>
     - 명령:
  ```sh
  <실행할 명령 그대로>
  ```
-->

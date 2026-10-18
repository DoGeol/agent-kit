---
schema: user-decision/v1
decisionId: SAMPLE-0001-d01
projectId: sample-app
projectTaskId: SAMPLE-0001
createdAt: 2026-10-18T23:40:00+09:00
irreversible: true
---

# Worker 계획과 PR 생성 승인

## 배경
상태 화면 Task가 Worker 계획 승인과 PR 생성을 기다리고 있다. 계획이 정해져야 첫 Worker를 시작할 수 있다.

## 질문 1: Worker 계획
Worker를 몇 개로 나눌지 정한다.

1. 계획대로 (추천) — 결과: Worker 2개로 병렬 진행 / 되돌림: 가능 / 비용: 사용량 보통
2. Worker 1개로 줄이기 — 결과: 순차 진행 / 되돌림: 가능 / 비용: 사용량 낮음

## 질문 2: PR 생성
작업이 끝나면 PR을 지금 열지 정한다.

1. 지금 Push하고 PR 열기 (추천) — 결과: 원격에 브랜치가 올라감 / 되돌림: PR 닫기만 가능 / 비용: 없음
2. 보류 — 결과: 로컬에 두고 다시 묻는다 / 되돌림: 해당 없음 / 비용: 없음

## 실행 내용 (질문 2의 1번)
- 저장소: sample-app (저장소 기준)
- 브랜치: feature/status-view → main
- 명령:
  ```sh
  git push -u origin feature/status-view
  gh pr create --base main --head feature/status-view --title "<제목>"
  ```

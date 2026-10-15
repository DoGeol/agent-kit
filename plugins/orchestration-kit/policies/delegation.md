# 위임 (Portfolio → Project)

[← 공통 정책](README.md)

ID와 상태 값은 [lifecycle.md](lifecycle.md#업무-id).

## 절차

1. Portfolio가 `portfolio/TASKS.md`에 `PORT-NNNN`을 등록한다 (`assigned`).
2. 프로젝트마다 위임 명세를 만든다: `handoffs/outbox/<projectId>/<portfolioTaskId>.md`. 템플릿 `templates/handoffs/portfolio-task.md`.
3. 사용자 또는 Portfolio가 해당 Project Coordinator 세션을 명시적으로 시작하거나, 살아 있는 세션에 명세 경로를 전달한다. 파일 생성만으로는 실행되지 않는다.
4. Project Coordinator가 명세를 읽고 수락 여부를 판단한다. 수락하면 `.ai/TASKS.md`에 `projectTaskId`를 만들고 `portfolioTaskId` 열에 연결한다. 거절하거나 질문이 있으면 사용자에게 알리고 `blocked` 보고를 낸다.
5. Portfolio는 다음 Pull에서 `.ai/TASKS.md`의 연결을 확인한 뒤 `accepted`로 바꾸고 `projectTaskId`를 적는다. Project는 Portfolio 파일을 직접 쓰지 않는다.

여러 프로젝트에 걸친 업무는 `portfolioTaskId` 하나에 프로젝트별 명세를 하나씩 둔다. 상위 업무는 모든 프로젝트가 `completed`를 보고해야 종결한다.

## 위임 명세

frontmatter 필수 필드:

| 필드 | 값 |
|---|---|
| `schema` | `portfolio-task/v1` |
| `portfolioTaskId` | `PORT-NNNN` |
| `projectId` | 등록된 `projectId` |
| `origin` | `portfolio` |
| `status` | Portfolio 업무 상태 값 |
| `priority` | `high` \| `medium` \| `low` |
| `createdAt` | ISO 8601 |

본문 필수 절: `목표`, `완료 조건`, `제약`.

명세의 `status`는 작성 시점 값이며 다시 고치지 않는다. 이후 상태의 원본은 `portfolio/TASKS.md`다. 명세에는 `전달 기록`만 덧붙인다.

명세에는 결과(무엇을, 어떤 조건이면 끝)만 적는다. 구현 방식과 Worker·Worktree 선택은 Project Coordinator가 정한다.

## 프로젝트에서 직접 시작한 업무

Portfolio를 거치지 않은 업무도 허용한다 [확정]. Project는 `origin: project-direct`, `portfolioTaskId: null`로 보고한다. Portfolio는 Pull에서 새 업무를 만들거나 기존 업무에 연결한다.

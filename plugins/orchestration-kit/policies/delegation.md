# 위임 (Portfolio → Project)

[← 공통 정책](README.md)

ID와 상태 값은 [lifecycle.md](lifecycle.md#업무-id).

## 절차

1. Portfolio가 `portfolio/TASKS.md`에 `PORT-NNNN`을 등록한다 (`backlog`).
2. 프로젝트마다 위임 명세를 만들고 `assigned`로 바꾼다: `handoffs/outbox/<projectId>/<portfolioTaskId>.md`. 템플릿 `templates/handoffs/portfolio-task.md`.
3. 사용자 또는 Portfolio가 해당 Project Coordinator 세션을 명시적으로 시작하거나, 살아 있는 세션에 명세 경로를 전달한다. Portfolio는 Project Coordinator 세션이 살아 있으면 세션 간 메시지로 경로를 보낼 수 있다 ([communication.md](communication.md#경로)). 파일 생성만으로는 실행되지 않는다. 새 세션 시작과 전달 절차(Coordinator 찾기, 짧은 시작 프롬프트, 첫 턴 확인, 다시 실행하지 않기)는 [portfolio Skill](../skills/portfolio/SKILL.md#세션-시작전달)을 따른다.
4. Project Coordinator가 명세의 `projectId`가 자기 저장소와 같은지 확인한다. 다르면 수락하지 않고 사용자에게 알린다 (명세가 잘못 전달된 것이다). 같으면 수락 여부와 상관없이 `.ai/TASKS.md`에 `projectTaskId`를 만들고 `portfolioTaskId` 열에 연결한다. 수락하면 `assigned`, 거절하거나 질문이 있으면 `blocked`로 두고 사용자에게 알린 뒤 `blocked` 보고를 낸다. 보고에 수락하지 않은 범위와 이유를 적는다.
5. Portfolio는 다음 Pull에서 `.ai/TASKS.md`의 연결을 확인하고 `projectTaskId`를 적는다. Project 행이 `blocked`면 `blocked`로 두고 보고를 기다린다. 그 밖의 상태면 `accepted`로 바꾼다. Project는 Portfolio 파일을 직접 쓰지 않는다.

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

본문 필수 절: `목표`, `완료 조건`, `제약`. 선택 절: `제안 역할` ([roles.md](roles.md)의 역할 이름. Project Coordinator는 참고만 한다), `제안 Provider` (Provider·모델 지정. Project는 따르고, 쓸 수 없으면 Portfolio에 알린다. [routing.md](routing.md#provider-선택)).

명세의 `status`는 작성 시점 값이며 다시 고치지 않는다. 이후 상태의 원본은 `portfolio/TASKS.md`다. 명세에는 `전달 기록`만 덧붙인다.

명세에는 결과(무엇을, 어떤 조건이면 끝)만 적는다. 구현 방식과 Worker·Worktree 선택은 Project Coordinator가 정한다.

## 프로젝트에서 직접 시작한 업무

Portfolio를 거치지 않은 업무도 허용한다 [확정]. Project는 `origin: project-direct`, `portfolioTaskId: null`로 보고한다. Portfolio는 Pull에서 새 업무를 만들거나 기존 업무에 연결한다.

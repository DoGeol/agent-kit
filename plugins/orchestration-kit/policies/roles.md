# 역할

[← 공통 정책](README.md)

Worker·Subagent에 맡길 일마다 **역할**을 정한다. 역할은 관점, 산출물, 수용 기준을 묶은 짧은 프로필이다.

- [확정] 역할 원본은 Plugin의 [`roles/`](../roles/) 한 곳이다. Skill이나 프로젝트에 복제하지 않는다.
- [확정] 역할은 Coordinator가 쓰는 Task 명세 본문으로 전달한다. Orca `--agent`는 Provider 선택이고 역할 옵션이 아니다. 특정 도구의 에이전트 정의(예: Claude `agents/`)에 기대지 않으므로 Claude·Codex·AGY Worker가 같은 방식으로 받는다.
- [확정] 역할, 등급(`fast`/`default`/`strong`), Provider는 따로 정한다. 역할 파일에 Provider를 적지 않는다. 역할 파일의 기본 등급은 힌트일 뿐이고 최종 등급은 [routing.md](routing.md#모델과-effort)로 정한다.

## 역할 목록

| 역할 | 맡는 일 | 파일 수정 |
|---|---|---|
| [frontend](../roles/frontend.md) | 화면·컴포넌트·클라이언트 상태 구현 | 함 |
| [designer](../roles/designer.md) | UI/UX 설계, 화면 흐름, 접근성·일관성 검토 | 설계 문서만 |
| [backend](../roles/backend.md) | API, 도메인 로직, 데이터 저장 | 함 |
| [qa](../roles/qa.md) | 테스트 작성·실행, 재현, 회귀 확인 | 테스트만 |
| [reviewer](../roles/reviewer.md) | 코드·설계 리뷰 | 안 함 |
| [docs](../roles/docs.md) | README, 가이드, 운영 문서 | 문서만 |

[권장] 목록은 필요할 때 늘린다. 새 역할은 `roles/<id>.md`로 더하고 이 표에 적는다.

## 역할 파일 규격

[권장] 30줄 안팎. 명세에 그대로 들어가므로 짧게 쓴다.

```markdown
# <id>: <이름>

기본 등급: <fast | default | strong 힌트>

## 관점
## 산출물
## 수용 기준
- [ ] <Coordinator가 확인할 수 있는 항목>
## 하지 않는 것
```

## 프로젝트 보강

프로젝트에 맞는 내용(스택, 디자인 시스템, lint 규칙, 금지 패턴)은 프로젝트의 `.ai/roles/<id>.md`에 적는다.

- 같은 `<id>`의 Plugin 역할 뒤에 덧붙여 쓴다. 둘이 충돌하면 프로젝트 내용을 따른다.
- Plugin에 없는 `<id>`는 그 프로젝트만의 역할이 된다. 형식은 위 규격을 따른다.
- `.ai/roles/`는 필요할 때 만든다. 초기화하지 않는다.

## 고르기

1. 하위 작업마다 주 역할 1개를 정한다. 산출물이 무엇인지로 고른다 (화면 코드 → `frontend`, 화면 설계 → `designer`).
2. 다른 관점이 꼭 필요하면 보조 역할을 더한다. 보조 역할은 `관점`과 `수용 기준`만 쓰고, 파일 소유 범위는 주 역할을 따른다.
3. Direct로 처리하는 작은 수정은 역할을 생략해도 된다.
4. Portfolio 위임 명세의 `제안 역할`은 참고만 한다. 최종 선택은 Project Coordinator가 한다.

## 조합: 한 Worker와 여러 Worker

| 상황 | 방식 |
|---|---|
| 작은·중간 작업, 한 사람이 같은 파일을 고치면 되는 일 | Worker 1개. 주 역할 + 보조 역할 (예: `frontend` + `designer`) |
| 큰 작업, 설계를 먼저 합의해야 하는 일 | ① 설계 역할 Worker가 설계 문서만 작성 ② Coordinator가 설계 수락 ③ 구현 역할 Worker가 구현 ④ 필요하면 설계 역할이 읽기 전용 리뷰 |

- 두 역할이 같은 파일을 고쳐야 하면 여러 Worker 방식만 쓴다. 파일마다 작성자는 한 명이다 ([routing.md](routing.md#병렬-실행-규칙)).
- 여러 Worker 방식에서 설계 문서는 다음 Worker 명세에 경로로 넘긴다. Worktree가 다르면 Coordinator가 먼저 병합한다.

## 명세에 넣기

명세 맨 앞에 역할 절을 둔다. 순서:

```markdown
## 역할: <주 역할> (+ <보조 역할>)
<roles/<주 역할>.md 본문>
<.ai/roles/<주 역할>.md 본문, 있으면>
<보조 역할의 관점과 수용 기준, 있으면>

## 작업
<대상, 변경, 제약, 소유 범위, 수용 기준. project Skill의 명세 규칙>
```

- Worker는 역할 수용 기준 항목마다 결과(통과 / 미통과 / 확인 못 함)와 근거를 남긴다. 완료 메시지가 짧게 제한되면(Orca `worker_done` 요약) 결과 파일을 쓰고 경로를 넘긴다 (Orca `--report-path`). 명세에 결과 파일 위치를 적는다. 임시 디렉터리 변수(`TMPDIR`)가 없는 Worker도 있으므로 절대 경로로 넘기게 한다.
- Subagent에 맡길 때도 같은 역할 절을 프롬프트 앞에 넣는다.
- 명세가 실행 도구에서 잘리지 않았는지 확인한다 (Orca는 `worker-show`의 전체 명세).

## Coordinator가 쓰는 곳

| 단계 | 할 일 |
|---|---|
| 라우팅 | 하위 작업마다 역할과 조합 방식을 고른다 |
| 명세 작성 | 위 순서로 역할 절을 넣는다 |
| 검증 | 역할 수용 기준으로 수락 여부를 판단한다. Worker가 통과라고 적어도 Coordinator가 직접 확인한다 |
| 보고 | 완료 보고의 `Acceptance evidence`에 역할 체크리스트 결과를 적는다 |

## 기록

`TASKS.md`의 `실행 방식` 열에 역할을 같이 적는다. 새 열을 만들지 않는다.

```text
Independent Session (Orca claude worker, role: frontend+designer, fast: haiku, 새 Worktree)
```

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
| [designer](../roles/designer.md) ([참고](../roles/designer/reference.md)) | UI/UX 설계, 화면 흐름, 접근성·일관성 검토, 디자인 원칙 초안·변경 제안 | 설계 문서만 |
| [backend](../roles/backend.md) | API, 도메인 로직, 데이터 저장 | 함 |
| [qa](../roles/qa.md) ([참고](../roles/qa/reference.md)) | QA 시트, 테스트 작성·실행, 재현, 회귀 확인 | 테스트만 |
| [planner](../roles/planner.md) ([참고](../roles/planner/reference.md)) | 구현 계획, PR 직전 최종 측정 시트 | 문서·시트만 |
| [architect](../roles/architect.md) | 시스템 설계: 경계, 계약, 대안과 트레이드오프, 이전·되돌리기, 결정 기록 초안 | 설계 문서만 |
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

## 참고 문서

역할 파일은 어느 Task에나 걸리는 관점·수용 기준만 둔다. 도구나 Task 종류별 절차는 `roles/<id>/reference.md`에 절로 나눠 둔다.

- Coordinator가 Task에 걸리는 절만 골라 명세의 역할 절 뒤에 붙인다. 절 이름은 도구·Task 종류로 짓는다 (예: `## Playwright e2e와 화면 비교`).
- 유명한 공개 Skill에서 가져오는 것은 절차, 관문, 산출물 형식뿐이다. 모델이 이미 아는 지식은 넣지 않는다. 문구를 복사하지 않고 다시 쓰며, 출처와 라이선스를 아래 표에 적는다.

| 역할 | 출처 | 라이선스 | 가져온 것 |
|---|---|---|---|
| qa | [obra/superpowers](https://github.com/obra/superpowers) `verification-before-completion`, `test-driven-development` | MIT | 새로 실행한 결과 없이 완료 주장 금지, 결함 상태에서 실패하는지 확인 |
| qa | [openai/skills](https://github.com/openai/skills) `playwright-interactive` | Apache-2.0 | QA 인벤토리(요구사항·구현·주장), 확인했고 없었던 결함 유형 |
| qa | [anthropics/skills](https://github.com/anthropics/skills) `webapp-testing` | Apache-2.0 | 조건 대기, 렌더 뒤 셀렉터 확보 |
| planner | [obra/superpowers](https://github.com/obra/superpowers) `writing-plans`, `brainstorming` | MIT | 단계마다 확인 명령·기대 결과, TBD 금지, 실패 모드, 하지 않을 것, 질문 세 갈래 |
| planner | [openai/skills](https://github.com/openai/skills) `define-goal` | Apache-2.0 | 판정 기준과 멈출 조건 |
| planner | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) `feature-dev` | Apache-2.0 | 명확화 질문을 건너뛰지 않음 |
| reviewer | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) `code-review` | Apache-2.0 | 확신도 80 미만은 올리지 않음, 오탐 유형 목록 |
| reviewer | [obra/superpowers](https://github.com/obra/superpowers) `requesting-code-review` 리뷰어 지침 | MIT | 명세 준수와 품질 판정 분리, 판단 보류 목록, 심각도 3단계, 병합 판정 |
| backend | [obra/superpowers](https://github.com/obra/superpowers) `systematic-debugging`, `test-driven-development` | MIT | 원인 위치를 찾기 전 고치지 않음, 고치기 전 실패 확인, 3번 실패하면 멈춤 |
| backend | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) `pr-review-toolkit` silent-failure-hunter | Apache-2.0 | 빈 catch·조용한 기본값 대체를 숨은 실패로 보고 |
| frontend | [anthropics/skills](https://github.com/anthropics/skills) `webapp-testing` | Apache-2.0 | 코드만 읽지 않고 브라우저에 띄워 상태별로 확인 |
| frontend, designer | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | MIT | 색에만 의존하지 않는 표시, 알림 영역에 둘 내용, 표시 형식 |
| designer | [anthropics/skills](https://github.com/anthropics/skills) `frontend-design` | Apache-2.0 | 흔한 장식을 넣기 전에 필요한지 묻기, 강조할 곳 하나, 프로젝트 지시가 일반 기본값보다 우선 |
| designer | [GOV.UK Design System 기여 기준](https://design-system.service.gov.uk/community/contribution-criteria/), [GOV.UK 디자인 원칙](https://www.gov.uk/guidance/government-design-principles) | OGL v3.0 | 원칙 변경은 쓰임 증거·중복 없음을 근거로 제안, 날짜를 단 변경 기록 |
| designer | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 | 기존 화면에서 초안을 만들되 덮어쓰지 않고 근거 없는 내용은 질문으로 남김 |
| designer, frontend | 원칙 문서 형식과 화면 목록 (principles.design, Atlassian 디자인 원칙, Jeremy Keith 디자인 원칙 강연, Brad Frost interface inventory) | 확인 못 함 (형식만 가져오고 문장은 쓰지 않음) | "A를 B보다 우선" 문장과 반대 문장 시험, 원칙마다 점검 질문, 3~5개, 같은 역할 요소의 변형 세기 |
| frontend | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | MIT | 위반 보고 형식 `파일:줄 - 문제` |
| architect | [rust-lang/rfcs](https://github.com/rust-lang/rfcs/blob/master/0000-template.md) 템플릿 | MIT OR Apache-2.0 | 버린 대안과 이유, 결과의 좋은 점·나쁜 점, 남은 질문 |
| architect | [MADR](https://adr.github.io/madr/) | MIT OR CC0-1.0 | 결정마다 선택지 여럿과 확인 방법(Confirmation), `proposed` 상태 |
| architect | [arc42](https://arc42.org/overview), [C4 모델](https://c4model.com/) | CC BY-SA 4.0, CC BY 4.0 | 수치로 쓰는 품질 요구, 그림은 맥락·큰 구성 요소 수준까지 |
| architect | [obra/superpowers](https://github.com/obra/superpowers) `brainstorming` | MIT | 설계 승인 뒤에 계획으로 넘김, 질문 세 갈래 |
| architect | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) `feature-dev` code-architect | Apache-2.0 | 기존 구조를 먼저 읽음. 구현 단계는 planner 몫으로 빼서 겹치지 않게 함 |
| docs | [anthropics/skills](https://github.com/anthropics/skills) `doc-coauthoring` | 표기 없음 (생각만 가져오고 문구는 쓰지 않음) | 다 쓴 뒤 처음 독자처럼 따라 해 보는 독자 시험 |

- [확정] qa: 새 시험은 변경 범위(diff)와 그 호출자에만 쓰고 기존 시험은 전부 실행한다. QA를 통과시키려는 변경(제품 코드, 시험 삭제·skip, assertion 약화, 기준 이미지 갱신, 허용치 완화, 동작 우회 mock)을 하지 않는다. 시험 파일 검수는 별도 Task로만 한다.
- [검증됨] qa 보강 비교 (sample-app, 심은 결함 1개와 함정 2개(기준 이미지 갱신 유혹, 범위 밖 시험), 팀마다 시트 `sonnet` 1 + 실행 `haiku` 1): 채점 8점은 두 팀 모두 8점이었다. 기준 이미지 갱신과 범위 함정은 두 팀의 시트 단계에서 이미 걸러져 차이가 나지 않았다. 보강한 팀에서만 나온 것: 결함을 고친 사본에서 새 시험이 통과함을 확인(red-green), 확인했고 없었던 결함 유형 목록, 차이 이미지 경로를 붙인 결정 요청.

- [검증됨] planner 비교 (sample-app, 간격·실패 동작·숨은 탭이 빠진 모호한 요청, 팀마다 `opus` 1, 미리 정한 10점 채점표): 지금 Coordinator 명세 규칙만 준 팀 7점, planner 역할 팀 10점. 차이는 간격 값을 확정했는지(가정+질문으로 남김), 단계마다 확인 명령·기대 결과, 멈출 조건. planner 팀만 결함을 넣어 새 시험이 실패하는지 보는 단계와 실패 모드별 코드 위치·확인 방법을 썼다.

- [검증됨] reviewer 비교 (sample-app 자동 재확인 diff, 진짜 결함 2개와 오탐 미끼 3종, 팀마다 `sonnet` 1, 8점 채점표): 기존 역할 6점, 보강 역할 7점. 결함 검출은 같았고 차이는 명세·품질 판정 분리와 병합 판정 형식뿐이다. 두 팀 모두 취향 미끼(`const`로 써도 되는 `let`)를 Minor로 올렸다. 그래서 "취향은 Minor로도 넣지 않는다" 줄을 더했다 (PR 직전 재측정, 같은 함정·`sonnet` 1회: 8점. 취향 미끼를 문제 목록 대신 판단 보류에 두었다). 기존 역할 팀만 찾은 정당한 지적(자동 확인 중 버튼 클릭이 조용히 무시됨)도 있었다.

- [검증됨] backend 비교 (sample-api, 공유 정수 해석 함수가 빈 값을 잃은 버그와 오류를 삼키는 진입부 catch, 팀마다 `sonnet` 1, 10점 채점표, 숨은 시험으로 기계 판정): 기존 역할 8점, 보강 역할 10점. 두 팀의 코드 수정은 같았다 (둘 다 공유 함수에서 원인을 고쳤고, 증상만 고치는 함정은 차이를 내지 못했다). 차이는 보강 역할에만 단서가 있는 두 항목이다: 고치기 전 실패한 시험 명령·출력 기록, 문서와 어긋나는 빈 catch를 고치지 않고 결정이 필요하다고 보고한 것.

- [검증됨] frontend 비교 (sample-app 최근 확인 기록 구현, 팀마다 `sonnet` 1, 10점 채점표, 숨은 e2e 4개로 기계 판정): 두 팀 모두 9점. 숨은 e2e·토큰 사용·새 e2e는 같았다. 보강 역할 팀만 요소 대응표를 썼다. 대신 기준 이미지 갱신을 피하려고 기록 영역을 흐름 밖(`position:absolute`)으로 뺐다. 그래서 금지 문장을 "시험·기준 이미지를 맞추려고 화면 배치를 바꾸지 않는다, 의도된 변경이면 이유와 함께 갱신"으로 고쳤다 (PR 직전 재측정, 같은 함정·`sonnet` 1회: 9점. 배치 회피 없이 기록을 흐름 안에 두었고 기준 이미지도 그대로 통과했다).
- [검증됨] designer 비교 (같은 기능의 설계 문서, 개수·보존·형식이 빠진 요청, 팀마다 `sonnet` 1, 10점 채점표): 기존 역할 9점, 보강 역할 10점. 차이는 사용자만 정할 값을 추천·가정·질문 표로 남겼는지 하나다. 두 팀 모두 실행하지 않은 코드 예시(`toLocaleTimeString('ko-KR', {hour12:false})`, 실제 출력 `14시 3분 1초`)와 틀린 기준 이미지 영향 짐작을 적었다. 그래서 "코드 예시와 시험 영향은 실행해 확인" 줄을 더했다 (PR 직전 재측정, 같은 함정·`sonnet` 1회: 10점. 기준 이미지 영향을 임시 사본에서 실행해 1px 밀림을 찾았다. 형식 예시는 오후 시각 하나만 실행해 오전 한 자리 시각(`4:03:07`)을 놓쳤다).

- [검증됨] docs 비교 (sample-api README 실행 절, 틀린 기존 줄 `npm start`·포트 8080을 심음, 팀마다 `haiku` 1, 10점 채점표, README 명령을 그대로 실행해 판정): 기존 역할 7점, 보강 역할 8점. 두 팀 모두 틀린 줄을 실행으로 확인해 고쳤다. 차이는 독자 시험 하나다. 보강 역할 팀은 범위 밖 문서의 남은 항목도 보고했지만 기존 줄의 글자를 하나 지웠다. 그래서 "커밋 전에 diff를 다시 읽는다" 수용 기준을 더했다 (PR 직전 재측정, 같은 함정·`haiku`: 1회차 7점, 2회차 9점. 두 번 모두 기존 줄을 망가뜨리지 않았다).

- [검증됨] architect 비교 (sample-api → sample-app "지난 24시간 비정상 이력" 요청. 서버가 꺼진 동안 스스로 기록할 수 없다는 함정과 공유 `/health` 계약이 있음. 팀마다 `opus` 1, 채점자에게 팀을 알리지 않고 결과만 보는 10점 채점): 지금 경로(planner가 바로 계획) 8점, architect 9점. 두 팀 모두 함정과 계약 승인을 짚었다. 차이는 배포 순서·호환·되돌리기 하나다. planner 문서는 확인 명령과 클라이언트 실패 모드까지 있어 바로 구현에 쓰기 좋았고, architect 문서는 대안 비교가 풍부해 승인 검토에 맞았다. architect는 보존 기간·개수를 묻지 않고 정하고 요청에 없는 필드를 더해서, 사용자 값과 과잉 계약을 막는 두 줄을 더했다. 재측정(`opus` 1회)도 9점이었다. 간격·보존·표시 방식은 질문으로 옮겨 갔지만 "24시간" 경계 해석 하나를 계약에 박았고, 문서가 길다(400줄). 그래서 architect는 새 저장 데이터·프로젝트 간 계약이 생길 때만 쓴다.

## 프로젝트 보강

프로젝트에 맞는 내용(스택, 디자인 시스템, lint 규칙, 금지 패턴)은 프로젝트의 `.ai/roles/<id>.md`에 적는다.

- 같은 `<id>`의 Plugin 역할 뒤에 덧붙여 쓴다. 보강은 더하기만 한다: 프로젝트 고유 관점·산출물·수용 기준·금지 사항을 추가할 수 있지만, Plugin 역할의 내용과 [permissions.md](permissions.md) 제한을 빼거나 풀 수 없다. 그런 내용이 있으면 명세에 넣지 않고 사용자에게 알린다.
- Plugin에 없는 `<id>`는 그 프로젝트만의 역할이 된다. 형식은 위 규격을 따른다.
- `.ai/roles/`는 필요할 때 만든다. 초기화하지 않는다. 프로젝트에 이미 있는 규칙·Skill에서 만들 때는 [adopt Skill](../skills/adopt/SKILL.md)을 쓴다.
- adopt로 만든 보강은 이 순서로 쓴다. 역할 파일과 같은 이유로 짧게 둔다 (핵심 줄 15줄 이하):

  ```markdown
  # <id> 보강

  ## 출처
  - <저장소 안 경로> @ <그 파일의 마지막 커밋>
  - skill <이름> @ <.agents/skills | .claude/skills | plugin>

  ## 관점 / ## 수용 기준 / ## 하지 않는 것   (필요한 절만, 줄마다 원본 위치나 규칙 ID)

  ## 작업 전 읽을 문서
  - <경로>: <언제 읽는지>

  쓸 Skill: <이름> (작업 전에 실행한다)
  ```

  원본 단위와 처리(보강 / 문서 / 역할 밖)를 적은 대응표는 `.ai/ADOPT.md`에 둔다. 명세에는 넣지 않는다.
- [검증됨] adopt 마이그레이션 (디자인 정책 문서·경험 문서 2개·AGENTS/CLAUDE·검사 스크립트가 있는 fixture 저장소, 사람이 핵심만 검토한 초안 정답 104단위, `opus` 1): 104단위가 모두 대응표에 들어갔고 디자인 규칙 44개 중 43개가 화면 역할로 갔다. frontend 보강 15줄에 모델이 모르는 프로젝트 고유 값(날짜 함수, 상태 컴포넌트, 토큰 접두어, 토큰 검사 명령)이 모두 들어갔다. 끊긴 링크 10개와 "문서는 symlink가 있다고 하지만 실제로 없어 Claude Worker가 못 읽는 Skill"도 찾았다. PR 직전 재측정(`opus` 1회)도 104단위 모두와 10점이었고, 그 Skill 줄에 `(Codex·AGY만)`을 달았다.
- [검증됨] adopt 보강의 행동 효과 (sample-app에 화면 규칙 문서와 두 번째 화면 문서를 심고, 판별 규칙 5개를 두 번째 문서에만 둠, 팀마다 `sonnet` 1, 10점 채점표): 명세에 "DESIGN.md를 읽는다" 한 줄만 준 팀과 adopt 보강을 넣은 팀 모두 10점이었다. 문서가 짧고 링크가 분명하면 보강 없이도 두 단계를 따라갔다. adopt의 값은 행동 차이보다 빠짐없는 대응표와 Coordinator가 명세에 넣을 줄을 고르는 수고를 줄이는 데 있다. 문서가 길고 흩어진 프로젝트에서의 행동 차이는 아직 재지 않았다.
- Coordinator는 세션을 시작할 때 셸에서 `../scripts/kit.sh adopt-check <저장소>`로 출처가 바뀌었는지 본다. `stale`이나 `new`가 나오면 adopt를 다시 실행하자고 제안한다. 보강을 직접 고치지 않는다.
- 저장소 문서(`AGENTS.md` 등)에 이미 있는 규칙이라도, 이번 Task에 걸리는 규칙은 명세에 직접 적는다. Worker가 문서를 자동으로 읽어도 그 안의 규칙을 지킨다는 보장은 없다. [검증됨] tila 저장소에서 eval 케이스 추가 Task로 비교했다 (Claude `haiku`, 팔마다 Worker 2개, 미리 정한 8점 채점표). 규칙 7줄을 명세에 넣은 팔은 8점, 8점이었다. 넣지 않은 팔은 5.5점, 5.5점이었다. 넣지 않은 팔의 감점은 두 가지다. 하나는 Codex 쪽 케이스를 만들지 않은 것이다. 이것은 저장소 문서에 eval 케이스 규칙으로 적혀 있지 않아 과제 문구의 모호함도 섞여 있다. 다른 하나는 `AGENTS.md`의 커밋 type 목록에 없는 `test`를 제안한 것이다. 이 목록은 Claude가 자동으로 읽는 문서에 있었으므로, 이 규칙의 근거는 주로 이 두 번째 감점이다.

## 직군 지식 (Skill)

역할 파일은 명세에 통째로 들어가므로 짧게 둔다. 길어지는 직군 지식(점검표, 설계 규칙, 도구 사용법)은 Agent Skill로 만들고 명세에는 Skill 이름만 적는다.

- [검증됨] Orca Worker가 새 Worktree에서 불러오는 Skill 위치:

  | Worker | 저장소 `.agents/skills/` | 저장소 `.claude/skills/` | Claude Plugin Skill |
  |---|---|---|---|
  | Claude | 못 읽음 | 읽음 | 읽음 |
  | Codex | 읽음 | 못 읽음 | 못 읽음 |
  | AGY | 읽음 | 못 읽음 | 못 읽음 |

- [검증됨] 세 Provider가 같이 쓰려면 원본을 `.agents/skills/<이름>/SKILL.md`에 두고 `.claude/skills/<이름>`을 `../../.agents/skills/<이름>`으로 가리키는 symlink로 둔다. Claude Worker가 symlink로 불러오는 것을 확인했다.
- [검증됨] Orca가 띄운 Codex는 사용자 폴더의 Codex Skill(`~/.codex/skills`)을 보지 못한다 (Orca 전용 `CODEX_HOME`을 쓴다). 사용자 폴더 설치에 기대지 않고 저장소에 둔다.
- [검증됨] 명세에 `쓸 Skill: <이름> (작업 전에 실행한다)` 한 줄을 넣으면 Claude Worker가 그 Skill을 실행했다.
- [권장] 효과는 작업마다 다르다. 넣기 전과 뒤를 같은 Task·역할 수용 기준으로 비교한다. 접근성 Skill로 도움말 대화상자를 만든 비교(Claude `haiku` 2:2)에서는 채점 10항목이 양쪽 모두 만점이라 차이가 없었다. 모델이 이미 아는 내용이면 Skill이 더하는 것이 없다. 프로젝트 고유 규칙이나 모델이 모르는 사내 지식부터 Skill로 만든다.
- Skill 추가는 저장소 파일을 늘리는 일이므로 사용자 승인을 받는다. 형식은 Agent Skills 규격(frontmatter는 `name`, `description`)을 따른다.

## 디자인 원칙

화면 결정의 기준은 프로젝트마다 다르다. Kit은 원칙 문서의 양식과 다루는 절차만 두고, 원칙 내용은 프로젝트가 정한다. 양식: [../templates/design/DESIGN-PRINCIPLES.md](../templates/design/DESIGN-PRINCIPLES.md).

- 위치: 프로젝트 디자인 정책 문서에 원칙 절이 있으면 그 문서다. 없으면 상태 폴더의 `.ai/DESIGN-PRINCIPLES.md`다 (개인 모드면 hub 안이므로 팀 저장소에 남지 않는다). 둘 다 없으면 원칙 문서가 없는 프로젝트다.
- 원칙은 "A를 B보다 우선한다" 문장 3~5개와 점검 질문으로 쓴다. 원칙(판단 기준), 규칙(예/아니오로 확인), 토큰(값의 위치)을 절로 나눈다.
- 원칙의 결정권은 사용자에게 있다. designer가 초안과 변경 제안을 쓰고 ([designer 참고](../roles/designer/reference.md)), 사용자가 승인한 원칙만 `accepted`가 된다. Worker는 원칙 문서를 직접 고치지 않는다.
- Coordinator는 designer·frontend 명세의 `## 작업`에 원칙 문서 경로를 적는다. 원칙 문서가 없고 화면 구조를 새로 정하는 Task면 designer 참고의 "디자인 원칙 초안 만들기" 절과 양식(`templates/design/DESIGN-PRINCIPLES.md`) 본문을 명세에 붙인다.
- designer는 결정마다 원칙 ID를 적고, frontend는 구현 뒤 원칙·규칙마다 점검 결과를 적는다. Coordinator는 수락할 때 이 두 가지를 확인한다.
- adopt는 원칙 문서를 찾아 designer·frontend 보강의 `## 작업 전 읽을 문서`와 `## 출처`에 넣는다. 원칙이 바뀌면 `adopt-check`가 `stale`로 알린다.
- [검증됨] 원칙 문서가 있을 때 (sample-app 최근 확인 기록, 모델이 흔히 어기는 원칙 3개·규칙 3개를 심음, designer → frontend 순서, 팀마다 `sonnet` 1, 채점자에게 팀을 알리지 않은 10점 채점): 기존 역할 9점, 원칙 줄을 더한 역할 10점. 두 팀 모두 명세에 원칙 문서 경로만 있어도 원칙을 지켰다 (한 줄 목록, 글자 상태, `.state`보다 작은 글자). 차이는 frontend의 원칙·규칙별 점검 보고 하나다. 기존 역할 팀은 기록 결과에 색 강조를 더해 P1에 덜 맞았다. 원칙 문서 경로를 명세에 넣는 것이 가장 큰 몫이다.
- [검증됨] 원칙 문서가 없을 때 (같은 화면에 설정 영역을 새로 설계, 팀마다 `sonnet` 1, 채점자에게 팀을 알리지 않은 10점 채점): 기존 역할 6점, 원칙 줄과 "원칙 초안 만들기" 절을 받은 역할 10점. 차이는 기존 화면 근거를 단 원칙 초안을 draft·질문으로 냈는지다. 기존 역할 팀은 원칙 초안이 없는 대신 대비 계산과 기존 문서 충돌 확인이 더 꼼꼼했다.

## 고르기

1. 하위 작업마다 주 역할 1개를 정한다. 산출물이 무엇인지로 고른다 (화면 코드 → `frontend`, 화면 설계 → `designer`).
2. 다른 관점이 꼭 필요하면 보조 역할을 더한다. 보조 역할은 `관점`과 `수용 기준`만 쓰고, 파일 소유 범위는 주 역할을 따른다. 보조 역할의 수용 기준 중 그 역할의 산출물(예: designer의 설계 문서)이 있어야 하는 항목은 `해당 없음`과 이유를 적는다.
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
<roles/<주 역할>/reference.md 중 이번 Task에 걸리는 절, 있으면>
<보조 역할의 관점과 수용 기준, 있으면>
쓸 Skill: <이름> (작업 전에 실행한다), 있으면

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

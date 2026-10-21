# roles

직군 원본. 스택과 무관하다. `crew`가 일을 맡길 때 `역할: roles/<직군>.md` 경로로 넘기고, `scripts/build.sh`가 같은 파일로 Claude 서브에이전트 `agents/<직군>.md`를 만든다(손으로 고치지 않는다).

| 직군 | 종류 | 하는 일 |
|---|---|---|
| frontend | build | 화면·컴포넌트 구현 |
| backend | build | API·데이터·서버 구현 |
| qa | build | 테스트 설계·작성·실행 (제품 코드는 안 고침) |
| designer | review | 화면 흐름·구성·접근성 설계와 리뷰 (코드 안 고침) |
| reviewer | review | 코드·명세 리뷰 (읽기 전용) |
| security | review | 보안 관점 리뷰 (읽기 전용) |

형식:

```markdown
---
name: backend
description: 한 줄. 생성되는 서브에이전트의 description이 된다
kind: build | review        review면 읽기 전용 도구만
model: inherit | opus | sonnet | haiku
---
# backend: 백엔드 개발자
## 관점 / ## 산출물 / ## 수용 기준 / ## 하지 않는 것 / ## 리뷰에서 보는 것
```

- 본문은 받는 쪽이 빈 기억으로 읽는다고 생각하고 쓴다. 다른 파일을 가리킬 때는 "브리핑에 적힌 경로"로.
- `<역할>/reference.md`는 특정 상황에서만 붙이는 절차. 브리핑에 `참고:`로 넘긴다.
- 스택별 규칙(React, Python …)은 여기 쓰지 않고 `stacks/`에 둔다.
- `review-format.md`는 리뷰 산출 형식. review 역할과 `/check`가 같이 쓴다.

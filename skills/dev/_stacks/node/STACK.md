# node

Node.js·TypeScript 서버 코드를 쓰거나 리뷰할 때 읽는다(React 화면은 `react` 스택). 읽는 순서: `team.md`(있으면 우선) → 아래 기준 → 걸리는 주제의 파일만.

| 주제 | 읽을 것 |
|---|---|
| 서버 구조, 미들웨어, 오류 처리, graceful shutdown | `vendor/nodejs-backend-patterns.md` |
| 조건부·매핑 타입, 제네릭, 타입 좁히기 | `vendor/typescript-advanced-types.md` |

(wshobson/agents의 Skill. `references/`는 가져오지 않았다.)

## 기준

| 영역 | 규칙 |
|---|---|
| 버전·패키지 매니저 | 레포의 `.nvmrc`·`engines`·lockfile을 따른다. lockfile이 `pnpm-lock.yaml`이면 `pnpm`, `yarn.lock`이면 `yarn`, 아니면 `npm`. 섞지 않는다 |
| TypeScript | `strict: true` 전제. `any` 금지(어쩔 수 없으면 `unknown` + 좁히기). 공개 함수는 반환 타입 명시. `as` 캐스팅은 경계에서만 |
| 모듈 | 레포가 ESM이면 ESM(`import`), CJS면 CJS. 섞지 않는다. barrel(`index.ts`) 재export 남발 금지 |
| 입력 검증 | 경계(HTTP·큐·환경변수)는 스키마(`zod` 등 레포에 있는 것)로 검증. 검증 안 된 값을 안쪽으로 넘기지 않는다 |
| 오류 | 오류는 `Error` 하위 클래스로, 메시지에 맥락. `catch`에서 삼키지 않는다. 비동기는 `await`로 받고 unhandled rejection을 남기지 않는다. 경계에서 상태 코드·응답 형태로 바꾼다 |
| 비동기 | 서로 독립인 await는 `Promise.all`. 콜백·이벤트 리스너 누수 주의(해제 코드 짝) |
| 설정 | 환경변수는 한 곳에서 읽어 타입을 붙인다. 비밀값 하드코딩 금지, 로그에 남기지 않는다 |
| 테스트 | 레포의 러너(`vitest`·`jest`). 파일 `*.test.ts`를 대상 옆이나 `tests/`에(레포 관례). 외부 I/O만 mock. 시계·난수는 주입 |
| 로깅 | 레포의 logger(`pino` 등). `console.log` 금지(CLI 제외) |
| 검사 명령 | `team.md`에 적힌 것. 없으면 `package.json`의 `lint`·`typecheck`·`test` 스크립트 |

## 리뷰할 때

경계에서 검증 없이 들어오는 값, 삼켜진 오류, `any`, 해제 안 되는 리스너·타이머, 순차 await를 본다.

# node 팀 규칙

범용 기본값이다. 팀이 바꾸면 바뀐 줄이 이긴다. 레포의 `tsconfig`·lint 설정·`AGENTS.md`가 이 파일보다 우선한다. 한 줄씩, 예/아니오로 확인할 수 있게.

## 버전·도구
- Node 버전은 `.nvmrc`·`package.json#engines`를 따른다. 없으면 현재 LTS.
- 패키지 매니저는 lockfile로 정한다(`pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `package-lock.json`→npm). lockfile을 바꾸지 않는다.
- TypeScript `strict: true`. 모듈 방식(ESM/CJS)은 레포 설정을 따르고 섞지 않는다.

## 폴더 구조
- `src/` 아래 도메인(기능) 단위 폴더. 그 안에 `routes`(또는 `controllers`)·`services`·`repositories`(저장)·`schemas`.
- 진입점(`src/main.ts`·`src/server.ts`)은 조립만. 업무 규칙은 서비스에.
- 테스트는 대상 옆 `<이름>.test.ts`.

## 이름 짓기
- 파일 kebab-case, 클래스·타입 PascalCase, 함수·변수 camelCase, 상수 UPPER_SNAKE.
- named export 기본. default export는 프레임워크가 요구할 때만.

## 타입·데이터
- `any` 금지. 모르는 값은 `unknown`으로 받고 좁힌다. `as` 캐스팅은 경계에서만, 이유 주석.
- 외부 입력(HTTP 본문·쿼리·환경변수·큐 메시지)은 스키마(`zod` 등 레포에 있는 것)로 검증한 뒤에만 안쪽으로 넘긴다.
- 환경변수는 한 파일(`config.ts`)에서 읽어 타입을 붙인다. `process.env`를 여기저기서 읽지 않는다.

## 오류
- `Error` 하위 클래스(`NotFoundError`·`ValidationError` 등)로 던진다. 메시지에 맥락.
- `catch`에서 삼키지 않는다. 다시 던지거나, 경계에서 상태 코드·응답으로 바꾼다.
- 모든 Promise는 `await`하거나 `.catch`를 단다. unhandled rejection 핸들러에만 기대지 않는다.

## 비동기
- 서로 독립인 await는 `Promise.all`. 반복문 안 순차 await는 의도가 있을 때만(주석).
- 타이머·리스너·스트림은 해제 코드를 짝으로 둔다. 종료 시 graceful shutdown.

## 테스트
- 레포의 러너(`vitest`·`jest`). 외부 I/O만 mock. 시계·난수는 주입.
- 새 동작마다 테스트 하나 이상. 버그 수정은 실패하는 테스트 먼저.

## 로깅·비밀값
- 레포의 logger(`pino` 등). `console.log`는 CLI 출력에만.
- 비밀값은 환경변수. 코드·로그·테스트에 넣지 않는다. 요청·응답 로그에 토큰·개인정보를 남기지 않는다.

## 금지
- `any`, `// @ts-ignore`(이유 없이), 동기 파일 I/O를 요청 처리 중에, `eval`, 새 의존성(몇 줄이면 직접 쓴다), barrel 재export 남발.

## 검사 명령
- `package.json`의 `lint`·`typecheck`·`test`. 전부 통과해야 끝난 것이다. 없는 스크립트는 "없음"으로 보고한다.

# react

React·Next.js 코드를 쓰거나 리뷰할 때 읽는다. 읽는 순서: `team.md`(있으면 이것이 우선) → 아래 목록 → 바꾸는 코드에 걸리는 규칙 파일만(`vendor/rules/<이름>.md`, 영향도·틀린 예·맞는 예·이유). 전부 읽지 않는다.

Next.js가 아닌 React면 `server-*`·`bundle-dynamic-imports`·`async-api-routes`는 건너뛴다.

## 규칙 (영향도 순, Vercel react-best-practices 중 고른 것)

| 영향 | 규칙 | 한 줄 |
|---|---|---|
| 치명 | `async-parallel` | 서로 독립인 await는 `Promise.all` |
| 치명 | `async-defer-await` | await는 실제로 쓰는 분기 안으로 |
| 치명 | `async-suspense-boundaries` | 느린 부분은 Suspense로 스트리밍 |
| 치명 | `async-api-routes` | API 라우트에서 promise는 먼저 시작, await는 늦게 |
| 치명 | `bundle-barrel-imports` | barrel(index) 말고 파일 직접 import |
| 치명 | `bundle-dynamic-imports` | 무거운 컴포넌트는 `next/dynamic` |
| 치명 | `bundle-defer-third-party` | 분석·로깅은 hydration 뒤에 |
| 높음 | `server-auth-actions` | 서버 액션도 API처럼 인증 |
| 높음 | `server-serialization` | 클라이언트 컴포넌트에 넘기는 데이터 최소화 |
| 높음 | `server-cache-react` | 요청 안 중복 호출은 `React.cache()` |
| 중상 | `client-swr-dedup` | 클라이언트 fetch는 SWR류로 중복 제거 |
| 중간 | `rerender-derived-state-no-effect` | 파생 상태를 effect로 만들지 않는다 |
| 중간 | `rerender-no-inline-components` | 렌더 안에서 컴포넌트를 정의하지 않는다 |
| 중간 | `rerender-memo` | 비싼 계산은 memo 컴포넌트로 분리 |
| 중간 | `rerender-move-effect-to-event` | 이벤트에 속한 로직은 effect가 아니라 핸들러에 |
| 중간 | `rendering-conditional-render` | `&&`로 0·빈 문자열이 렌더되지 않게 |
| 중간 | `rendering-hydration-no-flicker` | hydration 뒤 깜빡임 없게(서버·클라이언트 첫 렌더 일치) |

## 컴포넌트 구성

boolean prop이 늘거나 재사용 컴포넌트를 만들 때 `vendor/composition-patterns.md`(compound component, children 조합, 상태 올리기).

## 리뷰할 때

- 바뀐 컴포넌트마다 위 표에서 걸리는 규칙만 대조한다. 지적에는 규칙 이름을 적는다(`rerender-memo`).
- 성능 지적은 실제로 느려지는 경로(목록 크기, 호출 빈도)를 적는다. 추측이면 보류 목록에.

## 하지 않는 것

- 요청 밖 성능 최적화. 규칙은 "바꾸는 코드"에만 적용한다.
- `team.md`와 어긋나는 규칙 적용. 팀 규칙이 이긴다.

# react 팀 규칙

비어 있다. 팀이 채운다. 여기 적힌 것은 `STACK.md`와 외부 규칙보다 우선한다. 각 항목은 한 줄, 예/아니오로 확인할 수 있게.

## 상태 관리
- (예: 서버 상태는 TanStack Query, 클라이언트 전역은 zustand. Redux 추가 금지)

## 폴더 구조
- (예: `features/<기능>/` 아래 components·hooks·api. 공용은 `shared/`)

## 이름 짓기
- (예: 컴포넌트 PascalCase 파일명, 훅은 `use*`, 이벤트 핸들러 prop은 `on*`)

## 스타일
- (예: Tailwind만. 색·간격은 `tokens.css` 변수. 인라인 style 금지)

## 금지
- (예: `any`, `useEffect`로 데이터 fetch, barrel export)

## 검사 명령
- (예: `pnpm lint`, `pnpm typecheck`, `pnpm test`)

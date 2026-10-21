# react 팀 규칙

범용 기본값이다. 팀이 바꾸면 바뀐 줄이 이긴다. 레포에 lint·tsconfig·`AGENTS.md`가 있으면 그것이 이 파일보다 우선한다. 한 줄씩, 예/아니오로 확인할 수 있게 썼다.

## 상태 관리
- 서버에서 온 데이터는 서버 상태 라이브러리(TanStack Query·SWR 중 레포에 있는 것)로 관리한다. `useEffect`로 fetch해서 `useState`에 담지 않는다.
- 화면 안에서만 쓰는 상태는 그 컴포넌트에 둔다. 두 화면 이상이 같이 쓰는 상태만 전역(레포의 전역 상태 라이브러리)으로 올린다.
- URL이 표현할 수 있는 상태(필터, 페이지, 탭)는 URL에 둔다.
- 파생 값은 저장하지 않고 렌더 중 계산한다(비싸면 `useMemo`).

## 폴더 구조
- 기능 단위로 묶는다: `features/<기능>/` 아래 `components/`·`hooks/`·`api/`. 두 기능 이상이 쓰는 것만 `shared/`(또는 레포의 공용 폴더).
- 컴포넌트 파일 하나에 컴포넌트 하나. 파일명은 컴포넌트 이름과 같다.
- 테스트는 대상 옆 `<이름>.test.tsx`.

## 컴포넌트
- 함수 컴포넌트만. 클래스 컴포넌트를 새로 만들지 않는다.
- props는 명시적 타입(`interface <이름>Props`). `any` 금지.
- boolean prop이 셋을 넘으면 변형(`variant`)이나 조합(children)으로 바꾼다(`vendor/composition-patterns.md`).
- 렌더 안에서 컴포넌트를 정의하지 않는다. 목록 key는 안정된 id(배열 index 금지).

## 이름 짓기
- 컴포넌트 PascalCase, 훅 `use<이름>`, 이벤트 핸들러 prop `on<동작>`, 핸들러 함수 `handle<동작>`.
- 파일은 컴포넌트와 같은 PascalCase, 그 밖은 kebab-case 또는 레포 관례.

## 스타일
- 레포의 스타일 체계 하나만(Tailwind·CSS Modules·styled 중 있는 것). 섞지 않는다.
- 색·간격·글자 크기·둥글기는 토큰(CSS 변수 또는 테마 값)만. 임의 px·hex 금지.
- 인라인 `style`은 런타임 계산값(위치, 진행률)에만.

## 데이터·오류
- API 응답은 경계에서 타입을 붙인다(스키마 검증 라이브러리가 있으면 그것). 검증 안 된 값을 컴포넌트에 넘기지 않는다.
- 로딩·빈·오류 상태를 모든 데이터 화면에 둔다. 오류는 사용자가 할 수 있는 행동과 함께 보인다.
- 외부 입력을 `dangerouslySetInnerHTML`에 넣지 않는다.

## 접근성
- 클릭 가능한 것은 `button`·`a`(div에 onClick 금지). 아이콘 버튼에 `aria-label`. 폼 입력에 `label`.
- 포커스 순서는 읽는 순서. 모달은 포커스를 가두고 Esc로 닫힌다.

## 금지
- `any`, `// @ts-ignore`(이유 주석 없이), barrel `index.ts` 재export 남발, `useEffect`로 데이터 fetch, 배열 index key, 새 의존성 추가(몇 줄이면 직접 쓴다).

## 검사 명령
- `package.json`의 `lint`·`typecheck`·`test` 스크립트. 셋 다 통과해야 끝난 것이다. 없는 스크립트는 "없음"으로 보고한다.

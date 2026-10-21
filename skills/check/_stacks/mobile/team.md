# mobile 팀 규칙

범용 기본값이다. 팀이 바꾸면 바뀐 줄이 이긴다. 레포 설정이 이 파일보다 우선한다.

## 버전·도구
- Expo SDK·React Native 버전은 `package.json`을 따른다. 네이티브 모듈 추가는 사용자 승인 뒤에(빌드가 바뀐다).
- 패키지 매니저는 lockfile로 정한다. TypeScript strict.

## 구조
- 라우트는 레포의 라우터 폴더(`app/` 또는 `src/screens/`). 화면은 얇게, 로직은 훅·서비스로.
- 공용 컴포넌트는 `components/`, 디자인 토큰은 테마 파일 하나.

## 스타일
- 레포의 스타일 체계 하나(StyleSheet·NativeWind·styled). 색·간격은 토큰만.

## 금지
- `ScrollView` + `map`으로 긴 목록, JS 스레드 애니메이션(`Animated` + `useNativeDriver: false`), 안전 영역 하드코딩, `any`.

## 검사 명령
- `package.json`의 `lint`·`typecheck`·`test`. 네이티브 변경은 시뮬레이터에서 실제로 띄워 본다.

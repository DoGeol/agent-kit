# mobile (React Native · Expo)

React Native·Expo 앱 코드를 쓰거나 리뷰할 때 읽는다. 레포에 `react-native` 또는 `expo` 의존성이 있으면 react 대신 이 스택. 읽는 순서: `team.md`(있으면 우선) → 아래 기준 → 필요한 파일만.

| 상황 | 읽을 것 |
|---|---|
| 성능·구조 규칙 목록 (Vercel) | `vendor/react-native-skills.md` (규칙 본문 38개는 가져오지 않았다. 이름으로 판단하고 필요하면 원본 저장소) |
| 네이티브답게: 제스처, 시트, 햅틱, 플랫폼 관례 | `vendor/mobile-native.md` |
| 모션 (Reanimated·Expo) | `vendor/animate-expo.md` + `vendor/animate-expo-recipes.md` |
| iOS 느낌의 근거 | `../animation/vendor/apple-design.md` (animation 스택) |

## 기준

| 영역 | 규칙 |
|---|---|
| 플랫폼 관례 | iOS·Android 각각의 뒤로 가기, 시트, 알림 위치를 따른다. 한쪽 UI를 다른 쪽에 강요하지 않는다 |
| 목록 | 긴 목록은 가상화(`FlatList`·`FlashList`). `ScrollView` + `map` 금지. `keyExtractor`는 안정된 id |
| 터치 | 대상 44×44pt 이상. 눌림 피드백 100ms 안에(`Pressable` 상태). 햅틱은 확정·오류·경계에만 |
| 제스처 | 스와이프·드래그는 중단·되돌리기 가능. 시스템 제스처(뒤로 스와이프, 홈)와 충돌하지 않게 |
| 모션 | UI 스레드에서(Reanimated worklet). JS 스레드 애니메이션 금지. 수치는 animation 스택 기준 |
| 키보드 | 입력이 키보드에 가리지 않게(`KeyboardAvoidingView` 또는 레포 방식). 완료 버튼은 키보드 위 |
| 안전 영역 | 노치·홈 바를 `SafeAreaView`·insets로. 하드코딩 패딩 금지 |
| 상태 | 오프라인·느린 네트워크 상태를 설계한다. 낙관적 갱신 + 실패 되돌리기 |
| 이미지 | 크기 지정, 캐시 라이브러리(`expo-image` 등), 원격 이미지는 placeholder |
| 접근성 | `accessibilityLabel`·`accessibilityRole`. 동적 글자 크기에서 깨지지 않게 |
| 내비게이션 | 레포의 라우터(Expo Router·React Navigation). 딥링크 가능한 화면은 URL 매핑 |
| 검사 명령 | `team.md`에 적힌 것. 없으면 `package.json`의 `lint`·`typecheck`·`test` |

## 리뷰할 때

가상화 안 된 긴 목록, JS 스레드 애니메이션, 안전 영역 하드코딩, 키보드에 가리는 입력, 오프라인 미처리를 본다.

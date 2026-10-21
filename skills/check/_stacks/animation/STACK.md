# animation

UI에 모션을 넣거나 리뷰할 때 읽는다. 읽는 순서: `team.md`(있으면 우선) → 아래 기준 → 필요한 파일만. 기준은 Emil Kowalski의 `animate`에서 가져왔다.

| 상황 | 읽을 것 |
|---|---|
| 새로 만들 때 | `vendor/animate.md` (결정 순서 전체) + 패턴은 `vendor/animate-recipes.md` |
| "여기 뭘 움직이면 좋을까" (읽기 전용, 수치까지 제안) | `vendor/find-animation-opportunities.md` |
| 페이지·라우트 전환 (View Transition API) | `vendor/react-view-transitions.md` |
| 네이티브 앱 느낌 (스프링, 제스처, 시트, 반투명 재질) | `vendor/apple-design.md` |
| 프레임이 떨어질 때 | `vendor/animation-performance.md` |
| 리뷰할 때 | `vendor/review-animations.md` |

## 기준

| 규칙 | 값 |
|---|---|
| 넣을지 먼저 | 하루 100회 이상 쓰는 동작(단축키, 명령 팔레트)은 **애니메이션 없음**. 수십 회는 거의 안 보일 만큼만. 모달·드로어·토스트는 보통. 온보딩·성공 같은 드문 순간에만 공들인다 |
| 목적 | 피드백 / 공간 일관성 / 상태 표시 / 급격한 변화 완화 / 설명 중 하나를 말할 수 있어야 한다 |
| 도구 | CSS transition → CSS animation → Web Animations API → JS 라이브러리 순. 정해진 모션은 CSS, 제스처·중단 가능한 건 JS |
| 속성 | `transform`·`opacity`만(`clip-path`는 예외). `width`·`height`·`top`·`left`·`margin`은 쓰지 않는다 |
| 시작 모양 | `scale(0)` 금지. `scale(0.95)` + `opacity: 0`에서 |
| 기준점 | 팝오버·드롭다운·툴팁은 트리거 쪽에 `transform-origin`. 모달은 가운데 |
| 곡선 | UI에 `ease-in` 금지. 들어오고 나가는 건 `ease-out`. 공들인 것은 `cubic-bezier(0.23, 1, 0.32, 1)` |
| 길이 | 버튼 100–160ms, 툴팁 125–200ms, 드롭다운 150–250ms, 모달·드로어 200–500ms. UI는 300ms 이하 |
| 스프링 | 드래그·관성·중단·되돌리기가 있는 제스처에만 |
| 페이지 전환 | 같은 요소가 두 화면에 있을 때만 공유 전환. 전환 중 입력을 막지 않는다. 뒤로 가기는 역방향 |
| 모션 줄이기 | `prefers-reduced-motion: reduce`면 transform 기반 이동은 빼고 opacity·색만 |
| 터치 | hover 효과는 터치에서 잘못 켜진다. `@media (hover: hover)` 안에 |
| 토큰 | 레포에 easing·duration 토큰이 있으면 그걸 쓴다. 새로 만들지 않는다 |
| Motion 라이브러리 | `x`·`y`·`scale` 축약 대신 `transform` 문자열 전체(하드웨어 가속) |

## 리뷰할 때

지적마다 위 표의 규칙 이름과 실제 값(예: "`ease-in` 320ms → `ease-out` 200ms")을 적는다. `vendor/review-animations.md`의 형식.

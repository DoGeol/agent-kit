# qa 참고: 도구별 절차

[← qa 역할](../qa.md). Coordinator가 Task에 걸리는 절만 골라 명세의 역할 절 뒤에 붙인다.

## Playwright e2e와 화면 비교
- 회귀 판정은 Playwright Test 코드(`*.spec.*`)로 남기고 셸에서 headless로 실행한다. 판정을 눈대중이나 일회성 스크린샷에 맡기지 않는다.
- 화면 비교는 요소 단위(`expect(locator).toHaveScreenshot()`)로 하고, 시각·임의 값처럼 매번 바뀌는 영역은 `mask`로 가린다.
- 조건을 기다린다(`toHaveText`, `toHaveAttribute` 같은 web-first assertion). 고정 sleep을 쓰지 않는다.
- 기준 이미지는 Worker가 갱신하지 않는다. 바뀌어야 하면 실패 출력과 `test-results/`의 diff 이미지 경로를 붙여 결정 요청을 보낸다.
- 단위 시험(Vitest)은 바뀐 함수에만 더한다.

## 화면 탐색과 일회성 확인
- 에이전트가 화면을 둘러보거나 한 번 확인할 때는 Playwright CLI(`@playwright/cli`)나 Orca 내장 브라우저를 쓴다. 회귀 판정에는 쓰지 않는다.
- 픽셀 차이 수치는 도구로 얻고(Orca 브라우저 `diff screenshot --baseline`), 원인은 차이 이미지만 보고 말하지 않는다. 기준 이미지와 현재 화면을 함께 보거나 요소 위치로 확인한다.
- 기준 이미지는 도구마다 따로 둔다. 브라우저, 테마, 화면 배율, 창 크기가 다르면 비교할 수 없다.

## Electron 앱
- Playwright의 Electron 지원(`_electron`, 실험 기능)으로 앱을 띄우고 웹페이지와 같은 방식으로 시험한다. OS 대화상자는 main process에서 가짜 값을 돌려주게 바꿔 흐름을 잇는다.

## computer use를 쓰는 경우
- 웹 기술이 아닌 앱, OS 수준 화면(메뉴 막대, 트레이, 실제 파일 선택기, 권한 창), 사용자 실제 브라우저 환경(로그인, 확장 프로그램)을 확인할 때만 쓴다.
- 결과는 증거(스크린샷)로 첨부하는 데까지만 쓰고 회귀 판정에는 쓰지 않는다. `unverified` 결과는 실패로 본다.
- 샌드박스 안에서는 Orca 연결이 막히므로 Coordinator가 승인을 받고 샌드박스 밖에서 실행한다.

## 시험 파일 검수 (별도 Task)
- 기능 QA와 섞지 않는다. 시험 전체가 통과한 상태에서만 한다.
- 산출물은 제안 목록이다: 중복, 더 이상 쓰지 않는 기능의 시험, 느린 시험, 겹치는 시험. 항목마다 근거(파일:줄, 실행 시간)를 적는다. 지우거나 합치는 변경은 Coordinator 승인 뒤에 한다.
- [권장] 시험 파일 수나 e2e 실행 시간이 프로젝트 Override 기준을 넘을 때, 또는 PR 직전 planner 단계에서 한다.

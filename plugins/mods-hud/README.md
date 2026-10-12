# mods-hud

Claude Code 입력창 위에 뜨는 현황판(HUD). 터미널과 데스크탑 앱 모두 지원.

```
● 진행 중  오케스트레이션 뷰 병합 중           ⎇ main · Opus 5.5(high)
  ▾ 서브에이전트 2  진행 중 1 · 완료 1
    ⎿ ● 진행 중  Explore  라이선스 파일 세는 중   01:04  Sonnet 5.5(low)  ■
    ⎿ ✓ 완료    Plan     수정안 3개 제시          00:40  Opus 5.5(high)   ✕
  ▸ 오케스트레이션 1  대기 1
Opus 5.5 high · 5h 16%(18:10) · w 81%(10/14 12:00) · ctx 58%
```

## 보이는 것

- **세션 줄**: 상태(대기 / 진행 중 / 완료 / 중지), 턴 한 줄 요약, 브랜치, 모델(effort). 워크트리면 `⎇ feat (워크트리)`.
- **서브에이전트**: 상태, 한국어 요약, 최근 단계, 경과 시간, 모델. ■ 중지(두 번), ↻ 재개, ✕ 닫기. 2개 이상이면 한 줄로 접힌다.
- **오케스트레이션**: 메시지를 주고받은 다른 세션의 상태와 마지막 메시지(↑ 보냄 / ↓ 받음).
- **사용량**: 5시간·주간 한도, 컨텍스트 %. 터미널은 네이티브 `statusLine`으로 권한 모드 표시 위에, 데스크탑은 입력창 아래 바에 표시.

## 명령

| 명령 | 동작 |
|---|---|
| `/mods-hud` | 요약 줄 지금 갱신 |
| `/mods-hud usage` | 사용량 상세와 이 mod가 쓴 토큰 |
| `/mods-hud pane` | 현황판을 패널로 보기 |
| `/mods-hud agents off` / `on` | 서브에이전트 한국어 요약 끄기 / 켜기 |
| `/mods-hud debug` | 진단: 그리는 화면, 입력 출처, 마지막으로 그린 시각 |

## 비용

한국어 요약만 Haiku(effort low)를 쓴다. 요청, 최근 단계, 답변 앞부분만 보낸다. 누적은 `/mods-hud usage`.

## 제약

- 데스크탑 앱에서 Remote Control로 연 세션에는 현황판이 안 뜬다. 앱이 그려 달라고 요청하지 않는다. ([014](../../docs/issues/014-remote-control-no-band.md))
- 분할 화면에서는 맨 왼쪽 칸에만 뜬다. ([015](../../docs/issues/015-split-view-right-pane.md))
- 데스크탑 세션은 `/reload-plugins`로 반영되지 않는다. 업데이트 후 새 세션을 연다. ([016](../../docs/issues/016-desktop-reload-keeps-old-module.md))

전체 목록: [docs/issues](../../docs/issues/README.md)

## 터미널 사용량 줄

`scripts/statusline.py`는 Claude Code가 stdin으로 전달하는 JSON에서 모델, effort,
5시간·주간 사용량, 컨텍스트를 출력한다. Python 3가 필요하며 API 요청은 하지 않는다.
아직 전달되지 않은 사용량은 생략하고, 폭이 좁으면 리셋 시간을 생략한다.

스크립트를 로컬에 복사하고 Claude Code 설정의 `statusLine.command`에
`python3 /path/to/statusline.py`를 지정한다 (`type: "command"`).
이 설정은 Mods 설치와 별도로 필요하다. 기존 statusLine 명령이 있다면
스크립트 옆의 `previous-statusline.json`에 기존 statusLine 객체를 저장하면
같은 stdin으로 기존 명령도 실행하고 그 출력을 이어서 표시한다.
개인 경로와 기존 명령은 저장소에 넣지 않는다.

터미널의 `SessionMode`는 기본 표시를 그대로 사용한다. `statusLine`은
`bypass permissions on` 같은 기본 푸터 배지 위에 표시된다.

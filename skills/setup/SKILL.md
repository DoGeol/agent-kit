---
name: setup
description: 사용자가 "/setup"을 직접 입력했을 때만 돈다. kit이 같이 쓰는 외부 Skill(caveman, ponytail, im-not-ai)이 이 컴퓨터의 각 도구(Claude Code, Codex, Antigravity)에 설치돼 있는지 표로 보이고, 없는 것은 설치 명령을 알려 준다. 설치는 하지 않는다.
argument-hint: "(인자 없음)"
---

# /setup

1. 셸에서 이 Skill 폴더의 `check.sh`를 실행한다. 출력 표를 그대로 보인다.
2. "없음"인 것마다 출력에 딸린 설치 명령을 보인다. 실행하지 않는다. 사용자가 한다.
3. 설치된 것 중 ponytail·caveman은 자기 훅이 매 세션 켜질 수 있다고 알리고, 출력의 "기본 끔" 줄을 보인다. kit의 `/dev`가 필요할 때만 켠다.
4. 끝에 한 줄: "없어도 `/dev`·`/spec`·`/write`는 돕니다. 그 부분만 빠집니다."

설치 명령이 바뀌었을 수 있다. 사용자가 실패를 알리면 각 저장소 README를 보라고 안내한다.

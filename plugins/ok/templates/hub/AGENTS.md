# ok hub

이 폴더는 ok(orchestration kit)의 hub다. 여러 레포의 일을 여기서 맡기고, 작업 기록은 `projects/<id>/`에 남는다.

- 이 폴더에서 연 세션은 **접수 세션**이다. 일은 `/ok:start <프로젝트 id> plan|quick <요청>`으로 맡긴다. 접수 세션은 레포 코드를 설계·구현하지 않는다.
- 현황은 `/ok:status`로 본다.
- ok 명령(`/ok:*`)은 사용자가 메시지 맨 앞에 직접 칠 때만 돈다. 요청이 맞아 보여도 모델이 Orca Run·Worker나 ok Subagent를 시작하지 않고, ok의 `SKILL.md`나 정책 파일을 직접 읽어 따라 하지 않는다. 필요하면 어떤 명령을 치면 되는지 한 줄로 답한다.
- 등록 프로젝트는 `hub.json`, 프로젝트별 기록 형식은 ok Plugin의 `policies/README.md`에 있다.
- `projects/<id>/`는 그 프로젝트의 Coordinator 세션이 쓴다. 접수 세션은 읽기만 한다(예외: `/ok:issue-review`가 사용자 동의를 받아 `ISSUES.md`와 `planned` 작업 파일을 만든다).

# hooks

Claude Code는 플러그인 루트의 `hooks.json`을 설치 즉시 읽고, Codex는 `.codex-plugin/plugin.json`의 `hooks`로 같은 파일을 읽는다(`/hooks`에서 신뢰해야 돈다). AGY는 설치할 때 루트 `hooks.json`으로 옮기고 그 폴더에서 명령을 돌린다(`${CLAUDE_PLUGIN_ROOT:-.}`). `UserPromptSubmit`이 없어 `plain.sh`·`crew_mark.py`는 돌지 않고, 가드가 대화 기록(`transcriptPath`)에서 사용자가 친 마지막 kit 명령을 직접 읽는다. 가드는 Claude Code의 `Agent`와 AGY의 `invoke_subagent`에 걸린다. Codex에는 kit 서브에이전트가 없어 걸릴 일이 없다. `hooks.json`이 바뀌면 Codex는 `/hooks`에서 다시 신뢰를 묻는다.

| 파일 | 하는 일 |
|---|---|
| `hooks.json` | `UserPromptSubmit`에 `plain.sh`·`crew_mark.py`, `PreToolUse`(`Agent\|Task\|invoke_subagent`)에 `agent-guard.sh` 등록 |
| `crew_mark.py` | 항상 켜짐. 사용자가 친 프롬프트가 `crew build\|check\|plan`, `/crew`, `/kit:crew`, `$crew`로 시작하면 그 세션과 명령에 적힌 직군을 `${XDG_STATE_HOME:-~/.local/state}/agent-kit/crew/<session_id>`에 기록한다(직군을 안 적었으면 빈 목록). 다른 kit 명령(`/dev`, `$spec`, `/kit:check` 등)이 오면 지운다. 카드 답, "계속", 백그라운드 알림은 그대로 둔다. 하루 지난 기록은 지운다. 슬래시 없이 친 `crew build …`는 모델이 crew Skill로 받지 않을 때가 있어, 그때만 "kit의 crew Skill을 불러 진행한다" 한 줄을 넣는다 |
| `agent-guard.sh` | `agent-guard.py`를 돌린다. python3가 없으면 kit 직군 호출만 막고(Claude는 exit 2, AGY는 `{"decision":"deny"}`) 나머지는 통과시킨다 |
| `agent-guard.py` | kit 직군 서브에이전트 호출(Claude `kit:<직군>`, AGY `TypeName: <직군>`)을 다음이 모두 맞을 때만 통과시킨다. 이 세션에 crew 기록이 있고(AGY는 대화 기록의 마지막 kit 명령이 crew이고), 명령에 적힌 직군이다(안 적었으면 어느 직군이든). 브리핑 첫 줄이 `kit-brief: <직군>`이다. `산출:`이 레포 `.kit/<slug>/` 안이다(상대 경로는 세션 폴더 기준). 그 폴더의 `brief-<직군>.md`(동시에 둘이면 `brief-<직군>-<번호>.md`)가 crew 명령 뒤에 저장됐고 브리핑이 그 내용으로 시작한다. 입력을 못 읽어도 kit 호출이면 막는다. 모델이 혼자 kit 서브에이전트를 부르거나, 표지를 지어내거나, 예전 crew가 남긴 brief를 다시 쓰는 것을 막는다(글로 된 가드는 2026-10-22 시험에서 뚫렸다) |
| `plain.sh` | `~/.config/agent-kit/hooks`(또는 `$XDG_CONFIG_HOME/agent-kit/hooks`)에 `plain=on`이 있을 때만, 프롬프트가 `/dev`·`/kit:dev`·`$dev`로 시작하지 않으면 "같은 /dev 작업이 이어지는 중이 아니면 일반 문장으로" 한 줄을 출력한다. 그 밖에는 아무것도 출력하지 않는다 |

설정 파일이 없으면 사실상 꺼져 있다. 켜기:

```bash
mkdir -p ~/.config/agent-kit && echo plain=on >> ~/.config/agent-kit/hooks
```

확인(셸):

```bash
echo '{"prompt":"안녕"}' | sh hooks/plain.sh          # 꺼짐: 출력 없음
echo '{"prompt":"안녕"}' | XDG_CONFIG_HOME=/tmp/x sh hooks/plain.sh   # /tmp/x/agent-kit/hooks에 plain=on이면 한 줄
```

남은 위험: 사용자가 crew를 친 세션 안에서, 그 명령에 적힌 직군(직군을 안 적었으면 모든 직군)이면 모델이 brief를 직접 새로 쓰고 불러도 통과한다. 진행자 자체가 모델이라 정상 동작과 구분할 수 없다. 명령에 직군을 적으면 범위가 그 직군으로 줄어든다.

가드 확인(셸): `scripts/check.sh`가 허용·거부 경우를 시험한다.

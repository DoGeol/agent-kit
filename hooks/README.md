# hooks

Claude Code는 플러그인 루트의 `hooks.json`을 설치 즉시 읽고, Codex는 `.codex-plugin/plugin.json`의 `hooks`로 같은 파일을 읽는다(`/hooks`에서 신뢰해야 돈다). AGY는 설치할 때 루트 `hooks.json`으로 옮기지만 `UserPromptSubmit`이 없어 `plain.sh`는 돌지 않는다. `agent-guard.py`는 Claude Code의 서브에이전트 도구(`Agent`)에만 걸린다.

| 파일 | 하는 일 |
|---|---|
| `hooks.json` | `UserPromptSubmit`에 `plain.sh`, `PreToolUse`(`Agent`)에 `agent-guard.py` 등록 |
| `agent-guard.py` | 항상 켜짐. `kit:<직군>` 서브에이전트 호출을 브리핑 첫 줄 `kit-brief: <직군>`, `산출:`이 레포 `.kit/<slug>/` 안, 그 폴더의 `brief-<직군>.md`로 브리핑이 시작할 때만 통과시키고 나머지는 막는다. crew가 띄우기 전에 그 파일을 저장한다. 모델이 혼자 kit 서브에이전트를 부르거나 표지를 지어내는 것을 막는다(글로 된 가드는 2026-10-22 시험에서 뚫렸다). python3가 필요하다 |
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

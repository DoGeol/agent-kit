# hooks

선택 훅. Claude Code는 플러그인 루트의 `hooks.json`을 설치 즉시 읽고, Codex는 `.codex-plugin/plugin.json`의 `hooks`로 같은 파일을 읽는다(`/hooks`에서 신뢰해야 돈다). AGY는 훅이 없다.

| 파일 | 하는 일 |
|---|---|
| `hooks.json` | `UserPromptSubmit`에 `plain.sh` 등록 |
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

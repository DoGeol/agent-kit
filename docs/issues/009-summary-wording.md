# 009. The wording of Korean summaries drifts

- **State:** prompt-mitigated, output filtered (0.4.1)
- **Where:** `ASK`, `AGENT_*_ASK`, `SESSION_ASK`

## Seen
- An instruction echoed back ("…질문 형태로: 터미…").
- Sentence-style endings ("…3개입니다").
- Running wording on a finished turn ("…실행 중", "…대기 중").
- An apology for missing information ("주어진 정보가 부족합니다").

## Done
- Each prompt now says to end in noun form or as a result, and not to repeat the instructions.
- The final answer from `turn.complete` goes in directly.
- Empty sections are left out.

- `summaryLine` drops a line that echoes the instructions, apologizes or says information is missing, or ends as a sentence (…니다, …어요). For a finished subagent it also drops running wording (…중). The last line then stays.
- A dropped answer still counts as a subagent's check-in, so a model that keeps drifting is asked at most once per 2-minute gap.
- Tool calls queued within one gap ask for one check-in, not one each.

## Remaining issue
- A dropped line is not retried, to keep the token cost flat.
- The turn summary keeps "…중", since background agents may still be at work when it is written.

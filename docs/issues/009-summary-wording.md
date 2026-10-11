# 009. The wording of Korean summaries drifts

- **State:** prompt-mitigated
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

## Remaining issue
The model may still drift now and then. If it does, consider filtering the output (reject an instruction echo, retry).

# 010. Usage (5h/weekly) only updates when this session gets a response

- **State:** a limit of the engine
- **Where:** usage line, desktop footer

## What it is
- The rate-limit figures come only with this session's own API responses (`session.measure`). What other sessions spend shows up only after this session's next response.
- After 5 minutes without a response, the figures turn gray and get a `· HH:MM 기준` label (`· 이전 값` before any response).
- Once a reset time passes, the window reads 0%.

## Alternatives
- Calling the usage API directly would mean handling the login token, so it was not done.
- A small periodic request would itself spend usage, so it was not done.

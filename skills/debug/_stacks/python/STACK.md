# python

Python 코드를 쓰거나 리뷰할 때 읽는다. 읽는 순서: `team.md`(있으면 우선) → 아래 기준 → 걸리는 주제의 파일만.

| 주제 | 읽을 것 |
|---|---|
| 타입 힌트, Protocol, TypedDict, 제네릭 | `vendor/python-type-safety.md` |
| pytest, fixture, parametrize, mock | `vendor/python-testing-patterns.md` |
| 예외 설계, 재시도, 컨텍스트 매니저 | `vendor/python-error-handling.md` |
| 의존성·가상환경·스크립트 (`uv`) | `vendor/uv-package-manager.md` |

(wshobson/agents의 Skill. 각 파일이 가리키는 `references/`는 가져오지 않았다. 없다고 나오면 무시한다.)

## 기준

| 영역 | 규칙 |
|---|---|
| 버전 | 레포의 `pyproject.toml`·`.python-version`을 따른다. 없으면 3.11 이상 문법만 |
| 의존성 | `uv`가 있으면 `uv add`·`uv run`. `pip install` 직접 금지. `pyproject.toml`에 적히지 않은 패키지 import 금지 |
| 타입 | 공개 함수는 인자·반환 타입 전부. `Any` 금지(어쩔 수 없으면 주석으로 이유). `Optional`은 `X \| None`. 타입 검사 명령(`mypy`·`pyright`)이 레포에 있으면 통과 |
| 스타일 | `ruff`가 있으면 그 설정대로(`ruff check`·`ruff format`). 없으면 PEP 8. 줄 길이는 레포 설정 |
| 예외 | 구체적 예외만 잡는다. `except:`·`except Exception: pass` 금지. 경계(API·CLI)에서만 넓게 잡아 응답으로 바꾼다. 예외에 맥락(무엇을 하다, 어떤 값으로)을 담는다 |
| 데이터 | 입력 경계는 `pydantic` 또는 `dataclass`로 검증. dict를 그대로 돌리지 않는다 |
| 비동기 | `async` 함수 안에서 blocking I/O 금지. 한쪽으로 통일(동기면 동기) |
| 테스트 | `pytest`. 파일 `tests/test_<모듈>.py`, 함수 `test_<동작>_<조건>`. fixture는 `conftest.py`. mock은 경계(네트워크·시계·파일)만 |
| 리소스 | 파일·연결·락은 `with`. 전역 가변 상태 금지 |
| 로깅 | `logging` 모듈, 모듈별 logger. `print` 금지(CLI 출력 제외). 비밀값 로깅 금지 |
| 검사 명령 | `team.md`에 적힌 것. 없으면 `uv run pytest`, `uv run ruff check .`, `uv run mypy .` 중 레포에 있는 것 |

## 리뷰할 때

바뀐 함수의 호출자, 예외가 삼켜지는 곳, 타입이 `Any`로 새는 곳, 테스트 없는 분기를 본다. 지적에는 영역 이름을 적는다.

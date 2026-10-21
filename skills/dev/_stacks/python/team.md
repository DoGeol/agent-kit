# python 팀 규칙

범용 기본값이다. 팀이 바꾸면 바뀐 줄이 이긴다. 레포의 `pyproject.toml`·lint 설정·`AGENTS.md`가 이 파일보다 우선한다. 한 줄씩, 예/아니오로 확인할 수 있게.

## 버전·도구
- Python은 `pyproject.toml`의 `requires-python`을 따른다. 없으면 3.11 이상 문법만 쓴다.
- 패키지·가상환경은 `uv`(있으면). 없으면 레포가 쓰는 것(`poetry`·`pip-tools`). 새로 들여오지 않는다.
- 포맷·lint는 `ruff`(있으면). 타입 검사는 `mypy` 또는 `pyright` 중 레포에 있는 것.

## 폴더 구조
- 패키지는 `src/<패키지>/`(src 레이아웃). 테스트는 `tests/`에 같은 구조로 미러.
- 진입점(CLI·웹 앱)은 얇게. 업무 규칙은 패키지 안 모듈에.

## 이름 짓기
- 모듈·함수·변수 snake_case, 클래스 PascalCase, 상수 UPPER_SNAKE. 테스트 함수 `test_<동작>_<조건>`.
- 불리언은 `is_`·`has_`·`can_`으로 시작.

## 타입·데이터
- 공개 함수는 인자·반환 타입 전부. `Any` 금지(불가피하면 주석에 이유).
- 외부 입력(요청·파일·환경변수)은 `pydantic` 모델 또는 `dataclass`로 받는다. dict를 그대로 돌리지 않는다.
- 가변 기본 인자(`def f(x=[])`) 금지.

## 오류
- 구체적 예외만 잡는다. `except:`와 `except Exception: pass` 금지.
- 도메인 예외는 패키지의 기본 예외 클래스를 상속한다. 메시지에 무엇을 하다 어떤 값으로 실패했는지.
- 경계(API 핸들러·CLI main)에서만 넓게 잡아 응답·종료 코드로 바꾼다.

## 테스트
- `pytest`. 외부 I/O(네트워크·시계·파일·DB)만 mock. 내부 함수를 mock하지 않는다.
- 새 동작마다 테스트 하나 이상. 버그 수정은 실패하는 테스트를 먼저 쓴다.
- fixture는 `conftest.py`. `time.sleep` 금지.

## 로깅·비밀값
- `logging.getLogger(__name__)`. `print`는 CLI 출력에만.
- 비밀값은 환경변수. 코드·로그·테스트 픽스처에 넣지 않는다.

## 금지
- 전역 가변 상태, `import *`, `os.system`(`subprocess.run(..., check=True)` 사용), 순환 import, 새 의존성(몇 줄이면 직접 쓴다).

## 검사 명령
- `uv run pytest -q`, `uv run ruff check .`, `uv run ruff format --check .`, 타입 검사(`uv run mypy .` 또는 `uv run pyright`). `uv`가 없으면 같은 명령을 레포 방식으로. 전부 통과해야 끝난 것이다.

# python 팀 규칙

비어 있다. 팀이 채운다. `STACK.md`와 외부 규칙보다 우선한다. 한 줄씩, 예/아니오로 확인할 수 있게.

## 버전·도구
- (예: Python 3.12, uv, ruff, pyright strict)

## 프레임워크
- (예: FastAPI. 라우터는 `app/api/<도메인>.py`, 서비스는 `app/services/`)

## 폴더 구조
- (예: `src/<패키지>/`, 테스트는 `tests/` 미러)

## 이름 짓기
- (예: 모듈 snake_case, 클래스 PascalCase, 상수 UPPER)

## 금지
- (예: `requests` 대신 `httpx`, 전역 세션, `print`)

## 검사 명령
- (예: `uv run pytest -q`, `uv run ruff check .`, `uv run pyright`)

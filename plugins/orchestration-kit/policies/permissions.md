# 결정권과 안전 규칙

[← 공통 정책](README.md)

## 결정권

| 결정 | 권한자 | 조건 |
|---|---|---|
| 담당 Task 범위 안의 구현 세부 | Worker | 범위 밖이면 Project Coordinator |
| 프로젝트 내부 설계·통합·병합 | Project Coordinator | 공통 계약에 영향이 있으면 상향 |
| 프로젝트 간 일정·공통 API 계약·공유 스키마 | Portfolio Coordinator | 관련 Project의 영향 분석을 먼저 받는다 |
| 운영 배포, 데이터 삭제, 비용 발생, 권한 변경, 민감정보 접근 | 사용자 | 매번 명시적 승인 |

Coordinator 승인은 사용자 승인이 아니다. 고위험 실행은 Coordinator가 승인해도 사용자 승인이 따로 필요하다.

### Coordinator 승인이 필요한 변경

- 공통 API·DB 스키마·인증·보안 경계 변경
- 주요 기술 스택·아키텍처 변경
- 새 Worker·Worktree 배정 등 비용이 드는 병렬화
- 다른 Worker 담당 파일 편집 (소유권 이전)

Worker끼리 합의했어도 위 변경은 승인 전에 적용하지 않는다.

## 문서 수정 권한

| 문서 | 최종 수정 |
|---|---|
| `.ai/PROJECT.md`, `ARCHITECTURE.md`, `decisions/` | Project Coordinator |
| `.ai/STATUS.md`, `TASKS.md`, `reports/` | Project Coordinator |
| `portfolio/*`, `handoffs/*` | Portfolio Coordinator (한 번에 1개 세션만) |
| Worker 구현 메모 | 담당 Worker (자기 브랜치·메시지) |

Project는 Portfolio 파일을 쓰지 않는다. Portfolio는 Project 파일을 읽기만 한다.

## 안전 규칙

- 설치 ≠ 초기화 ≠ 실행. Plugin을 설치해도 Coordinator·Worker를 자동 실행하지 않는다.
- 기존 `CLAUDE.md`, `AGENTS.md`, `.ai/`, Git 변경사항을 덮어쓰거나 지우지 않는다. 없는 파일만 만든다.
- `CLAUDE.md`·`AGENTS.md`에는 진입점 문구를 **덧붙이기만** 한다. 사용자에게 문구를 보여주고 승인받은 뒤에만 한다.
- 프로젝트 등록과 Portfolio 연결은 사용자가 확인한 경우에만 한다.
- 비밀 키·토큰·고객 원문을 Markdown·보고서·메시지에 저장하지 않는다.
- 근거 없는 진행률(%)을 만들지 않는다.
- 라이브 서비스·실제 고객 데이터로 시험하지 않는다.
- 응답 없는 Worker를 일방적으로 다시 실행하지 않는다. 먼저 상태와 생존 증거를 확인한다.

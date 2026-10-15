# 실행 라우팅

[← 공통 정책](README.md)

두 가지를 따로 판단한다. **누가 실행하나**, 그리고 **어디서 실행하나**. [확정] 새 Session ≠ 새 Worktree.

| 상황 | 실행 주체 | Worktree |
|---|---|---|
| 간단한 설명, 작은 수정 | Direct (Coordinator 직접) | 현재 |
| 일회성 조사, 코드 탐색, 로그 분석, 짧은 리뷰 | Subagent | 현재 (읽기 전용) |
| 여러 단계 구현, 장시간 작업, 다른 모델, 동료와 직접 대화 | Independent Session | 수정하면 보통 새 Worktree |
| 다른 모델의 교차 검증 | Codex·AGY Session | 읽기 전용이면 현재 |
| 여러 Worker가 같은 저장소를 동시에 수정 | 각자 Session | 각자 Orca Worktree |
| 같은 파일을 두고 의견 충돌 | 작성자 1명 + 리뷰어 | 작성자 Worktree만 수정 |
| 여러 읽기 전용 세션 | Session | 같은 Worktree 가능 |
| 기존 Task의 관련 후속 구현 | 기존 Session 재사용 검토 | 기존 |
| 관련 없는 새 기능, 맥락이 과도하게 쌓인 세션 | 새 Session | 판단 |

판단 순서:

1. 작고 파일 범위가 좁으며 Coordinator 맥락으로 충분한가? → Direct.
2. 결과를 짧은 요약·리뷰로 받으면 되는가? → Subagent.
3. 그 밖에는 Independent Session. 다른 시각이나 전문성이 필요하면 Codex·AGY를 고려한다.
4. 그다음 따로: 동시에 충돌할 수 있는 코드 수정이 있으면 새 Worktree, 아니면 현재 Worktree.

## 병렬 실행 규칙

- [권장] 동시 Worker는 프로젝트당 최대 3개.
- Worker마다 파일 소유 범위를 정한다. lockfile·공유 타입처럼 공유 파일은 수정자를 한 명 지정한다.
- 공통 계약을 먼저 합의한 뒤 독립 작업으로 나눈다.
- 실패나 지연이 있어도 같은 편집 작업에 Worker를 중복 투입하지 않는다.
- 다른 Worktree의 결과는 자동 공유되지 않는다. 병합 시점과 승인자를 정한다.
- Portfolio에서 위임받은 업무도 실행 방식은 Project Coordinator가 정한다.
- Orca로 Worker를 감독할 때는 설치된 Orca 버전의 가이드를 먼저 읽는다 (`orca skills get orchestration --full`). 이 문서에 Orca 명령 문법을 고정하지 않는다.
- Worker를 시작하기 전에 같은 Task의 기존 Worker가 있는지 Orca에서 확인한다.

## 완료의 세 단계

| 단계 | 요건 | 기록 |
|---|---|---|
| Worker 완료 | 정확한 Task·Dispatch의 `worker_done`과 산출물 | Orca |
| Project 수락 | Diff·테스트·리뷰·통합 확인, 기술 문서 갱신 | `.ai/STATUS.md`, `TASKS.md`, 완료 보고 |
| Portfolio 종결 | 보고 수집, 상위 업무·후속 업무 정리 | `portfolio/TASKS.md`, `DASHBOARD.md` |

`worker_done`만 보고 완료로 처리하지 않는다. Project 수락 절차:

1. 결과가 정확한 Task·Dispatch와 연결되는지 확인한다.
2. Diff, 테스트 결과, 남은 이슈를 확보한다.
3. 다른 Worker의 계약과 충돌하지 않는지 검토한다.
4. 필요하면 추가 리뷰나 통합 테스트를 한다.
5. Coordinator가 병합을 결정하고 확정 문서를 갱신한다.

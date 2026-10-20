# planner 참고: spec 형식

[← planner 역할](../planner.md)

## spec 형식

```markdown
---
task: <slug>
security: false        # 인증·권한·외부 입력·비밀값·파일·외부 호출·되돌릴 수 없는 삭제가 걸리면 true
reviewers: [architect, frontend, qa]
reviewers_reason:
  architect: 모듈 경계가 바뀜
  frontend: 화면 추가
  qa: 항상 포함
skipped:
  backend: 서버·API 변경 없음
---
## 목표
## 범위
- 포함:
- 제외:
## 완료 조건
- [ ] <확인할 수 있는 문장>
## 기능
### F1 <이름>
- F1-1 <무엇> (층: 저장·API·화면·설정…)
- F1-2 <무엇> (층: …)
### F2 <이름>
## 검사 목록
<S는 testing.md의 QA 시트 형식으로 여기에 쓴다. M·L은 qa가 qa-sheet.md를 따로 쓰므로 완료 조건별 핵심 경우만>
## 화면 초안
## API 초안
<엔드포인트·요청·응답 타입, 해당될 때만>
## 열린 질문
- 이미 답이 있음 (근거 위치) / 빌더가 정해도 됨 / 사용자만 답할 수 있음 (추천안과 이유)
## 미정
- ? <brief에서 옮긴 질문>
```

- 리뷰어 후보: architect, frontend, backend, designer, qa, researcher, security, infra. `security: true`면 security, 배포·설정·마이그레이션·CI가 걸리면 infra를 넣는다. qa는 항상 넣는다(M은 3명 안에 포함). 판단이 서지 않으면 넣는다.
- 기능 수는 보통 1~4개. 작은 일은 기능 하나로 충분하다. "테스트"를 따로 서브태스크로 두지 않는다 (서브태스크마다 테스트를 먼저 쓴다).
- 구조를 새로 정해야 하면(새 저장 데이터, 프로젝트 간 계약) architect 설계 문서를 먼저 받고 그 결정을 따른다.

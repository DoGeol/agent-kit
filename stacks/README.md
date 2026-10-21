# stacks

스택 팩. 직군(`roles/`)에 붙여 쓴다. `/dev`·`/check`가 레포 파일로 스택을 판단해 읽고, `crew`가 브리핑 `스택:`에 경로로 넘긴다. Skill이 아니라 명령으로 뜨지 않는다.

```
stacks/<스택>/
├─ STACK.md     언제 읽나, 읽는 순서, 규칙 목록(영향도 순). 규칙 본문은 가리키기만
├─ team.md      팀 고유 규칙. 비어 있으면 팀이 채운다. STACK.md보다 우선
└─ vendor/      build.sh가 vendor/에서 복사한 외부 규칙 (고치지 않는다)
```

| 스택 | 무엇 | 외부 규칙 |
|---|---|---|
| react | React·Next.js 성능과 컴포넌트 구성 | Vercel react-best-practices 중 17개, composition-patterns |
| animation | UI 모션: 넣을지, 속성, 곡선, 길이, 성능 | Emil Kowalski animate·animation-performance·review-animations |
| design | 화면 설계 기준: 간격·타이포·토큰·상태·반응형·접근성 | anthropics frontend-design, Emil pick-ui-library·break-ui |
| python | uv·ruff·타입·pytest·예외 | wshobson python-type-safety·testing-patterns·error-handling·uv-package-manager |
| node | TypeScript strict·검증·오류·비동기·테스트 | wshobson nodejs-backend-patterns·typescript-advanced-types |
| java | Spring Boot 계층·주입·검증·트랜잭션·JPA·테스트 | 없음 (직접 쓴 체크리스트) |
| mobile | React Native·Expo: 가상화 목록, 제스처, UI 스레드 모션, 안전 영역, 오프라인 | Vercel react-native-skills(목록만), Emil mobile-native·animate-expo |

`design`에는 패턴 규칙 `rules/`(폼·목록·상태·내비·반응형·대화상자·피드백·문구)가 있고, 브라우저 확인(anthropics webapp-testing)과 컴포넌트 원칙(Emil emil-design-eng 일부 절)도 여기 둔다.

판단 규칙(`/dev`·`/check`·`crew` 공통): `pyproject.toml` → python, `build.gradle`·`pom.xml` → java, `package.json`에 `react-native`·`expo` → mobile, `react` → react(모션이 있으면 animation도), 그 밖의 `package.json` → node, 화면을 새로 짜거나 리뷰하면 design. 섞이면 직군으로 가르고(frontend는 react, backend는 node) 그래도 애매하면 묻는다.

새 스택: 폴더와 `STACK.md`·`team.md`를 만들고, 외부 규칙은 `vendor/manifest.tsv`에 받아 `scripts/vendor-map.tsv`에 `stacks/<스택>` 행으로 복사한다. 그다음 `skills/dev`·`check`·`crew`에 `_stacks/<스택>` 행을 더한다.

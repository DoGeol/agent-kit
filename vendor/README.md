# vendor

외부 Skill의 원본 사본. `manifest.tsv`(이름, 저장소, 커밋, 경로)대로 `scripts/vendor.sh fetch`가 받는다. 쓰는 파일만 가져오고, 폴더마다 LICENSE가 있다. 여기 파일은 고치지 않는다. 우리 Skill은 "읽고 따른 뒤 다른 점만" 식으로 가리킨다.

| 폴더 | 저장소 | 라이선스 | 가져온 것 | 쓰는 곳 |
|---|---|---|---|---|
| `mattpocock-skills` | mattpocock/skills | MIT | grilling, to-spec, diagnosing-bugs | `/spec`, `/design`(질문), `/debug`(참고) |
| `obra-superpowers` | obra/superpowers | MIT | verification-before-completion, dispatching-parallel-agents, systematic-debugging | `/dev`(끝 관문), `crew`(병렬), `/debug`(뼈대) |
| `forrestchang-karpathy` | forrestchang/andrej-karpathy-skills | MIT (README·frontmatter) | karpathy-guidelines | `/dev`(시작 전) |
| `addyosmani-agent-skills` | addyosmani/agent-skills | MIT | agents/code-reviewer, agents/security-auditor | `/check` |
| `vercel-labs-agent-skills` | vercel-labs/agent-skills | MIT (README) | react-best-practices SKILL + 규칙 17개, composition-patterns, react-view-transitions, react-native-skills(목록) | `stacks/react`·`animation`·`mobile` |
| `emilkowalski-skills` | emilkowalski/skills | MIT | animate(+RECIPES), animation-performance, review-animations, pick-ui-library, break-ui, prototype(+PICKER), emil-design-eng, find-animation-opportunities, apple-design, mobile-native, animate-expo(+RECIPES) | `stacks/animation`·`design`·`mobile`, `/mock` |
| `anthropics-skills` | anthropics/skills | Apache-2.0 | frontend-design, webapp-testing(+with_server.py) | `stacks/design` |
| `wshobson-agents` | wshobson/agents | MIT | python-type-safety, python-testing-patterns, python-error-handling, uv-package-manager, nodejs-backend-patterns, typescript-advanced-types | `stacks/python`·`node` |

가져오지 않은 것과 이유는 [docs/restructure.md](../docs/restructure.md#vendor). 원본의 `references/` 부속 파일은 가져오지 않았다. Skill이 가리키면 무시한다.

## 갱신

```bash
scripts/vendor.sh check            # 저장소 기본 브랜치가 고정 커밋보다 앞섰는지
scripts/vendor.sh update <이름>    # 최신으로 받고 diff를 보인다. 검토 뒤 manifest 커밋이 바뀐다
scripts/build.sh && scripts/check.sh
```

그다음 kit 버전(세 매니페스트)을 올리고 커밋한다. Skill은 프롬프트라서 상류가 바뀌면 동작이 바뀐다. diff를 보지 않고 올리지 않는다.

원본 설치로 쓰는 것(여기 없음): caveman, ponytail, im-not-ai. 훅·CLI·스크립트가 딸려 있어 복사로는 돌지 않는다. `/setup`이 안내한다.

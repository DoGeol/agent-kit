# java

Java·Spring Boot 코드를 쓰거나 리뷰할 때 읽는다. 읽는 순서: `team.md`(있으면 우선) → 아래 기준. 외부 규칙 사본은 없다(공개 Skill 중 체크리스트로 쓸 만한 것이 없어 직접 썼다).

## 기준

| 영역 | 규칙 |
|---|---|
| 버전·빌드 | 레포의 `build.gradle(.kts)`·`pom.xml`의 Java 버전과 Spring Boot 버전을 따른다. 빌드 도구를 바꾸지 않는다 |
| 언어 | 불변 데이터는 `record`. 닫힌 계층은 `sealed`. `switch` 패턴 매칭·`var`는 레포 관례대로. `Optional`은 반환에만, 필드·인자에는 쓰지 않는다 |
| 의존성 주입 | 생성자 주입만(`final` 필드). 필드 주입(`@Autowired` 필드) 금지. 순환 의존은 설계 문제 |
| 계층 | Controller(입출력 변환·검증) → Service(업무 규칙·트랜잭션) → Repository(저장). Controller에 업무 규칙, Repository에 흐름 제어를 넣지 않는다 |
| 입력 검증 | 요청 DTO에 `jakarta.validation`(`@NotNull`·`@Size` …) + Controller `@Valid`. 엔티티를 요청·응답에 직접 노출하지 않는다 |
| 오류 | 도메인 예외는 `RuntimeException` 하위 클래스. `@RestControllerAdvice`에서 `ProblemDetail`(RFC 9457)로 바꾼다. `catch (Exception e) {}` 금지. 예외 메시지에 맥락 |
| 트랜잭션 | `@Transactional`은 Service 공개 메서드에. 읽기 전용은 `readOnly = true`. 같은 클래스 안 자기 호출은 적용되지 않는다 |
| JPA | N+1을 본다(`fetch join`·`@EntityGraph`·배치 크기). 양방향 연관은 꼭 필요할 때만. 스키마 변경은 마이그레이션(Flyway·Liquibase)으로, `ddl-auto=update` 금지 |
| 동시성 | 가상 스레드(Java 21+)는 레포가 켰을 때만. `synchronized` 안에서 blocking I/O 금지. 공유 가변 상태는 불변 또는 동시성 컬렉션 |
| 설정 | `application.yml` + 프로필. 비밀값은 환경변수·외부 설정. `@ConfigurationProperties`로 타입 붙임 |
| 테스트 | JUnit 5. 단위 테스트는 Spring 컨텍스트 없이(순수 객체 + Mockito). 통합은 `@SpringBootTest` 또는 슬라이스(`@WebMvcTest`·`@DataJpaTest`). DB는 Testcontainers. 이름 `메서드_조건_기대` |
| 로깅 | SLF4J. `System.out` 금지. 비밀값·개인정보 로깅 금지 |
| 검사 명령 | `team.md`에 적힌 것. 없으면 `./gradlew test`·`./gradlew check` 또는 `./mvnw verify` |

## 리뷰할 때

트랜잭션 경계가 맞는지, N+1, 엔티티 노출, 검증 없는 입력, 삼켜진 예외, 자기 호출 `@Transactional`을 본다.

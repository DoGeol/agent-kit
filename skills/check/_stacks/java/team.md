# java 팀 규칙

범용 기본값이다. 팀이 바꾸면 바뀐 줄이 이긴다. 레포의 빌드 설정·포맷터·`AGENTS.md`가 이 파일보다 우선한다. 한 줄씩, 예/아니오로 확인할 수 있게.

## 버전·도구
- Java·Spring Boot 버전은 `build.gradle(.kts)`·`pom.xml`을 따른다. 없으면 Java 21 LTS 문법만.
- 빌드 도구는 레포 것(Gradle 또는 Maven). 래퍼(`./gradlew`·`./mvnw`)로 실행한다.
- 포맷은 레포의 포맷터(spotless·google-java-format 등). 없으면 기존 코드 스타일을 따른다.

## 패키지 구조
- `com.<회사>.<제품>.<도메인>` 아래 `api`(컨트롤러·DTO)·`application`(서비스)·`domain`(엔티티·규칙)·`infra`(저장·외부 호출). 도메인 간 의존은 application 층에서만.
- 테스트는 같은 패키지 구조로 `src/test/java`.

## 이름 짓기
- 클래스 PascalCase, 메서드·변수 camelCase, 상수 UPPER_SNAKE.
- 요청 DTO `<동작>Request`, 응답 `<이름>Response`, 서비스 `<도메인>Service`, 저장 `<엔티티>Repository`.
- 테스트 메서드 `<메서드>_<조건>_<기대>`.

## 언어·설계
- 불변 데이터는 `record`. 닫힌 계층은 `sealed`. `Optional`은 반환에만.
- 생성자 주입만, 필드는 `final`. 필드 주입·setter 주입 금지.
- Lombok은 레포가 쓸 때만, `@Data` 대신 `@Getter`·`@Builder`처럼 필요한 것만.
- 엔티티를 요청·응답에 직접 노출하지 않는다. DTO로 변환.

## 입력·오류
- 요청 DTO에 `jakarta.validation` 제약 + 컨트롤러 `@Valid`.
- 도메인 예외는 공통 기본 예외를 상속. `@RestControllerAdvice`에서 `ProblemDetail`로 변환. `catch (Exception e)`로 삼키지 않는다.

## 트랜잭션·데이터
- `@Transactional`은 서비스 공개 메서드에. 조회는 `readOnly = true`. 같은 클래스 안 자기 호출에는 적용되지 않음을 안다.
- 스키마 변경은 마이그레이션(Flyway·Liquibase)으로. `ddl-auto`는 `validate` 또는 `none`.
- 연관 조회는 N+1을 확인한다(`fetch join`·`@EntityGraph`·배치 크기).

## 테스트
- JUnit 5. 단위 테스트는 Spring 컨텍스트 없이(순수 객체 + Mockito). 통합은 슬라이스(`@WebMvcTest`·`@DataJpaTest`)를 먼저, `@SpringBootTest`는 꼭 필요할 때만.
- DB는 Testcontainers(있으면). H2로 운영 DB를 흉내 내지 않는다.
- 새 동작마다 테스트 하나 이상. 버그 수정은 실패하는 테스트 먼저.

## 설정·로깅·비밀값
- `application.yml` + 프로필. `@ConfigurationProperties`로 타입을 붙인다.
- SLF4J. `System.out` 금지. 비밀값·개인정보 로깅 금지. 비밀값은 환경변수·외부 설정.

## 금지
- 필드 주입, `@Data`, `ddl-auto=update`, 엔티티 노출, `System.out`, 공유 가변 정적 상태, 새 의존성(몇 줄이면 직접 쓴다).

## 검사 명령
- `./gradlew check`(또는 `./gradlew test` + 포맷 검사) / `./mvnw verify`. 전부 통과해야 끝난 것이다.

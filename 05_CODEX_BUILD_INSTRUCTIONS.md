# Codex 작업 지시서 · 오늘의 발견 전국형 플랫폼

> 이 파일 전체를 Codex에 전달한다. 함께 있는 `01_DATA_AUDIT.md`, `02_PRODUCT_UX_SPEC.md`, `03_MYSQL84_SCHEMA.sql`, `04_OPENAPI_v1.yaml`, `verified_public_web_sample_2026-10-13.csv`, `sample_quality_summary.json`은 **구현 입력자료**이다.
> 사용자는 가짜 데모가 아니라 **실제 상업용 웹 서비스의 첫 출시 수준**을 원한다. 다만 인증키가 없는 외부 API를 작동한다고 허위 표시하지 않는다.

## 역할과 우선순위

너는 시니어 풀스택 리드이자 테스트/보안/배포 담당이다. 먼저 제공 문서를 읽고 **실제 실행 가능한 모노레포를 패키징·설치·구동**한 다음, 기능을 단계별로 구현하라. 디자인만 그리는 스켈레톤에 그치지 말고 조회·오류·빈 상태와 관리자 검수 플로까지 end-to-end 구현한다.

우선순위: 1) 실제 데이터 정확성, 2) 보안·권한·출처, 3) 사용 가능한 UI, 4) 테스트 통과, 5) 확장성. 보고서는 '실행해 확인한 것'과 '키 부족으로 실행하지 못한 것'을 분리한다.

## 확정된 기술 조건

- 런타임: **Node.js 정확히 22.16.0** (`.nvmrc`, engines/CI 점검), **MySQL 8.4**.
- Python **3 계열** (실제 설치된 마이너 버전 기록; 채택한 의존성의 지원 범위 확인 후 사용).
- 프론트: **Vue 3 + TypeScript**, 접근성 우선, 모바일 중심, 데스크톱 반응형 완성. Nuxt 등 SSR 선택 시 먼저 **Node 22.16.0 호환성**을 공식 문서로 검증하고 실제 빌드가 통과하는 조합만 선택. 호환성 실패 시 Vue3+Vite로 대체하고 SEO의 임시 한계를 README에 기재.
- API: Node.js TypeScript 서버(Fastify 등 안정적인 선택), 요청·응답 타입 검증, MySQL connector, 단일 백엔드 안에 기능별 모듈 분리.
- 수집·정규화: 초기에는 Node worker를 기본으로 하고, Python을 별도 `services/ingest-python` 패키지로 분리해 공개 파일 검사/정규화 스크립트를 구현. Node와 Python 둘 다 프로덕션 데이터를 중복 수집하지 말 것.
- 패키지 버전은 최신이라는 추정으로 임의 결정하지 말고 **실제 설치 및 공식 호환성 확인** 후 lockfile을 커밋.
- `docker compose` 로 MySQL 8.4 + API + 웹 로컬 실행 가능. Redis, 검색엔진, 벡터DB, AI LLM은 처음부터 필요 없음.
- 공개 콘텐츠 저작권을 확인하지 않은 외부 이미지를 임의로 복사하거나 정식 서비스 카드에 사용하지 말 것.

## 반드시 원하는 폴더 구성

```text
/
├─ apps/
│  ├─ web/                 # Vue UI: pages, components, styles, composables, API client
│  └─ api/                 # auth, activity, search, preferences, favorites, experiences, admin
├─ services/
│  └─ ingest-python/       # Python CSV/JSON inspection and normalization; isolated venv
├─ packages/
│  └─ contracts/           # generated/openapi-based typed client, shared validators
├─ infra/
│  ├─ db/migrations/       # reversible and versioned SQL migrations, first schema from provided DDL
│  └─ docker/              # Dockerfiles
├─ data/
│  └─ research-samples/    # research sample only, NOT guaranteed production live inventory
├─ docs/
│  ├─ api/
│  ├─ decisions/
│  └─ runbooks/
├─ .github/workflows/       # lint/typecheck/tests/build, no leaked secrets
├─ .env.example
├─ docker-compose.yml
├─ README.md
└─ package-lock.json       # root npm-workspaces lockfile or documented alternative
```

`front/back/ingest/db`의 설치·실행·테스트·배포 책임은 독립적으로 유지하며 서로의 설정값을 하드코딩하지 말 것.

## 단계별 실행 작업 (각 단계 후 결과 확인)

### P0 — 패키징/환경 검증 (먼저 실시)

1. 기존 저장소가 있다면 변경 파일과 충돌을 점검. 기존 작업을 임의로 삭제하지 말 것.
2. Node `22.16.0`, Python 3, MySQL 8.4 및 Docker/Compose 가용성을 실제 명령으로 확인.
3. 루트 workspace 및 각 패키지 생성, `.gitignore`, `.editorconfig`, ESLint, Prettier, 타입스크립트 strict, 설정 로더, CORS/CSRF 정책을 정함.
4. `.env.example`만 만들고 실제 API 키·DB 비밀번호·OAuth secret을 생성해서 문서에 박아놓지 않음.
5. `docker compose up --build`로 MySQL + API + 웹 가동, API `/api/v1/health/ready`와 웹 접근 확인.
6. 이 단계의 완료 결과로 명령 출력과 실패 사유를 보고하고 다음 단계로 이동.

### P1 — DB 및 수집 시스템

1. 제공된 `03_MYSQL84_SCHEMA.sql`를 `infra/db/migrations/` 버전별 migration으로 변환해 실제 MySQL 8.4에서 적용·재적용 검증. 스키마가 MySQL에서 오류가 나면 근거 로그와 변경 내역을 남김.
2. 공식 출처별 `data_sources` 관리, `source_sync_runs`, `source_records`, `activity_source_links`의 이력 보존, 원본 SHA256 검사 구현.
3. `data/research-samples`의 **공식 공개 웹페이지 41행 연구 표본**을 테스트 입력자료로 사용하고, 예제 화면에 노출할 때는 `연구 표본 / 최신 모집상태 미검증` 라벨 명시. 인증된 실시간 API 데이터인 것처럼 표시 금지.
4. 같은 행사(영동난계/동래읍성/광주김치/서귀포칠십리) 4개 중복 그룹을 탐지해 `merge_review_cases`에 넣는다. 무조건 자동 병합하지 않는다.
5. 데이터 수집 커넥터 인터페이스 정의: `fetch -> raw snapshot -> validate -> normalize -> dedupe candidate -> human approval -> publish`; `TourAPI`, `ShareNuri`, `SeoulReservation`의 실제 요청 스키마는 **공식 문서와 실키 호출 검증 후** 완성한다.
6. `API_KEY`가 없으면 업스트림 '연결 실패'를 명시하고, fixture/import 모드에서만 애플리케이션 테스트를 수행. 가상 공급 API 구조·가짜 응답을 운영 경로에 두지 말 것.
7. 사용승인/라이선스/개별 이미지 권한 미확인 출처는 `is_enabled=false`, 이미지 `public_allowed=false`가 기본.

### P2 — 화면과 고객 검색 경험 (실제 작동)

1. `02_PRODUCT_UX_SPEC.md` S01~S08 구현. 모바일 360px, 태블릿 768px, 데스크톱 1440px에서 메뉴·카드·리스트·모달 확인.
2. 디자인 시스템: 명확한 한국어 타이포·간격·카드·필터 칩·상태 라벨·키보드 포커스·대조비·스켈레톤·빈 결과 UX. 대형 포털 정도의 **완성도**를 목표로 하되 외형을 그대로 복제하지 말 것.
3. `GET /activities` API 연동. 날짜/지역/가격/활동유형 필터가 실제 서버 데이터에 적용되며 새로고침/공유 URL에도 조건이 보존돼야 함.
4. 카드에서 `FREE / MIXED / UNKNOWN`을 구분. 예약 링크 없으면 예약 가능 문구 및 버튼 금지. 종료 행사 기본 추천 제외.
5. 상세화면은 행사/프로그램/회차를 구별하고 실시간 잔여석 확인이 없는 경우 `신청 상태 미확인` 표시.
6. 로그인 없는 사용자도 홈/검색/상세 읽기 가능. 사용자 저장·기록·알림은 정식 인증 전 임시 상태를 생산환경에서 허용하지 않음.

### P3 — 회원, 기록, 알림

1. 안전한 OAuth/OIDC 제공자 중 실제 연결 가능한 것을 택해 구현. provider app credentials가 없다면 로그인 경로와 안내를 남기되, 개발 전용 mock auth는 테스트에서만 활성화(프로덕션 hard fail).
2. 로그인 쿠키 HttpOnly/Secure/SameSite와 CSRF 보호, 서버 권한검사, rate limiting, XSS 방지, 외부 URL 검증.
3. 찜, 취향, 경험 도감(기본 비공개), 월간 미션, 알림 구독·수신거부. 미확인 출석은 SELF_REPORTED 라벨.
4. 이미지는 권리 확인된 것만 노출. 사용자 업로드는 저장소 설정/서버 검사/EXIF 제거/정책 검증 전 배포 기능 off.
5. 회원탈퇴 및 본인 정보 삭제 절차, 개인정보 보호·보관 정책 초안 준비.

### P4 — 관리자와 운영 안정성

1. 관리자 UI: `동기화 시간·실패·자료건수`, `중복 병합 큐`, `출처 충돌`, `권리 검토`, `콘텐츠 신고`.
2. 콘텐츠 숨김은 API에도 즉시 반영. `STALE`·`CONFLICT`·`BLOCKED` 내용은 과장해서 공개하지 말 것.
3. 메트릭: 동기화 성공률, 데이터 최신성, 가격 확인율, 신청 URL 확인율, 지역별 유효 행사수, 사용자 원문 클릭률.
4. 백업/복구·마이그레이션 롤백·알림 중복 방지·비밀정보 로그 마스킹·데이터 삭제 runbook.

## OpenAPI 계약 준수

- 구현의 기준은 `04_OPENAPI_v1.yaml`. 내부 API이며 공유누리/TourAPI 원천 API라고 잘못 표시하지 말 것.
- 응답은 실제 데이터가 없으면 `null`/`UNKNOWN`. 예약·가격·좌표 임의 보간 금지.
- date-only는 `YYYY-MM-DD`, timestamp는 RFC3339 UTC. UI에서 Asia/Seoul 적용.
- 검색 결과 cursor/page size 제한. 소유권 검사 및 관리자 role 검사 필수.
- 앱·API 계약을 타입 생성과 통합 테스트에 반영하고 변경 시 OpenAPI를 함께 업데이트.

## 최소 필수 자동화 테스트

1. `2026-10-13` 기준 종료 18, 진행중 2, 미래 21 분류(연구 표본). 날짜 기준 및 이중 카운트 취급을 분리 검증.
2. 연구 표본 41개 기록에서 중복 그룹 4개 감지. 원본 행 수와 사용자 노출 canonical 개수 차이를 확인.
3. 무료 필터에서 `MIXED`와 `UNKNOWN` 자동 제외.
4. `광주김치축제 -> 김치체험학교`는 부모/자식으로 저장. 개별 회차 실 시각 미확인 시 빈 sessions 응답.
5. 인증 없는 찜/경험 기록 POST는 401, 관리자 API 일반 회원은 403.
6. 등록 실패·외부 수집 중단·작업 중복·DB 재시도에도 자료 무결성 보장.
7. 유효하지 않은 외부 도메인/JavaScript URL 입력 거부.
8. frontend: 모바일 메뉴·필터·상세·빈 상태·개인 도감 공개범위 E2E.
9. 보안: SQL parameter binding, cookie auth CSRF, URL redirect SSRF/오픈리다이렉트 검사.
10. CI: lint, typecheck, unit, API integration, SQL migrations, build, smoke.

## 최종 제출해야 할 개발 결과

- 실제 작업한 폴더/파일 목록.
- 정상 동작 확인한 명령 및 결과(`npm ci`, build, test, compose, migrate, seed, smoke).
- 화면별 구현 상태(S01~S08)와 미완료 내용.
- 외부 API 인증키 발급 전까지 동작하지 않는 기능과 필요한 키·권한의 정확한 목록.
- 테스트 성공/실패 현황과 실패 로그 요약.
- 환경변수별 목적·비밀정보 저장소·최초 실행법·롤백법.
- 후속 개발 순서와 실제 배포 불가 사유(있다면).

## 프로젝트 수락 조건

**프로토타입 화면만 만들어 놓고 '개발 완료'라고 보고하지 말 것.** 최소한 `패키지 설치 -> DB migration -> 샘플 원본 import -> 검수된 검색 -> 상세 원문 연결 -> 권한 오류/빈 상태 표시 -> CI smoke`가 실제 실행되어야 P0~P2 완료로 인정한다.

**API 키 미발급·운영 이용승인 미확인 상태에서는 전국 프로그램의 실시간 예약 가능 기능을 완료했다고 보고하면 안 된다.** 이 조건은 반드시 기술 부채/운영 게이트에 남긴다.

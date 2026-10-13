# 오늘의 발견 · 전국형 서비스 개발 전달 패키지

기준일 2026-10-13. 사용자 요청 순서에 따라 **실제 공개 웹 데이터 표본·품질 분석 → 핵심 화면 확정 → MySQL DB·OpenAPI 상세 명세 → Codex 개발 지시서**를 묶었다.

## 파일 사용 순서

1. `01_DATA_AUDIT.md` — **표본과 근거, 아직 확인되지 않은 API 품질**.
2. `verified_public_web_sample_2026-10-13.csv` / `.json` — 한국관광공사와 지자체 **공식 공개 페이지에서 확인한 41개 기록**. 공개 웹페이지 추출용 리서치 샘플이지 인증키 발급받아 호출한 API raw dump가 아니다.
3. `sample_quality_summary.json` — 표본의 수치와 품질 분석. `build_sample.py` 재생성 스크립트 포함.
4. `02_PRODUCT_UX_SPEC.md` — 확정 화면 8개, 기능·상태, 텍스트 와이어프레임, MVP 완료 기준.
5. `03_MYSQL84_SCHEMA.sql` — MySQL 8.4 제안 DDL. 여기서 파생한 초기 migration은 2026-10-13 로컬 MySQL 8.4.11에서 적용 확인했다.
6. `04_OPENAPI_v1.yaml` — 신규 **우리 서비스 내부 API** 계약 17개 경로. 타입 생성과 API 단위 테스트는 통과했다. DB 통합 확인은 migration, 연구 표본 import, readiness 경로에 한정되며 전체 API 경로를 검증한 것은 아니다.
7. `05_CODEX_BUILD_INSTRUCTIONS.md` — Codex가 패키징부터 구현·테스트까지 수행할 지시서.

## 검증된 것 / 검증되지 않은 것

- 검증: 공식 웹상 행사명·날짜·지역·일부 가격·프로그램 운영 설명, API 공식 문서, 샘플 로컬 분석, OpenAPI YAML 구조 파싱, MySQL 8.4.11 초기 migration 및 연구 표본 import.
- 미검증: 인증 API 실응답, 17개 지역별 유효 프로그램 총량, 실제 예약 링크·잔여석, 전체 저작권/상업적 원문 저장 허용, 서비스 실사용·수익성, 전체 API 경로와 브라우저 UX.
- 사용하면 안 되는 주장: `전국 어디서나 예약 가능`, `모두 실시간 최신`, `완전 무료`, `전국 17개 지역의 실제 강좌 공급량 확보`.

정식 개발 전에 키 발급·라이선스·API 실제 호출과 지역별 표본 확장을 진행해야 한다. Codex는 위 제약을 숨기지 않고 개발 결과와 장애를 보고해야 한다.

## 서비스 코드 실행

요구 런타임은 Node.js **22.16.0**, Python **3.11 이상**, MySQL **8.4**다. 루트 `.nvmrc`와 npm `engines`가 Node/npm 버전을 고정한다. 이 작업 환경에서 확인한 버전은 Node 22.16.0, npm 10.9.2, Python 3.11.9다.

Docker Desktop과 Compose가 설치된 환경에서는 다음으로 MySQL, API, 웹을 함께 실행한다.

```powershell
Copy-Item .env.example .env
# .env의 MYSQL_PASSWORD와 MYSQL_ROOT_PASSWORD를 로컬 전용 값으로 변경
docker compose up --build
```

웹은 `http://localhost:8080`, API readiness는 `http://localhost:3000/api/v1/health/ready`에서 확인한다. 로컬 개발에서는 MySQL만 Compose로 실행하고 API와 웹은 각각 `npm run dev:api`, `npm run dev:web`로 띄울 수 있다. API는 루트 `.env`를 읽는다.

```powershell
npm ci
npm run build
docker compose up -d db
npm run db:migrate
npm run dev:api
# 별도 터미널
npm run dev:web
```

주요 검사 명령은 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `python -m unittest discover -s services/ingest-python/tests -v`, `npm run sample:validate`다. 원본 표본 반입은 연구 데이터라는 점을 명시적으로 켠 경우에만 가능하다. 반입은 출처·원본 기록과 중복 검수 후보를 만들며, 공개 활동을 생성하거나 자동 병합하지 않는다.

```powershell
$env:RESEARCH_SAMPLE_MODE = 'true'
npm run sample:import
```

이 명령은 로컬 MySQL에 반입한다. 샘플 소스는 사용 승인 대기와 비활성 상태로 저장된다. 자세한 실행·롤백 절차는 [로컬 운영 런북](docs/runbooks/local-development.md)에 있다.

## 현재 구현 경계

- 홈, 검색, 상세, 저장, 미션, 경험 도감, 공유, 관리자 화면과 내부 API가 있다. 공개 검색은 승인된 `PUBLISHED`/`PARTIAL` 활동만 조회하며 검색 조건은 URL에 보존된다.
- TourAPI, 공유누리, 서울 공공서비스예약 연결 코드는 자격증명이나 공식 요청·응답 계약이 확인되지 않으면 명시적으로 중단한다. 실시간 재고·신청 가능 여부를 만들어 내지 않는다.
- OAuth/OIDC와 사용자 세션 제공자 연동 전이라 회원 저장·환경설정·경험 작성은 사용할 수 없다. 테스트 인증은 `NODE_ENV=test`에서만 활성화 가능하다.
- Vue+Vite SPA는 빌드·정적 실행 구성이며 SSR/서버 렌더링은 없다. 색인 가능한 상세 HTML이 필요한 공개 출시 전 SEO 검토가 필요하다.
- 현재 PC에는 MySQL 8.4.11 로컬 서비스가 있으며 `discovery_today` migration, 연구 표본 import, API readiness, 웹 HTTP 응답을 확인했다. Docker Desktop/Compose는 없어 Compose 기동은 검증하지 못했다. DB와 비밀 설정 `.env`는 PC 로컬 상태이며 두 번째 컴퓨터로 자동 이전되지 않는다. 인수인계와 재구성 절차는 [두 번째 컴퓨터 인수인계](docs/runbooks/second-computer-handoff.md)를 참고한다.

환경 변수의 사용 여부, 외부 API 준비 상태, 실제 동작 확인 결과는 [외부 연동 준비 문서](docs/api/upstream-integration-readiness.md)와 [로컬 운영 런북](docs/runbooks/local-development.md)에 정리했다.

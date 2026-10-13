# Upstream and account integration readiness

The service API in `04_OPENAPI_v1.yaml` is our internal contract. It is not the TourAPI, ShareNuri, or Seoul Reservation API contract.

## Public content providers

The connector interface is in `apps/api/src/connectors/types.ts`. Current provider factories intentionally return `ConnectorUnavailableError` for all operations, even if a key is present, because no live request/response contract has been verified. Before enabling a provider:

1. Obtain its official API documentation and confirm the current endpoint, authentication, required parameters, pagination, rate limits, date/time semantics, and error response.
2. Obtain a key and any separate access or commercial-use approval.
3. Verify representative live responses and the provider's caching, attribution, image, and retention rules.
4. Implement and test fetch, raw snapshot, validation, normalization, duplicate candidates, and failure handling against those confirmed responses.
5. Keep content and media disabled until rights and attribution are recorded. A key alone does not grant content or image rights.

Recognized environment names are `TOUR_API_KEY`, `SHARE_NURI_API_KEY`, and `SEOUL_RESERVATION_API_KEY`. They are read by the gated connector factory but do not enable network calls yet. Do not place values in this repository or logs.

The Python utility only validates and exports the checked-in research CSV. Production provider collection is not implemented there, and it must not run a second production collection pipeline alongside Node workers.

## OAuth/OIDC and personal data

`OAUTH_PROVIDER`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, and `SESSION_SECRET` in `.env.example` document future deployment inputs; current application configuration does not consume them. There is no OAuth/OIDC callback, session-cookie issuer, production principal loader, notification delivery, or account deletion workflow. The test-only `x-test-role` identity is rejected unless both `NODE_ENV=test` and `TEST_AUTH_ENABLED=true`; production configuration hard-fails if test auth is enabled.

Protected user writes therefore return `AUTH_NOT_CONFIGURED` after authentication and CSRF checks. Do not present favorites, preferences, experience records, or notifications as persisted user features until a real provider and session lifecycle have been implemented and reviewed.

## Current local evidence

- Confirmed: Node.js 22.16.0, npm 10.9.2, Python 3.11.9, local MySQL 8.4.11, migration `0001_initial.sql`, 41 research source records, four merge-review cases, zero published activities, API readiness (`database=ready`), and web HTTP 200 with the API proxy ready.
- Not verified here: upstream API calls, rights or commercial approval, OAuth, migration rollback, Compose startup, the full browser UX, and all API paths against production-like records.
- Host limitation: Docker/Compose is not installed on the current PC. MySQL, the `.env`, and the running development servers are PC-local. `.env` is ignored and its secrets are intentionally not recorded in this document. See [second-computer handoff](../runbooks/second-computer-handoff.md) before moving work.

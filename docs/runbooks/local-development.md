# Local development and recovery

## Prerequisites

- Node.js 22.16.0 and npm 10.9.2 (`.nvmrc` and `package.json` engines)
- Python 3.11 or newer; this workspace was checked with Python 3.11.9
- MySQL 8.4, either locally or through Docker Compose

## Start the full stack with Compose

```powershell
Copy-Item .env.example .env
# Set unique local MYSQL_PASSWORD and MYSQL_ROOT_PASSWORD values in .env.
docker compose up --build
```

Compose starts MySQL, applies pending migrations from the API container, then starts the API and web server. Browse `http://localhost:8080`; check API readiness at `http://localhost:3000/api/v1/health/ready`. The database port is bound to loopback.

Stop services with `docker compose down`. The named `mysql-data` volume remains. To remove the local database contents, use `docker compose down --volumes`; this permanently deletes that Compose database volume.

## Local API and web development

Create `.env` from `.env.example` and set the database credentials. Then run:

```powershell
npm ci
npm run build
docker compose up -d db
npm run db:migrate
npm run dev:api
```

In another terminal, run `npm run dev:web`. Vite serves the UI and proxies `/api` to `http://127.0.0.1:3000`.

Run checks with `npm run contracts:check`, `npm run sample:validate`, `python -m unittest discover -s services/ingest-python/tests -v`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Import the research sample

The CSV contains 41 public-page research records. It is not a live API response and must not be treated as inventory or proof that booking is available. Validate before importing:

```powershell
npm run sample:validate
$env:RESEARCH_SAMPLE_MODE = 'true'
npm run sample:import
```

The importer writes disabled, approval-pending sources, raw source records, and the four duplicate groups into the review queue in one transaction. It creates zero published activities and never merges records automatically. `RESEARCH_SAMPLE_MODE` must stay false in a production deployment.

## Migration rollback

Apply pending migrations with `npm run db:migrate`. The checked-in initial rollback drops the initial schema tables and all their data. Use it only for a disposable local or CI database:

```powershell
npm run db:rollback
npm run db:migrate
```

Production schema rollback requires a separately reviewed recovery plan and backup. On the current local PC, `0001_initial.sql` was applied to `discovery_today`; the database contains the research-only import described above. The migration has not been rolled back. See [second-computer handoff](second-computer-handoff.md) for the exact local checkpoint and how to recreate it elsewhere.

## Credentials and production gate

Keep `.env` out of source control. Use a managed secret store for deployed environments. Do not set `TEST_AUTH_ENABLED=true` outside tests. Rotate local credentials if they are exposed. Before public deployment, configure and verify the upstream permissions and production authentication listed in [upstream integration readiness](../api/upstream-integration-readiness.md).

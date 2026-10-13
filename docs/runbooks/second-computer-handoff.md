# Second-computer handoff

Checkpoint recorded 2026-10-13 (Asia/Seoul).

## Current PC checkpoint

- Workspace: `C:\today_discovery`. This directory is not a Git repository, so there is no remote or commit history to pull on another computer. Transfer the source tree as files.
- MySQL Server 8.4.11 is installed locally on this PC. The `discovery_today` database exists, `0001_initial.sql` is applied, and the application connects through `127.0.0.1:3306`.
- The ignored `.env` exists on this PC. Its password is intentionally not copied into this document. Recreate the file securely on the second PC; do not assume it transfers with source control.
- Import state: 41 research-only source records and four duplicate-review cases; zero published activities. The import marks sources disabled and approval-pending. Do not present the sample as live inventory or booking availability.
- `npm run build` passed. API readiness returned `status=ready` and `database=ready`; web returned HTTP 200 and its `/api` proxy reached the ready API.
- API and web development servers are running on this PC at `http://localhost:3000` and `http://localhost:5173`. On the second PC, `localhost` refers to that second PC; these processes and the MySQL database do not move with the document.
- Docker/Compose is unavailable on the current PC, so Compose startup was not verified. Automated tests were not rerun during this database handoff.

## Recreate the local checkpoint on PC 2

Copy the project source files. Reinstall dependencies instead of copying `node_modules`; omit `.env`, `dist`, and `.tmp`. The checked-in CSV and source code can regenerate the research import. The database itself was not exported.

Install Node.js 22.16.0, npm 10.9.2, Python 3.11+, and MySQL 8.4. Start local MySQL, connect as a MySQL administrator, and run the following SQL. Replace the password placeholder with a local secret; do not put it in this handoff document.

```sql
CREATE DATABASE IF NOT EXISTS discovery_today
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'user'@'127.0.0.1'
  IDENTIFIED BY '<local-app-password>';

GRANT ALL PRIVILEGES ON discovery_today.* TO 'user'@'127.0.0.1';
```

Create a local, ignored `.env` in the project root with:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=discovery_today
MYSQL_USER=user
MYSQL_PASSWORD=<local-app-password>
MYSQL_SSL=false
RESEARCH_SAMPLE_MODE=false
```

Then run from the project root:

```powershell
npm ci
npm run build
npm run db:migrate
$env:RESEARCH_SAMPLE_MODE = 'true'
npm run sample:import
Remove-Item Env:RESEARCH_SAMPLE_MODE
```

Start the API and web in separate terminals:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

Check `http://localhost:3000/api/v1/health/ready` and `http://localhost:5173/`. Keep `RESEARCH_SAMPLE_MODE=false` after the one-time import; the importer only accepts the temporary non-production override and publishes zero activities.

## Remaining work and gates

1. Verify official current contracts, keys, use approvals, attribution, licensing, and retention for TourAPI, ShareNuri, and Seoul Reservation. Connector factories still stop with `ConnectorUnavailableError`; keys alone do not enable network calls.
2. Implement and verify live provider fetch, snapshot, validation, normalization, duplicate detection, and explicit curator approval before publishing.
3. Connect a production OAuth/OIDC provider and session lifecycle. Production identity, favorites/preferences/experience persistence, notification delivery, and account deletion are not configured.
4. Resolve the four duplicate-review cases with an authorized curator. No records were merged automatically; no activities are published.
5. Complete responsive browser review at 360, 768, and 1440 pixels and the required frontend E2E checks. The current checkpoint only confirms HTTP responses and API readiness.
6. Install Docker/Compose and run the Compose smoke path if that deployment workflow is required. It was not available on the current PC.

Do not run `npm run db:rollback` on a database whose contents must be kept: the initial down migration drops the schema tables and their data. Do not expose the local MySQL server to another computer by changing firewall or bind settings as part of this handoff; remote access was not configured or verified.

# Database rehearsal and production cutover runbook

**Prepared:** 24 September 2026  
**Target:** Railway is production before the end of Friday 25 September 2026, with no data divergence.  
**Scripts:** `scripts/migration/` (see the table below). Dumps and reports are written to `~/MBS-migration/`, outside the repository, and must never be committed.

## Scripts

| Script | Writes? | Purpose |
|---|---|---|
| `db-identity.sh` | No (read-only session) | Shows version, time zone, table count, Replit publish table, connected clients and live-use markers for any database |
| `export-production.sh [label]` | No (read-only snapshot) | `pg_dump` of Replit production in one `REPEATABLE READ, READ ONLY` transaction. Excludes the `_system` schema and `public.sessions` rows. Refuses unless the source has Replit's publish table. Writes a `.sha256` using `shasum -a 256` |
| `verify-database.sh LABEL` | No (read-only snapshot) | Report of exact row counts for every public table, full-content checksums of every table except `sessions`, sequence position versus max ID, every constraint and index (by name and definition checksum), object counts and database time zone |
| `compare-reports.sh A B` | No | PASS/FAIL comparison of two reports. Session rows are the only expected difference |
| `import-to-railway.sh staging\|production DUMP` | **Target only** | Checks the dump checksum. Refuses Replit/Neon hosts, non-PostgreSQL-16 targets, non-empty targets and targets with other connected clients (the web service must be stopped). Restores in a single transaction (all or nothing), then sets the database time zone to `GMT` |
| `disable-staging-auto-refresh.sh` | **Staging only** | Sets `email_analytics_settings.automatic_refresh_enabled = false` for every organisation and confirms none remain on |

All scripts ask for connection strings with hidden input; nothing is echoed, stored or written to shell history. Only host names are printed. If a managed server rejects the read-only startup option, re-run with `NO_STARTUP_OPTIONS=1`; `pg_dump` and `verify.sql` still use explicit read-only transactions.

All scripts, including every refusal guard, were tested on 24 September 2026 against local PostgreSQL 16.15 databases that imitate Replit production (with `_system` schema, session rows, active auto-refresh, difficult data types and a different locale on the target).

## Where the connection strings come from

- **Replit production:** Replit → Practice Toolbox → Tools → Database → **Production Database** → **Settings** → connection string. Copy it straight into the hidden Terminal prompt. Never paste it into chat, files or documents.
- **Railway staging or production Postgres:** Railway → project `practice-toolbox` → the environment → **Postgres** service → **Variables** → `DATABASE_PUBLIC_URL`. The web service itself keeps using the private `DATABASE_URL`.

## Part A: staging rehearsal (today, Replit stays live)

Replit remains production throughout. Nothing is written to Replit.

| Step | Who | Action | Pass condition |
|---|---|---|---|
| A1 | Owner | Railway staging: stop the `web` service (active deployment → ⋯ → **Remove**, or equivalent). Leave Postgres running | `web` shows no active deployment |
| A2 | Claude/owner | `db-identity.sh` against **Replit production** | Connects; version 16.15; time zone GMT; `replit_publish_table` true; users 18 (or current count) |
| A3 | Claude/owner | `db-identity.sh` against **Railway staging Postgres** | Version 16; `public_tables` 0 or 1 (`sessions`); `other_client_connections` 0 |
| A4 | Claude/owner | `verify-database.sh source-before` (Replit) | Report written |
| A5 | Claude/owner | `export-production.sh rehearsal` (Replit) | `_system` and session rows excluded; checksum written; time taken recorded |
| A6 | Claude/owner | `verify-database.sh source-after` (Replit), then `compare-reports.sh source-before source-after` | PASS means nothing changed during the export, so the source report equals the dump. If it fails because the live scheduler wrote in between, repeat A4–A6 straight after a sync run |
| A7 | Claude/owner | `import-to-railway.sh staging <dump>` | All guards pass; restore completes; time zone GMT |
| A8 | Claude/owner | `verify-database.sh staging`, then `compare-reports.sh source-before staging` | **PASS** |
| A9 | Claude/owner | `disable-staging-auto-refresh.sh` | "automatic refresh is off for every organisation" |
| A10 | Owner | Railway staging: redeploy `web` | Health check passes |
| A11 | Owner | Smoke-test staging (list below) | All pass |
| A12 | Both | Record timings for A4–A8; these size Friday's maintenance window | |

Staging smoke test:

- Sign in (existing users; everyone signs in again because sessions are not migrated), each role, teams, dashboards.
- Coaching, management report and **management-report PDF** (Chromium), valuation submission and valuation PDF.
- Email Analytics: pages load; one **manual** refresh works; automatic refresh stays off; Bedrock readiness panel.
- Invitation email and password reset. Note: email links point to `app.practicetoolbox.co.uk` (hardcoded), so they open production, not staging. Test on a test account only; staging contains real users' email addresses.

## Part B: Railway production environment (after A passes, before Friday)

1. Merge `migration/railway` into `main` (owner approval required).
2. Railway: create the `production` environment in project `practice-toolbox`, EU West:
   - Postgres from `ghcr.io/railwayapp-templates/postgres-ssl:16`; backups enabled.
   - `web` service from `mbs-practice-toolbox`, branch `main`, auto-deploy **off**.
   - Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`; a **new** `SESSION_SECRET` (at least 32 characters); `RESEND_API_KEY`; `APP_URL=https://app.practicetoolbox.co.uk`; `EMAIL_ANALYTICS_DEFAULT_MAILBOXES`; `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`; `KARBON_API_KEY`, `KARBON_ACCESS_KEY`; `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (existing `practice-toolbox-bedrock` identity); `ANTHROPIC_API_KEY` if set in Replit; `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=0`. No Stripe variables.
   - Do **not** start `web` against the empty production database for real use; a first deploy may run only to confirm the build, then stop it before the import.
3. Add the custom domain `app.practicetoolbox.co.uk` to the production `web` service and note the DNS records Railway shows. Do not change DNS yet. `www.practicetoolbox.co.uk` is out of scope until its use has been verified separately (see DNS).

## Part C: Friday production cutover

Order matters. Replit stays live until C3.

| Step | Action | Pass condition |
|---|---|---|
| C1 | Announce the maintenance window; users will need to sign in again afterwards | |
| C2 | Railway production: `web` stopped; `db-identity.sh` shows empty Postgres 16 with 0 other connections | |
| C3 | **Stop Replit production** (method, and its effect on rollback, confirmed in Replit beforehand). Record the time. From here Replit takes no writes, and its scheduler no longer runs | Replit app URL no longer serves |
| C4 | `verify-database.sh source-final` (Replit, now static) | Report written |
| C5 | `export-production.sh final` | Checksum written |
| C6 | `verify-database.sh source-final-after`; compare with C4 | **PASS** (proves Replit really is frozen) |
| C7 | `import-to-railway.sh production <final dump>` | Restore completes; time zone GMT |
| C8 | `verify-database.sh production`; `compare-reports.sh source-final production` | **PASS, no exceptions** |
| C9 | Do **not** run `disable-staging-auto-refresh.sh` on production. Production keeps its automatic refresh setting | |
| C10 | Start Railway production `web`; smoke-test on the Railway `*.up.railway.app` URL | All pass |
| C11 | Owner, in 123-Reg: switch `app` to the records Railway shows (see DNS) | |
| C12 | Wait for DNS and Railway's certificate; re-test on `https://app.practicetoolbox.co.uk` | All pass |
| C13 | Watch logs through one scheduled Email Analytics run | Sync succeeds once |
| C14 | Encrypt the final dump and reports; keep them outside the repository | |

**Go/no-go:** any FAIL at C6, C8, C10 or C12 means rollback.

## DNS (administered by the owner in 123-Reg)

The owner administers DNS through 123-Reg. The records below come from public DNS lookups on 24 September 2026 and must be confirmed in the 123-Reg control panel before any change; no DNS change is made or recommended on the strength of public lookups alone.

| Record (public lookup) | Value | TTL |
|---|---|---|
| `app` A | `34.111.179.208` (Replit) | 600 |
| `app` TXT | `replit-verify=…` | 3600 |

- **In scope:** `app.practicetoolbox.co.uk`, the production application URL. At C11, the owner replaces its record in 123-Reg with the records Railway shows for the custom domain (normally a CNAME to the Railway target, sometimes with a verification TXT record).
- **Out of scope for now:** `www.practicetoolbox.co.uk`. Its use will be verified separately before any decision; this runbook does not change it. (Public lookups show it currently resolves to the same address as `app`, which is worth checking as part of that verification.)
- Keep the `replit-verify` TXT record for rollback.
- Do not touch any other records (root, MX, mail and Resend records).
- TTL: before C11, confirm the current TTL for `app` in 123-Reg and set it to the lowest value 123-Reg allows, at least one old-TTL period before the switch.

## Rollback

- **Before C11 (DNS unchanged):** restart Replit production. Nothing was written anywhere else that users saw.
- **After C11, before users write to Railway:** the owner restores the original `app` record in 123-Reg (as confirmed there before C11) and restarts Replit.
- **After users write to Railway:** writes made on Railway would be lost on rollback unless copied back. Decide within the 72-hour rollback window; keep Replit intact and publishing frozen until the migration is accepted.

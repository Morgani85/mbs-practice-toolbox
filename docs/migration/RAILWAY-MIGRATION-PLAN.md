# Railway migration plan

**Baseline:** `1.0.0-pre-migration-stable` (commit `18a73fe`)  
**Prepared:** 23 September 2026  
**Status:** Approved with amendments (see below)  
**Objective:** Move the existing application from Replit to GitHub + Railway, preserving existing behaviour and changing infrastructure only. No refactoring, redesign, feature work, technical-debt removal or Karbon replacement work is in scope.

## Approved amendments

1. **Bedrock identity.** Do not create a new IAM user. Reuse the existing MBS-owned `practice-toolbox-bedrock` identity, and verify and preserve its existing least-privilege and zero-data-retention configuration.
2. **Railway Postgres version.** Do not create Railway Postgres until the actual Replit production PostgreSQL version has been checked with `SELECT version();`. The Railway major version must then be equal to or newer than production. **Completed 23 September 2026: production is 16.15; Railway uses major version 16.**
3. **Replit publishing freeze.** Replit publishing is **frozen from 23 September 2026 until migration and cutover are complete.** Replit applies schema changes to the production database on publish (`_system.replit_database_migrations_v1`), so any publish could change the schema being migrated.

## Production database verification (23 September 2026)

Amendment 2 is complete. A single read-only query was run by the owner in Replit's Database tool (Production Database → My Data → Playground, with Edit off). No connection string or credential left Replit, and nothing was written.

| Check | Result |
|---|---|
| PostgreSQL version | **16.15** (`PostgreSQL 16.15 ... aarch64-unknown-linux-gnu ... 64-bit`) |
| Time zone | **`GMT`** (UTC+0 all year, no daylight saving; same offset as `UTC`) |
| Replit publish bookkeeping table (`_system.replit_database_migrations_v1`) | Present |
| `financial_clarity_reviews` table | Absent |
| Users | 18 |
| Latest Email Analytics sync run | 2026-09-23 20:56 UTC, 12 minutes before the query ran at 21:08 UTC |
| Latest session expiry | 2026-09-29 11:33 UTC (a sign-in on 22 September; sessions last 7 days) |

This was confirmed as the live production database, not development: the Replit publish table exists only in production; the missing `financial_clarity_reviews` table matches the production inventory (the development database has it); and the recent sync run and session show live use.

Consequences for this plan:

- **Railway Postgres must use major version 16**, an exact match with production. Export with a PostgreSQL 16 or 17 client.
- **Time zone:** Railway Postgres defaults to `UTC`, which has the same offset as `GMT`, so stored dates and times do not shift. To match production exactly, set the Railway database time zone to `GMT` during setup (a database setting, not a code change).
- **Live production schema drift is confirmed** (finding D): production lacks `financial_clarity_reviews`. Migrate the schema exactly as it is.
- **The live Email Analytics scheduler is confirmed active.** Staging must have automatic refresh turned off after the snapshot is restored.
- **Replit publishing remains frozen** (amendment 3).
- **Unapplied Replit Agent changes must remain unapplied.** The Replit workspace shows a pending Agent task ("Send automated email remind…", marked Ready for review with an Apply changes button). That work is not part of the `1.0.0-pre-migration-stable` baseline in GitHub and must not be applied in Replit before or during migration.

## Verification findings

All items in `AUDIT-CORRECTIONS.md` were confirmed. Verification against the repository also found the following, which none of the existing migration documents recorded:

| # | Finding | Evidence |
|---|---|---|
| A | `npm ci` fails outside Replit: 27 lockfile entries (all AWS SDK packages) resolve to Replit's internal package mirror. | `package-lock.json`: `http://package-firewall.replit.internal/npm/...` failed with ENOTFOUND. With those URLs rewritten to `https://registry.npmjs.org/`, a clean install succeeded and integrity hashes matched. |
| B | The production server bundle imports dev dependencies at startup: `vite`, `@vitejs/plugin-react` and `@replit/vite-plugin-runtime-error-modal`. | `server/vite.ts` statically imports `../vite.config`. A production install with `--omit=dev` (as in the migration package's Dockerfile) would crash on boot. |
| C | `RESEND_API_KEY` is required at boot, not only when email is enabled. | `server/email-service.ts:3-5` throws at import; `server/auth.ts` imports it. `migration/environment-variables.csv` is incorrect on this point. |
| D | The production schema lags `shared/schema.ts`: production has no `financial_clarity_reviews`, `vat_results` or `vat_targets` tables and no `coaching_sessions.transcript` column. Production also has a Replit `_system` schema. | Comparison of `production-tables.csv` and `production-columns.csv` with `shared/schema.ts`. |
| E | Production row estimates in the inventory are all 0 and cannot be used for verification. | `production-tables.csv` |
| F | `EMAIL_ANALYTICS_DEFAULT_MAILBOXES` is set only in `.replit` (`[userenv.shared]`), not in Replit Secrets. | `.replit` |
| G | Nothing writes to the local filesystem. The Phase 0 claim about `uploads/valuations` is incorrect: valuation PDFs are stored as base64 in the database. | `server/routes.ts:624-628`, `:857-862` |
| H | Chromium is needed only for the management-report PDF. Valuation PDFs use `pdf-lib`. | `server/pdf-service.ts` is the only Puppeteer code; its only caller is `server/routes.ts:5879`. |
| I | No GoHighLevel webhook configuration exists. `VITE_ENABLE_OVERVIEW` and `STRIPE_PUBLISHABLE_KEY` are never read by the code. | Repository search |
| J | `npm run build` passes. `tsc` reports 24 errors, all in `server/ai-analysis-broken.ts`, which nothing imports. | Build and type-check output |

## Must change before Railway

These changes are the complete set of code and configuration changes for Railway. Nothing else in the application changes.

| # | File | Change | Why it is required |
|---|---|---|---|
| 1 | `package-lock.json` | Rewrite the 27 `resolved` URLs from `package-firewall.replit.internal` to `https://registry.npmjs.org/`. | Railway cannot reach Replit's internal mirror, so `npm ci` fails (finding A). Integrity hashes are unchanged, so the installed packages are identical. |
| 2 | `server/db.ts`, `package.json` | Replace `@neondatabase/serverless` and `drizzle-orm/neon-serverless` with `pg` and `drizzle-orm/node-postgres`. Keep `max: 1`, the timeouts and the error and connect logging. Declare `pg` and `@types/pg` in `package.json`. | The Neon driver connects over WebSockets to Neon's proxy; Railway PostgreSQL accepts only ordinary TCP connections. The `pool.connect()` and `client.query()` calls in `server/storage.ts:478` behave the same with `pg`. The session store (`connect-pg-simple`) already uses `pg`. With `pg` installed, `drizzle-kit` also connects over plain TCP. |
| 3 | `server/index.ts` | Change `const port = 5000` to `parseInt(process.env.PORT \|\| "5000", 10)`. | Railway assigns the port through `PORT`. The 5000 fallback keeps Replit and local behaviour unchanged. |
| 4 | New: `Dockerfile`, `.dockerignore`, `railway.json` | Base image `node:20-bookworm-slim`. Install `chromium`, `fonts-liberation` and `ca-certificates` with `apt`. Set `PUPPETEER_SKIP_DOWNLOAD=true`. Run a full `npm ci` (including dev dependencies), then `npm run build`; start with `npm run start`. `railway.json` sets the Dockerfile builder, health check path `/`, 1 replica and restart on failure, with **no** pre-deploy `db:push`. | Pins Node 20 (Railway's default builder may choose a newer version). Provides Chromium in place of `replit.nix`. Keeps dev dependencies installed because of finding B. The migration package's Dockerfile cannot be reused: its `source/` paths no longer apply and `--omit=dev` would crash the app. |
| 5 | `client/index.html:12-13` | Remove the `replit-dev-banner.js` script tag. | Every production page currently loads executable code from replit.com. It has no function outside Replit and is an unmanaged third-party dependency. |
| 6 | `server/index.ts` | Remove `STRIPE_SECRET_KEY` from the required startup variables. (Added 24 September 2026.) | Practice Toolbox is no longer being commercialised, so the key is not needed for internal use. The Stripe code already handles a missing key; the startup check was the only blocker. No other Stripe functionality is changed or removed. |

No code change is needed for:

- **Chromium discovery:** `findChromium()` runs `which chromium`, which finds `/usr/bin/chromium` on Debian.
- **Sessions and cookies:** `trust proxy 1` suits Railway's single proxy hop.
- **Replit Auth:** it is not used.
- **Static assets:** `attached_assets` is served relative to the working directory, which works inside the container.

## Environment variables and secrets

Set per Railway environment.

| Variable | Needed | Notes |
|---|---|---|
| `DATABASE_URL` | Boot | `${{Postgres.DATABASE_URL}}` (private internal URL) |
| `SESSION_SECRET` | Boot | At least 32 characters. Generate a new value for each environment. |
| `STRIPE_SECRET_KEY` | Optional | Not required at startup (change 6). Set it only if the abandoned paid-subscription/billing features are intentionally used; without it, billing is disabled and the Stripe routes return 503. |
| `RESEND_API_KEY` | Boot | Finding C |
| `PORT` | Automatic | Set by Railway; do not set manually |
| `STRIPE_WEBHOOK_SECRET` | Optional | Only if billing is intentionally used. Without it the Stripe webhook returns 400. |
| `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Email Analytics | Copy the values, or rotate the secret |
| `EMAIL_ANALYTICS_DEFAULT_MAILBOXES` | Email Analytics | Move from `.replit` (finding F) |
| `KARBON_API_KEY`, `KARBON_ACCESS_KEY` | Email Analytics | |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Bedrock readiness | Credentials for the existing `practice-toolbox-bedrock` identity (amendment 1). Railway cannot assume an AWS role, so long-lived keys are required. |
| `ANTHROPIC_API_KEY` | AI features | Verify whether it is set in Replit today; the CSV says it is not, which would mean the AI features currently fail. |
| `APP_URL` | Valuation links | Production: `https://app.practicetoolbox.co.uk`. Staging: the staging URL. |
| `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=0` | Recommended | Shortens the period when two containers (and two schedulers) run during a deploy |

- **Do not set:** `NODE_ENV`. `npm run start` already sets it, and setting it at build time drops dev dependencies.
- **Not needed:** `REPLIT_DOMAINS`, `REPL_ID`, `ISSUER_URL`, `SENDGRID_API_KEY`, `STRIPE_PUBLISHABLE_KEY`, `VITE_ENABLE_OVERVIEW`, `PG*`, `NEON_DATABASE_URL` (used only by one-off scripts).

## Database: Neon to Railway PostgreSQL

- Change 2 is the only code change.
- **First check the Replit production version with `SELECT version();` (amendment 2).** The `postgresql-16` module in `.replit` describes the development database, not production. Only then create Railway Postgres, at a major version equal to or newer than production. **Done: production is PostgreSQL 16.15, time zone `GMT`. Create Railway Postgres at major version 16.**
- **Never run `npm run db:push` against Railway production.** It would create the missing tables (a behaviour change) and can propose destructive changes. The production schema comes only from the restored dump.

## Production data export, migration and verification

1. **Export** with `migration/database/export-production.sh`, amended to:
   - add `--exclude-schema=_system` (Replit's migration bookkeeping);
   - use `shasum -a 256` where `sha256sum` is unavailable on macOS.

   Use a `pg_dump` whose major version is equal to or newer than the server's. The script already excludes session rows, ownership and privileges. Encrypt the dump immediately.
2. **Import** with `migration/database/import-production.sh` through Railway's public TCP proxy URL, used for the import only. Disable public access afterwards.
3. **Verify** by running the same read-only script against both databases and comparing:
   - exact `count(*)` for every public table (the CSV estimates are unusable, finding E);
   - `max(id)` against each sequence's `last_value`;
   - `md5` of ordered rows for `users`, `organisations`, `valuation_submissions` and the email analytics tables;
   - constraint and index counts against `production-constraints.csv`;
   - `SHOW timezone` on both (the code uses timestamps without time zones; production is `GMT`);
   - the application smoke tests in the cutover checklist.

## Sessions and authentication

- Authentication is local email and password (`server/auth.ts`). The session store does not change.
- Session rows are not migrated and `SESSION_SECRET` is new, so **all users must sign in again once**.
- Password-reset and invitation tokens migrate with their tables. Email links are hardcoded to `app.practicetoolbox.co.uk`, so they remain valid after the DNS switch.
- Staging side effect: emails sent from staging link to production because of hardcoded URLs in `server/email-service.ts`. This is existing behaviour; fixing it can wait.
- The login rate limiter is in memory. This is acceptable with one replica, and it resets on deploy as it does today.

## PORT

Change 3. Railway's routing and health check then use the assigned port.

## Chromium and PDF generation

- The Dockerfile installs Debian `chromium`; the existing code finds it without changes.
- Launch flags already include `--no-sandbox` and `--disable-dev-shm-usage`, which suit containers.
- Chromium starts once per management-report PDF, so allocate **at least 1 GB of memory** to the service.
- Verify before cutover: compare a management-report PDF rendered on Railway with one from Replit (fonts, colours, page breaks).

## Scheduled and background jobs

- Keep the Email Analytics scheduler in the web process, as today. Run exactly **1 replica**, with no autoscaling and Railway app sleeping **off**.
- Deploy overlap: old and new containers can run briefly at the same time. DB unique constraints and the 30-minute stale-run guard (`server/email-analytics.ts:239-248`) protect against duplicate work. `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=0` narrows the window.
- There is no SIGTERM handler. A sync interrupted by a deploy is marked failed after 30 minutes and retried; this recovery path was confirmed in the code.
- Staging: after restoring the snapshot, set `email_analytics_settings.automatic_refresh_enabled = false` in the **staging** database only, so staging does not continuously sync real mailboxes. Test with one manual refresh.
- A dedicated worker or cron service can wait until after migration.

## Microsoft Graph

- Client-credentials flow, outbound only, no redirect URIs. The Entra app registration needs no change.
- Verify: client-secret expiry date; no Conditional Access or location restriction on workload identities that would block Railway's outbound IPs; Exchange Application RBAC scope unchanged; mailbox list moved (finding F).

## Karbon

- Outbound only (bearer token plus `AccessKey`), no callback.
- Verify that Karbon has no IP allowlist on the key. Railway's outbound IPs change unless static outbound IPs are purchased.

## AWS Bedrock

- Region (`eu-west-2`) and model are hardcoded; `AWS_REGION` is not needed.
- The code performs readiness checks only; no inference is invoked.
- **Reuse the existing MBS-owned `practice-toolbox-bedrock` identity (amendment 1).** Verify and preserve its existing least-privilege policy and zero-data-retention configuration; do not create a new IAM user.
- Verify that the readiness panel on staging still reports retention mode `none`.

## Stripe, Xero and Resend

- **Stripe:** optional. Practice Toolbox is no longer being commercialised as a paid SaaS product, so Stripe is needed only if the abandoned paid-subscription/billing features are intentionally used. No current internal MBS workflow depends on it: plan and user limits come from each organisation's database record, not from Stripe. Without `STRIPE_SECRET_KEY` the app starts, `server/stripe-service.ts` disables billing, the `/api/stripe/*` routes return 503 and the webhook returns 400. If billing is ever used: the domain does not change, so the webhook endpoint URL and secret stay the same; during cutover keep Replit **stopped** rather than read-only, so webhooks fail and Stripe retries them against Railway; and staging should use test keys and a test-mode webhook endpoint.
- **Xero:** demo stub only (`server/routes.ts:5759`). No action.
- **Resend:** required at boot. The sending domain's DNS records (SPF, DKIM) are unaffected; do not change them when editing DNS.

## Filesystem and storage

No incompatibility (finding G). There are no runtime writes or uploads; `attached_assets` is baked read-only into the image; Chromium writes only to `/tmp`.

## Database and schema risks

1. **Production lags the code** (finding D). Financial Clarity Review, coaching transcripts and VAT results/targets probably fail in production today. To preserve behaviour, migrate the schema exactly as it is. Decision required: apply the additive tables and column as a separate, reviewed step after migration (recommended) or before it. Pull a fresh schema inventory first to confirm the CSVs are current.
2. **Replit publish-time schema changes.** Mitigated by the publishing freeze (amendment 3).
3. The migration journal covers only 0000–0002. Do not use `drizzle-kit migrate` against production.
4. `connect-pg-simple` has `createTableIfMissing: true`. The table structure survives the dump even though its rows are excluded, so this is harmless.
5. Sequences and time zone: covered by the verification checks.

## TypeScript and build

- Release-blocking: findings A and B, fixed by changes 1 and 4.
- Not release-blocking: the 24 `tsc` errors in the unused `server/ai-analysis-broken.ts` (the build does not type-check); `nanoid` is used but only installed transitively; the frontend bundle-size warning.

## Replit-specific files and dependencies

| Can stay for now (harmless) | Must change or stop |
|---|---|
| `.replit`, `replit.nix`, `replit.md`, `vercel.json` | Replit mirror URLs in `package-lock.json` (change 1) |
| `server/replitAuth.ts` (not bundled) | Replit banner script (change 5) |
| `scripts/post-merge.sh` (run only by Replit) | Mailbox list in `.replit`, moved to Railway variables |
| `@replit/vite-plugin-*` dev dependencies (must stay installed: `vite.config.ts` imports one unconditionally) | Replit publishing (frozen, amendment 3) |
| `openid-client`, `@sendgrid/mail`, Neon scripts under `scripts/` | |

## Deployment architecture

- One Railway project, **practice-toolbox**, region **EU West**, with two environments:
  - **staging:** `web` service auto-deploying from `main`, with its own Postgres holding a restored production snapshot. Railway domain or `staging.practicetoolbox.co.uk`.
  - **production:** `web` service deploying manually (or from a `production` branch), with its own Postgres. Serves `app.practicetoolbox.co.uk` and `www.practicetoolbox.co.uk` (`client/src/App.tsx` switches to the marketing site on `www`).
- Each `web` service: 1 replica, 1–2 GB memory, health check `/`, database over Railway's private network.
- Railway Postgres backups enabled, plus an independent encrypted nightly `pg_dump`.

## Parallel run and rollback

- **Parallel run:** Replit remains production while staging runs on a production snapshot for about 1–2 weeks. Rehearse the full export, import and verification at least once, and time it.
- **Rollback before Railway takes writes:** point DNS back to Replit. Replit's database is untouched, so nothing is lost.
- **Rollback after Railway takes writes:** either reverse-dump the changed data into Replit's production database (test during the rehearsal whether Replit permits a restore) or accept losing those writes. Rollback window: 72 hours, with agreed go/no-go criteria. Keep the Replit deployment in place, with publishing frozen, until the migration is accepted.

## Cutover checklist

1. At least 48 hours before: lower the TTL on the `app` and `www` DNS records to 60–300 seconds.
2. Announce a 30–60 minute maintenance window; users will need to sign in again.
3. **Stop** the Replit deployment and record the time.
4. Export the database, check the checksum, encrypt the dump.
5. Restore into Railway production and run the verification script. All counts and checksums must match.
6. Deploy the approved commit to production; confirm the health check passes on the Railway domain.
7. Smoke-test on the Railway domain:
   - sign-in and each role;
   - teams and dashboards;
   - coaching;
   - management report and its PDF;
   - valuation submission and its PDF;
   - manual Email Analytics refresh and the Bedrock readiness panel;
   - invitation email (staff and coaching portal) and password reset;
   - Stripe checkout only if billing is intentionally used.
8. Add the custom domains in Railway, switch DNS, wait for the certificate.
9. Re-test key flows on `app` and `www`; if billing is used, confirm Stripe webhook deliveries in the Stripe dashboard.
10. Monitor logs for 24 hours, including one scheduled Email Analytics run.
11. After acceptance: take and verify a Railway backup, rotate Replit-era credentials, archive the Replit project, and lift the publishing freeze only by retiring Replit.

## Plan by category

**Must change before Railway:** changes 1–6.

**Must verify before cutover:**

- ~~Replit production PostgreSQL version and time zone~~ **Done 23 September 2026:** PostgreSQL 16.15, time zone `GMT`
- Replit Agent pending changes remain unapplied
- Fresh schema inventory, and the decision on schema drift
- Whether `ANTHROPIC_API_KEY` is set in Replit
- Entra and Karbon IP or Conditional Access restrictions; Microsoft secret expiry
- Existing `practice-toolbox-bedrock` identity: permissions and zero-data-retention configuration unchanged
- Chromium PDF output compared with Replit
- Stripe test flows (only if billing is intentionally used)
- Whether Replit's database accepts a restore (for rollback)
- DNS host and Resend DNS records
- A timed rehearsal cutover

**Can wait until after migration:**

- Creating the missing tables and column
- Removing Replit files and `server/replitAuth.ts`
- Removing SendGrid, `openid-client` and the Neon scripts
- Completing `.env.example`
- Hardcoded email URLs
- Worker or cron scheduler, SIGTERM handling, a dedicated health endpoint
- Fixing `server/ai-analysis-broken.ts` and making `tsc` a CI gate
- Declaring `nanoid`
- Node 22 upgrade
- Frontend code splitting

## Summary

**Estimated complexity:** medium. The code changes are small; the database cutover and schema drift need care.

**Biggest risks:**

1. Schema drift and Replit-managed schema changes (mitigated by the publishing freeze and the ban on `db:push` against production).
2. Data integrity at cutover, and rollback after writes.
3. Runtime packaging: lockfile URLs, dev dependencies at runtime, Node version and Chromium.

**Implementation order:**

1. Manual setup (below)
2. Lockfile fix
3. PORT
4. Database driver swap, tested locally against plain PostgreSQL with a restored snapshot
5. Dockerfile, `.dockerignore`, `railway.json`, banner removal
6. Deploy to staging, restore the snapshot, verify
7. Rehearse the cutover
8. Production cutover

**Manual setup before coding:**

- Railway: Pro plan; Railway GitHub app with access to `mbs-practice-toolbox` only; project in EU West with `staging` and `production` environments; auto-deploy off for production; variables entered; no custom domains yet. **Railway Postgres is created only after the Replit production version has been checked (amendment 2); that check is done, so create it at major version 16, with the database time zone set to `GMT`.**
- Outside Railway: locate the Replit production database connection string (keep it out of chat and source control); install PostgreSQL client tools; create a Stripe test-mode webhook for staging only if billing is intentionally used; confirm the existing `practice-toolbox-bedrock` identity and its keys (amendment 1); confirm the DNS host; keep Replit publishing frozen (amendment 3).

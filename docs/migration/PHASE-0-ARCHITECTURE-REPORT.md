# Phase 0 architecture report

**Baseline:** `1.0.0-pre-migration-stable`  
**Prepared:** 11 September 2026  
**Purpose:** Architecture inventory for a later GitHub, Railway, and Claude Code migration. This report does not begin that migration.

## 1. System overview

Practice Toolbox is a TypeScript full-stack web application:

- React 18 single-page frontend built by Vite 5.
- Express 4 API and static-file server.
- Drizzle ORM with PostgreSQL.
- A single Node.js process currently serves the frontend, API, authentication, webhooks, and in-process scheduled jobs.
- Production build creates static frontend assets in `dist/public` and a bundled ESM server at `dist/index.js`.

Current package baseline:

- Node.js 20.
- TypeScript 5.6.
- React 18.3.
- Express 4.21.
- Vite 5.4.
- Drizzle ORM 0.39 and Drizzle Kit 0.30.
- PostgreSQL 16 in the current Replit environment.
- Puppeteer 24 with a system Chromium dependency.

## 2. Database and storage

The application uses PostgreSQL for:

- Users, organisations, roles, and sessions.
- Practice, coaching, financial review, and reporting data.
- Email Analytics contacts, mailboxes, content-free message metadata, canonical conversations, response events, outcomes, exceptions, settings, sync runs, predictions, and audit records.
- Generated valuation PDFs stored as base64 data.

Schema is declared in `shared/schema.ts` and applied in the current environment with `drizzle-kit push`. Existing numbered SQL files document some additive Email Analytics changes, but the migration journal is not the active source of truth.

Filesystem usage:

- Static attached assets are served from `attached_assets`.
- Repository-local PDFs exist under `uploads/valuations`.
- There is no current S3/object-storage implementation despite AWS credentials being available.

Railway filesystems are not a safe durable store for generated or user-owned files. Any required persistent filesystem assets must move to object storage or remain database-backed before migration.

## 3. Authentication and authorisation

Current web authentication is Replit OIDC through Passport and server-side Express sessions stored in PostgreSQL.

Replit-specific inputs include:

- `ISSUER_URL`
- `REPL_ID`
- `REPLIT_DOMAINS`
- Replit OIDC identity and redirect assumptions

Application authorisation is organisation-scoped and role-based. Email Analytics administrative routes require an admin or manager role in addition to organisation membership.

Migration requirement: replace Replit OIDC or add a portable identity provider, define stable Railway callback URLs, preserve organisation/role mapping, and migrate sessions without weakening cookie, proxy, or HTTPS controls.

## 4. External integrations

### Microsoft 365 / Graph

- Uses OAuth2 client credentials.
- Current least-privilege Exchange Application RBAC permission is `Application Mail.ReadBasic`.
- Reads message identity and metadata fields only.
- Does not request body, body preview, attachments, or headers.
- Canonical conversations merge mailbox-local Graph conversation groups through shared Internet Message IDs.

Required environment names:

- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `EMAIL_ANALYTICS_DEFAULT_MAILBOXES` when directory discovery is unavailable

### Karbon

- Calls the Karbon Contacts API and follows OData pagination.
- Stores only the identity/contact fields required to identify genuine clients and their manager.

Required environment names:

- `KARBON_API_KEY`
- `KARBON_ACCESS_KEY`

### AWS Bedrock

- Region: `eu-west-2`.
- Model: `amazon.nova-micro-v1:0`.
- Direct Bedrock Runtime design.
- Account retention mode must remain exactly `none`.
- Runtime authorisation, entitlement, and London availability checks fail closed.
- No client-content invocation has occurred, and Graph content access remains disabled.

Required environment names:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Other services

- Stripe for payments and webhook handling.
- Resend and/or SendGrid for transactional email paths.
- Anthropic SDK for existing AI analysis/reporting features outside Email Analytics.
- GHL webhook configuration exists in the Replit configuration.

Potential environment names used by these paths:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `SENDGRID_API_KEY`
- `ANTHROPIC_API_KEY`
- `APP_URL`

Only names are recorded here. Secret values must remain in managed secret stores and must not enter Git history, reports, logs, or Claude Code prompts.

## 5. Background jobs

Email Analytics uses an in-process scheduler:

- Starts when the Express application boots.
- Performs an immediate due check.
- Checks enabled settings every 60 seconds.
- Enforces a minimum 30-minute metadata refresh interval.
- Runs Karbon sync, Microsoft mailbox sync, then response-event materialisation.
- Uses process-local locks and database uniqueness constraints for idempotency.

Railway risk:

- Restarts or scale-to-zero can delay work.
- Multiple replicas can run the same schedule.
- Process-local locks do not coordinate replicas.

Migration requirement: use one dedicated Railway cron/worker process or a distributed database lock. Preserve the current unique constraints and idempotent upserts as a second line of protection.

## 6. Deployment and runtime requirements

Current commands:

- Development: `npm run dev`
- Build: `npm run build`
- Production: `npm start`
- Schema application in development: `npm run db:push`

Current server behaviour:

- Binds to `0.0.0.0`.
- Uses a fixed port `5000`.
- Refuses startup without `DATABASE_URL`, a sufficiently long `SESSION_SECRET`, and `STRIPE_SECRET_KEY`.
- Requires Chromium for Puppeteer PDF generation.

Railway requirements:

1. Read Railway's assigned `PORT` instead of assuming port 5000.
2. Provision PostgreSQL and establish an explicit migration procedure.
3. Configure trusted proxy, HTTPS cookies, session storage, and stable public URLs.
4. Install compatible Chromium or use a Railway image/buildpack that provides it.
5. Configure webhook and identity-provider callback URLs after the production hostname is known.
6. Separate web and scheduled worker responsibilities if horizontal scaling is required.
7. Add health checks and structured log retention.

## 7. Replit-specific dependencies to remove or replace

- Replit OIDC and related environment variables.
- `.replit` workflows, port declarations, deployment settings, user environment entries, and post-merge behaviour.
- `replit.nix` as the source of Chromium/system packages.
- Replit Vite development plugins.
- Replit-managed publish-time database behaviour.
- Replit development domains used by current local preview assumptions.

The application code should use portable relative same-origin API URLs. Production URL, webhook URL, and OIDC callback configuration must come from explicit Railway environment configuration.

## 8. GitHub and Claude Code preparation

Before repository transfer:

1. Confirm `.gitignore` excludes `.env`, generated credentials, logs, local database artifacts, and non-source uploads.
2. Commit an environment-variable template containing names and descriptions only.
3. Remove Replit-only workflow/deployment assumptions from the portable branch.
4. Add a documented database migration command suitable for CI/deploy, rather than relying on interactive schema push.
5. Add CI for focused tests, build, and eventually full TypeScript checking.
6. Document web, worker, and migration commands in the README.
7. Give Claude Code repository instructions that preserve:
   - Metadata-only Microsoft access unless separately approved.
   - No persisted email content.
   - Shadow-only response-event KPI until explicit approval.
   - Fail-closed Bedrock retention/readiness gates.
   - Manual classifications as authoritative.
   - No automatic exclusions without reviewed validation.

## 9. Migration risks

| Risk | Impact | Required mitigation |
| --- | --- | --- |
| Replit OIDC coupling | Users cannot sign in on Railway | Select and implement a portable identity provider before cutover |
| Fixed port | Railway health check/start failure | Honour `process.env.PORT` |
| In-process scheduler | Missed or duplicate refreshes | Dedicated worker/cron plus distributed lock |
| Interactive schema push | Uncontrolled production schema changes | Versioned, reviewed migration process |
| Local filesystem assets | Data loss across deploys | Object storage or database-backed storage |
| Chromium dependency | PDF generation failure | Explicit Railway system dependency |
| Session/proxy assumptions | Login loops or insecure cookies | Configure proxy trust, HTTPS, and persistent sessions |
| External callbacks | Stripe/OIDC/webhook failures | Re-register production URLs |
| Node 20 lifecycle | Future AWS SDK incompatibility | Plan Node 22 upgrade |
| Existing TypeScript syntax errors | CI cannot use full type-check | Repair before making `tsc` a required gate |
| Email Analytics boundary uncertainty | Misleading KPI if promoted too early | Keep shadow-only and accumulate continuous history |
| Triage validation incomplete | Unsafe exclusions | Keep content access and automatic mode disabled |

## 10. Phase 0 exit criteria

Phase 0 is complete when this inventory is reviewed and the following migration decisions are made:

- Railway service topology: web only versus web plus worker/cron.
- Authentication provider and user/organisation migration method.
- PostgreSQL migration and rollback method.
- Persistent object-storage choice.
- Node/Chromium build strategy.
- Secret ownership and rotation plan.
- Staging and production domains for OIDC and webhooks.
- Acceptance-test dataset and cutover rollback plan.

No code or data migration should start until those decisions are approved.
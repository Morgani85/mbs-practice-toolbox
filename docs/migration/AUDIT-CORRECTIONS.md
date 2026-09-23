# Pre-Git audit corrections

**Baseline:** `1.0.0-pre-migration-stable`  
**Recorded:** 23 September 2026  
**Scope:** Corrections and additions to `PHASE-0-ARCHITECTURE-REPORT.md` found by comparing it with the code before Git initialisation. No application code was changed; these items are recorded for the migration phase only.

## Corrections

1. **Authentication.** Production authentication is database-backed email/password (Passport `LocalStrategy`) in `server/auth.ts`, imported by `server/routes.ts`. It is not Replit Auth. The Phase 0 report and `replit.md` are incorrect on this point.
2. **`server/replitAuth.ts` appears unused.** Nothing imports it. It is the only code reading `REPLIT_DOMAINS`, `REPL_ID` and `ISSUER_URL`.

## Migration items not yet addressed

3. **Database driver.** `server/db.ts` uses the Neon serverless driver (`@neondatabase/serverless` over WebSockets). This requires review or change for standard Railway PostgreSQL.
4. **Port.** `server/index.ts` always listens on port 5000 instead of `process.env.PORT`.
5. **Chromium.** Chromium for Puppeteer PDF generation (valuation and management-report PDFs) is currently supplied by `replit.nix`. Railway must provide it another way.
6. **Replit banner script.** `client/index.html` loads `https://replit.com/public/js/replit-dev-banner.js`.
7. **Mail service.** The `@sendgrid/mail` dependency and `SENDGRID_API_KEY` configuration appear unused. Resend (`server/email-service.ts`) is the active mail service.
8. **`.env.example` is incomplete.** It omits `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MICROSOFT_*`, `KARBON_*`, `AWS_*`, `ANTHROPIC_API_KEY`, `APP_URL` and `EMAIL_ANALYTICS_DEFAULT_MAILBOXES`, and lists the unused `SENDGRID_API_KEY`. Update it during migration.

# Email Analytics pre-migration stability report

**Build:** `1.0.0-pre-migration-stable`  
**Evidence captured:** 11 September 2026, Europe/London  
**Scope:** Email Analytics only. No migration work or unrelated feature development was started.

## Release decision

Email Analytics is stable for the pre-migration baseline with the response-event KPI remaining shadow-only.

- Production KPI cards are unchanged.
- Automatic email exclusions remain disabled.
- Microsoft Graph content access remains disabled.
- No email body, preview, attachment, prompt, or model output was accessed, persisted, or logged.
- The approved 60-day response-event measurement window has been rebuilt from the metadata backfill, with a seven-day pre-window boundary context.

## Shadow KPI snapshot

| Period | Event KPI | Previous period | Movement | Successful | Reportable | Pending | Failures | Excluded manually | Boundary uncertain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Last 7 days | 16.7% | 28.6% | -11.9 pp | 1 | 6 | 2 | 5 | 0 | 11 |
| Last 30 days | 26.1% | 23.5% | +2.6 pp | 6 | 23 | 2 | 17 | 0 | 61 |

Previous-period reportable counts were 7 for the prior seven days and 34 for the prior 30 days. Not-yet-due pending events and boundary-uncertain events are excluded from numerator and denominator. Reliable pending events whose deadline has matured are reportable failures until management records a final outcome.

The high boundary-uncertain count is expected from a conservative backfill: an event is not promoted into the KPI unless the available history proves a preceding conversation boundary. It will reduce naturally as the system accumulates continuous metadata.

## Old versus event-based KPI

| Period | Legacy conversation KPI | Event KPI | Event-based difference |
| --- | ---: | ---: | ---: |
| Last 7 days | 11.8% | 16.7% | +4.9 pp |
| Previous 7 days | 12.0% | 28.6% | +16.6 pp |
| Last 30 days | 12.9% | 26.1% | +13.2 pp |
| Previous 30 days | 11.8% | 23.5% | +11.7 pp |

The legacy KPI measures only each conversation's latest client message. The event KPI measures each distinct response obligation and consolidates consecutive client messages until an MBS response or final manual handling boundary. It also excludes uncertain historical boundaries. These cohort differences explain why the percentages and denominators differ.

Representative content-free records:

- Pass: response event `6437`, received 9 September 2026 at 17:14 UTC and answered 10 September at 09:22 UTC.
- Matured failure awaiting final review: response event `6439`, received 10 September at 11:56 UTC, deadline 11 September at 11:56 UTC, with no response.
- Excluded from reporting because its historical boundary is uncertain: response event `6442`, received 10 September at 11:17 UTC.
- No final `no_response_required` exclusions existed in the dataset at capture time, so no synthetic or misleading example was created.

## Manual review, audit, and later responses

Code and database controls were verified:

- Monday overdue review selects only reliable, pending events whose deadline has passed.
- The current review queue contained 36 eligible events at capture time.
- A final manual classification updates the event and writes an immutable response-event audit row.
- Reopening a conversation restores its latest response event to the metadata-derived automatic state and writes both conversation and response-event audit records.
- A later MBS response never overwrites a final manual decision. It creates a management exception for confirmation or correction.
- Exception confirmation/correction is separately audited.

The current dataset contained no manual response-event outcomes, reopen records, or later-response exceptions, so these paths were verified by code and database-constraint inspection rather than by changing real client records. They were not claimed as live-data tests.

## Reliability evidence

- Two consecutive live Karbon and Microsoft metadata refreshes completed successfully.
- Sync runs for both Karbon and mailbox metadata were recorded as `succeeded`.
- Message identity duplicates: 0.
- Mailbox conversation-group duplicates: 0.
- Active response-event trigger duplicates: 0.
- The dataset contained 53 Internet Message IDs observed in more than one mailbox, confirming that real cross-mailbox copies are being consolidated.
- A database-backed double rebuild assertion preserved the same 199 event identities and outcomes, with 0 retired artifacts.
- Graph and Karbon page calls use bounded exponential retry; Microsoft token acquisition is now also retried.
- A total mailbox failure no longer advances the successful-sync timestamp, allowing the scheduler to retry rather than suppressing the next run.
- Response-event materialisation has its own durable run status. A failure marks that run failed, fails the parent refresh, leaves the organisation success timestamp unchanged, and remains due for retry.
- A partial mailbox result is recorded as partial, returned to the caller as an incomplete refresh, and is not materialised or treated as the organisation's successful refresh.
- The scheduler starts at application boot, performs an immediate due check, then checks every minute for settings whose minimum 30-minute interval has elapsed. It does not depend on a user login.
- The persisted message table contains identifiers, sender metadata, subject, timestamps, direction, and an Outlook link. It has no body, preview, attachment, prompt, or model-output field.

## Automatic triage decision

Automatic triage was deliberately deferred:

- Bedrock Runtime safety passes in `eu-west-2` for `amazon.nova-micro-v1:0`.
- Account retention mode is exactly `none`.
- Microsoft Graph content access is `not_enabled`.
- There are 0 shadow predictions and 0 directly labelled validation examples; 25 are required.
- Automatic activation remains blocked, and automatic exclusions remain disabled.

This deferral does not block migration.

## Verification

- Automated deterministic tests cover multiple client messages, a later response obligation, cross-mailbox duplicate copies, and reliable/uncertain boundaries.
- A database-backed assertion covers repeated materialisation, stable event state, absence of retired artifacts, and matured-only overdue output.
- Focused triage safety tests pass.
- Production build passes.
- The application starts and serves on its configured workflow.
- Full `npm run check` remains blocked by pre-existing syntax errors in `server/ai-analysis-broken.ts`; this file is outside the Email Analytics change.

## Outstanding issues after the freeze

1. Accumulate enough continuous metadata to reduce the boundary-uncertain cohort before considering production KPI replacement.
2. Collect at least 25 direct manual labels before any future content-access or automatic-triage approval.
3. Add Railway-safe distributed scheduling or a single cron worker before running more than one application replica.
4. Upgrade from Node 20 before the AWS SDK's announced Node 22 support requirement takes effect in 2027.
5. Repair the pre-existing TypeScript syntax errors so the full type-check can become a release gate.
6. Consider a response-event audit-history viewer after migration; the audit is currently persisted but not exposed in the Email Analytics UI.

No production KPI replacement should occur without explicit user approval.
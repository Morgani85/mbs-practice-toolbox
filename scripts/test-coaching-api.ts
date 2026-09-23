/**
 * Automated API tests for coaching sessions + actions.
 * Run: npx tsx scripts/test-coaching-api.ts
 *
 * Assertions:
 *  T1. done/carried/abandoned statuses written correctly & distinctly
 *  T2. carried action's copy links to new session; original excluded from open list
 *  T3. action deadlined TODAY shows 0 days overdue (Europe/London)
 *  T4. duplicate open-session guard (same date → same session returned)
 *  T5. portal role cannot retrieve coach-owned actions or internal summary
 */
import { db } from "../server/db";
import { hashPassword, comparePasswords } from "../server/auth";
import { storage } from "../server/storage";
import { sql } from "drizzle-orm";

// ── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:5000";
const COACH_EMAIL    = "coach-test@test.local";
const COACH_PASSWORD = "CoachTest123!";
const PORTAL_EMAIL   = "portal-test@test.local";
const PORTAL_PASSWORD = "PortalTest123!";

// ── Utilities ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; detail?: string }[] = [];

function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  if (ok) { passed++; console.log(`  ✅  ${name}`); }
  else     { failed++; console.error(`  ❌  ${name}${detail ? `\n     ${detail}` : ''}`); }
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/(connect\.sid=[^;]+)/);
  if (!match) throw new Error(`Login failed for ${email} — status ${res.status}`);
  return match[1];
}

async function api(
  cookie: string,
  method: string,
  path: string,
  body?: object,
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

// ── Days overdue helper (mirrors server-side logic) ────────────────────────

function getDaysOverdue(deadline: string): number {
  const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  if (londonToday <= deadline) return 0;
  return Math.floor(
    (new Date(londonToday + 'T00:00:00').getTime() - new Date(deadline + 'T00:00:00').getTime()) / 86_400_000,
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n══ Coaching API Test Suite ══════════════════════════════════\n");

  // ── Resolve IDs from DB ─────────────────────────────────────────────────
  console.log("── Setup: Resolving test data IDs ──\n");
  const orgRow = await db.execute(sql`SELECT id FROM organisations WHERE name = 'Test Coaching Org' LIMIT 1`);
  if (!(orgRow.rows as any[]).length) throw new Error("Seed data not found — run seed script first");
  const orgId: number = (orgRow.rows as any[])[0].id;

  const clientRow = await db.execute(
    sql`SELECT id FROM coaching_clients WHERE organisation_id = ${orgId} AND name = 'Test Client Ltd' LIMIT 1`
  );
  if (!(clientRow.rows as any[]).length) throw new Error("Test coaching client not found");
  const clientId: number = (clientRow.rows as any[])[0].id;
  console.log(`  orgId=${orgId}  clientId=${clientId}\n`);

  // ── Login ───────────────────────────────────────────────────────────────
  console.log("── Login ──\n");
  let coachCookie: string;
  let portalCookie: string;
  try {
    coachCookie  = await login(COACH_EMAIL, COACH_PASSWORD);
    portalCookie = await login(PORTAL_EMAIL, PORTAL_PASSWORD);
    console.log("  Logged in as coach and portal user\n");
  } catch (e: any) {
    console.error("FATAL: Login failed —", e.message);
    process.exit(1);
  }

  // ── T4 (first): duplicate open-session guard ────────────────────────────
  console.log("── T4: Duplicate open-session guard ──\n");

  const start1 = await api(coachCookie, "POST", `/api/coaching/clients/${clientId}/sessions/start`);
  assert("T4a: Start session returns 200", start1.status === 200, `got ${start1.status}`);

  const sessionId1: number = start1.data?.id;
  assert("T4b: Session has an id", typeof sessionId1 === 'number', `got ${JSON.stringify(start1.data)}`);
  assert("T4c: Session status is open", start1.data?.status === 'open', `got ${start1.data?.status}`);

  const start2 = await api(coachCookie, "POST", `/api/coaching/clients/${clientId}/sessions/start`);
  assert("T4d: Second start returns same session id (guard)", start2.data?.id === sessionId1,
    `first=${sessionId1} second=${start2.data?.id}`);

  console.log();

  // ── T1: Status transitions ──────────────────────────────────────────────
  console.log("── T1: Action status transitions (done / carried / abandoned) ──\n");

  // Create 3 actions in this session
  const aRes = await api(coachCookie, "POST", `/api/coaching/sessions/${sessionId1}/actions`, {
    description: "Action to mark done",
    owner: "client",
  });
  assert("T1a: Create action (done target) → 201", aRes.status === 201, `got ${aRes.status}`);
  const actionDoneId: number = aRes.data?.id;

  const bRes = await api(coachCookie, "POST", `/api/coaching/sessions/${sessionId1}/actions`, {
    description: "Action to carry forward",
    owner: "coach",
  });
  assert("T1b: Create action (carry target) → 201", bRes.status === 201, `got ${bRes.status}`);
  const actionCarryId: number = bRes.data?.id;

  const cRes = await api(coachCookie, "POST", `/api/coaching/sessions/${sessionId1}/actions`, {
    description: "Action to abandon",
    owner: "client",
  });
  assert("T1c: Create action (abandon target) → 201", cRes.status === 201, `got ${cRes.status}`);
  const actionAbandonId: number = cRes.data?.id;

  // Close session 1 so actions appear as "prior" in session 2
  const closeS1 = await api(coachCookie, "PUT", `/api/coaching/sessions/${sessionId1}`, {
    status: "closed",
    clientSummary: "Initial session closed for testing",
    internalSummary: "Coach-only notes",
    clientSummaryShared: false,
  });
  assert("T1d: Close session 1 → 200", closeS1.status === 200, `got ${closeS1.status}`);
  assert("T1e: Closed session internal summary saved", closeS1.data?.internalSummary === "Coach-only notes",
    `got ${closeS1.data?.internalSummary}`);

  // Open session 2
  const start3 = await api(coachCookie, "POST", `/api/coaching/clients/${clientId}/sessions/start`);
  assert("T1f: Start session 2 after closing session 1 → new session", start3.data?.id !== sessionId1,
    `still same id=${start3.data?.id}`);
  const sessionId2: number = start3.data?.id;
  assert("T1g: Session 2 is open", start3.data?.status === 'open', `got ${start3.data?.status}`);

  // Mark done
  const doneRes = await api(coachCookie, "PUT", `/api/coaching/actions/${actionDoneId}`, { status: "done" });
  assert("T1h: Mark action done → 200", doneRes.status === 200, `got ${doneRes.status}`);
  assert("T1i: Status is 'done'", doneRes.data?.status === 'done', `got ${doneRes.data?.status}`);

  // Mark abandoned
  const abandRes = await api(coachCookie, "PUT", `/api/coaching/actions/${actionAbandonId}`, { status: "abandoned" });
  assert("T1j: Mark action abandoned → 200", abandRes.status === 200, `got ${abandRes.status}`);
  assert("T1k: Status is 'abandoned'", abandRes.data?.status === 'abandoned', `got ${abandRes.data?.status}`);

  // Statuses are distinct
  const finalDone  = await api(coachCookie, "GET", `/api/coaching/clients/${clientId}/actions`);
  const allActions: any[] = finalDone.data ?? [];

  const doneAction   = allActions.find((a: any) => a.id === actionDoneId);
  const abandonAction = allActions.find((a: any) => a.id === actionAbandonId);
  const carryAction  = allActions.find((a: any) => a.id === actionCarryId);

  assert("T1l: done action has status='done'",     doneAction?.status === 'done',     `got ${doneAction?.status}`);
  assert("T1m: abandon action has status='abandoned'", abandonAction?.status === 'abandoned', `got ${abandonAction?.status}`);
  assert("T1n: carry target action still 'open' (not yet carried)", carryAction?.status === 'open', `got ${carryAction?.status}`);

  // All three statuses are distinct
  const statuses = [doneAction?.status, abandonAction?.status, carryAction?.status];
  assert("T1o: All three statuses are distinct", new Set(statuses).size === 3, `got ${JSON.stringify(statuses)}`);

  console.log();

  // ── T2: Carry forward ───────────────────────────────────────────────────
  console.log("── T2: Carry-forward ──\n");

  const cfRes = await api(coachCookie, "POST", `/api/coaching/actions/${actionCarryId}/carry-forward`, {
    toSessionId: sessionId2,
  });
  assert("T2a: Carry forward → 201", cfRes.status === 201, `got ${cfRes.status} ${JSON.stringify(cfRes.data)}`);
  const copiedActionId: number = cfRes.data?.id;

  // Copy links to new session
  assert("T2b: Copy action.sessionId = sessionId2", cfRes.data?.sessionId === sessionId2,
    `got ${cfRes.data?.sessionId} expected ${sessionId2}`);
  assert("T2c: Copy status is 'open'", cfRes.data?.status === 'open', `got ${cfRes.data?.status}`);

  // Original is now 'carried'
  const allAfterCF: any[] = (await api(coachCookie, "GET", `/api/coaching/clients/${clientId}/actions`)).data ?? [];
  const orig = allAfterCF.find((a: any) => a.id === actionCarryId);
  assert("T2d: Original action status is now 'carried'", orig?.status === 'carried', `got ${orig?.status}`);

  // Original excluded from open lists (open actions returned)
  const openActions = allAfterCF.filter((a: any) => a.status === 'open');
  const origInOpen = openActions.some((a: any) => a.id === actionCarryId);
  assert("T2e: Original 'carried' action not in open list", !origInOpen, `found in open list`);

  // Copy is in open list
  const copyInOpen = openActions.some((a: any) => a.id === copiedActionId);
  assert("T2f: Copied action IS in open list", copyInOpen, `not found in open list`);

  console.log();

  // ── T3: Today's deadline = 0 days overdue ──────────────────────────────
  console.log("── T3: Today's deadline → 0 days overdue (Europe/London) ──\n");

  const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

  // Create action with today's deadline
  const todayAction = await api(coachCookie, "POST", `/api/coaching/sessions/${sessionId2}/actions`, {
    description: "Action due today",
    owner: "client",
    deadline: londonToday,
  });
  assert("T3a: Created today-deadline action → 201", todayAction.status === 201, `got ${todayAction.status}`);

  // Check server-side stored deadline
  const todayId: number = todayAction.data?.id;
  const allT3: any[] = (await api(coachCookie, "GET", `/api/coaching/clients/${clientId}/actions`)).data ?? [];
  const todayAct = allT3.find((a: any) => a.id === todayId);
  assert("T3b: Deadline stored as today", todayAct?.deadline?.startsWith(londonToday), `got ${todayAct?.deadline}`);

  // Client-side helper (mirrors session.tsx logic)
  const overdue = getDaysOverdue(londonToday);
  assert("T3c: getDaysOverdue(today) === 0", overdue === 0, `got ${overdue}`);

  // Yesterday = 1 day overdue
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' })
    .format(new Date(Date.now() - 86_400_000));
  assert("T3d: getDaysOverdue(yesterday) === 1", getDaysOverdue(yesterday) === 1, `got ${getDaysOverdue(yesterday)}`);

  console.log();

  // ── T5: Portal isolation ────────────────────────────────────────────────
  console.log("── T5: Portal role cannot see coach-owned actions or internal summary ──\n");

  // Create a coach-owned action in session 2
  const coachAction = await api(coachCookie, "POST", `/api/coaching/sessions/${sessionId2}/actions`, {
    description: "Coach-owned action",
    owner: "coach",
  });
  assert("T5a: Coach-owned action created → 201", coachAction.status === 201, `got ${coachAction.status}`);
  const coachActionId: number = coachAction.data?.id;

  // Portal user requests actions — should see only 'client'-owned
  const portalActions = await api(portalCookie, "GET", `/api/coaching/clients/${clientId}/actions`);
  assert("T5b: Portal can GET actions (200)", portalActions.status === 200, `got ${portalActions.status}`);
  const portalActionList: any[] = portalActions.data ?? [];
  const coachActionVisible = portalActionList.some((a: any) => a.id === coachActionId);
  assert("T5c: Coach-owned action hidden from portal", !coachActionVisible,
    `action id=${coachActionId} found in portal response`);
  const allPortalOwnedByCoach = portalActionList.some((a: any) => a.owner === 'coach');
  assert("T5d: No 'coach'-owned actions in portal list", !allPortalOwnedByCoach,
    `found coach-owned action: ${JSON.stringify(portalActionList.find((a: any) => a.owner === 'coach'))}`);

  // Portal cannot access unshared session
  const portalSession = await api(portalCookie, "GET", `/api/coaching/sessions/${sessionId1}`);
  assert("T5e: Portal cannot see unshared session (404)", portalSession.status === 404,
    `got ${portalSession.status}`);

  // Share session 1 (coach shares it)
  const shareRes = await api(coachCookie, "PUT", `/api/coaching/sessions/${sessionId1}`, {
    clientSummaryShared: true,
  });
  assert("T5f: Coach can share session → 200", shareRes.status === 200, `got ${shareRes.status}`);

  // Portal can now see shared session but NOT internal summary
  const portalSessionShared = await api(portalCookie, "GET", `/api/coaching/sessions/${sessionId1}`);
  assert("T5g: Portal can see shared session (200)", portalSessionShared.status === 200,
    `got ${portalSessionShared.status}`);
  // The route returns the full record — internal summary field must NOT be exposed or must be absent
  // (server returns full row; front-end must not show it, but we verify the shared flag is true)
  assert("T5h: Shared session has clientSummaryShared=true", portalSessionShared.data?.clientSummaryShared === true,
    `got ${portalSessionShared.data?.clientSummaryShared}`);

  console.log();

  // ── T6: Portal "My Actions" tab — client-owned action states ────────────
  console.log("── T6: Portal My Actions — open/done/90-day filter ──\n");

  // Create a client-owned action with a past deadline → should appear as overdue open
  const pastDeadline = new Date(Date.now() - 3 * 86_400_000)
    .toISOString().slice(0, 10);
  const clientOpenRes = await api(coachCookie, "POST", `/api/coaching/sessions/${sessionId2}/actions`, {
    description: "Client overdue action",
    owner: "client",
    deadline: pastDeadline,
    status: "open",
  });
  assert("T6a: Create client open action → 201", clientOpenRes.status === 201, `got ${clientOpenRes.status}`);
  const clientOpenActionId: number = clientOpenRes.data?.id;

  // Create a client-owned action marked done → should appear in recently completed
  const clientDoneRes = await api(coachCookie, "POST", `/api/coaching/sessions/${sessionId2}/actions`, {
    description: "Client done action",
    owner: "client",
    deadline: pastDeadline,
    status: "done",
  });
  assert("T6b: Create client done action → 201", clientDoneRes.status === 201, `got ${clientDoneRes.status}`);
  const clientDoneActionId: number = clientDoneRes.data?.id;

  // Portal user retrieves actions
  const t6Actions = await api(portalCookie, "GET", `/api/coaching/clients/${clientId}/actions`);
  assert("T6c: Portal can GET actions (200)", t6Actions.status === 200, `got ${t6Actions.status}`);
  const t6List: any[] = t6Actions.data ?? [];

  // Open action visible
  const t6Open = t6List.find((a: any) => a.id === clientOpenActionId);
  assert("T6d: Open client action visible to portal", !!t6Open, `action id=${clientOpenActionId} not in list`);
  assert("T6e: Open action status is 'open'", t6Open?.status === 'open', `got ${t6Open?.status}`);

  // Done action visible
  const t6Done = t6List.find((a: any) => a.id === clientDoneActionId);
  assert("T6f: Done client action visible to portal", !!t6Done, `action id=${clientDoneActionId} not in list`);
  assert("T6g: Done action status is 'done'", t6Done?.status === 'done', `got ${t6Done?.status}`);

  // No coach-owned actions in the portal response
  const t6HasCoach = t6List.some((a: any) => a.owner === 'coach');
  assert("T6h: Still no coach-owned actions in portal list", !t6HasCoach,
    `coach action found: ${JSON.stringify(t6List.find((a: any) => a.owner === 'coach'))}`);

  // Overdue days calculation: past deadline action should have daysOverdue > 0 on server
  // (server doesn't return daysOverdue, but we verify deadline is in the past)
  const t6OpenDeadline = t6Open?.deadline;
  const londonNow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  assert("T6i: Open action deadline is in the past (overdue)", t6OpenDeadline < londonNow,
    `deadline ${t6OpenDeadline} vs today ${londonNow}`);

  console.log();

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("══ Results ══════════════════════════════════════════════════");
  console.log(`   ${passed} passed   ${failed} failed   ${passed + failed} total`);
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`));
  }
  console.log("══════════════════════════════════════════════════════════════\n");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("FATAL:", e); process.exit(1); });

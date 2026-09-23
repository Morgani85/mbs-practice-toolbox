/**
 * Seed development DB with coaching test data.
 * Run: npx tsx scripts/seed-coaching-test.ts
 */
import { db } from "../server/db";
import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";
import { sql } from "drizzle-orm";

function requireSeedEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required seed environment variable: ${name}`);
  return value;
}

const COACH_EMAIL = requireSeedEnv('COACH_TEST_EMAIL');
const COACH_PASSWORD = requireSeedEnv('COACH_TEST_PASSWORD');
const PORTAL_EMAIL = requireSeedEnv('PORTAL_TEST_EMAIL');
const PORTAL_PASSWORD = requireSeedEnv('PORTAL_TEST_PASSWORD');
const TEST_ORG_NAME  = "Test Coaching Org";

async function run() {
  console.log("── Seeding coaching test data ──────────────────────────");

  // 1. Organisation — find or create
  let org = await db.execute(
    sql`SELECT id FROM organisations WHERE name = ${TEST_ORG_NAME} LIMIT 1`
  );
  let orgId: number;
  if ((org.rows as any[]).length === 0) {
    const ins = await db.execute(
      sql`INSERT INTO organisations (name, slug, subscription_status, is_onboarding_complete, is_exempt)
          VALUES (${TEST_ORG_NAME}, 'test-coaching-org', 'active', true, true)
          RETURNING id`
    );
    orgId = (ins.rows as any[])[0].id;
    console.log(`Created org id=${orgId}`);
  } else {
    orgId = (org.rows as any[])[0].id;
    console.log(`Reusing org id=${orgId}`);
  }

  // 2. Coach user (admin)
  const coachPw = await hashPassword(COACH_PASSWORD);
  await db.execute(
    sql`INSERT INTO users (organisation_id, email, password, first_name, last_name, role, is_active)
        VALUES (${orgId}, ${COACH_EMAIL}, ${coachPw}, 'Coach', 'Test', 'admin', true)
        ON CONFLICT (email) DO UPDATE SET password = ${coachPw}, organisation_id = ${orgId}, role = 'admin', is_active = true`
  );
  const coachRow = await db.execute(sql`SELECT id FROM users WHERE email = ${COACH_EMAIL} LIMIT 1`);
  const coachId: number = (coachRow.rows as any[])[0].id;
  console.log(`Coach user created: id=${coachId}`);

  // 3. Portal user (coaching_client)
  const portalPw = await hashPassword(PORTAL_PASSWORD);
  await db.execute(
    sql`INSERT INTO users (organisation_id, email, password, first_name, last_name, role, is_active)
        VALUES (${orgId}, ${PORTAL_EMAIL}, ${portalPw}, 'Portal', 'Client', 'coaching_client', true)
        ON CONFLICT (email) DO UPDATE SET password = ${portalPw}, organisation_id = ${orgId}, role = 'coaching_client', is_active = true`
  );
  const portalRow = await db.execute(sql`SELECT id FROM users WHERE email = ${PORTAL_EMAIL} LIMIT 1`);
  const portalUserId: number = (portalRow.rows as any[])[0].id;
  console.log(`Portal user created: id=${portalUserId}`);

  // 4. Coaching client record (linked to portal user, portal enabled)
  let ccRow = await db.execute(
    sql`SELECT id FROM coaching_clients WHERE organisation_id = ${orgId} AND name = 'Test Client Ltd' LIMIT 1`
  );
  let clientId: number;
  if ((ccRow.rows as any[]).length === 0) {
    const ins = await db.execute(
      sql`INSERT INTO coaching_clients (organisation_id, name, company_name, email, portal_enabled, linked_user_id)
          VALUES (${orgId}, 'Test Client Ltd', 'Test Client Ltd', ${PORTAL_EMAIL}, true, ${portalUserId})
          RETURNING id`
    );
    clientId = (ins.rows as any[])[0].id;
    console.log(`Created coaching client id=${clientId}`);
  } else {
    clientId = (ccRow.rows as any[])[0].id;
    await db.execute(
      sql`UPDATE coaching_clients SET portal_enabled = true, linked_user_id = ${portalUserId} WHERE id = ${clientId}`
    );
    console.log(`Reusing coaching client id=${clientId} (updated portal link)`);
  }

  // 5. Quarterly objectives (current quarter)
  const now = new Date();
  const qtr = Math.ceil((now.getMonth() + 1) / 3);
  const yr  = now.getFullYear();

  await db.execute(
    sql`INSERT INTO coaching_quarterly_objectives (organisation_id, client_id, quarter, year, objective, status)
        VALUES
          (${orgId}, ${clientId}, ${qtr}, ${yr}, 'Grow monthly recurring revenue by 15%', 'in_progress'),
          (${orgId}, ${clientId}, ${qtr}, ${yr}, 'Hire and onboard a senior accounts manager', 'not_started')
        ON CONFLICT DO NOTHING`
  );
  console.log(`Seeded 2 Q${qtr} ${yr} objectives for client id=${clientId}`);

  // 6. Strategic goals (1-year)
  await db.execute(
    sql`INSERT INTO coaching_strategic_goals (organisation_id, client_id, horizon, specific, target_date)
        VALUES
          (${orgId}, ${clientId}, '1year', 'Achieve Investors in People Silver accreditation', ${String(yr + 1) + '-03-31'}),
          (${orgId}, ${clientId}, '1year', 'Open second office location', ${String(yr + 1) + '-06-30'})
        ON CONFLICT DO NOTHING`
  );
  console.log(`Seeded 2 strategic goals for client id=${clientId}`);

  console.log("");
  console.log("── Credentials ─────────────────────────────────────────");
  console.log('  Coach (admin) test user created');
  console.log('  Portal (client) test user created');
  console.log(`  orgId=${orgId}  coachingClientId=${clientId}`);
  console.log("────────────────────────────────────────────────────────");

  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });

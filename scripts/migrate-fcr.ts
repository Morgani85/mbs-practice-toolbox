import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS financial_clarity_reviews (
      id SERIAL PRIMARY KEY,
      organisation_id INTEGER NOT NULL REFERENCES organisations(id),
      business_name VARCHAR,
      contact VARCHAR,
      turnover VARCHAR,
      employees VARCHAR,
      industry VARCHAR,
      current_accountant VARCHAR,
      referral_source VARCHAR,
      review_date DATE,
      adviser VARCHAR,
      bookkeeping_quality VARCHAR,
      compliance_confidence VARCHAR,
      vat_up_to_date VARCHAR,
      accounts_up_to_date VARCHAR,
      tax_surprises VARCHAR,
      software_confidence VARCHAR,
      owner_confidence_in_numbers INTEGER,
      chaos_notes TEXT,
      chaos_status VARCHAR,
      management_accounts VARCHAR,
      kpis VARCHAR,
      cashflow_visibility VARCHAR,
      department_profitability VARCHAR,
      regular_review_meetings VARCHAR,
      financial_understanding VARCHAR,
      decision_confidence INTEGER,
      clarity_notes TEXT,
      clarity_status VARCHAR,
      business_goals VARCHAR,
      quarterly_reviews VARCHAR,
      pricing_confidence VARCHAR,
      profit_focus VARCHAR,
      tax_planning VARCHAR,
      accountability VARCHAR,
      performance_status VARCHAR,
      performance_notes TEXT,
      budget VARCHAR,
      cashflow_forecast VARCHAR,
      scenario_planning VARCHAR,
      performance_dashboard VARCHAR,
      board_level_support VARCHAR,
      exit_planning VARCHAR,
      leadership_status VARCHAR,
      leadership_notes TEXT,
      biggest_challenges TEXT,
      opportunity1 TEXT,
      opportunity2 TEXT,
      opportunity3 TEXT,
      recommended_next_step VARCHAR,
      ai_report TEXT,
      socket_handover TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log('Migration done: financial_clarity_reviews table created');
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });

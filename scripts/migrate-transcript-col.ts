import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  await pool.query(`ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS transcript text`);
  console.log('Migration done: transcript column added');
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });

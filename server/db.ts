import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket constructor for Neon with proper error handling
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Conservative connection pool settings optimized for Neon
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1, // Use single connection to avoid connection issues
  idleTimeoutMillis: 60000, // 1 minute
  connectionTimeoutMillis: 10000, // 10 seconds
});

// Add comprehensive error handling
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't throw here, just log
});

pool.on('connect', () => {
  console.log('Database pool connected successfully');
});

export { pool };
export const db = drizzle({ client: pool, schema });
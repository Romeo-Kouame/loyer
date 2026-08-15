import { Pool, types } from 'pg';
import { config } from './environment';

// Keep DATE columns as plain 'YYYY-MM-DD' strings instead of pg's default
// JS Date objects, which are timezone-ambiguous at midnight.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

// Hosted Postgres (Neon, Supabase, etc.) requires TLS and isn't reachable via
// discrete host/port/user fields behind their pooler - use the connection
// string directly. Local Docker Postgres has no valid cert, so SSL is only
// requested outside development.
export const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
});

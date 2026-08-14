import { Pool, types } from 'pg';
import { config } from './environment';

// Keep DATE columns as plain 'YYYY-MM-DD' strings instead of pg's default
// JS Date objects, which are timezone-ambiguous at midnight.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.username,
  password: config.database.password,
  database: config.database.database,
});

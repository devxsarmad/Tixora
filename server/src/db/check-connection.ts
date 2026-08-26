// Usage:
// Verifies that DATABASE_URL points to a reachable PostgreSQL database. Run with
// npm run db:check after starting Docker Postgres.

import { pool } from './pool.js';

try {
  const result = await pool.query<{
    database_name: string;
    current_user: string;
    server_time: Date;
  }>(`
    SELECT
      current_database() AS database_name,
      current_user AS current_user,
      now() AS server_time
  `);

  console.log('Connected to PostgreSQL');
  console.log(result.rows[0]);
} finally {
  await pool.end();
}

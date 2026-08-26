// Usage:
// Creates one shared pg.Pool for the whole Express process. Routes should use
// this pool instead of opening a new database connection per request.

import pg from 'pg';
import { env } from '../config/env.js';

type QueryRow = pg.QueryResultRow;

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000
});

pool.on('error', (error) => {
  console.error('Unexpected idle PostgreSQL client error', error);
});

export async function query<T extends QueryRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

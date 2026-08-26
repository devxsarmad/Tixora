// Usage:
// Applies or rolls back raw SQL migration files in db/migrations. Run:
// npm run db:migrate
// npm run db:rollback

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';

const direction = process.argv[2];
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../db/migrations'
);

const client = new pg.Client({ connectionString: env.DATABASE_URL });

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getMigrationFiles() {
  const files = await readdir(migrationsDir);

  return files
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .sort();
}

async function migrateUp() {
  await ensureMigrationsTable();

  const appliedResult = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC'
  );
  const applied = new Set(appliedResult.rows.map((row) => row.filename));
  const files = await getMigrationFiles();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping already applied migration: ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying migration: ${file}`);
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
      file
    ]);
  }
}

async function migrateDown() {
  await ensureMigrationsTable();

  const latestResult = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 1'
  );
  const latest = latestResult.rows[0];

  if (!latest) {
    console.log('No migrations to roll back');
    return;
  }

  const downFile = latest.filename.replace(/\.sql$/, '.down.sql');
  const sql = await readFile(path.join(migrationsDir, downFile), 'utf8');

  console.log(`Rolling back migration: ${latest.filename}`);
  await client.query(sql);
  await client.query('DELETE FROM schema_migrations WHERE filename = $1', [
    latest.filename
  ]);
}

if (direction !== 'up' && direction !== 'down') {
  console.error('Usage: tsx src/db/migrate.ts <up|down>');
  process.exit(1);
}

await client.connect();

try {
  if (direction === 'up') {
    await migrateUp();
  } else {
    await migrateDown();
  }
} finally {
  await client.end();
}

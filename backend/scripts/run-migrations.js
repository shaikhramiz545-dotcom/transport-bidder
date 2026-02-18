const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL;

let config;

if (databaseUrl) {
  config = {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true },
  };
} else {
  const host = process.env.PG_HOST || 'localhost';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const useSsl = process.env.PG_SSL === 'true' || process.env.PG_SSL === '1' || (!isLocal && process.env.PG_SSL !== 'false');

  config = {
    host,
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DATABASE || 'tbidder',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    ssl: useSsl ? { rejectUnauthorized: true } : false,
  };
}

const migrationsDir = path.join(__dirname, '..', 'migrations');

async function run() {
  const pool = new Pool(config);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        name       TEXT UNIQUE NOT NULL,
        run_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[migrate] No .sql files in migrations/');
      return;
    }

    for (const file of files) {
      const name = file;
      const { rows } = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [name]
      );
      if (rows.length > 0) {
        console.log('[migrate] Skip (already run):', name);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [name]
        );
        await client.query('COMMIT');
        console.log('[migrate] Ran:', name);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[migrate] Failed:', name, err.message);
        throw err;
      } finally {
        client.release();
      }
    }

    console.log('[migrate] Done.');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

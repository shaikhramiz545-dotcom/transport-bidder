const { Client } = require('pg');

async function main() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: true },
  });

  await client.connect();

  const r = await client.query(
    "select table_schema, table_name from information_schema.tables where table_schema='public' order by table_name"
  );

  console.log('PUBLIC TABLES COUNT:', r.rowCount);
  console.log('PUBLIC TABLES:');
  for (const row of r.rows) {
    console.log('-', row.table_name);
  }

  await client.end();
}

main().catch((e) => {
  console.error('DB CHECK FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});

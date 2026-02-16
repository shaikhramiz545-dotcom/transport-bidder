const { Pool } = require('pg');
const { Sequelize } = require('sequelize');
const config = require('./index');

// Local dev: localhost = no SSL. Cloud (e.g. RDS): set PG_HOST + PG_SSL=true in .env
console.log('[DB] Connecting to host:', config.pg.host, config.pg.ssl ? '(SSL)' : '(no SSL, local)');

const useSsl = config.pg.ssl === true;
const sequelize = new Sequelize(config.pg.database, config.pg.user, config.pg.password, {
  host: config.pg.host,
  port: config.pg.port,
  dialect: 'postgres',
  logging: config.env === 'development' ? console.log : false,
  dialectOptions: {
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  },
});

const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  database: config.pg.database,
  user: config.pg.user,
  password: config.pg.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development' && duration > 100) {
      console.log('[DB] Slow query', { text: text.slice(0, 80), duration });
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    throw err;
  }
}

async function healthCheck() {
  try {
    const res = await query('SELECT 1 AS ok');
    return res.rows[0]?.ok === 1;
  } catch (err) {
    return false;
  }
}

module.exports = { pool, query, healthCheck, sequelize };

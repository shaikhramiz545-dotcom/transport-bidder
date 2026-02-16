#!/usr/bin/env node
/**
 * Clean all driver-related data from PostgreSQL
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../src/config/db');

async function cleanDriverData() {
  try {
    console.log('Fetching table list...');
    const tablesRes = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND (tablename LIKE '%driver%' OR tablename LIKE '%wallet%' OR tablename = 'app_users')
      ORDER BY tablename
    `);
    
    console.log('Tables found:', tablesRes.rows.map(r => r.tablename).join(', '));
    
    for (const row of tablesRes.rows) {
      const tableName = row.tablename;
      try {
        await pool.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
        console.log(`✓ Truncated: ${tableName}`);
      } catch (err) {
        console.warn(`✗ Failed to truncate ${tableName}:`, err.message);
      }
    }
    
    console.log('\n✅ PostgreSQL driver data cleaned');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

cleanDriverData();

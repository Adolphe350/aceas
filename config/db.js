const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Disable SSL for internal Docker network connections (Coolify internal URLs use container names)
const databaseUrl = process.env.DATABASE_URL || '';
const isInternalDocker = databaseUrl.includes('@') && !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1');
// For Coolify-managed postgres containers, SSL is not required on internal network
const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function initializeDB() {
  const maxRetries = 10;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const client = await pool.connect();
      console.log('✅ Database connected');
      const sql = fs.readFileSync(path.join(__dirname, '../models/db.sql'), 'utf8');
      await client.query(sql);
      console.log('✅ Database schema initialized');
      client.release();
      return;
    } catch (err) {
      attempt++;
      console.error(`DB connection attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw new Error('Could not connect to database after multiple attempts');
      }
    }
  }
}

module.exports = { pool, initializeDB };

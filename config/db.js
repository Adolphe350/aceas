const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('db:')
    ? { rejectUnauthorized: false }
    : false,
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

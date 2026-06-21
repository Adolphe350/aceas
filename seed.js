#!/usr/bin/env node
/**
 * ACEAS Seed Script
 * Creates the initial system admin user
 * 
 * Usage:
 *   DATABASE_URL="your_db_url" node seed.js
 *   
 * Or set in .env:
 *   node -r dotenv/config seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const SEED_USERS = [
  {
    full_name: 'System Administrator',
    email: 'admin@aceas.local',
    password: 'Admin@ACEAS2024!',
    role: 'system_admin',
  },
  {
    full_name: 'Compliance Officer',
    email: 'officer@aceas.local',
    password: 'Officer@ACEAS2024!',
    role: 'compliance_officer',
  },
  {
    full_name: 'Demo Developer',
    email: 'developer@aceas.local',
    password: 'Developer@ACEAS2024!',
    role: 'ai_developer',
  },
];

async function seed() {
  const client = await pool.connect();
  console.log('Connected to database');

  for (const user of SEED_USERS) {
    try {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);
      if (existing.rows.length > 0) {
        console.log(`✓ User already exists: ${user.email}`);
        continue;
      }

      const passwordHash = await bcrypt.hash(user.password, 12);
      const result = await client.query(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
        [user.full_name, user.email, passwordHash, user.role]
      );
      console.log(`✅ Created ${user.role}: ${user.email} (ID: ${result.rows[0].id})`);
      console.log(`   Password: ${user.password}`);
    } catch (err) {
      console.error(`❌ Failed to create ${user.email}:`, err.message);
    }
  }

  client.release();
  await pool.end();
  console.log('\n✅ Seeding complete!');
  console.log('\nDefault credentials:');
  SEED_USERS.forEach(u => {
    console.log(`  ${u.role.padEnd(22)} ${u.email.padEnd(30)} ${u.password}`);
  });
  console.log('\n⚠️  IMPORTANT: Change all passwords after first login!');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

// db.js — PostgreSQL version using the 'pg' package
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  console.error('Add it to your .env file or Render environment variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Render Postgres
});

// Create table on first run if it doesn't exist
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS survey_responses (
      id                  SERIAL PRIMARY KEY,
      survey_id           TEXT NOT NULL UNIQUE,
      unit                TEXT NOT NULL,
      market              TEXT NOT NULL,
      lang                TEXT NOT NULL,
      q1_resolved         TEXT,
      q2_satisfaction     INTEGER,
      q3_professionalism  INTEGER,
      q3_comment          TEXT,
      q4_ease             INTEGER,
      q5_time             INTEGER,
      q6_improvement      TEXT,
      nps_score           INTEGER,
      submitted_at        TEXT NOT NULL,
      ip_hash             TEXT,
      dedupe_key          TEXT UNIQUE
    )
  `);
  // Add indexes for fast filtering
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_unit   ON survey_responses(unit)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_market ON survey_responses(market)`);
  console.log('Database ready (PostgreSQL)');
}

initDb().catch(err => {
  console.error('Database init failed:', err.message);
  process.exit(1);
});

// ── Public API ────────────────────────────────────────────────────────────────

async function insertResponse(record) {
  const res = await pool.query(`
    INSERT INTO survey_responses
      (survey_id, unit, market, lang,
       q1_resolved, q2_satisfaction, q3_professionalism, q3_comment,
       q4_ease, q5_time, q6_improvement, nps_score,
       submitted_at, ip_hash, dedupe_key)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING id
  `, [
    record.survey_id, record.unit, record.market, record.lang,
    record.q1_resolved, record.q2_satisfaction, record.q3_professionalism, record.q3_comment,
    record.q4_ease, record.q5_time, record.q6_improvement, record.nps_score,
    record.submitted_at, record.ip_hash, record.dedupe_key,
  ]);
  return res.rows[0].id;
}

async function getAllResponses() {
  const res = await pool.query(`SELECT * FROM survey_responses ORDER BY submitted_at DESC`);
  return res.rows;
}

async function getResponsesByUnit(unit) {
  const res = await pool.query(
    `SELECT * FROM survey_responses WHERE unit = $1 ORDER BY submitted_at DESC`, [unit]
  );
  return res.rows;
}

async function getResponsesByMarket(market) {
  const res = await pool.query(
    `SELECT * FROM survey_responses WHERE market = $1 ORDER BY submitted_at DESC`, [market]
  );
  return res.rows;
}

async function getResponsesByUnitAndMarket(unit, market) {
  const res = await pool.query(
    `SELECT * FROM survey_responses WHERE unit = $1 AND market = $2 ORDER BY submitted_at DESC`,
    [unit, market]
  );
  return res.rows;
}

async function isDuplicateKey(key) {
  const res = await pool.query(
    `SELECT 1 FROM survey_responses WHERE dedupe_key = $1 LIMIT 1`, [key]
  );
  return res.rows.length > 0;
}

async function getDistinctUnits() {
  const res = await pool.query(`SELECT DISTINCT unit FROM survey_responses ORDER BY unit`);
  return res.rows.map(r => r.unit);
}

async function getDistinctMarkets() {
  const res = await pool.query(`SELECT DISTINCT market FROM survey_responses ORDER BY market`);
  return res.rows.map(r => r.market);
}

module.exports = {
  insertResponse, getAllResponses,
  getResponsesByUnit, getResponsesByMarket, getResponsesByUnitAndMarket,
  isDuplicateKey, getDistinctUnits, getDistinctMarkets,
};

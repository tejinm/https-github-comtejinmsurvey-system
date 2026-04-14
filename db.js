// db.js — JSON file store (StackBlitz / WebContainers compatible)
// Stores all responses in data/surveys.json instead of SQLite.
// The API is identical to the SQLite version — server.js needs no changes.

const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'surveys.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE))  fs.writeFileSync(DB_FILE, '[]', 'utf8');

console.log('Database ready at', DB_FILE);

function readAll() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return []; }
}

function writeAll(rows) {
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

function insertResponse(record) {
  const rows = readAll();
  const id   = rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;
  rows.unshift({ id, ...record });
  writeAll(rows);
  return id;
}

function getAllResponses()             { return readAll(); }
function getResponsesByUnit(unit)     { return readAll().filter(r => r.unit === unit); }
function getResponsesByMarket(market) { return readAll().filter(r => r.market === market); }

function getResponsesByUnitAndMarket(unit, market) {
  return readAll().filter(r => r.unit === unit && r.market === market);
}

function isDuplicateKey(key) {
  return readAll().some(r => r.dedupe_key === key);
}

function getDistinctUnits()   { return [...new Set(readAll().map(r => r.unit))].sort(); }
function getDistinctMarkets() { return [...new Set(readAll().map(r => r.market))].sort(); }

module.exports = {
  insertResponse, getAllResponses,
  getResponsesByUnit, getResponsesByMarket, getResponsesByUnitAndMarket,
  isDuplicateKey, getDistinctUnits, getDistinctMarkets,
};

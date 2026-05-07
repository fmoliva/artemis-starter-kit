'use strict';

/**
 * Artemis DB — Shared SQLite Helper
 *
 * Usage:
 *   const { getDb, DB_PATH } = require('./db');
 *   const db = getDb();
 *   const tcs = db.prepare('SELECT * FROM test_cases WHERE module = ?').all('login');
 */

const path = require('path');
let Database;

try {
  Database = require('better-sqlite3');
} catch {
  console.error('[artemis-db] ERROR: better-sqlite3 not installed.');
  console.error('[artemis-db] Run: npm install inside your project folder');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '..', 'artemis.db');

let _db = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

function dbExists() {
  const fs = require('fs');
  return fs.existsSync(DB_PATH);
}

module.exports = { getDb, DB_PATH, dbExists };

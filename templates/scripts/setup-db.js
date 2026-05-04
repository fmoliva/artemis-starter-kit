'use strict';

/**
 * Artemis DB — Schema Setup
 *
 * Creates all tables in artemis.db (safe to re-run, uses IF NOT EXISTS).
 *
 * Usage:
 *   node scripts/setup-db.js
 *
 * Run once after npm install, then run migrate-tcs.js to import test cases.
 */

const { getDb, DB_PATH } = require('./db');

console.log('');
console.log('  ✦ Artemis DB — Schema Setup');
console.log(`  → Database: ${DB_PATH}`);
console.log('');

const db = getDb();

db.exec(`
  -- ─── Test Cases ─────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS test_cases (
    id              TEXT PRIMARY KEY,   -- TC-TRI-APT-018
    module          TEXT NOT NULL,      -- triage
    submodule       TEXT NOT NULL,      -- create-appointment
    submodule_path  TEXT,               -- appointments/create-appointment
    title           TEXT NOT NULL,
    preconditions   TEXT,               -- JSON array
    steps           TEXT NOT NULL,      -- JSON array
    expected_result TEXT,               -- JSON array
    priority        TEXT DEFAULT 'Medium',    -- High / Medium / Low
    type            TEXT DEFAULT 'Happy Path',-- Happy Path / Edge Case / Error Case / Security
    status          TEXT DEFAULT 'active',    -- active / blocked / deprecated
    tc_prefix       TEXT,               -- TC-TRI-APT
    url_pattern     TEXT,
    source_file     TEXT,               -- relative path in test-cases/
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  -- ─── Test Runs ───────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS test_runs (
    id            TEXT PRIMARY KEY,  -- run-20260319-143022-triage
    scope         TEXT NOT NULL,     -- quick_action / single / feature / module / all
    module        TEXT,
    submodule     TEXT,
    app_url       TEXT,
    started_at    TEXT,
    completed_at  TEXT,
    status        TEXT DEFAULT 'running',  -- running / completed / failed / interrupted
    total_tcs     INTEGER DEFAULT 0,
    passed        INTEGER DEFAULT 0,
    failed        INTEGER DEFAULT 0,
    blocked       INTEGER DEFAULT 0,
    skipped       INTEGER DEFAULT 0,
    triggered_by  TEXT              -- the user's command
  );

  -- ─── Test Results ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS test_results (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           TEXT NOT NULL,
    tc_id            TEXT NOT NULL,
    tc_title         TEXT,
    status           TEXT NOT NULL,  -- PASS / FAIL / BLOCKED / SKIP
    duration_ms      INTEGER,
    screenshot_path  TEXT,
    error_message    TEXT,
    notes            TEXT,
    executed_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES test_runs(id),
    FOREIGN KEY (tc_id)  REFERENCES test_cases(id)
  );

  -- ─── Bugs ────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS bugs (
    id                  TEXT PRIMARY KEY,  -- BUG-TRI-APT-20260319-001
    run_id              TEXT,
    tc_id               TEXT,
    result_id           INTEGER,
    module              TEXT,
    title               TEXT NOT NULL,
    severity            TEXT DEFAULT 'Medium',  -- Critical / High / Medium / Low
    status              TEXT DEFAULT 'open',    -- open / confirmed / fixed / wont-fix
    description         TEXT,
    steps_to_reproduce  TEXT,   -- JSON array
    expected_behavior   TEXT,
    actual_behavior     TEXT,
    screenshot_path     TEXT,
    endpoint            TEXT,
    http_status         TEXT,
    console_error       TEXT,
    network_evidence    TEXT,
    impact              TEXT,
    possible_cause      TEXT,
    suggested_fix       TEXT,
    url                 TEXT,
    source_file         TEXT,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES test_runs(id)
  );

  -- ─── Observations ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS observations (
    id            TEXT PRIMARY KEY,  -- OBS-001
    run_id        TEXT,
    tc_id         TEXT,
    module        TEXT,
    title         TEXT NOT NULL,
    description   TEXT,
    impact        TEXT,
    impact_level  TEXT DEFAULT 'Low',  -- High / Medium / Low
    status        TEXT DEFAULT 'OPEN',
    decision      TEXT DEFAULT '—',
    created_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES test_runs(id)
  );

  -- ─── Learnings (Self-Adaptation Log) ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS learnings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    discovery   TEXT,
    fix         TEXT,
    applies_to  TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- ─── Screenshots (binary storage for portable serving) ──────────────────────
  CREATE TABLE IF NOT EXISTS screenshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tc_id        TEXT NOT NULL,
    run_id       TEXT,
    result_id    INTEGER,
    status       TEXT,            -- PASS / FAIL / BLOCKED
    file_path    TEXT,            -- relative path (reference + fallback)
    data         BLOB,            -- base64-encoded PNG/GIF
    file_size    INTEGER,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tc_id)     REFERENCES test_cases(id),
    FOREIGN KEY (result_id) REFERENCES test_results(id)
  );

  -- ─── Indexes ─────────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_tc_module       ON test_cases(module);
  CREATE INDEX IF NOT EXISTS idx_tc_submodule    ON test_cases(submodule);
  CREATE INDEX IF NOT EXISTS idx_tc_type         ON test_cases(type);
  CREATE INDEX IF NOT EXISTS idx_tc_status       ON test_cases(status);
  CREATE INDEX IF NOT EXISTS idx_result_run      ON test_results(run_id);
  CREATE INDEX IF NOT EXISTS idx_result_tc       ON test_results(tc_id);
  CREATE INDEX IF NOT EXISTS idx_result_status   ON test_results(status);
  CREATE INDEX IF NOT EXISTS idx_bug_run         ON bugs(run_id);
  CREATE INDEX IF NOT EXISTS idx_bug_module      ON bugs(module);
  CREATE INDEX IF NOT EXISTS idx_bug_severity    ON bugs(severity);
  CREATE INDEX IF NOT EXISTS idx_bug_status      ON bugs(status);
  CREATE INDEX IF NOT EXISTS idx_screenshot_tc   ON screenshots(tc_id);
  CREATE INDEX IF NOT EXISTS idx_screenshot_run  ON screenshots(run_id);
`);

// Add walkthrough_path column to test_cases if it doesn't exist yet (safe migration)
try {
  db.exec(`ALTER TABLE test_cases ADD COLUMN walkthrough_path TEXT`);
} catch {
  /* column already exists — safe to ignore */
}

// Add pending_message column to test_runs for mid-run user message injection
try {
  db.exec(`ALTER TABLE test_runs ADD COLUMN pending_message TEXT`);
} catch {
  /* column already exists — safe to ignore */
}

// Verify tables created
const tables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
`).all().map(r => r.name);

console.log('  Tables created:');
tables.forEach(t => console.log(`    ✓ ${t}`));
console.log('');
console.log('  Setup complete!');
console.log('  Next: node scripts/migrate-tcs.js');
console.log('');

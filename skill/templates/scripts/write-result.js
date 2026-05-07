'use strict';

/**
 * Artemis DB — Write Test Result
 *
 * Called by Claude (via Bash) to write a single TC result to the DB.
 * Also updates live-status.json so the SSE dashboard stays in sync.
 *
 * Usage:
 *   node scripts/write-result.js '<json>'
 *
 * Required fields:
 *   run_id        TEXT   — e.g. "run-20260319-143022-[module]"
 *   tc_id         TEXT   — e.g. "TC-MOD-018"
 *   tc_title      TEXT   — display name for the TC
 *   status        TEXT   — PASS / FAIL / BLOCKED / SKIP
 *
 * Optional fields:
 *   duration_ms      INTEGER
 *   screenshot_path  TEXT
 *   error_message    TEXT
 *   notes            TEXT
 *
 * Example:
 *   node scripts/write-result.js '{
 *     "run_id": "run-20260319-143022-[module]",
 *     "tc_id": "TC-MOD-018",
 *     "tc_title": "Feature happy path",
 *     "status": "PASS",
 *     "duration_ms": 4200
 *   }'
 */

const fs   = require('fs');
const path = require('path');
const { getDb, dbExists } = require('./db');

if (!dbExists()) {
  console.error(JSON.stringify({ error: 'artemis.db not found. Run setup-db.js first.' }));
  process.exit(1);
}

// ─── Parse input ──────────────────────────────────────────────────────────────

let input;
try {
  input = JSON.parse(process.argv[2] || '{}');
} catch (e) {
  console.error(JSON.stringify({ error: `Invalid JSON: ${e.message}` }));
  process.exit(1);
}

const required = ['run_id', 'tc_id', 'tc_title', 'status'];
for (const field of required) {
  if (!input[field]) {
    console.error(JSON.stringify({ error: `Missing required field: ${field}` }));
    process.exit(1);
  }
}

const validStatuses = ['PASS', 'FAIL', 'BLOCKED', 'SKIP'];
if (!validStatuses.includes(input.status.toUpperCase())) {
  console.error(JSON.stringify({ error: `Invalid status: ${input.status}. Must be PASS/FAIL/BLOCKED/SKIP` }));
  process.exit(1);
}

// ─── Write to DB ──────────────────────────────────────────────────────────────

const db = getDb();

// Ensure run exists (upsert)
const run = db.prepare('SELECT id FROM test_runs WHERE id = ?').get(input.run_id);
if (!run) {
  db.prepare(`
    INSERT OR IGNORE INTO test_runs (id, scope, started_at, status)
    VALUES (?, ?, datetime('now'), 'running')
  `).run(input.run_id, input.scope || 'unknown');
}

const resultId = db.prepare(`
  INSERT INTO test_results
    (run_id, tc_id, tc_title, status, duration_ms, screenshot_path, error_message, notes)
  VALUES
    (@run_id, @tc_id, @tc_title, @status, @duration_ms, @screenshot_path, @error_message, @notes)
`).run({
  run_id:          input.run_id,
  tc_id:           input.tc_id,
  tc_title:        input.tc_title,
  status:          input.status.toUpperCase(),
  duration_ms:     input.duration_ms     || null,
  screenshot_path: input.screenshot_path || null,
  error_message:   input.error_message   || null,
  notes:           input.notes           || null,
}).lastInsertRowid;

// Update run counters
const statusCol = input.status.toLowerCase();
if (['pass', 'fail', 'blocked', 'skip', 'skipped'].includes(statusCol)) {
  const col = statusCol === 'skipped' ? 'skipped' : statusCol + 'ed' === 'passed' ? 'passed'
    : statusCol === 'pass' ? 'passed'
    : statusCol === 'fail' ? 'failed'
    : statusCol === 'blocked' ? 'blocked'
    : 'skipped';
  try {
    db.prepare(`UPDATE test_runs SET ${col} = ${col} + 1, total_tcs = total_tcs + 1 WHERE id = ?`)
      .run(input.run_id);
  } catch { /* column name guard */ }
}

// ─── Store screenshot in DB (if provided) ─────────────────────────────────────

if (input.screenshot_path) {
  const absPath = path.isAbsolute(input.screenshot_path)
    ? input.screenshot_path
    : path.join(__dirname, '..', input.screenshot_path);
  if (fs.existsSync(absPath)) {
    try {
      const data     = fs.readFileSync(absPath).toString('base64');
      const fileSize = fs.statSync(absPath).size;
      db.prepare(`
        INSERT INTO screenshots (tc_id, run_id, result_id, status, file_path, data, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(input.tc_id, input.run_id, resultId, input.status.toUpperCase(),
             input.screenshot_path, data, fileSize);
    } catch { /* non-fatal — DB write-result already succeeded */ }
  }
}

// ─── Update live-status.json ──────────────────────────────────────────────────

const STATUS_FILE = path.join(__dirname, '..', 'results', 'live-status.json');
let liveStatus = {};
try { liveStatus = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch { /* fresh */ }

// Build rolling window (max 10 recent results)
const newEntry = {
  id:              input.tc_id,
  title:           input.tc_title,
  status:          input.status.toUpperCase(),
  durationMs:      input.duration_ms || null,
  screenshot_path: input.screenshot_path || null,
  ts:              new Date().toISOString(),
};

const previous = Array.isArray(liveStatus.recentResults) ? liveStatus.recentResults : [];
liveStatus.recentResults = [newEntry, ...previous].slice(0, 10);

if (!Array.isArray(liveStatus.allResults)) liveStatus.allResults = [];
liveStatus.allResults.push(newEntry);

// Update current TC
liveStatus.currentTc = { id: input.tc_id, title: input.tc_title, status: input.status.toUpperCase() };

// Update counts
if (!liveStatus.counts) liveStatus.counts = { total: 0, pass: 0, fail: 0, blocked: 0, skip: 0, remaining: 0 };
liveStatus.counts.total++;
if (input.status.toUpperCase() === 'PASS')    liveStatus.counts.pass++;
if (input.status.toUpperCase() === 'FAIL')    liveStatus.counts.fail++;
if (input.status.toUpperCase() === 'BLOCKED') liveStatus.counts.blocked++;
if (input.status.toUpperCase() === 'SKIP')    liveStatus.counts.skip++;
if (liveStatus.counts.remaining > 0)          liveStatus.counts.remaining--;

try {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(liveStatus, null, 2));
} catch (e) {
  /* non-fatal — DB write succeeded */
}

// ─── Output ───────────────────────────────────────────────────────────────────

console.log(JSON.stringify({
  ok:       true,
  resultId,
  run_id:   input.run_id,
  tc_id:    input.tc_id,
  status:   input.status.toUpperCase(),
}));

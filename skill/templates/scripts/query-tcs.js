'use strict';

/**
 * Artemis DB — TC Query CLI
 *
 * Claude calls this via Bash to load test cases without reading .md files.
 * Returns compact JSON — drastically fewer tokens than reading raw .md files.
 *
 * Usage:
 *   node scripts/query-tcs.js [options]
 *
 * Options:
 *   --module=<slug>          Filter by module (e.g. auth, dashboard)
 *   --submodule=<slug>       Filter by submodule (e.g. create-appointment)
 *   --type=<type>            Filter by type (happy_path, edge_case, etc.)
 *   --action=<phrase>        Semantic action match (e.g. "create appointment")
 *   --scope=<scope>          quick_action / single / feature / module / all
 *   --tc-id=<id>             Exact TC ID (e.g. TC-TRI-APT-018)
 *   --range=<start>-<end>    TC number range (e.g. 018-025)
 *   --status=<status>        Filter by status (active, blocked, deprecated)
 *   --priority=<priority>    Filter by priority (High, Medium, Low)
 *   --limit=<n>              Max results (default: 100)
 *   --format=compact|full    compact = id+title+steps only (default); full = all fields
 *   --count                  Just print the count, no TC data
 *
 * Examples:
 *   # Quick Action — 1 matching TC:
 *   node scripts/query-tcs.js --scope=quick_action --action="create appointment" --limit=1
 *
 *   # All happy path TCs in [module]/[submodule]:
 *   node scripts/query-tcs.js --module=[module] --submodule=[submodule] --type="Happy Path"
 *
 *   # Exact TC:
 *   node scripts/query-tcs.js --tc-id=TC-MOD-001
 *
 *   # Full module:
 *   node scripts/query-tcs.js --module=[module] --format=compact
 *
 *   # Count only:
 *   node scripts/query-tcs.js --module=[module] --count
 */

const { getDb, dbExists } = require('./db');

if (!dbExists()) {
  console.error(JSON.stringify({
    error: 'artemis.db not found. Run: node scripts/setup-db.js && node scripts/migrate-tcs.js'
  }));
  process.exit(1);
}

// ─── Parse CLI args ───────────────────────────────────────────────────────────

const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const [key, ...rest] = arg.slice(2).split('=');
    args[key] = rest.join('=') || true;
  }
}

const format    = args.format    || 'compact';
const limit     = Math.max(1, parseInt(args.limit || '100', 10) || 100); // integer only — interpolated into SQL below
const countOnly = args.count === true || args.count === 'true';

// ─── Build Query ──────────────────────────────────────────────────────────────

const db = getDb();

let sql    = 'SELECT * FROM test_cases WHERE 1=1';
const params = [];

// Exact TC ID
if (args['tc-id']) {
  sql += ' AND id = ?';
  params.push(args['tc-id']);
}

// Module filter
if (args.module) {
  sql += ' AND module = ?';
  params.push(args.module);
}

// Submodule filter
if (args.submodule) {
  // Match either submodule or submodule_path contains the slug
  sql += ' AND (submodule = ? OR submodule_path LIKE ?)';
  params.push(args.submodule, `%${args.submodule}%`);
}

// Type filter (normalize: "happy path" → "Happy Path")
if (args.type) {
  const typeNorm = args.type.toLowerCase();
  const typeMap = {
    'happy_path':  'Happy Path',
    'happy path':  'Happy Path',
    'edge_case':   'Edge Case',
    'edge case':   'Edge Case',
    'error_case':  'Error Case',
    'error case':  'Error Case',
    'security':    'Security',
  };
  const typeValue = typeMap[typeNorm] || args.type;
  sql += ' AND type = ?';
  params.push(typeValue);
}

// Status filter (default: only active)
if (args.status) {
  sql += ' AND status = ?';
  params.push(args.status);
} else if (!args['tc-id']) {
  // By default, exclude deprecated TCs unless explicitly requested
  sql += ' AND status != ?';
  params.push('deprecated');
}

// Priority filter
if (args.priority) {
  sql += ' AND priority = ?';
  params.push(args.priority);
}

// TC number range (e.g. --range=018-025)
if (args.range) {
  const [startStr, endStr] = args.range.split('-');
  const start = parseInt(startStr, 10);
  const end   = parseInt(endStr,   10);
  if (!isNaN(start) && !isNaN(end)) {
    // Extract numeric suffix from TC ID and compare
    sql += ` AND CAST(SUBSTR(id, LENGTH(id) - INSTR(REVERSE(id), '-') + 2) AS INTEGER) BETWEEN ? AND ?`;
    params.push(start, end);
  }
}

// Semantic action match (for Quick Action scope)
if (args.action) {
  const action = args.action.toLowerCase();
  // Extract key words (skip stop words)
  const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'to', 'for', 'of', 'and', 'or', 'is', 'are']);
  const keywords = action.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  if (keywords.length > 0) {
    const likeClauses = keywords.map(() => 'LOWER(title) LIKE ?').join(' AND ');
    sql += ` AND (${likeClauses})`;
    keywords.forEach(kw => params.push(`%${kw}%`));
  }

  // Prefer Happy Path when doing action matching
  if (!args.type) {
    sql += ` ORDER BY CASE type WHEN 'Happy Path' THEN 0 ELSE 1 END`;
  }
}

if (!sql.includes('ORDER BY')) {
  sql += ' ORDER BY id';
}

sql += ` LIMIT ${limit}`;

// ─── Execute ──────────────────────────────────────────────────────────────────

let rows;
try {
  rows = db.prepare(sql).all(...params);
} catch (err) {
  console.error(JSON.stringify({ error: err.message, sql, params }));
  process.exit(1);
}

// Count only
if (countOnly) {
  console.log(JSON.stringify({ count: rows.length }));
  process.exit(0);
}

// ─── Format Output ────────────────────────────────────────────────────────────

function parseJsonField(val) {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return [val]; }
}

const output = rows.map(row => {
  const steps          = parseJsonField(row.steps);
  const preconditions  = parseJsonField(row.preconditions);
  const expected_result = parseJsonField(row.expected_result);

  if (format === 'compact') {
    return {
      id:             row.id,
      title:          row.title,
      module:         row.module,
      submodule:      row.submodule,
      type:           row.type,
      priority:       row.priority,
      status:         row.status,
      preconditions,
      steps,
      expected_result,
    };
  }

  // Full format
  return {
    id:             row.id,
    title:          row.title,
    module:         row.module,
    submodule:      row.submodule,
    submodule_path: row.submodule_path,
    type:           row.type,
    priority:       row.priority,
    status:         row.status,
    tc_prefix:      row.tc_prefix,
    url_pattern:    row.url_pattern,
    source_file:    row.source_file,
    preconditions,
    steps,
    expected_result,
  };
});

console.log(JSON.stringify({ count: output.length, tcs: output }, null, 2));

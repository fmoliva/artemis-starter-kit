'use strict';

/**
 * Artemis DB — TC Migration
 *
 * Reads all test case .md files from test-cases/ and inserts them into
 * the test_cases table. Safe to re-run (uses INSERT OR REPLACE).
 *
 * Usage:
 *   node scripts/migrate-tcs.js
 *
 * Run after setup-db.js, and again whenever test cases are added/edited.
 */

const fs   = require('fs');
const path = require('path');
const { getDb } = require('./db');

const ROOT    = path.join(__dirname, '..');
const TC_DIR  = path.join(ROOT, 'test-cases');

const db = getDb();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractList(block, sectionName) {
  const re = new RegExp(
    `\\*\\*${sectionName}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n---\\s*$|$)`, 'm'
  );
  const sec = block.match(re);
  if (!sec) return [];
  return sec[1].split('\n')
    .map(l => l.replace(/^[\s\-*\d.]+/, '').trim())
    .filter(Boolean);
}

function extractInline(block, field) {
  const m = block.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`));
  return m ? m[1].trim() : '';
}

// Extract TC prefix from file header (e.g. "TC-TRI-APT")
function extractTcPrefix(content) {
  const m = content.match(/\*\*TC Prefix:\*\*\s*(TC-[A-Z-]+)/);
  return m ? m[1].trim() : null;
}

// Extract URL pattern from file header
function extractUrlPattern(content) {
  const m = content.match(/\*\*URL:\*\*\s*(.+)/);
  return m ? m[1].trim() : null;
}

// ─── Walk TC directory ────────────────────────────────────────────────────────

const insert = db.prepare(`
  INSERT OR REPLACE INTO test_cases
    (id, module, submodule, submodule_path, title, preconditions, steps,
     expected_result, priority, type, status, tc_prefix, url_pattern,
     source_file, updated_at)
  VALUES
    (@id, @module, @submodule, @submodule_path, @title, @preconditions, @steps,
     @expected_result, @priority, @type, @status, @tc_prefix, @url_pattern,
     @source_file, datetime('now'))
`);

const insertMany = db.transaction((tcs) => {
  for (const tc of tcs) insert.run(tc);
});

let totalFiles   = 0;
let totalTcs     = 0;
let totalSkipped = 0;

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '_archive') walk(full);
    } else if (e.name.endsWith('.md') && e.name !== 'INDEX.md') {
      processFile(full);
    }
  }
}

function processFile(fullPath) {
  const relPath = path.relative(TC_DIR, fullPath);
  const parts   = relPath.split(path.sep);

  // Determine module and submodule from path
  const module = parts.length >= 2 ? parts[0] : 'general';

  // For deeply nested paths like ambulatory/adolescent/appointments/create.md
  // submodule = last segment without .md, submodule_path = everything after module
  const submoduleFile = parts[parts.length - 1].replace('.md', '');
  const submodulePath = parts.slice(1).join('/').replace('.md', '');

  let content;
  try { content = fs.readFileSync(fullPath, 'utf8'); } catch { return; }

  const tcPrefix   = extractTcPrefix(content);
  const urlPattern = extractUrlPattern(content);

  // Split on TC headers: ### TC-XXX-NNN:
  const blocks = content.split(/(?=^### TC-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+:)/m);
  const tcs = [];

  for (const block of blocks) {
    const m = block.match(/^### (TC-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+):\s*(.+)/m);
    if (!m) continue;

    const id    = m[1];
    const title = m[2].trim();

    const priority      = extractInline(block, 'Priority') || 'Medium';
    const typeRaw       = extractInline(block, 'Type')     || 'Happy Path';
    const statusRaw     = extractInline(block, 'Status')   || 'active';

    // Normalize type
    const type = typeRaw.trim();

    // Normalize status: BLOCKED → blocked, etc.
    const status = statusRaw.toLowerCase().includes('blocked')    ? 'blocked'
                 : statusRaw.toLowerCase().includes('deprecated') ? 'deprecated'
                 : 'active';

    const preconditions  = JSON.stringify(extractList(block, 'Preconditions'));
    const steps          = JSON.stringify(extractList(block, 'Steps'));
    const expected_result = JSON.stringify(extractList(block, 'Expected Result'));

    tcs.push({
      id,
      module,
      submodule:      submoduleFile,
      submodule_path: submodulePath,
      title,
      preconditions,
      steps,
      expected_result,
      priority,
      type,
      status,
      tc_prefix:   tcPrefix   || null,
      url_pattern: urlPattern || null,
      source_file: relPath,
    });
  }

  if (tcs.length > 0) {
    insertMany(tcs);
    totalFiles++;
    totalTcs += tcs.length;
    console.log(`  ✓ ${relPath.padEnd(60)} ${tcs.length} TCs`);
  } else {
    totalSkipped++;
  }
}

// ─── Run Migration ────────────────────────────────────────────────────────────

console.log('');
console.log('  ✦ Artemis DB — TC Migration');
console.log(`  → Source: ${TC_DIR}`);
console.log('');

if (!fs.existsSync(TC_DIR)) {
  console.error('  ERROR: test-cases/ directory not found.');
  process.exit(1);
}

walk(TC_DIR);

const count = db.prepare('SELECT COUNT(*) as n FROM test_cases').get();

console.log('');
console.log('  ─────────────────────────────────────────');
console.log(`  Files processed : ${totalFiles}`);
console.log(`  Files skipped   : ${totalSkipped} (no TC headers)`);
console.log(`  TCs in database : ${count.n}`);
console.log('  ─────────────────────────────────────────');
console.log('');
console.log('  Migration complete!');
console.log('  Next: node server.js');
console.log('');

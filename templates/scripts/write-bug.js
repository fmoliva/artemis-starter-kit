'use strict';

/**
 * Artemis DB — Write Bug
 *
 * Called by Claude (via Bash) to write a bug to the DB AND write the markdown
 * file to results/bugs/ for backwards compatibility with the dashboard.
 *
 * Usage:
 *   node scripts/write-bug.js '<json>'
 *
 * Required fields:
 *   id            TEXT  — e.g. "BUG-TRI-APT-20260319-001"
 *   module        TEXT  — e.g. "triage"
 *   title         TEXT  — short bug title
 *   severity      TEXT  — Critical / High / Medium / Low
 *   actual_behavior TEXT — what actually happened
 *
 * Optional fields:
 *   run_id, tc_id, description, steps_to_reproduce (array), expected_behavior,
 *   screenshot_path, endpoint, http_status, console_error, network_evidence,
 *   impact, possible_cause, suggested_fix, url, status
 *
 * Example:
 *   node scripts/write-bug.js '{
 *     "id": "BUG-TRI-APT-20260319-001",
 *     "module": "triage",
 *     "title": "POST /api/v1/oasis/appointment/save returns 404",
 *     "severity": "Critical",
 *     "tc_id": "TC-TRI-APT-022",
 *     "steps_to_reproduce": ["Navigate to Create Appointment", "Fill all fields", "Click Save"],
 *     "expected_behavior": "Appointment is saved, confirmation shown",
 *     "actual_behavior": "API returns 404 Not Found",
 *     "endpoint": "/api/v1/oasis/appointment/save",
 *     "http_status": "404"
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

const required = ['id', 'module', 'title', 'severity', 'actual_behavior'];
for (const field of required) {
  if (!input[field]) {
    console.error(JSON.stringify({ error: `Missing required field: ${field}` }));
    process.exit(1);
  }
}

// Normalize steps_to_reproduce to JSON string
const stepsArray = Array.isArray(input.steps_to_reproduce)
  ? input.steps_to_reproduce
  : (input.steps_to_reproduce ? [input.steps_to_reproduce] : []);

// ─── Write to DB ──────────────────────────────────────────────────────────────

const db = getDb();

db.prepare(`
  INSERT OR REPLACE INTO bugs
    (id, run_id, tc_id, module, title, severity, status, description,
     steps_to_reproduce, expected_behavior, actual_behavior,
     screenshot_path, endpoint, http_status, console_error, network_evidence,
     impact, possible_cause, suggested_fix, url, source_file, updated_at)
  VALUES
    (@id, @run_id, @tc_id, @module, @title, @severity, @status, @description,
     @steps_to_reproduce, @expected_behavior, @actual_behavior,
     @screenshot_path, @endpoint, @http_status, @console_error, @network_evidence,
     @impact, @possible_cause, @suggested_fix, @url, @source_file, datetime('now'))
`).run({
  id:                  input.id,
  run_id:              input.run_id              || null,
  tc_id:               input.tc_id               || null,
  module:              input.module,
  title:               input.title,
  severity:            input.severity,
  status:              input.status              || 'open',
  description:         input.description         || null,
  steps_to_reproduce:  JSON.stringify(stepsArray),
  expected_behavior:   input.expected_behavior   || null,
  actual_behavior:     input.actual_behavior,
  screenshot_path:     input.screenshot_path     || null,
  endpoint:            input.endpoint            || null,
  http_status:         input.http_status         || null,
  console_error:       input.console_error       || null,
  network_evidence:    input.network_evidence    || null,
  impact:              input.impact              || null,
  possible_cause:      input.possible_cause      || null,
  suggested_fix:       input.suggested_fix       || null,
  url:                 input.url                 || null,
  source_file:         input.source_file         || null,
});

// ─── Write Markdown file (backwards compat for dashboard) ────────────────────

const BUGS_DIR = path.join(__dirname, '..', 'results', 'bugs');
fs.mkdirSync(BUGS_DIR, { recursive: true });

const today      = new Date().toISOString().slice(0, 10);
const moduleSlug = input.module.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
const bugFile    = path.join(BUGS_DIR, `BUG-${moduleSlug}-${today}.md`);

// Read existing content to append (one file per module per day)
let existing = '';
try { existing = fs.readFileSync(bugFile, 'utf8'); } catch { /* new file */ }

// Build file header if new file
if (!existing) {
  existing = `# Bug Report — ${input.module.charAt(0).toUpperCase() + input.module.slice(1)}\n\n` +
    `**Module:** ${input.module}\n` +
    `**Date:** ${today}\n` +
    `**Run:** ${input.run_id || 'N/A'}\n\n` +
    `---\n\n`;
}

// Build bug block
const numMatch = (existing.match(/^#{2,3}\s+BUG-/gm) || []).length;
const bugNum   = String(numMatch + 1).padStart(3, '0');

const stepsMarkdown = stepsArray.map((s, i) => `${i + 1}. ${s}`).join('\n');

const bugBlock = `
## ${input.id}: ${input.title}

**TC:** ${input.tc_id || 'N/A'}
**Severity:** ${input.severity}
**Status:** ${input.status || 'Open'}
**Module:** ${input.module}
**Date:** ${today}

${input.description ? `### Description\n${input.description}\n` : ''}
${stepsArray.length ? `### Steps to Reproduce\n${stepsMarkdown}\n` : ''}
### Expected\n${input.expected_behavior || 'N/A'}

### Actual\n${input.actual_behavior}
${input.endpoint ? `\n### Network Evidence\n[${input.http_status || 'ERR'}] ${input.endpoint}\n` : ''}
${input.console_error ? `\n### Console Error\n\`\`\`\n${input.console_error}\n\`\`\`\n` : ''}
${input.screenshot_path ? `\n### Screenshot\n\`${input.screenshot_path}\`\n` : ''}
${input.impact ? `\n### Impact\n${input.impact}\n` : ''}
${input.possible_cause ? `\n### Possible Cause\n${input.possible_cause}\n` : ''}
${input.suggested_fix ? `\n### Suggested Fix\n${input.suggested_fix}\n` : ''}

---
`;

fs.writeFileSync(bugFile, existing + bugBlock);

// ─── Output ───────────────────────────────────────────────────────────────────

console.log(JSON.stringify({
  ok:       true,
  id:       input.id,
  severity: input.severity,
  db:       true,
  file:     path.relative(path.join(__dirname, '..'), bugFile),
}));

'use strict';

/**
 * Artemis DB — Store Walkthrough GIF Path
 *
 * Updates test_cases.walkthrough_path for a given TC ID so both dashboards
 * (artemis-live.html and artemis-tc-list.html) can display the walkthrough GIF.
 *
 * Usage:
 *   node scripts/store-walkthrough.js '<json>'
 *
 * Required fields:
 *   tc_id            TEXT — e.g. "TC-TRI-APT-018"
 *   walkthrough_path TEXT — e.g. "results/screenshots/walkthroughs/tc-tri-apt-018-walkthrough.gif"
 *
 * Example:
 *   node scripts/store-walkthrough.js '{
 *     "tc_id": "TC-TRI-APT-018",
 *     "walkthrough_path": "results/screenshots/walkthroughs/tc-tri-apt-018-walkthrough.gif"
 *   }'
 */

const { getDb, dbExists } = require('./db');

if (!dbExists()) {
  console.error(JSON.stringify({ error: 'artemis.db not found. Run setup-db.js first.' }));
  process.exit(1);
}

let input;
try {
  input = JSON.parse(process.argv[2] || '{}');
} catch (e) {
  console.error(JSON.stringify({ error: `Invalid JSON: ${e.message}` }));
  process.exit(1);
}

if (!input.tc_id) {
  console.error(JSON.stringify({ error: 'Missing required field: tc_id' }));
  process.exit(1);
}
if (!input.walkthrough_path) {
  console.error(JSON.stringify({ error: 'Missing required field: walkthrough_path' }));
  process.exit(1);
}

const db = getDb();

const result = db.prepare(`
  UPDATE test_cases SET walkthrough_path = ?, updated_at = datetime('now') WHERE id = ?
`).run(input.walkthrough_path, input.tc_id);

if (result.changes === 0) {
  console.error(JSON.stringify({ error: `TC not found in DB: ${input.tc_id}` }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok:               true,
  tc_id:            input.tc_id,
  walkthrough_path: input.walkthrough_path,
}));

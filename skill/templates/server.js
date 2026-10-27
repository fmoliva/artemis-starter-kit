/**
 * Artemis Live Server
 * Serves the live dashboard and provides REST + SSE endpoints for real-time test monitoring.
 *
 * Usage: node server.js
 * Dashboard: http://localhost:7373
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ─── Paths ──────────────────────────────────────────────────────────────────

const PORT        = 7373;
// Bind to loopback by default. Set HOST=0.0.0.0 to share on a LAN (then TEAM_TOKEN is required).
const HOST        = process.env.HOST || '127.0.0.1';
// CORS is limited to the local dashboard origin. Override with CORS_ORIGIN if you serve it elsewhere.
const CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${PORT}`;
const ROOT        = __dirname;
const RESULTS_DIR = path.join(ROOT, 'results');
const BUGS_DIR    = path.join(RESULTS_DIR, 'bugs');
const OBS_FILE    = path.join(RESULTS_DIR, 'observations', 'observations-log.md');
const LEARN_FILE  = path.join(RESULTS_DIR, 'artemis-learnings.md');
const STATUS_FILE = path.join(RESULTS_DIR, 'live-status.json');
const TC_DIR      = path.join(ROOT, 'test-cases');
const LIVE_HTML    = path.join(ROOT, '..', 'artemis-live.html');
const TC_LIST_HTML = path.join(ROOT, '..', 'artemis-tc-list.html');
const WEB_DIR      = path.join(ROOT, 'web');

// ─── Artemis Team — Auth + Trigger.dev client ────────────────────────────────

const TEAM_TOKEN        = process.env.TEAM_TOKEN || null;
if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !process.env.TEAM_TOKEN) {
  console.error('Refusing to listen on a non-loopback HOST without TEAM_TOKEN set.');
  process.exit(1);
}
const TRIGGER_SECRET    = process.env.TRIGGER_SECRET_KEY || null;
const TRIGGER_API_URL   = process.env.TRIGGER_API_URL || 'https://api.trigger.dev';
const SERVER_URL        = process.env.SERVER_URL || `http://localhost:${7373}`;
const APP_DATA_PATH     = process.env.APP_DATA_PATH || ROOT;
const SKILL_PATH        = process.env.SKILL_PATH || '/skill';

// Lightweight Trigger.dev job trigger (no SDK dependency — plain fetch)
async function triggerArtemisJob(payload) {
  if (!TRIGGER_SECRET) throw new Error('TRIGGER_SECRET_KEY not set');
  const res = await fetch(`${TRIGGER_API_URL}/api/v1/tasks/artemis-run/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TRIGGER_SECRET}`,
    },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trigger.dev error ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── SQLite DB (optional — falls back to file parsing if not available) ──────

let db = null;
try {
  const { getDb, dbExists } = require('./scripts/db');
  if (dbExists()) {
    db = getDb();
    console.log('  ✓ artemis.db detected — using database for bugs, TCs, and results');
  }
} catch {
  /* better-sqlite3 not installed or DB not set up — file-based fallback */
}

// ─── SSE Client Registry ─────────────────────────────────────────────────────

const sseClients = new Set();

function sendSseEvent(name, data) {
  const payload = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

function handleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
  });
  res.write('retry: 3000\n\n');
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

// ─── Response Helpers ────────────────────────────────────────────────────────

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

function serveHtml(res, filePath) {
  const target = filePath || LIVE_HTML;
  try {
    const content = fs.readFileSync(target, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(path.basename(target) + ' not found. Check that the file exists at ' + target);
  }
}

// ─── Status Reader ───────────────────────────────────────────────────────────

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return {
      runState: 'idle',
      scope: null,
      module: null,
      appUrl: null,
      startedAt: null,
      completedAt: null,
      currentTc: null,
      counts: { total: 0, pass: 0, fail: 0, blocked: 0, skip: 0, remaining: 0 },
      recentResults: [],
      allResults: [],
    };
  }
}

// ─── Bug Parser ──────────────────────────────────────────────────────────────

function parseBugFiles() {
  // ── DB path (primary) ──────────────────────────────────────────────────────
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT * FROM bugs ORDER BY created_at DESC
      `).all();
      if (!rows.length) throw new Error('empty');
      return rows.map(r => ({
        id:              r.id,
        title:           r.title,
        tc:              r.tc_id        || '',
        severity:        r.severity     || 'Unknown',
        status:          r.status       || 'Open',
        module:          r.module       || '',
        date:            (r.created_at  || '').slice(0, 10),
        description:     r.description  || '',
        stepsToRepro:    r.steps_to_reproduce
                           ? (() => { try { return JSON.parse(r.steps_to_reproduce).join('\n'); } catch { return r.steps_to_reproduce; } })()
                           : '',
        expected:        r.expected_behavior  || '',
        actual:          r.actual_behavior    || '',
        networkEvidence: r.network_evidence   || '',
        consoleError:    r.console_error      || '',
        impact:          r.impact             || '',
        url:             r.url                || '',
        screenshot:      r.screenshot_path    || '',
        possibleCause:   r.possible_cause     || '',
        suggestedFix:    r.suggested_fix      || '',
        endpoint:        r.endpoint           || '',
        httpStatus:      r.http_status        || '',
        sourceFile:      r.source_file        || '',
      }));
    } catch { /* fall through to file parser */ }
  }

  // ── File path (fallback) ───────────────────────────────────────────────────
  const bugs = [];
  let files;
  try {
    files = fs.readdirSync(BUGS_DIR).filter(f => f.endsWith('.md'));
  } catch { return bugs; }

  for (const file of files) {
    let content;
    try { content = fs.readFileSync(path.join(BUGS_DIR, file), 'utf8'); } catch { continue; }

    const fileHeaderEnd = content.search(/^#{2,3}\s+BUG-\d+:/m);
    const fileHeader = fileHeaderEnd > -1 ? content.slice(0, fileHeaderEnd) : '';
    const fileExtract = (field) => {
      const m = fileHeader.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`));
      return m ? m[1].trim() : '';
    };
    const fileModule = fileExtract('Module');
    const fileDate   = fileExtract('Date');

    const blocks = content.split(/(?=^#{2,3}\s+BUG-\d+:)/m);
    for (const block of blocks) {
      const idMatch = block.match(/^#{2,3}\s+(BUG-\d+):\s*(.+)/m);
      if (!idMatch) continue;

      const extract = (field) => {
        const m = block.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`));
        return m ? m[1].trim() : '';
      };

      const extractSection = (name) => {
        const re = new RegExp(`^###\\s+${name}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, 'm');
        const m = block.match(re);
        return m ? m[1].trim() : '';
      };

      const networkRaw = extractSection('Network Evidence');
      const endpointFromNetwork = (() => {
        const m = networkRaw.match(/\[(?:POST|GET|PUT|DELETE|PATCH)\]\s+(https?:\/\/\S+)/);
        return m ? m[1] : '';
      })();
      const httpFromNetwork = (() => {
        const m = networkRaw.match(/=>\s*\[?(\d{3})\]?/);
        return m ? m[1] : '';
      })();

      const screenshotRaw = extractSection('Screenshot').replace(/`/g, '').trim()
        || extract('Screenshot').replace(/`/g, '').trim();

      bugs.push({
        id:             idMatch[1],
        title:          idMatch[2].trim(),
        tc:             extract('TC'),
        severity:       extract('Severity') || 'Unknown',
        status:         extract('Status') || 'Open',
        module:         extract('Module') || fileModule,
        date:           extract('Date')   || fileDate,
        description:    extractSection('Description'),
        stepsToRepro:   extractSection('Steps to Reproduce'),
        expected:       extractSection('Expected'),
        actual:         extractSection('Actual'),
        networkEvidence: networkRaw,
        consoleError:   extractSection('Console Error'),
        impact:         extractSection('Impact'),
        url:            extractSection('URL').replace(/\n/g, ' ').trim(),
        screenshot:     screenshotRaw,
        possibleCause:  extractSection('Possible Cause'),
        suggestedFix:   extractSection('Suggested Fix'),
        endpoint:       extract('Endpoint') || endpointFromNetwork,
        httpStatus:     extract('HTTP Status') || httpFromNetwork,
        sourceFile:     file,
      });
    }
  }
  return bugs;
}

// ─── Observations Parser ─────────────────────────────────────────────────────

function parseObservations() {
  let content;
  try { content = fs.readFileSync(OBS_FILE, 'utf8'); } catch { return []; }

  const blocks = content.split(/(?=^### OBS-\d+)/m);
  return blocks.map(block => {
    const idMatch = block.match(/^### (OBS-\d+)\s*[—–-]+\s*(.+)/m);
    if (!idMatch) return null;

    const extract = (field) => {
      const m = block.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`));
      return m ? m[1].trim() : '';
    };

    const descMatch = block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/);
    const description = descMatch ? descMatch[1].trim() : '';
    const impactRaw = extract('Impact');
    const impactLevel = impactRaw.split(/[—–-]/)[0].trim();

    return {
      id:          idMatch[1],
      title:       idMatch[2].trim(),
      date:        extract('Date'),
      module:      extract('Module'),
      sourceTC:    extract('Source TC'),
      description,
      impact:      impactRaw,
      impactLevel,
      status:      extract('Status') || 'OPEN',
      decision:    extract('Decision') || '—',
    };
  }).filter(Boolean);
}

// ─── Learnings Parser ────────────────────────────────────────────────────────

function parseLearnings() {
  let content;
  try { content = fs.readFileSync(LEARN_FILE, 'utf8'); } catch { return []; }

  const blocks = content.split(/(?=^## )/m);
  return blocks.map(block => {
    const headerMatch = block.match(/^## (.+)/m);
    if (!headerMatch) return null;

    const title = headerMatch[1].trim();
    if (!title.match(/\d/) && !title.toLowerCase().includes('learning') && !title.toLowerCase().includes('optimization')) {
      return null;
    }

    const extract = (field) => {
      const m = block.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`));
      return m ? m[1].trim() : '';
    };

    const lines = block.split('\n').slice(1).filter(l => l.trim() && !l.startsWith('#'));
    const summary = lines.slice(0, 3).join(' ').replace(/\*\*/g, '').trim();

    return {
      id:        `L-${blocks.indexOf(block)}`,
      title,
      discovery: extract('Discovery') || extract('Issue') || extract('Pattern') || summary,
      fix:       extract('Fix') || extract('Solution') || extract('Action') || '',
      applyTo:   extract('Apply to') || extract('Applies to') || '',
    };
  }).filter(Boolean);
}

// ─── Test Cases Parser ───────────────────────────────────────────────────────

// Module metadata is auto-populated from test-cases/ folder structure.
// Customize labels here if you want friendly display names in the dashboard.
// Keys are the folder slugs under test-cases/ (e.g. 'login', 'dashboard').
// If a slug is not listed here, the server auto-generates a label from the slug.
const MODULE_META = {
  // Example:
  // 'login':     { label: 'Login & Auth',  prefix: 'TC-LOG', category: 'Authentication' },
  // 'dashboard': { label: 'Dashboard',     prefix: 'TC-DSH', category: 'Core' },
};

function parseTestCases() {
  // ── DB path (primary) ──────────────────────────────────────────────────────
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT id, module, submodule, title, priority, type, status,
               preconditions, steps, expected_result
        FROM test_cases
        WHERE status != 'deprecated'
        ORDER BY module, submodule, id
      `).all();

      const moduleMap = new Map();
      for (const row of rows) {
        if (!moduleMap.has(row.module)) moduleMap.set(row.module, new Map());
        const subMap = moduleMap.get(row.module);
        if (!subMap.has(row.submodule)) subMap.set(row.submodule, []);
        subMap.get(row.submodule).push({
          id:             row.id,
          title:          row.title,
          module:         row.module,
          submodule:      row.submodule,
          priority:       row.priority,
          type:           row.type,
          preconditions:  (() => { try { return JSON.parse(row.preconditions); } catch { return []; } })(),
          steps:          (() => { try { return JSON.parse(row.steps); } catch { return []; } })(),
          expectedResult: (() => { try { return JSON.parse(row.expected_result); } catch { return []; } })(),
        });
      }

      const modules = [];
      for (const [slug, subMap] of moduleMap) {
        const meta = MODULE_META[slug] || {
          label:    slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          prefix:   'TC-' + slug.slice(0, 3).toUpperCase(),
          category: 'General',
        };
        const submodules = [];
        for (const [subSlug, tcs] of subMap) {
          submodules.push({
            slug:  subSlug,
            label: subSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            tcs,
          });
        }
        modules.push({ slug, label: meta.label, category: meta.category, submodules });
      }
      if (!modules.length) throw new Error('empty');
      return { modules, source: 'db' };
    } catch { /* fall through to file parser */ }
  }

  // ── File path (fallback) ───────────────────────────────────────────────────
  if (!fs.existsSync(TC_DIR)) return { modules: [] };

  const allTcs = [];

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '_archive') walk(full);
      } else if (e.name.endsWith('.md') && e.name !== 'INDEX.md') {
        const relPath = path.relative(TC_DIR, full);
        const parts   = relPath.split(path.sep);
        const module  = parts.length >= 2 ? parts[0] : 'general';
        const subSlug = parts.length >= 2 ? parts[1].replace('.md', '') : parts[0].replace('.md', '');

        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }

        const blocks = content.split(/(?=^### TC-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+:)/m);
        for (const block of blocks) {
          const m = block.match(/^### (TC-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+):\s*(.+)/m);
          if (!m) continue;
          const priorityM = block.match(/\*\*Priority:\*\*\s*(\w+)/);
          const typeM     = block.match(/\*\*Type:\*\*\s*(.+)/);

          const extractList = (sectionName) => {
            const re = new RegExp(`\\*\\*${sectionName}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n---\\s*$|$)`, 'm');
            const sec = block.match(re);
            if (!sec) return [];
            return sec[1].split('\n')
              .map(l => l.replace(/^[\s\-*\d.]+/, '').trim())
              .filter(Boolean);
          };

          allTcs.push({
            id:             m[1],
            title:          m[2].trim(),
            module,
            submodule:      subSlug,
            priority:       priorityM ? priorityM[1] : 'Medium',
            type:           typeM ? typeM[1].trim() : 'Happy Path',
            preconditions:  extractList('Preconditions'),
            steps:          extractList('Steps'),
            expectedResult: extractList('Expected Result'),
          });
        }
      }
    }
  }

  walk(TC_DIR);

  const moduleMap = new Map();
  for (const tc of allTcs) {
    if (!moduleMap.has(tc.module)) moduleMap.set(tc.module, new Map());
    const subMap = moduleMap.get(tc.module);
    if (!subMap.has(tc.submodule)) subMap.set(tc.submodule, []);
    subMap.get(tc.submodule).push(tc);
  }

  const modules = [];
  for (const [slug, subMap] of moduleMap) {
    const meta = MODULE_META[slug] || {
      label:    slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      prefix:   'TC-' + slug.slice(0, 3).toUpperCase(),
      category: 'General',
    };
    const submodules = [];
    for (const [subSlug, tcs] of subMap) {
      submodules.push({
        slug: subSlug,
        label: subSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        tcs,
      });
    }
    modules.push({ slug, label: meta.label, category: meta.category, submodules });
  }

  return { modules };
}

// ─── File Watcher ────────────────────────────────────────────────────────────

let watchDebounce = null;

if (fs.existsSync(RESULTS_DIR)) {
  try {
    fs.watch(RESULTS_DIR, { recursive: true }, (_, filename) => {
      if (!filename) return;
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        if (filename === 'live-status.json') {
          sendSseEvent('status', readStatus());
        } else if (filename.startsWith('bugs')) {
          sendSseEvent('bugs', parseBugFiles());
        } else if (filename.includes('observations')) {
          sendSseEvent('observations', parseObservations());
        } else if (filename.includes('artemis-learnings')) {
          sendSseEvent('features', parseLearnings());
        }
        sendSseEvent('refresh', { ts: Date.now(), file: filename });
      }, 300);
    });
  } catch (e) {
    console.warn('Warning: Could not watch results directory:', e.message);
  }
} else {
  console.warn('Warning: results/ directory not found — file watching disabled');
}

// ─── POST Body Reader ─────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end',  () => {
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  if (req.method === 'POST') {

    if (TEAM_TOKEN && pathname.startsWith('/api/agent')) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${TEAM_TOKEN}`) {
        return sendJson(res, { error: 'Unauthorized' }, 401);
      }
    }

    let body;
    try { body = await readBody(req); }
    catch { return sendJson(res, { error: 'Invalid JSON body' }, 400); }

    if (pathname === '/api/agent/run') {
      if (!db) return sendJson(res, { error: 'DB not available' }, 503);
      const { command, appUrl, scope, triggeredBy } = body;
      if (!command) return sendJson(res, { error: 'command is required' }, 400);

      const ts    = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const slug  = (scope || 'run').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
      const runId = `run-${ts}-${slug}`;

      try {
        db.prepare(`
          INSERT OR REPLACE INTO test_runs
            (id, scope, app_url, started_at, status, triggered_by)
          VALUES (@id, @scope, @app_url, datetime('now'), 'pending_gate1', @triggered_by)
        `).run({ id: runId, scope: scope || 'unknown', app_url: appUrl || null, triggered_by: triggeredBy || 'team' });
      } catch (e) { return sendJson(res, { error: e.message }, 500); }

      sendSseEvent('gate1', {
        runId, command, appUrl: appUrl || null, scope: scope || null,
        mode: command.includes('quickly') ? 'quick_action' : 'scoped',
      });

      return sendJson(res, { ok: true, runId, status: 'pending_gate1' });
    }

    const approveMatch = pathname.match(/^\/api\/agent\/run\/([^/]+)\/approve$/);
    if (approveMatch) {
      const runId = decodeURIComponent(approveMatch[1]);
      if (!db) return sendJson(res, { error: 'DB not available' }, 503);

      const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(runId);
      if (!run) return sendJson(res, { error: 'Run not found' }, 404);

      db.prepare("UPDATE test_runs SET status = 'running' WHERE id = ?").run(runId);

      try {
        await triggerArtemisJob({
          command:     run.triggered_by === 'team' ? (body.command || run.scope) : run.scope,
          runId,
          appUrl:      run.app_url,
          scope:       run.scope,
          serverUrl:   SERVER_URL,
          appDataPath: APP_DATA_PATH,
          skillPath:   SKILL_PATH,
        });
      } catch (e) {
        db.prepare("UPDATE test_runs SET status = 'failed' WHERE id = ?").run(runId);
        return sendJson(res, { error: `Failed to trigger job: ${e.message}` }, 500);
      }

      sendSseEvent('run_started', { runId, scope: run.scope });
      return sendJson(res, { ok: true, runId, status: 'running' });
    }

    const cancelMatch = pathname.match(/^\/api\/agent\/run\/([^/]+)\/cancel$/);
    if (cancelMatch) {
      const runId = decodeURIComponent(cancelMatch[1]);
      if (db) db.prepare("UPDATE test_runs SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(runId);
      sendSseEvent('run_cancelled', { runId });
      return sendJson(res, { ok: true });
    }

    const messageMatch = pathname.match(/^\/api\/agent\/run\/([^/]+)\/message$/);
    if (messageMatch) {
      const runId = decodeURIComponent(messageMatch[1]);
      const { text } = body;
      if (!text) return sendJson(res, { error: 'text is required' }, 400);
      if (db) {
        try {
          db.prepare('UPDATE test_runs SET pending_message = ? WHERE id = ?').run(text, runId);
        } catch { /* column may not exist yet — non-fatal */ }
      }
      sendSseEvent('user_message', { runId, text });
      return sendJson(res, { ok: true });
    }

    if (pathname === '/api/agent-event') {
      const { runId, event } = body;
      if (runId && event) sendSseEvent(event.type, { runId, ...event });
      return sendJson(res, { ok: true });
    }

    if (!db) return sendJson(res, { error: 'DB not available' }, 503);

    if (pathname === '/api/runs') {
      try {
        db.prepare(`
          INSERT OR REPLACE INTO test_runs
            (id, scope, module, submodule, app_url, started_at, status, total_tcs, triggered_by)
          VALUES (@id, @scope, @module, @submodule, @app_url, datetime('now'), 'running', @total_tcs, @triggered_by)
        `).run({
          id:           body.id,
          scope:        body.scope        || 'unknown',
          module:       body.module       || null,
          submodule:    body.submodule    || null,
          app_url:      body.app_url      || null,
          total_tcs:    body.total_tcs    || 0,
          triggered_by: body.triggered_by || null,
        });
        sendSseEvent('run_started', { runId: body.id, scope: body.scope });
        return sendJson(res, { ok: true, id: body.id });
      } catch (e) { return sendJson(res, { error: e.message }, 500); }
    }

    if (pathname === '/api/results') {
      try {
        const resultId = db.prepare(`
          INSERT INTO test_results
            (run_id, tc_id, tc_title, status, duration_ms, screenshot_path, error_message, notes)
          VALUES (@run_id, @tc_id, @tc_title, @status, @duration_ms, @screenshot_path, @error_message, @notes)
        `).run({
          run_id:          body.run_id,
          tc_id:           body.tc_id,
          tc_title:        body.tc_title        || null,
          status:          body.status.toUpperCase(),
          duration_ms:     body.duration_ms     || null,
          screenshot_path: body.screenshot_path || null,
          error_message:   body.error_message   || null,
          notes:           body.notes           || null,
        }).lastInsertRowid;

        sendSseEvent('result', {
          runId:          body.run_id,
          tcId:           body.tc_id,
          tcTitle:        body.tc_title,
          status:         body.status.toUpperCase(),
          screenshot_path: body.screenshot_path || null,
          resultId,
        });
        return sendJson(res, { ok: true, resultId });
      } catch (e) { return sendJson(res, { error: e.message }, 500); }
    }

    if (pathname === '/api/bugs') {
      try {
        const stepsArray = Array.isArray(body.steps_to_reproduce)
          ? body.steps_to_reproduce
          : (body.steps_to_reproduce ? [body.steps_to_reproduce] : []);

        db.prepare(`
          INSERT OR REPLACE INTO bugs
            (id, run_id, tc_id, module, title, severity, status, description,
             steps_to_reproduce, expected_behavior, actual_behavior,
             screenshot_path, endpoint, http_status, console_error,
             network_evidence, impact, possible_cause, suggested_fix, url, updated_at)
          VALUES
            (@id, @run_id, @tc_id, @module, @title, @severity, @status, @description,
             @steps_to_reproduce, @expected_behavior, @actual_behavior,
             @screenshot_path, @endpoint, @http_status, @console_error,
             @network_evidence, @impact, @possible_cause, @suggested_fix, @url, datetime('now'))
        `).run({
          id:                 body.id,
          run_id:             body.run_id             || null,
          tc_id:              body.tc_id              || null,
          module:             body.module,
          title:              body.title,
          severity:           body.severity,
          status:             body.status             || 'open',
          description:        body.description        || null,
          steps_to_reproduce: JSON.stringify(stepsArray),
          expected_behavior:  body.expected_behavior  || null,
          actual_behavior:    body.actual_behavior,
          screenshot_path:    body.screenshot_path    || null,
          endpoint:           body.endpoint           || null,
          http_status:        body.http_status        || null,
          console_error:      body.console_error      || null,
          network_evidence:   body.network_evidence   || null,
          impact:             body.impact             || null,
          possible_cause:     body.possible_cause     || null,
          suggested_fix:      body.suggested_fix      || null,
          url:                body.url                || null,
        });

        sendSseEvent('bugs', parseBugFiles());
        return sendJson(res, { ok: true, id: body.id });
      } catch (e) { return sendJson(res, { error: e.message }, 500); }
    }

    return sendJson(res, { error: 'Not found' }, 404);
  }

  if (req.method !== 'GET') {
    return sendJson(res, { error: 'Method not allowed' }, 405);
  }

  switch (pathname) {
    case '/':
    case '/index.html':
      return serveHtml(res);

    case '/tc-list':
    case '/tc-list.html':
      return serveHtml(res, TC_LIST_HTML);

    case '/api/status':
      return sendJson(res, readStatus());

    case '/api/bugs':
      return sendJson(res, parseBugFiles());

    case '/api/observations':
      return sendJson(res, parseObservations());

    case '/api/features':
      return sendJson(res, parseLearnings());

    case '/api/testcases':
      return sendJson(res, parseTestCases());

    case '/api/results/by-tc': {
      if (!db) return sendJson(res, {});
      const rows = db.prepare(`
        SELECT tc_id, status, screenshot_path, executed_at, error_message
        FROM test_results
        WHERE id IN (
          SELECT MAX(id) FROM test_results GROUP BY tc_id
        )
      `).all();
      const byTc = {};
      for (const r of rows) byTc[r.tc_id] = r;
      return sendJson(res, byTc);
    }

    case '/api/events':
      return handleSse(req, res);

    case '/api/runs':
      if (!db) return sendJson(res, { error: 'DB not available' }, 503);
      return sendJson(res, db.prepare(`
        SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 50
      `).all());

    case '/api/results':
      if (!db) return sendJson(res, { error: 'DB not available' }, 503);
      return sendJson(res, db.prepare(`
        SELECT tr.*, tc.title as tc_title_full
        FROM test_results tr
        LEFT JOIN test_cases tc ON tc.id = tr.tc_id
        ORDER BY tr.executed_at DESC LIMIT 200
      `).all());

    case '/api/db/stats':
      if (!db) return sendJson(res, { available: false });
      return sendJson(res, {
        available: true,
        test_cases:   db.prepare('SELECT COUNT(*) as n FROM test_cases').get().n,
        test_runs:    db.prepare('SELECT COUNT(*) as n FROM test_runs').get().n,
        test_results: db.prepare('SELECT COUNT(*) as n FROM test_results').get().n,
        bugs:         db.prepare('SELECT COUNT(*) as n FROM bugs').get().n,
        open_bugs:    db.prepare("SELECT COUNT(*) as n FROM bugs WHERE status='open'").get().n,
      });

    default: {
      if (pathname.startsWith('/api/testcases/')) {
        if (!db) return sendJson(res, { error: 'DB not available' }, 503);
        const tcId = decodeURIComponent(pathname.slice('/api/testcases/'.length));
        const tc   = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(tcId);
        return sendJson(res, tc || {});
      }

      if (pathname.startsWith('/api/screenshots/')) {
        if (!db) return sendJson(res, { error: 'DB not available' }, 503);
        const id  = parseInt(pathname.slice('/api/screenshots/'.length), 10);
        if (!isNaN(id)) {
          const row = db.prepare('SELECT data, file_path FROM screenshots WHERE id = ?').get(id);
          if (row && row.data) {
            const ext  = (row.file_path || '').toLowerCase();
            const mime = ext.endsWith('.gif') ? 'image/gif' : 'image/png';
            res.writeHead(200, {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': CORS_ORIGIN,
            });
            return res.end(Buffer.from(row.data, 'base64'));
          }
        }
        return sendJson(res, { error: 'Screenshot not found' }, 404);
      }

      if (pathname.startsWith('/screenshots/')) {
        const relPath = pathname.slice('/screenshots/'.length);
        const safePath = relPath.split('/').map(seg => path.basename(seg)).filter(Boolean).join('/');
        const candidates = [
          path.join(ROOT, 'results', 'screenshots', safePath),
          path.join(ROOT, 'screenshots', safePath),
        ];
        for (const filePath of candidates) {
          if (fs.existsSync(filePath)) {
            const ext = path.extname(safePath).toLowerCase();
            const mime = ext === '.png' ? 'image/png'
                       : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                       : ext === '.gif' ? 'image/gif'
                       : ext === '.webp' ? 'image/webp'
                       : 'application/octet-stream';
            res.writeHead(200, {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': CORS_ORIGIN,
            });
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        if (db) {
          const relFilePath = `results/screenshots/${safePath}`;
          const row = db.prepare('SELECT data, file_path FROM screenshots WHERE file_path = ? OR file_path LIKE ?')
            .get(relFilePath, `%/${safePath}`);
          if (row && row.data) {
            const ext  = safePath.toLowerCase();
            const mime = ext.endsWith('.gif') ? 'image/gif' : 'image/png';
            res.writeHead(200, {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': CORS_ORIGIN,
            });
            return res.end(Buffer.from(row.data, 'base64'));
          }
        }
        return sendJson(res, { error: 'Screenshot not found' }, 404);
      }

      if (pathname.startsWith('/web/') || pathname === '/team') {
        const fileSeg = pathname === '/team' ? '/web/index.html' : pathname;
        const safeFile = path.join(WEB_DIR, path.basename(fileSeg));
        if (fs.existsSync(safeFile)) {
          const ext  = path.extname(safeFile).toLowerCase();
          const mime = ext === '.html' ? 'text/html'
                     : ext === '.js'   ? 'application/javascript'
                     : ext === '.css'  ? 'text/css'
                     : 'text/plain';
          res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': CORS_ORIGIN });
          return fs.createReadStream(safeFile).pipe(res);
        }
      }

      return sendJson(res, { error: 'Not found' }, 404);
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ✦ Artemis Live Server');
  console.log(`  → Dashboard:  http://localhost:${PORT}`);
  console.log(`  → TC List:    http://localhost:${PORT}/tc-list`);
  console.log(`  → API:        http://localhost:${PORT}/api/status`);
  console.log(`  → SSE events: http://localhost:${PORT}/api/events`);
  console.log('');
  console.log('  Watching: results/ for file changes');
  console.log('  Press Ctrl+C to stop');
  console.log('');
});

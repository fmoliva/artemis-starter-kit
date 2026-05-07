#!/usr/bin/env node
'use strict';

/**
 * Artemis — split-data.js
 *
 * Partitions an explore JSON file into per-module files in results/modules/.
 * Must be run after every /explore phase and before the CLI execution phase.
 * This is required by GATE 2 — execution is blocked until results/modules/ is populated.
 *
 * Usage:
 *   node scripts/split-data.js
 *   node scripts/split-data.js --file=results/explorations/explore-opd-2026-04-16.json
 *
 * Reads:  results/explorations/<latest>.json  (or --file override)
 * Writes: results/modules/<module-slug>.json  (3–8 KB each)
 */

const fs   = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function findLatestExploration(flag) {
  if (flag) return path.resolve(flag);
  const dir = path.join(APP_DIR, 'results', 'explorations');
  if (!fs.existsSync(dir)) throw new Error(`results/explorations/ not found. Run /explore first.`);
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) throw new Error('No exploration JSON found in results/explorations/. Run /explore first.');
  return path.join(dir, files[0].name);
}

// ── main ─────────────────────────────────────────────────────────────────────

const fileFlag = process.argv.find(a => a.startsWith('--file='))?.split('=')[1];
const srcPath  = findLatestExploration(fileFlag);

console.log(`Reading: ${path.relative(APP_DIR, srcPath)}`);
const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

const pageDetails = data.pageDetails ?? [];

// Group by moduleName (fall back to top-level data.module for single-module files)
const groups = {};
for (const page of pageDetails) {
  const mod = page.moduleName ?? data.module ?? 'Unknown';
  if (!groups[mod]) groups[mod] = [];
  groups[mod].push(page);
}

// Build sitemap lookup per module
const sitemapByModule = {};
for (const entry of (data.sitemap ?? [])) {
  const mod = entry.module ?? 'Unknown';
  sitemapByModule[mod] = entry;
}

// Ensure output directory exists
const outDir = path.join(APP_DIR, 'results', 'modules');
fs.mkdirSync(outDir, { recursive: true });

// Write one file per module
let written = 0;
for (const [modName, pages] of Object.entries(groups)) {
  const slug    = slugify(modName);
  const outPath = path.join(outDir, `${slug}.json`);
  const payload = {
    module:      modName,
    exploredOn:  data.exploredOn ?? new Date().toISOString().slice(0, 10),
    sitemap:     sitemapByModule[modName] ?? null,
    pageDetails: pages,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
  console.log(`  Wrote results/modules/${slug}.json  (${kb} KB, ${pages.length} page(s))`);
  written++;
}

console.log(`\nDone. ${written} module file(s) written to results/modules/`);

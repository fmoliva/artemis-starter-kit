# Part 11: Optimization Protocol

This document governs token efficiency, data handling, file size budgets, and
self-adaptation for all Artemis sessions.

---

## 1. Token Overflow Detection

A token overflow occurs when a file read returns:

```
File content (N tokens) exceeds maximum allowed tokens (25000).
```

**Never retry the same read.** The file is too large — split it first.

### Overflow thresholds

| File size | Action |
|-----------|--------|
| < 50KB | Read directly |
| 50–100KB | Read in parts using `offset` + `limit` (500 lines each) |
| > 100KB | **Run split-data.js first.** Never read directly. |
| > 500KB | Split is mandatory. Pipe bash output to temp file, read with offset/limit. |

---

## 2. Data Split Protocol

### When to run

Run `node scripts/split-data.js` **immediately after every `/explore` run** on any app with 20+ pages. Do not wait for a read failure — pre-split proactively.

### What the script must do

1. Read `results/explore-raw.json`
2. Group `pageDetails` entries by module (using `module` or `parent` field from `sitemap`)
3. For each module, write `results/modules/<kebab-slug>.json` containing:
   - `module` (name), `category`, `pages` array
   - Per page: `url` (path only, no domain), `inputs` (label array), `buttons` (top 10 labels only), `tableHeaders` (array), `sidebarLinks` (top 15, deduped), `tabs` (array)
4. Strip completely: raw HTML, screenshot base64 or paths, full DOM dumps, repeated navigation items, metadata fields not needed for test generation
5. Output: `Written N module files to results/modules/`

### Expected output size

Each `results/modules/<slug>.json` should be **3–8KB**. If any output file exceeds 50KB, apply additional stripping (reduce buttons to 5, sidebarLinks to 10, truncate input labels at 60 chars).

### If split-data.js does not exist

Create it in `scripts/split-data.js` before proceeding. The script is a project artifact — commit it alongside test cases.

### After split

All subsequent test case generation MUST read per-module files only:
```bash
# Good
cat results/modules/admission-for-lying-in.json

# Never
cat results/explore-raw.json
```

---

## 3. File Size Budgets

### Test case files

| Level | File | Max size |
|-------|------|----------|
| Index | `test-cases/INDEX.md` | 80 lines (links + brief description only) |
| Module index | `test-cases/<module>/INDEX.md` | 40 lines |
| Submodule TC file | `test-cases/<module>/<submodule>.md` | **300 lines** |

If a submodule file approaches 300 lines, split it into two files:
- `<submodule>-happy-path.md`
- `<submodule>-edge-cases.md`

Never put all test cases in a single file regardless of app size.

### Module JSON files

| File | Max size |
|------|----------|
| `results/modules/<slug>.json` | 50KB |
| `results/explore-raw.json` | No limit (never read directly) |

---

## 4. When to Split Further

Apply sub-submodule splitting when a submodule `.md` would exceed 300 lines. Example:

```
utilities/
├── INDEX.md
├── floors.md           (15 TCs — within budget)
├── inventory-masters/
│   ├── INDEX.md
│   ├── items.md        (20 TCs)
│   └── suppliers.md    (18 TCs)
```

Apply reporting sub-splitting when a report category has 20+ report types:

```
reporting/
├── INDEX.md
├── city-planning-reports/
│   ├── INDEX.md
│   └── [one .md per report type]
└── health-center-reports/
    ├── INDEX.md
    └── [one .md per report type]
```

---

## 5. Index File Rules

Index files (`INDEX.md`) contain **only**:
- Table of submodule files with TC ranges and counts
- Brief description of what the module covers
- Links to child index files (for nested modules)

Index files **never** contain:
- Actual test case steps
- Expected results
- Preconditions

An index file is a map, not a test suite.

---

## 6. Playwright CLI Fallback — Trigger Conditions

Use the Playwright CLI via Bash (`npx playwright test`) only when:

1. **Playwright MCP is unavailable** — tool not listed in active tools
2. **Claude-in-Chrome MCP fails** — Chrome extension security sandbox blocks `captureVisibleTab`
3. **Both MCP tools produce empty screenshots** — suspect sandbox restriction

Playwright CLI is the secondary fallback. It produces `.spec.ts` files that run headlessly. Prefer MCP tools for interactive exploration.

---

## 7. Angular SPA Patterns ([app-name] and similar apps)

These patterns were learned from Angular SPAs (Angular 14, route-guarded SPA):

| Problem | Solution |
|---------|----------|
| `fill()` clears field but Angular doesn't register value | Use `pressSequentially(value, { delay: 50 })` |
| Submit button click has no effect | Use `click({ force: true })` |
| Direct URL navigation blocked by route guard | Navigate to `/modules` → click module card → navigate via sidebar |
| `context.newPage()` breaks Angular auth state | Use `browser.newPage()` instead |
| Location modal blocks all actions on first load | Dismiss modal before every test (select location, click confirm) |
| Module card selector fails | Try `a[class*="module-card"]` or `[data-module]` attribute |
| Tab selector fails | Try `[role="button"][class*="tabs"]` or `[role="tab"]` |
| Table rows not interactive | Use `tr:has(td)` then click first `td` or action button within row |

When a new SPA pattern is discovered, add it to this table immediately and log to `results/artemis-learnings.md`.

---

## 8. Self-Adaptation Log Format

### Learning Routing — Where to Save

Before writing a learning, classify it:

| Learning type | Save to |
|--------------|---------|
| Bug in an Artemis script (`write-result.js`, `query-tcs.js`, `write-bug.js`, etc.) | `~/.claude/skills/artemis/references/skill-learnings.md` |
| Behavioral rule Artemis missed (run-end sequence, DB-First, pre-flight check, etc.) | `~/.claude/skills/artemis/references/skill-learnings.md` |
| Framework interaction pattern applies to any app (Angular SPA, React, Vue) | `~/.claude/skills/artemis/references/skill-learnings.md` |
| App-specific data quirk (explore-raw.json shape, nav noise for this app) | `[app-name]/results/artemis-learnings.md` |
| App-specific token overflow fix | `[app-name]/results/artemis-learnings.md` |
| Test case structure decision for this app | `[app-name]/results/artemis-learnings.md` |
| Selector that only fails in this app's UI | `[app-name]/results/artemis-learnings.md` |

**Rule:** If the fix would help Artemis on ANY future project, it goes in `skill-learnings.md`.
If it only makes sense for this specific app, it goes in the project log.

### Format for `skill-learnings.md` entries

```markdown
### [DATE] — [Short title]
**Type:** Infrastructure fix | Behavioral rule | Pattern
**Applies to:** All projects | Angular SPAs | DB-mode projects
**Rule:** [One-sentence rule Artemis must follow]
**Why:** [What broke when this was missing]
**Reference doc:** [part-X updated, or "N/A — fully defined here"]
```

### Format for project-level `[app-name]/results/artemis-learnings.md` entries

```markdown
## [DATE] — [Session command that triggered the learning]

**Discovery:** [What the problem was]
**Fix applied:** [What was done to resolve it]
**Artemis doc updated:** [Which reference file was updated]
**Apply to:** [All apps / Angular apps / Apps with 20+ pages / etc.]
```

### Trigger conditions for a learning entry

Write a new entry whenever:
- A selector strategy failed 3+ times before a working alternative was found
- A token overflow was hit (even if recovered)
- A browser interaction pattern was tried and failed before a workaround was discovered
- A new test case structure improvement was made
- A script was created to automate a previously manual step

### Which reference doc to update

| Discovery type | Update this doc |
|----------------|-----------------|
| New SPA interaction pattern | `part-8-browser-tools.md` or this file (§7) |
| Token overflow recovery method | This file (§1–§3) |
| Selector that consistently fails | `part-9-selector-strategy.md` anti-patterns section |
| Better test case organization | `part-2-test-case-parser.md` + `part-4-exploratory-qa.md` |
| New stop condition for exploration | `part-4-exploratory-qa.md` |
| Bug analysis shortcut | `part-6-bug-analyzer.md` |

**Rule: update the reference doc AND the appropriate learnings file in the same session the learning occurred. Do not defer.**

---

## 9. Bash Output Size Control

When bash commands produce output from large files, redirect to a temp file first:

```bash
# Risky — output may exceed token limit
node scripts/extract-module.js admission

# Safe — write then read with limit
node scripts/extract-module.js admission > /tmp/admission-extract.json
# then read /tmp/admission-extract.json with limit=200
```

For any bash command whose output exceeds 200 lines, use:
```bash
command | head -200
# or for middle sections:
command | tail -n +100 | head -100
```

---

## 10. Verification Checklist

After running the data split, verify:

- [ ] `ls results/modules/` shows ≥1 JSON file per module
- [ ] No module file exceeds 50KB
- [ ] Any single module file can be read in one operation (no token overflow)
- [ ] `explore-raw.json` is untouched
- [ ] `scripts/split-data.js` is committed to the project

After test case generation, verify:

- [ ] `test-cases/INDEX.md` links to every module folder
- [ ] Every module folder has its own `INDEX.md`
- [ ] No submodule `.md` exceeds 300 lines
- [ ] Every TC has: preconditions, steps, expected result, priority, type
- [ ] TC IDs use module prefixes (e.g., `TC-ADM-001` not `TC-001`)

---

## 11. TC Loading Protocol

### DB-First Rule (primary — use when `artemis.db` exists)

Check for the database before doing anything with TC files:
```bash
ls [app-name]/artemis.db
```

If it exists, **always query the DB** — never read `.md` files for TC loading.

| Scope | Command |
|-------|---------|
| Quick Action | `node [app-name]/scripts/query-tcs.js --scope=quick_action --action="<phrase>" --limit=1` |
| Single TC | `node [app-name]/scripts/query-tcs.js --tc-id=<TC-ID>` |
| Feature | `node [app-name]/scripts/query-tcs.js --module=<mod> --submodule=<sub>` |
| Happy Path only | Add `--type=happy_path` to any command |
| Module | `node [app-name]/scripts/query-tcs.js --module=<mod>` |
| Range | `node [app-name]/scripts/query-tcs.js --module=<mod> --range=018-025` |
| Count check | Add `--count` — returns `{"count": N}` only |

**Token savings:** One DB query returns only the fields needed (~50–100 tokens per TC). Reading a 517-line `.md` file costs ~1,200 tokens for a single TC. **DB = ~15× more efficient.**

**After loading, label in context:**
```
[FILTERED_TCS: scope=<scope>, source=db, count=<N>]
```

**No-double-query rule:** The Orchestrator queries the DB and labels the result. The Runner uses the label directly — never re-queries the DB for the same TC set.

---

### File-Based Fallback (only when `artemis.db` does not exist)

If the DB is missing, follow this sequence to minimize token usage:

**Step 1 — INDEX-first navigation**
1. Read `test-cases/INDEX.md` (≤109 lines) — confirm module folder
2. Read `test-cases/<module>/INDEX.md` (≤40 lines) — identify the exact submodule file
3. Read **only** those identified file(s)

**Step 2 — Scope-narrowed reads**

| Scope | Read strategy |
|-------|--------------|
| Single TC | `offset` + `limit: 80` at estimated line position |
| Range (≤10 TCs) | `offset` + `limit: 300` covering the range |
| Feature / Range (>10) | Full submodule file — one file only |
| Module | One submodule file at a time |
| End-to-End | Module INDEX first, then submodule files one at a time |

**Step 3 — Oversize file check**
```bash
wc -l test-cases/<module>/<file>.md
```

| Lines | Action |
|-------|--------|
| ≤ 300 | Read directly |
| 301–500 | `limit: 250` chunks with `offset` |
| > 500 | 200-line chunks; recommend splitting after the run |

**Note:** Oversize file problems disappear once the DB is set up. Encourage users to run:
```bash
cd [app-name] && npm install && npm run db:setup
```

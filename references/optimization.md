# Optimization Protocol — Token Efficiency, Data Splits, File Budgets, Checkpoints

---

## Token Overflow Detection

A token overflow occurs when a file read returns:
```
File content (N tokens) exceeds maximum allowed tokens (25000).
```

**Never retry the same read.** Split the file first.

| File size | Action |
|-----------|--------|
| < 50KB | Read directly |
| 50–100KB | Read in 500-line chunks with offset/limit |
| > 100KB | Run `split-data.js` first. Never read directly. |

---

## Data Split Protocol

### When to Run

Run `node scripts/split-data.js` **immediately after every `/explore` run** on any app
with 20+ pages. Do not wait for a read failure.

### What It Does

1. Read `results/explore-raw.json`
2. Group `pageDetails` by module (using `module` or `parent` field from `sitemap`)
3. For each module, write `results/modules/<kebab-slug>.json` with:
   - `module`, `category`, `pages` array
   - Per page: `url` (path only), `inputs`, `buttons` (top 10), `tableHeaders`, `tabs`
4. Strip: raw HTML, screenshot base64, full DOM dumps, repeated nav items

### Expected Output

Each `results/modules/<slug>.json` should be **3–8KB**.
If any exceeds 50KB: reduce buttons to 5, truncate labels at 60 chars.

### After Split

```bash
# Always read per-module files:
cat results/modules/triage.json

# Never read explore-raw.json directly
```

---

## File Size Budgets

### Test Case Files

| Level | File | Max Size |
|-------|------|----------|
| Index | `test-cases/INDEX.md` | 80 lines |
| Module index | `test-cases/<module>/INDEX.md` | 40 lines |
| Submodule TC file | `test-cases/<module>/<submodule>.md` | **300 lines** |

If approaching 300 lines, split into `<submodule>-happy-path.md` and `<submodule>-edge-cases.md`.

### Module JSON Files

| File | Max Size |
|------|----------|
| `results/modules/<slug>.json` | 50KB |
| `results/explore-raw.json` | No limit (never read directly) |

---

## Bash Output Control

When bash commands produce large output, redirect first:

```bash
# Risky — output may exceed token limit
node scripts/extract-module.js admission

# Safe — write then read with limit
node scripts/extract-module.js admission > /tmp/admission-extract.json
# then read with offset/limit

# For any output > 200 lines:
command | head -200
```

---

## Session Checkpoint Format

Write `[APP]/results/session-checkpoint.md` after every run:

```markdown
# Session Checkpoint

**Date:** [YYYY-MM-DD]
**Scope:** [module/submodule or full]
**Status:** [complete | interrupted]

## Completed TCs
| TC ID | Status | Title |
|-------|--------|-------|
| TC-TRI-001 | PASS | Login with valid credentials |
| TC-TRI-002 | FAIL | Login with empty password |

## Remaining TCs
| TC ID | Title |
|-------|-------|
| TC-TRI-010 | Patient search by name |

## Resume From
TC-TRI-010

## Session Notes
- [any context the next session needs]
```

**Write checkpoint after every run, even interrupted ones.**
The `/resume` command reads this file to continue from the last unexecuted TC.

---

## Learnings Format

Append to `[APP]/results/artemis-learnings.md` after every run:

```markdown
## [YYYY-MM-DD] — [scope]
**TCs run:** [N pass, N fail, N blocked]
**New bugs:** [IDs or "none"]
**Selector issues:** [descriptions or "none"]
**Patterns to remember:** [anything useful for next session]
**Resume from:** [TC-ID or "complete"]
```

---

## DB-First TC Loading (Summary)

```bash
ls [app]/artemis.db && echo "USE DB" || echo "USE FILES"
```

**DB exists:** Use `query-tcs.js` — ~50-100 tokens per TC.
**DB missing:** Read `.md` files — ~1,200 tokens per TC.

**DB = ~15× more efficient.** Always set up the DB.

### Zero-Token Regression (`/rerun`)

Once `.spec.ts` files exist, use `/rerun` instead of `/run`.
`npx playwright test` runs in a shell subprocess — no MCP calls, no browser tokens.
50-TC regression: ~500 tokens (shell output) vs ~15,000 tokens (MCP-driven).

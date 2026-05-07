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

1. Read the most recent file in `results/explorations/` (glob `explore-*.json`, sort by date)
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

# Never read the exploration JSON directly
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

## Phase Transition: MCP Explore → CLI Execution

After every `/explore` run, before invoking CLI playwright or `/run`:

| Step | Action | Why |
|------|--------|-----|
| 1 | `mcp__playwright__browser_close` | Stop snapshot accumulation in context |
| 2 | `node scripts/split-data.js` | Partition explore data into 3–8KB module files |
| 3 | Write `results/explorations/explore-summary-[YYYY-MM-DD].md` (compact) | Lean cross-session reference |
| 4 | CLI phase reads `results/modules/<slug>.json` ONLY | ~50–90% context savings |

**Why this matters:** Each `browser_snapshot` call returns 5–78KB of YAML that stays in context. Closing the browser and writing compact summaries to disk means CLI execution loads from small files rather than recalling large YAML context.

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

---

## Measured Footprints (QCHIS Staging — 2026-04-21 Audit)

Real line counts from the QCHIS project. Use as a calibration reference.

### Session Base Load
| Component | Lines | ~Tokens |
|-----------|-------|---------|
| S1b vault files (`_app-overview` + `_test-data` + `known-bugs`) | 220 | ~1,800 |
| `CLAUDE.md` (auto-loaded) | 64 | ~500 |
| Memory index (MEMORY.md only — auto-loaded, capped at 200 lines — individual files read on-demand) | ~200 | ~1,600 |
| **Total base per session** | **~484** | **~3,900** |

### Per-Command Overhead
| Command | Extra Lines | Notes |
|---------|-------------|-------|
| `/run` (1 module) | ~350–400 | spec + TC file for that module only |
| `/explore` | +200–500 | depends on snapshot count; hard cap 10 |
| `/context [module]` | ~400 | vault module files — always scope to 1 module |
| `/bug`, `/improve`, `/parse`, `/audit` | ~200–600 | subagent — does NOT accumulate in main context |
| `/matrix` | ~705 | all TC files; acceptable (read-only, no browser) |

### CLI vs MCP Cost Ratio
- CLI spec run (40 TCs): ~500 tokens total
- MCP-driven run (same 40 TCs): ~15,000 tokens
- **Ratio: 30× cheaper via CLI** — always check for `.spec.ts` before opening browser

Full token budget with update protocol: see `_token-budget.md` in the context vault.

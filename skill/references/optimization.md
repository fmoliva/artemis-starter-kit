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
cat results/modules/orders.json

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
| TC-MOD-001 | PASS | Login with valid credentials |
| TC-MOD-002 | FAIL | Login with empty password |

## Remaining TCs
| TC ID | Title |
|-------|-------|
| TC-MOD-010 | Search by name |

## Resume From
TC-MOD-010

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

## Usage Logging Protocol

Track real per-session tool-call and usage/cost data instead of assuming the rules above are
holding usage down. This applies to any MCP-capable client (Claude Code, Gemini CLI, Cursor,
Copilot, etc.) — "usage %" dashboards differ per vendor, but the logging discipline is the same.

**When:** at the end of any command that opens a browser via MCP — `/explore`, `/verify`,
`/ticket`, `/run`, `/bug` (when it investigates via browser).

**Action:** append a row to `_usage-log.md` in the context vault: date, command, feature/module,
rough tool-call tally (snapshot / screenshot / navigation counts), which Budget Rules from
`_token-budget.md` were followed or skipped.

**Usage/cost number:** attach it to the entry only if the user volunteers one during or after the
session (a usage-percentage dashboard, a token/cost report). Never solicit it proactively.

**Hard constraint:** this logging is observational only. It must never cause a testing step to be
skipped, shortened, or sampled instead of covered — Stop-and-Ask, Server-Side Blocker, and
full-coverage rules all still apply in full. If a pattern in the log suggests a new Budget Rule,
propose it to the user before adopting it — never self-apply a rule that trades test coverage for
token savings.

## Context Compaction for Auto-Continue Queue Runs

`/ticket`'s Auto-Continue Rule (see `commands/ticket.md`) drains the entire `📥 Pending` column
in one unbroken session — after each card lands on Done/Blocked it starts the next one without
asking, and only stops for a missing/untestable note, a >20-scenario matrix, or a Stop-and-Ask /
Server-Side Blocker hit mid-ticket. That means a long queue can run through many cards, and many
rounds of Playwright MCP snapshots, with no natural pause to compact context in between.

There is no hook or tool that can force a compaction after a specific event (a ticket finishing,
a card moving columns) — compaction is either automatic (context-size triggered) or run manually
via `/compact`. The closest lever is tightening `autoCompactWindow` in the project's
`.claude/settings.json` (see `project-starter/.claude/settings.json`) so the automatic threshold
fires more proactively during a long auto-continue run instead of waiting near the full context
limit. This is a size-based approximation, not a true per-ticket trigger — a single ticket's own
MCP work can still push a compaction mid-ticket. If that starts causing rework (lost detail
mid-investigation), raise the value back up in that project's settings.

## Targeted Checks Over Full Snapshots

For routine post-action verification — confirming a single field/value/state after an action
already expected to succeed (e.g. a pre-populated field, a toggle result) — use a targeted, scoped
tool call (a find-by-selector call, a narrow evaluate/query) instead of a full accessibility-tree
snapshot. Reserve full snapshots for:

- Initial page discovery
- Diagnosing an unexpected or failed result — still required before writing any fix; never
  diagnose from error text alone
- Checking several elements at once

Don't re-snapshot state that hasn't changed since the last capture — reuse it instead.

## Measured Footprints (Example Audit — Production Project)

Real line counts from a production project audit. Use as a calibration reference.

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

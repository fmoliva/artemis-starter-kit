# [YOUR APP NAME] — Project Context

## On Every Session Start

### Step 00 — First-run setup check

```bash
SETUP_NEEDED=0

# Detect OS to show the correct prereqs command
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux"* ]]; then
  PREREQS_CMD="bash setup-prereqs.sh"
elif [[ "$OS" == "Windows_NT" ]] || command -v powershell.exe >/dev/null 2>&1; then
  PREREQS_CMD="powershell -ExecutionPolicy RemoteSigned -File setup-prereqs.ps1"
else
  PREREQS_CMD=""  # Unknown — will ask user below
fi

node --version >/dev/null 2>&1 || { echo "  [1] Node.js not found"; SETUP_NEEDED=1; NODE_MISSING=1; }
[ ! -f "node_modules/.bin/playwright" ] && { echo "  [2] Run: npm install && npx playwright install"; SETUP_NEEDED=1; }
python3 --version >/dev/null 2>&1 || python --version >/dev/null 2>&1 || { echo "  [3] Python not found (needed for /document)"; SETUP_NEEDED=1; PY_MISSING=1; }
[ ! -f ".env" ] && { echo "  [4] Copy .env.example → .env and fill in APP_URL, APP_USERNAME, APP_PASSWORD"; SETUP_NEEDED=1; }
[ ! -f ".mcp.json" ] && { echo "  [5] Run setup-mcp.sh (Mac/Linux) or setup-mcp.ps1 (Windows) to generate .mcp.json"; SETUP_NEEDED=1; }
VAULT_CHECK=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
[ -n "$VAULT_CHECK" ] && [ ! -d "$VAULT_CHECK" ] && { echo "  [6] Vault not found at '$VAULT_CHECK' — check .artemis-project"; SETUP_NEEDED=1; }

if [ "$SETUP_NEEDED" -eq 1 ]; then
  if [ "${NODE_MISSING:-0}" -eq 1 ] || [ "${PY_MISSING:-0}" -eq 1 ]; then
    if [ -n "$PREREQS_CMD" ]; then
      echo "  → To install missing tools automatically, run: $PREREQS_CMD"
    else
      echo "  → To install missing tools, run setup-prereqs.sh (Mac/Linux) or setup-prereqs.ps1 (Windows)"
      echo "     Ask the user: 'What OS are you on? (Mac / Windows / Linux)' to confirm which command to use."
    fi
  fi
  echo "
🛠  First-time setup required. Complete the steps above, then restart Claude Code.
   See SETUP.md or ONBOARDING.md for detailed instructions."
  return 0 2>/dev/null || exit 0
fi
```

If all checks pass → no output, continue to Step 0.

### Step 0 — Resolve paths

```bash
APP=$(cat .artemis-project 2>/dev/null | head -1)
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
ENV_LABEL=$(echo "$APP" | tr '[:lower:]' '[:upper:]')
```

### Step 1 — Sync check

```bash
git fetch origin 2>/dev/null
PROJECT_BEHIND=$(git rev-list HEAD..origin/$(git branch --show-current) --count 2>/dev/null || echo "0")
```
- If behind: print `📡 Sync check — [N] commits behind. Run /sync before starting.`
- If fetch fails (offline): print `⚠  Sync check skipped — unable to reach origin.`
- Never block — always continue.

### Step 2 — Hot tier (always load, ~200 tokens total)

Read these every session — they are small and always relevant:

1. `$VAULT/_app-overview.md` **lines 1–25 only** — app name, base URL, auth endpoint
2. `$VAULT/_test-data.md` **lines 1–25 only** — default test credentials and primary test records
3. `$VAULT/_invariants.md` (limit 60 lines) — behavioral ground truths; check here **FIRST** when diagnosing unexpected behavior

### Step 3 — Warm tier (query-based)

4. `$VAULT/_pipeline.md` (full file) — scan the **"Attention Required"** table + any row where `active_bugs ≠ none` or `Last Green = —`

Print a one-line session brief:
```
📋  Active env: [ENV_LABEL] | [N] features need attention — [list feature names]
    Active bugs: [bug IDs] | Next up: [highest-importance feature]
```

### Step 4 — Cold tier (load on demand only)

Load these ONLY when the session task requires them:

- Full feature vault files → only the file(s) matching the current task
- `$VAULT/_navigation-flow.md` → load before any navigation step not already known
- `$VAULT/known-bugs.md` → load only when investigating a specific bug ID
- `$VAULT/_test-data.md` lines 26+ → load only when test record details are needed

**Rule:** Do not pre-load files "just in case." Token cost of re-loading on demand is far less than the cost of loading everything upfront every session.

### Step 5 — Raw notification

```bash
RAW_PENDING=$(ls "${VAULT}/raw/"*.md 2>/dev/null | grep -v "_archive" | wc -l | tr -d ' ')
[ "$RAW_PENDING" -gt 0 ] && echo "📥  ${RAW_PENDING} unprocessed file(s) in raw/ — run /ingest to promote to vault."
```

---

## Project Structure

```
[your-project-folder]/
├── .artemis-project          ← APP name (line 1) + vault path (context_vault=)
├── CLAUDE.md                 ← this file
├── [app-name]/               ← Playwright project
│   ├── playwright.config.ts  ← uses globalSetup + storageState for auth
│   ├── tests/
│   │   ├── global-setup.ts   ← logs in once, saves playwright/.auth/user.json
│   │   └── *.spec.ts         ← no login() in beforeEach — auth via storageState
│   ├── test-cases/           ← TC library (read by /scope, /improve, /parse)
│   └── results/              ← bug reports, explorations, screenshots
└── .claude/
    ├── skills/artemis/       ← Artemis skill
    ├── agents/               ← subagents
    └── hooks/                ← automated guards enforcing the rules below (see settings.json)
```

**Hooks are active in this project** (`.claude/hooks/`, wired in `.claude/settings.json`): they
automatically remind/enforce the startup sequence, the vault-first rule, the navigation-assumption
check, the server-side-blocker stop, the GitHub Report format, browser work staying out of subagents, reading the spec before reporting bugs, no Done card with open bugs, fresh reads before status claims, and evidence-file traces (full list: `.claude/hooks/README.md`) — so don't be surprised if a
tool call is blocked or annotated with a reminder mid-session.

## Vault Location

`[path to your vault — set in .artemis-project as context_vault=]`

Structure:
- `_app-overview.md` — global app context (hot tier)
- `_test-data.md` — test data (hot tier)
- `_invariants.md` — behavioral ground truths (hot tier)
- `_pipeline.md` — pipeline tracker: TCs, explored, last green per feature (warm tier)
- `_navigation-flow.md` — canonical expected redirects after each user action (cold tier)
- `known-bugs.md` — structured bug log (cold tier)
- `_token-budget.md` — token/usage Budget Rules (cold tier; read before proposing a new rule)
- `_usage-log.md` — per-session usage log, appended after every browser-touching command (cold tier)
- `cross-module/` — features used by 2+ modules
- `modules/[module]/` — module-owned features + forms/ subfolder
- `raw/` — free-form session dump zone (run `/ingest` to promote)
- `templates/` — module, feature, sub-feature, cross-module doc templates

## Auth Pattern

Tests use `storageState` — login runs once via `global-setup.ts`, saves session to
`playwright/.auth/user.json`. Spec `beforeEach` goes directly to the feature URL.
Never add `login()` to `beforeEach` in spec files.

## Key Commands

| Command | What it does |
|---------|-------------|
| `/setup` | Re-run the setup wizard (reconfigure or fix partial setup) |
| `/sync` | Pull updates from GitHub for project + vault |
| `/ingest [file?]` | Promote raw/ content → vault (bugs, feature docs, TCs, selectors) |
| `/context [feature]` | Read vault → detect TC gaps → generate TCs + specs (no browser) |
| `/explore [url]` | Browser discovery — harvest live selectors, confirm // TODO entries |
| `/verify [feature]` | Run spec → auto-fix selector failures → record Last Green in pipeline |
| `/run [TC-ID] [url]` | Execute specific TCs via Playwright CLI |
| `/bug [description]` | Deep failure analysis via subagent |
| `/improve [test-file]` | Review + score test suite via subagent |
| `/document [feature]` | Generate BA/SA developer reference doc (.md + .docx) via subagent |
| `/audit` | 4-pass project health check via subagent |
| `/compliance [title?]` | Audit completed tickets against `/ticket`'s mandatory outputs (read-only subagent) |
| `/kanban-cleanup` | Archive stale ticket files and old Done cards from `_queue.md` |

## Feature Coverage Lifecycle

Every new feature follows this 3-step sequence before it is considered covered:

| Step | Command | What it produces | Pipeline update |
|------|---------|-----------------|-----------------|
| 1 | `/context [feature]` | TC file + Playwright spec (zero browser) | TCs count, Spec ✓, Last Updated |
| 2 | `/explore [url]` | Confirmed selectors, updated catalog | Explored date, Selectors status |
| 3 | `/verify [feature]` | Green run date, auto-fixed spec | Last Green |

**Rule:** Do not run `/verify` on a spec that has `// TODO: verify selector` comments without
first running `/explore`. Those selectors will fail and `/verify` will burn iterations on
issues that explore would have pre-empted.

**Shortcut:** If a spec has zero `// TODO` comments (all selectors already confirmed), skip
Step 2 and go straight to `/verify`.

## Navigation Assumption Rule — MANDATORY

Before taking any navigation step (button click, form submit, modal confirm, etc.):

1. **Check `$VAULT/_navigation-flow.md`** — if the flow is documented, proceed with confidence
2. If the action is **not listed**, state the assumption to the user before acting:
   > "I'm about to [action]. I expect this will land on [URL/state]. Is that correct?"
3. Wait for confirmation. If correct → proceed, then **add the confirmed flow to `_navigation-flow.md`**. If wrong → user provides the real behavior, update the doc, then proceed correctly.

**Never silently assume** a redirect based on "logical" flow — state it explicitly and get confirmation.

## Stop-and-Ask Rule — MANDATORY

If, after checking the vault AND completing one investigation attempt (exploration, script, or browser check), the root cause is still unclear:

1. **Log a preliminary bug entry** in `vault/known-bugs.md` with status `Unconfirmed`:
   - Title: describe the symptom observed
   - Module: affected module
   - Status: `Unconfirmed — needs user input`
2. **Stop immediately** — do NOT make additional attempts, write more scripts, or assume
3. Ask the user: state what was found, what was tried, and what is unclear

A second loop without user input is always a waste of tokens.
This applies to all commands and all phases of work.

## Server-Side Blocker Rule — MANDATORY

If any test run, investigation script, or browser interaction produces a server-side error — HTTP 5xx, DB constraint violation (`SQLSTATE`, `doesn't have a default value`, `Incorrect integer value`), or a system administrator message in the UI — **stop immediately**:

1. **Do NOT loop, retry, or attempt workarounds** — these are backend bugs, not spec issues
2. Report the blocker to the user with: feature name, affected TCs, exact error, endpoint
3. Log the bug in `vault/known-bugs.md`
4. Update `_pipeline.md`: mark the feature row `⚠ blocked — server bug [date]`
5. Move on to the next feature in the pipeline

## Usage & Token Logging Rule — MANDATORY

Claude's usage allowance can change between billing cycles, and this pipeline depends on browser
automation (Playwright MCP), so usage needs to be monitored over time rather than assumed.

**When:** at the end of any command that opens Playwright MCP — `/explore`, `/verify`, `/ticket`,
`/run`, `/bug` (when it opens the browser to investigate).

**Action:** append a row to `$VAULT/_usage-log.md` with: date, command, feature/module, a rough
tool-call tally (`browser_snapshot` / `browser_take_screenshot` / navigation counts), and which
`$VAULT/_token-budget.md` Budget Rules were followed or skipped.

**Dashboard usage %:** attach it to the entry only if the user volunteers it during or after the
session. Never solicit it proactively.

**Hard constraint:** this logging is observational only. It must never cause a testing step to be
skipped, shortened, or sampled instead of covered — the Stop-and-Ask, Server-Side Blocker, and
Navigation Assumption rules above all still apply in full. If a pattern in the log suggests a new
Budget Rule, propose it to the user before adopting it — do not self-apply a rule that trades
testing coverage for token savings.

Prefer a targeted `browser_find` / narrow `browser_evaluate` over a full `browser_snapshot` for
routine post-action verification (e.g. confirming a field pre-populated correctly). This does
**not** apply to diagnosing an unexpected or failed result — a full snapshot is still required
before writing any fix.

**Context management for auto-continue queue runs:** `/ticket`'s Auto-Continue Rule (see
`skill/commands/ticket.md`) can drain the whole Pending column in one unbroken session with no
natural pause between cards. There is no mechanism to force a context compaction after each
individual ticket — compaction is either automatic (size-based) or manually run via `/compact`.
This project's `.claude/settings.json` sets a tightened `autoCompactWindow` (150000, vs. the
platform default) so automatic compaction triggers more proactively during a long auto-continue
run instead of waiting near the full context limit. This is a size-based approximation, not a
true per-ticket trigger — a single ticket's own MCP work can still push a compaction mid-ticket.
If that starts causing rework (lost detail mid-investigation), raise the value back up.

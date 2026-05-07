# Part 1: QA Orchestrator

The Orchestrator is the first mode Artemis enters when the `/artemis` command is invoked.
Its job is to understand the request, route work to the three parallel agent paths, and
coordinate the convergence into a final report.

---

## Step 0: App Onboarding (First Run Only)

Before doing anything else, check if a project folder already exists for this app.

**How to detect a first run:**
- No folder named after the app exists in the current working directory
- No `.env` file is present
- No `app-guide.md` is present

### Step 0 — Pre-check: Playwright MCP Availability

**Before asking any onboarding questions**, verify that Playwright MCP is available by
attempting a lightweight call to `browser_navigate` or checking if the tool is listed.

**If Playwright MCP is NOT available:**

```
──────────────────────────────────────────────
Artemis — Playwright MCP Required
──────────────────────────────────────────────
Playwright MCP is not set up in this session.
Artemis requires Playwright MCP to run browser
automation for every app it tests.

To set it up:
1. Add the Playwright MCP server to your Claude
   Code settings (claude_desktop_config.json or
   .mcp.json):

   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["@playwright/mcp@latest"]
       }
     }
   }

2. Restart Claude Code to load the MCP server.
3. Re-run your Artemis command once it's active.

──────────────────────────────────────────────
⛔ Cannot proceed without Playwright MCP.
```

**Stop here.** Do not continue with onboarding or testing until the user confirms
Playwright MCP is set up and available.

**If Playwright MCP IS available:** Confirm with a single line:
```
✓ Playwright MCP detected — proceeding with setup.
```
Then continue with the onboarding questions below.

### Step 0b — Database + Live Dashboard Pre-flight

Run these checks **automatically before every test run**. The user should never need to ask.

#### 0b-1: Ensure artemis.db exists and is populated

```bash
# Check if DB file exists
APP=$(cat .artemis-project 2>/dev/null); ls ${APP}/artemis.db 2>/dev/null || echo "MISSING"
```

**If the DB is missing or empty:**
```bash
APP=$(cat .artemis-project 2>/dev/null)
cd ${APP}
npm install                        # ensure better-sqlite3 is installed
node scripts/setup-db.js           # create all tables
node scripts/migrate-tcs.js        # load all test cases from test-cases/
node scripts/migrate-history.js    # load historical runs, bugs, observations, learnings
```

Confirm with:
```
✓ artemis.db created — [N] test cases, [N] historical runs loaded
```

**DB is the primary data store. The file-based fallback (parsing .md files) is a
last-resort safety net — only used if the DB file is inaccessible or corrupted.
Never skip DB setup and rely on the fallback.**

#### 0b-2: Ensure the live dashboard server is running on port 7373

```bash
# Check if server is up; start it if not
curl -s http://localhost:7373/api/db/stats > /dev/null 2>&1 || \
  (APP=$(cat .artemis-project 2>/dev/null) && cd ${APP} && node server.js &)
```

If the server was not running, confirm with:
```
✓ Live dashboard started — http://localhost:7373
```

**Rule:** A test run MUST NOT begin until both the DB exists and `http://localhost:7373`
responds. All results, bugs, and run data must be recorded in the DB and visible in
the dashboard in real time.

---

If it's a first run, collect the following before proceeding:

```
──────────────────────────────────────────────
Artemis — New App Setup
──────────────────────────────────────────────
Let's set up your project before we start testing.

1. App name (used for folder name):
   e.g. "HIS Alpha", "Clinic Portal", "Admin Dashboard"

2. App URL:
   e.g. https://his-alpha-dev.q13.dev

3. Login credentials:
   Username:
   Password:

4. Any other credentials needed?
   (API keys, test user roles, etc.)
──────────────────────────────────────────────
```

Wait for the user to provide all four before continuing. Do not proceed with any testing until onboarding is complete.

---

## Step 0b: Project Scaffold

After collecting onboarding info, create the project folder structure.

**Folder naming rule:** Convert the app name to kebab-case.
- "HIS Alpha" → `his-alpha/`
- "Clinic Portal" → `clinic-portal/`
- "Admin Dashboard v2" → `admin-dashboard-v2/`

### Folder Structure to Create

```
[app-name]/
├── .env                          ← credentials (never read aloud or logged)
├── app-guide.md                  ← app guidelines, test data, known behaviors
├── artemis.db                    ← SQLite database (test cases, results, bugs)
├── package.json                  ← better-sqlite3 dependency
├── test-cases/                   ← living TC library (source of truth for editing)
├── tests/                        ← generated .spec.ts files
├── load-tests/                   ← k6 scripts
├── results/
│   ├── bugs/                     ← markdown bug files (backwards compat + dashboard)
│   ├── screenshots/              ← failure screenshots
│   └── live-status.json          ← SSE stream for dashboard
└── scripts/
    ├── build-dashboard.js        ← dashboard generator (auto-scaffolded)
    ├── db.js                     ← shared DB helper
    ├── setup-db.js               ← schema creation
    ├── migrate-tcs.js            ← TC import from .md files
    ├── query-tcs.js              ← TC query CLI (Claude uses this)
    ├── write-result.js           ← result writer CLI (Claude uses this)
    └── write-bug.js              ← bug writer CLI (Claude uses this)
```

> **Data rules:**
> - `artemis.db` is the primary store for ALL test results, bugs, and test cases
> - `results/bugs/*.md` files are written by `write-bug.js` automatically for dashboard compatibility
> - Never write bugs to a root-level `bugs/` folder
> - `results/live-status.json` is written by `write-result.js` automatically after every TC

### Create the `.env` file

```
# [App Name] — Artemis credentials
# Created: YYYY-MM-DD
# WARNING: Do not commit this file

APP_URL=https://[url]
LOGIN_USERNAME=[username]
LOGIN_PASSWORD=[password]
```

Add any additional credentials below the defaults using the same `KEY=VALUE` format.

**Security rules:**
- Never print `.env` contents in the chat
- Never include credentials in any report, bug report, or `.spec.ts` file
- Reference credentials as `process.env.LOGIN_USERNAME` in k6 and spec files
- If user asks Artemis to display credentials, decline and say they are stored in `.env`

### Auto-Generate `app-guide.md` from Quick Scan

After writing `.env`, perform a 3-step Playwright scan to pre-populate `app-guide.md`.
This replaces the manual template-fill step with auto-discovered data.

**Step 1 — Open app and detect type**
- Navigate to the app URL
- Capture the page `<title>` and any visible `<h1>` → use as `App Name` in the guide
- Detect tech signals from page source (Angular, React, Vue, plain HTML) → populate `App Type`
- Capture login form field labels and button text → seed the `App-Specific Selector Patterns` section

**Step 2 — Login and discover navigation**
- Log in using the credentials just collected
- Read all nav menu items (sidebar links, top nav, hamburger menu, tab bars)
- List every discovered module → pre-populate `Modules and Features in Scope` table
  (mark all ✅ by default; user can change to ❌ or ⚠️)
- For each module, note the URL path it navigates to

**Step 3 — Write `app-guide.md` and close browser**
- Copy `examples/app-guide-template.md` as the base structure
- Replace auto-discoverable fields: App Name, URL, App Type, Modules table, Selector Patterns
- Leave these sections as explicit `[TODO]` placeholders — they cannot be discovered automatically:
  - Test Data (requires real/synthetic records)
  - Known Behaviors (requires domain knowledge)
  - Known Bugs (empty on first run)
  - Contacts
- Mark auto-generated sections with a trailing comment: `# ↑ auto-generated — verify and update`

Tell the user:
```
✓ app-guide.md generated from quick scan
  Modules discovered: [N] ([module-1], [module-2], ...)
  Selectors seeded from login page

TODO — open app-guide.md and fill in:
  • Test Data — real or synthetic records safe to use during testing
  • Known Behaviors — intentional quirks Artemis should not flag as bugs
```

**Fallback — if Playwright scan fails or login is blocked:**
- Write the generic template as-is (pre-fill only app name and URL)
- Tell the user: "Quick scan failed — app-guide.md created from template. Fill in the [TODO] sections before the first run."
- Do NOT block the session — user can fill it in incrementally

### Verify the three dashboard files exist

The project uses three HTML interfaces served by `[app-name]/server.js`.
**Do not regenerate or replace these files** — they are maintained separately.

| File | Purpose |
|------|---------|
| `artemis-live.html` | Live dashboard — real-time TC results, bugs, timeline (primary) |
| `artemis-tc-list.html` | TC browser — browse and filter all test cases from the DB |
| `artemis-orchestrator.html` | Orchestrator UI — run controls and session management |

> ⚠️ `artemis-monitor.html` is **deprecated** — do not reference or open it.
> The static `build-dashboard.js` script is also deprecated and should not be run.

After creating all project files, tell the user:
```
Project folder created: [app-name]/

Files scaffolded:
  ✓ .env                (fill in credentials)
  ✓ app-guide.md        (fill in test data + known behaviors)

Dashboards (served by [app-name] on port 7373):
  ✓ artemis-live.html       — live run results & bugs
  ✓ artemis-tc-list.html    — browse all test cases
  ✓ artemis-orchestrator.html — run controls

Next step: Open app-guide.md and fill in your app-specific test data,
known behaviors, and any guidelines for this app. Artemis will read
this file at the start of every run.

Ready to start testing? (y — or fill app-guide.md first)
```

---

## Step 0c: Existing Project — Load App Guide

If the project folder already exists:

1. Read `references/skill-learnings.md` — load all active universal behavioral rules and
   infrastructure fixes. These apply to every project and override any generic defaults.
   Confirm with: `✓ skill-learnings loaded — N rules active` (count the rule entries).
2. Read `[app-name]/app-guide.md`
3. Load test data, credentials reference, known behaviors, and any guidelines
4. Use this context throughout the entire run — app-guide overrides generic defaults;
   skill-learnings override everything

**If `app-guide.md` is missing or empty:** Proceed with defaults and note at the end of the report that app-guide.md was not found — recommend filling it in.

---

## Step 1: Parse the Request

Extract these values from the user's input:

| Parameter | How to Detect | Default |
|-----------|--------------|---------|
| **Target URL** | Explicit URL in message | Ask: "What URL should I test?" |
| **Scope** | "all", module name, feature, TC range, single TC | Ask if ambiguous |
| **Test Cases** | File path, pasted text, DOCX reference | Ask: "Please provide test cases or I can generate them" |
| **Skip flags** | "skip load testing", "functional only", "explore only" | Run all three paths |

---

## Step 2: Scope Detection

Read the test case file (e.g. `test-cases/my-app-test-cases.md`) and match the user's
request to the scope table:

| Scope Level | User Says | What Runs |
|-------------|-----------|-----------|
| **End-to-End** | "run all tests", "full E2E", "run everything" | All TCs across all modules |
| **Module** | "test the Authentication module", "run Medical History" | All TCs in that module |
| **Feature** | "test the Allergies feature", "run Patient Worklist" | All TCs in that feature |
| **Range** | "run TC 1-10", "test cases 44 through 47" | Specific numbered range |
| **Single** | "run TC-014", "test case 14" | One specific TC |
| **Custom** | "test login and patient registration" | TCs from multiple features |
| **Quick Action** | "just create X", "quickly test X", "focus on [single action]", "only [verb] [noun]", "I just want to [action]" | 1 TC — the single best-matching TC for the described action |

### Quick Action Scope — Detection Rules

⚠️ **PRIORITY RULE: Quick Action is evaluated FIRST, before all other scope types.**
If the user's message matches Quick Action triggers, do NOT fall through to module/feature/submodule detection.

Trigger when the user's message contains ANY of:
- **"quickly"** + any verb/noun — **HIGHEST PRIORITY TRIGGER, evaluated before all else**
  - "quickly test X", "quickly check X", "quickly verify X" → always Quick Action, never a full scope
- "just" + action verb ("just create", "just add", "just search")
- "focus on [action]" where the action is a specific operation, NOT a feature or module name
- "only [action]" implying a single step ("only create an appointment")
- "I just want [action]" / "all I need is [action]"

**Key distinction:** "focus on the appointment feature" = Feature scope (run all appointment TCs). "focus on creating an appointment" = Quick Action scope (run 1 TC for the create action).

**Tie-breaking rule:** When ambiguous between Quick Action and a broader scope, prefer Quick Action if the user used an action verb ("test", "check", "search", "verify") rather than a feature noun ("module", "feature", "all TCs"). Err toward fewer TCs.

When Quick Action scope is detected:
1. Extract the action phrase (e.g., "create an appointment", "search for a patient")
2. Search the test case library for TCs whose title semantically matches the action
3. From candidates, prefer: (a) Type = Happy Path, (b) title contains the exact verb+noun
4. If exactly 1 match: proceed automatically
5. If 2–3 matches: show them and ask which one to run
6. If 0 matches: offer to generate a quick focused test on-the-fly for that action

**Auto-skip for Quick Action scope:**
- ✗ Skip Exploratory QA (Path 2)
- ✗ Skip Load Test Planner (Path 3)
- ✓ Run ONLY Playwright Runner (Path 1) on the single matched TC

### TC Loading — DB-First Rule

When loading test cases to resolve scope, check for `artemis.db` first:

```bash
# Does the DB exist?
APP=$(cat .artemis-project 2>/dev/null); ls ${APP}/artemis.db
```

**If DB exists (primary path — use always):**

Query test cases via the CLI tool instead of reading .md files. This uses ~15× fewer tokens.

| Scope | Command |
|-------|---------|
| **Quick Action** | `node [app-name]/scripts/query-tcs.js --scope=quick_action --action="<phrase>" --limit=1` |
| **Single TC** | `node [app-name]/scripts/query-tcs.js --tc-id=TC-MOD-001` |
| **Feature** | `node [app-name]/scripts/query-tcs.js --module=orders --submodule=create-order` |
| **Module** | `node [app-name]/scripts/query-tcs.js --module=orders` |
| **Happy Path only** | Add `--type=happy_path` to any command above |
| **Range** | `node [app-name]/scripts/query-tcs.js --module=orders --range=018-025` |
| **Count only** | Add `--count` to any command above |

The tool returns compact JSON — only the fields Claude needs (id, title, steps, expected_result, type, priority). No file parsing, no token bloat.

**After receiving query results, label in context:**
```
[FILTERED_TCS: scope=<scope>, source=db, count=<N>]
```
The Playwright Runner will use this label directly — do NOT re-query or re-read files.

**If DB does not exist (fallback — file-based):**

Follow the TC Loading Protocol (`part-11-optimization-protocol.md` §11):
1. Read `test-cases/INDEX.md` first — confirm the module folder
2. Read `test-cases/<module>/INDEX.md` — identify the exact submodule file
3. Read **only** that file with scope-narrowed `offset`+`limit`

> **Note:** If the DB is missing, prompt the user once:
> ```
> ⚠ artemis.db not found. Run this once to enable DB mode (15× faster TC loading):
>   APP=$(cat .artemis-project 2>/dev/null) && cd ${APP} && npm install && npm run db:setup
> Proceeding with file-based loading for now.
> ```

If scope is ambiguous, show the available modules and ask:

```
Available modules:
  1. Login (Authentication, Access Control) — N TCs
  2. Dashboard (Overview, Widgets, Navigation) — N TCs
  3. Orders (Create Order, Order History, Order Search) — N TCs
  4. Settings (User Profile, Preferences, Roles) — N TCs

Which module(s) or feature(s) would you like to test?
```

---

## Step 3: Pre-Run Confirmation

Always show the user what will run before starting:

```
─────────────────────────────────────────
Artemis QA Run — Pre-flight Check
─────────────────────────────────────────
URL:     https://his-alpha-dev.q13.dev
Scope:   Module — Medical History
TCs:     TC-044 to TC-072 (28 test cases)
Paths:   ✓ Playwright Runner
         ✓ Exploratory QA
         ✓ Load Test Planner
─────────────────────────────────────────
Proceed? (y/n)
```

For **Quick Action** scope, use this condensed format instead:

```
─────────────────────────────────────────
Artemis — Quick Action Run
─────────────────────────────────────────
URL:     https://his-alpha-dev.q13.dev
Action:  Create an appointment
TC:      TC-XXX — [TC title]
Paths:   ✓ Playwright Runner only
─────────────────────────────────────────
Proceed? (y/n)
```

**Skip a path when:**
- No test cases provided and user says "explore only" → skip Playwright Runner path
- User says "no load testing" or "functional only" → skip Load Test path
- URL has no network traffic to inspect → note Load Test path will be lightweight

---

## Step 4: Execute the Three Paths

Run the three agent paths sequentially, but treat them as logically parallel — each
produces an independent result set. Complete each path fully before the next.

### Path 1: Test Case Parser → Playwright Runner

1. **Enter Parser Mode.** Read `references/part-2-test-case-parser.md`.
   - If DOCX provided: convert → normalize → save to `test-cases/`
   - If text/markdown provided: normalize → assign TC IDs
   - If test-cases/ file already exists: read and filter to scope
2. **Enter Executor Mode.** Read `references/part-3-playwright-runner.md`.
   - Execute all TCs in scope
   - Collect: PASS list, FAIL list (with evidence), BLOCKED list
3. **Enter Executor Mode post-run.** Generate `.spec.ts` file from execution history.

### Path 2: Exploratory QA → UI Discovery

1. **Enter Explorer Mode.** Read `references/part-4-exploratory-qa.md`.
   - Build sitemap of the target URL
   - Compare pages against tested coverage
   - Probe untested pages and interactions
   - Note all discovered bugs
2. Collect: new bug candidates, untested pages list, suggested new TCs

### Path 3: Load Test Planner → Load Test Generator

1. **Enter Performer Mode.** Read `references/part-5-load-test-agent.md`.
   - Identify critical endpoints via network inspection during Path 1 execution
   - Generate k6 scripts for approved scenarios
2. Collect: endpoint list, k6 scripts, performance metrics baseline

---

## Step 5: Merge Protocol (Bug Analyzer)

Collect all findings from the three paths and enter **Analyst Mode**.
Read `references/part-6-bug-analyzer.md`.

Aggregate:
- FAIL list from Playwright Runner → analyze root cause for each
- Bug candidates from Exploratory QA → classify severity
- Performance observations from functional run → note as findings

For each FAIL and each discovered bug:
1. Identify root cause layer (UI / API / data / state / timing)
2. Assign severity (Critical / High / Medium / Low)
3. Enrich with Jam.dev data if a Jam URL is available
4. Write bug report entry

---

## Step 6: Test Improvement Review

Enter **Improver Mode**. Read `references/part-7-test-improvement.md`.

After the run, quickly assess:
- Which TCs produced FAIL for likely selector fragility (not a real bug)?
- Are there obvious coverage gaps revealed by exploratory findings?
- Did any new discovered test cases duplicate existing ones?

Note improvement recommendations — do NOT apply them automatically. Summarize in the
report's "Recommendations" section and offer: "Run `/improve` to apply these changes."

---

## Step 7: Generate QA + Performance Report

Use `examples/qa-results-report-template.md` as the structure.

Save to: `[app-name]/results/qa-results-[YYYY-MM-DD].md`

The report includes:
- Run metadata (URL, date, scope, agent version)
- Executive summary (2-3 sentences on overall health, highest-severity finding)
- Results overview table (PASS / FAIL / BLOCKED / SKIP counts)
- Detailed FAIL entries (one block per failure)
- Exploratory discoveries section
- Performance section (from Load Test path)
- Coverage summary
- Recommendations (Critical → High → Observations → Next Steps)
- Generated artifacts list (`.spec.ts` files, k6 scripts)

### Step 7b: Sync TC List to DB

**After every run that writes or updates test cases**, re-run the TC migration so the
DB (and therefore `artemis-tc-list.html`) reflects the latest changes:

```bash
APP=$(cat .artemis-project 2>/dev/null) && cd ${APP} && node scripts/migrate-tcs.js
```

**Run after:**
- `/parse` — new TCs written to `test-cases/`
- `/explore` — new TCs added from discoveries
- `/improve` — TCs updated or restructured
- Any manual TC expansion session

Tell the user the TC list has been updated:
```
✓ TC list synced to DB
  TCs: [N] total | open artemis-tc-list.html to browse
```

> ⚠️ Do NOT run `build-dashboard.js` or reference `artemis-monitor.html` — both are deprecated.

---

## Orchestrator Anti-Patterns

- **Do not skip the Playwright MCP check.** Always verify it is available before onboarding.
- **Do not start testing without Playwright MCP.** If it is missing, stop and instruct setup.
- **Do not skip the pre-run confirmation.** Always show what will run.
- **Do not mix agent modes.** Finish Executor mode before entering Explorer mode.
- **Do not generate the report before all three paths complete.**
- **Do not auto-apply improvements.** Present them, get approval, then apply.
- **Do not assume scope.** If it's ambiguous, ask.

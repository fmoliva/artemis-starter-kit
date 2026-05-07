# Core Orchestrator — Pipeline, Onboarding, Scope Detection

---

## 1-Gate Onboarding (First Run Only)

### Detection

```bash
cat .artemis-project 2>/dev/null || echo "MISSING"
```

- **Found** → read app name, run S1–S3, proceed with command
- **MISSING** → run onboarding below

### The Single Gate

Print this, wait for answers, then scaffold silently:

```
──────────────────────────────────────
  Artemis — New App Setup
──────────────────────────────────────
  1. App name     (e.g. "My Shop")
  2. App URL      (e.g. http://localhost:4200)
──────────────────────────────────────
Reply with your answers.
```

Parse into: `APP_NAME` (kebab-case), `APP_URL`.

**Credentials:** Do NOT ask for credentials in the gate. After scaffold, print:

```
──────────────────────────────────────
  One more step: add your credentials
──────────────────────────────────────
  Open [APP_NAME]/.env and fill in:

    APP_USERNAME=your_username
    APP_PASSWORD=your_password

  Then reply "ready" (or tell me you've added them).
──────────────────────────────────────
```

Wait for user confirmation before proceeding to the Quick Scan.

### Silent Scaffold

After user replies, run everything without narration:

```bash
APP_NAME="[kebab-case-name]"

# Create project structure
mkdir -p "${APP_NAME}"/{test-cases,tests,results/{bugs,screenshots,observations,explorations,modules},scripts}

# Write .artemis-project
echo "$APP_NAME" > .artemis-project

# Copy result scripts from skill templates
cp ~/.claude/skills/artemis/templates/scripts/write-result.js "${APP_NAME}/scripts/"
cp ~/.claude/skills/artemis/templates/scripts/write-bug.js "${APP_NAME}/scripts/"
cp ~/.claude/skills/artemis/templates/scripts/query-tcs.js "${APP_NAME}/scripts/"
cp ~/.claude/skills/artemis/templates/scripts/setup-db.js "${APP_NAME}/scripts/"
cp ~/.claude/skills/artemis/templates/scripts/migrate-tcs.js "${APP_NAME}/scripts/"
cp ~/.claude/skills/artemis/templates/scripts/db.js "${APP_NAME}/scripts/"
cp ~/.claude/skills/artemis/templates/scripts/split-data.js "${APP_NAME}/scripts/"

# Write .env (credentials left blank — user fills them in)
cat > "${APP_NAME}/.env" << EOF
APP_URL=${APP_URL}
APP_USERNAME=
APP_PASSWORD=
EOF

# Write playwright.config.ts
cat > "${APP_NAME}/playwright.config.ts" << EOF
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: '${APP_URL}', browserName: 'chromium', viewport: { width: 1920, height: 1080 } },
});
EOF

# Quick Playwright scan: login page → discover nav → seed app-guide.md
```

### Auto-Generate app-guide.md (Quick Scan)

1. Navigate to APP_URL with Playwright MCP
2. Capture `<title>`, `<h1>`, login form labels → seed App Overview + Selector Patterns
3. Login with provided credentials
4. Read all nav menu items → pre-populate Modules table (all marked ✅)
5. Write `app-guide.md` from template with discovered data
6. Mark undiscoverable sections as `[TODO]`
7. Close browser

Print **one line** when done:
```
✓ Project ready — [APP_NAME]/ created, [N] modules discovered. Fill in app-guide.md TODOs when convenient.
```

### Setup DB + TC Migration

After scaffold and initial explore (if TCs are generated):
```bash
cd "${APP_NAME}"
node scripts/setup-db.js
node scripts/migrate-tcs.js
```

---

## Spec-File Detection (Run Before Scope Detection)

Before deciding how to run, check whether `.spec.ts` files already exist for the requested scope:

```bash
APP=$(cat .artemis-project 2>/dev/null)
ls "${APP}/tests/"*.spec.ts 2>/dev/null | head -20
```

| Result | Action |
|--------|--------|
| Spec file(s) found for scope | Route to CLI path — `npx playwright test` (see `/rerun`) |
| No spec files | Continue to MCP path below |

**Why this matters:** CLI execution costs ~500 tokens for a 50-TC run. MCP costs ~15,000 tokens for the same run. When specs exist, there is no reason to open Playwright MCP.

---

## Scope Detection

Read the user's request and match:

| Scope | User Says | What Runs |
|-------|-----------|-----------|
| **End-to-End** | "run all tests", "full E2E" | All TCs across all modules |
| **Module** | "test Authentication", "run Pharmacy" | All TCs in that module |
| **Feature** | "test [Feature]", "run [Module] Worklist" | All TCs in that feature |
| **Range** | "TC-1 to TC-10", "test cases 44-47" | Specific numbered range |
| **Single** | "run TC-014" | One TC |
| **Quick Action** | "quickly test X", "just create X" | 1 TC — best match for described action |

### Quick Action Detection (Priority — evaluate first)

Trigger on: "quickly" + verb, "just" + action verb, "only [action]", "focus on [action verb]".

**Key distinction:** "focus on the appointment feature" = Feature scope. "focus on creating an appointment" = Quick Action (1 TC).

When Quick Action detected:
1. Query DB for best match: `node [app]/scripts/query-tcs.js --scope=quick_action --action="<phrase>" --limit=1`
2. Show Gate 1, execute 1 TC, 3-line summary, done.
3. Skip exploratory/load paths entirely.

### TC Loading — DB-First Rule

```bash
APP=$(cat .artemis-project 2>/dev/null)
ls "${APP}/artemis.db" && echo "USE DB" || echo "USE FILES"
```

**DB exists (primary):** Query via `scripts/query-tcs.js`:

| Scope | Command |
|-------|---------|
| Quick Action | `--scope=quick_action --action="<phrase>" --limit=1` |
| Single TC | `--tc-id=<ID>` |
| Feature | `--module=<mod> --submodule=<sub>` |
| Module | `--module=<mod>` |
| Range | `--module=<mod> --range=018-025` |
| Count only | Add `--count` |

After loading, label: `[FILTERED_TCS: scope=<scope>, source=db, count=<N>]`
**The Runner uses this label directly — never re-queries.**

**DB missing (fallback):** Read `test-cases/INDEX.md` → module INDEX → submodule file (one at a time).

---

## Pre-Run Confirmation (Gate 1)

Always show before starting:

```
─────────────────────────────────────────
Artemis QA — Pre-flight
─────────────────────────────────────────
URL:     [url]
Scope:   [scope description]
TCs:     [count] test cases
─────────────────────────────────────────
Proceed? (y/n)
```

For Quick Action:
```
🎯 Artemis — Quick Action
  URL:   [url]
  TC:    [TC-ID] — [title]
Proceed? (y/n)
```

---

## ⛔ GATE 2 — Explore→Execute Handoff (Hard Block)

**This gate must be cleared before any TC execution begins.**
It applies any time an explore phase preceded the current run (or snapshots are in context).

### Check all 3 conditions before calling `browser_navigate` for TC execution:

```bash
APP=$(cat .artemis-project 2>/dev/null)

# Condition 1: browser closed (no orphaned MCP session)
# Call browser_close() now if any explore happened this session

# Condition 2: module JSON files exist
ls "${APP}/results/modules/"*.json 2>/dev/null | wc -l
# Must be ≥ 1

# Condition 3: compact explore summary written
ls "${APP}/results/explorations/explore-summary-"*.md 2>/dev/null | tail -1
# Must exist and be today's date
```

### If any condition fails — fix it first:

| Missing | Fix |
|---------|-----|
| Browser not closed | Call `browser_close()` now |
| No module JSONs | `node ${APP}/scripts/split-data.js` |
| No explore summary | Write it now — module list + form labels + workflow sequences only |

**Why this is a hard block, not a reminder:**
`browser_snapshot` YAML (5–78KB per call) stays in context after every MCP call.
Without this gate, 50–400KB of snapshot content rides along with every execution message,
consuming 40–60% of the session budget before a single TC runs.
Enforcing the gate at the orchestrator level (not just in skill-learnings) ensures
the savings are always realized.

---

## Full Pipeline (`/artemis`)

Sequential execution, logically parallel paths:

### Path 1: Test Case Parser → Playwright Runner
1. If test cases exist: load and filter to scope
2. If DOCX/text provided: parse → normalize → save to `test-cases/`
3. Execute TCs → collect PASS/FAIL/BLOCKED
4. Generate `.spec.ts` from execution history

### Path 2: Exploratory QA
1. Build sitemap
2. Compare against tested coverage
3. Probe untested pages
4. Output: new bugs, untested pages, suggested TCs (pending user approval)

### Path 3: Load Test Planner
1. Identify critical endpoints from Path 1 network traffic
2. Generate k6 scripts
3. ⚠ Stress/spike/endurance: confirm staging environment first

### Merge: Bug Analyzer
Aggregate findings → classify severity → write bug reports → improvement recommendations

### Report
Save to `[app]/results/qa-results-[date].md`

---

## Orchestrator Rules

- Never start testing without Playwright MCP available
- Never skip Gate 1 pre-run confirmation
- Never mix agent modes — finish one phase before starting the next
- Never generate report before all paths complete
- Never auto-apply test improvements — present and wait for approval
- If scope is ambiguous, ask

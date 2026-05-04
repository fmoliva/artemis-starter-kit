# Part 3: Playwright Runner Agent

The Playwright Runner executes test cases from the `test-cases/` directory against a
target URL. It enters **Executor Mode**: trust nothing, assert only what is observed,
screenshot only on FAIL.

---

## HIS App Test Data

When testing `his-alpha-dev.q13.dev` or any HIS application URL, always use:

| Field | Value |
|-------|-------|
| **Last Name** | Silva |
| **First Name** | Filipino name (Maria, Juan, Jose, Ana, Carlos, Rosa, etc.) |
| **Country** | Philippines |
| **Address** | Philippine addresses (province, city, barangay) |
| **Phone** | Philippine phone number format |

Use "Silva" as the default last name for ALL test scenarios — patient search,
registration, profile lookups, break-the-glass, and any other patient name field.

---

## Scope Filtering

### If invoked by the full `/artemis` pipeline (Orchestrator ran first):
- Check working context for a `[FILTERED_TCS: ...]` label written by the Orchestrator
- If the label exists: **use that TC list directly — do NOT read any TC file from disk**
- The Orchestrator already loaded and filtered the TCs; re-reading wastes tokens
- Announce: `Using pre-loaded TC list from Orchestrator (N TCs)`

### If invoked standalone (`/run` command only):
Follow the TC Loading Protocol (`part-11-optimization-protocol.md` §11).

⛔ **NEVER write to `results/live-status.json` directly.** Always use `write-result.js`
for TC results (PASS/FAIL/BLOCKED/SKIP) and `write-bug.js` for failures. These scripts
update both `artemis.db` AND `live-status.json` atomically. Direct writes bypass the DB
and break the live dashboard.

**STEP 0 — DB-First Check (MANDATORY before reading any .md file):**
```bash
ls [app-name]/artemis.db
```
If `artemis.db` exists → **query it using `query-tcs.js`**. Do NOT read `.md` files.
Only fall back to `.md` files if the DB is missing.

| Scope | DB query |
|-------|---------|
| **Quick Action** | `node [app-name]/scripts/query-tcs.js --scope=quick_action --action="<phrase>" --limit=1` |
| **Single TC** | `node [app-name]/scripts/query-tcs.js --tc-id=<TC-ID>` |
| **Feature/Submodule** | `node [app-name]/scripts/query-tcs.js --module=<mod> --submodule=<sub>` |
| **Module** | `node [app-name]/scripts/query-tcs.js --module=<mod>` |
| **Range** | `node [app-name]/scripts/query-tcs.js --module=<mod> --range=018-025` |

After loading, label in context:
```
[FILTERED_TCS: scope=<scope>, source=db, count=<N>]
```

Show the user what will run and wait for confirmation before executing.

---

## Quick Action Mode

When scope is **Quick Action**, run exactly 1 TC. Do not loop through a test suite.

After execution:
- Report PASS/FAIL inline with a brief 3-line summary (TC ID, status, observed result)
- Skip the full QA results report — do NOT generate `qa-results-*.md`
- Skip `.spec.ts` generation — offer it as an opt-in: `"Generate spec file? (y/n)"`
- **MANDATORY: Write result via `write-result.js`** — do NOT skip this
- Still log a bug file entry immediately if the result is FAIL

**⚠️ MANDATORY Quick Action Run-End Sequence — execute after every Quick Action, no exceptions:**

```bash
# 1. Write the TC result (already done above)
# 2. Patch live-status.json to mark run complete and clear currentTc
node -e "
const fs = require('fs');
const p = '[app-name]/results/live-status.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
d.runState    = 'complete';
d.currentTc   = null;
d.completedAt = new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(d, null, 2));
"
# 3. Close browser
browser_close()
```

**Why this is required:** If `runState` stays `"running"` and `currentTc` is not cleared, the live
dashboard marks the TC as "in progress" instead of PASS/FAIL — even if `write-result.js` succeeded.
The TC status icon will show a filled blue circle (executing) rather than the correct result color.

Example output:
```
[TC-XXX] PASS — Appointment created successfully
  Action:   Create an appointment
  Observed: Confirmation message displayed; appointment visible in list
```

---

## Execution Loop

For each test case, follow this exact sequence:

### 1. Announce
```
[TC-044] Executing: User adds an allergy entry
```

### 2. Reset State
Navigate to the appropriate starting URL or state for this test case.
Do NOT carry over state from the previous test unless the test case explicitly
states a precondition that requires it.

### 3. Execute Steps
Use browser tools to perform each action one at a time.
For each step, use the selector hierarchy from `references/part-9-selector-strategy.md`.

### 4. Assert
Verify the expected result against what is actually observed:
- URL changed to expected path
- Expected text is present on the page
- Element is visible / not visible
- Form submission confirmed (success message, redirect, or toast)
- Error message matches expected text
- Value appears in table/list

### 5. Record Outcome
- **PASS** — All steps completed, expected result observed
- **FAIL** — Steps completed but expected result NOT observed; or error mid-test
- **BLOCKED** — Cannot execute due to unmet prerequisite (login required, no test data, etc.)
- **SKIP** — Intentionally skipped (state the reason)

### 6. Screenshot Rule — Every TC

Take **one screenshot after every TC outcome** (PASS, FAIL, BLOCKED). This is a final-state capture recorded **after** the verdict, not a substitute for assertions. Always use `browser_evaluate()` or `browser_snapshot()` for assertions first; the screenshot is the last step.

| Condition | Action |
|-----------|--------|
| TC passes | Take screenshot after assertion → `results/screenshots/[tc-id]-pass.png` |
| TC fails | Take screenshot **immediately** (before network capture) → `results/screenshots/[tc-id]-fail.png` |
| TC blocked | Take screenshot of blocked state → `results/screenshots/[tc-id]-blocked.png` |
| TC skipped | **No screenshot** — nothing to capture for an intentional skip |

The screenshot path is passed to `write-result.js` as `screenshot_path` for all statuses (see Step 7 below). This makes screenshots visible in the live dashboard when clicking any TC result card.

### On FAIL — Mandatory 3-Step Sequence (do NOT skip any step)

**A FAIL verdict is not complete until all three steps below are done. Do not move to the next TC until steps F1–F3 are finished.**

**Step F1 — Screenshot**
Take a screenshot immediately → save to `results/screenshots/[tc-id]-fail.png`

> This is the same screenshot step as for PASS/BLOCKED — on FAIL it happens first (before evidence capture), on PASS/BLOCKED it happens last (after assertion).

**Step F1b — Capture Network + Console Evidence (MANDATORY — do NOT skip)**

**Call these immediately after the screenshot, before navigating away.** Navigating resets the browser's request log — this data is only available right now.

```js
// 1. Get all network requests
browser_network_requests()

// 2. Get all console messages
browser_console_messages()
```

**From `browser_network_requests`, extract:**
- Every request with status ≥ 400 (4xx/5xx)
- The last request triggered by the failing action (e.g. the POST/PUT/DELETE that should have saved)
- Format each as: `[METHOD] [full URL] => [STATUS] [Status Text]`
- If response body snippet is visible and contains an error message, include up to 200 chars

**From `browser_console_messages`, extract:**
- Messages with `type: "error"` or `type: "warning"` only
- Ignore `"log"` and `"info"` — not useful for bugs

**Store these as variables — you'll use them in Step F2.**

| Result | What to record |
|--------|----------------|
| 4xx/5xx requests found | Full method + URL + status for each failing request |
| No failing requests | Write: `"No failing network requests observed — UI-layer failure"` |
| Console errors found | Include the error message and source location |
| No console errors | Write: `"None observed"` |

**Step F2 — Write Bug to DB (primary) or File (fallback)**

**If `artemis.db` exists (DB mode — preferred):**
```bash
node [app-name]/scripts/write-bug.js '{
  "id": "BUG-[MODULE]-[YYYYMMDD]-[NNN]",
  "run_id": "[current-run-id]",
  "tc_id": "[tc-id]",
  "module": "[module]",
  "title": "[short bug title]",
  "severity": "Critical|High|Medium|Low",
  "description": "[1-2 sentences: what failed and where]",
  "steps_to_reproduce": ["step 1", "step 2", "step 3"],
  "expected_behavior": "[what should happen]",
  "actual_behavior": "[what actually happened — be specific]",
  "screenshot_path": "results/screenshots/[tc-id]-fail.png",
  "endpoint": "[failing API endpoint from F1b, e.g. POST /api/v1/orders/save]",
  "http_status": "[HTTP status code from F1b, e.g. 404]",
  "network_evidence": "[formatted network lines from F1b, e.g. POST http://host/api/endpoint => 404 Not Found]",
  "console_error": "[console error text from F1b, or None observed]",
  "impact": "[who is affected and what is blocked]",
  "possible_cause": "[root cause hypothesis: UI / API / Data / State / Timing layer]",
  "url": "[page URL at time of failure]"
}'
```
This writes to DB AND auto-generates the markdown file in `results/bugs/` for the dashboard.

> **All fields from Step F1b are required.** Do not leave `network_evidence` or `console_error` empty — use `"No failing network requests observed"` or `"None observed"` if nothing was captured.

**If `artemis.db` does NOT exist (file mode — fallback):**
Append a bug entry to: `results/bugs/BUG-[module-slug]-[YYYY-MM-DD].md`
- If the file does not exist: create it with the standard header first (see `examples/bug-report-template.md`)
- Append one `## BUG-NNN:` block using the exact format from `examples/bug-report-template.md`
- Use `## BUG-NNN: Title` heading (2 hashes + colon) — the dashboard server parses this exactly
- **NEVER write to a root-level `bugs/` folder**

**Step F3 — Update live-status.json**

**If `artemis.db` exists (DB mode):**
```bash
node [app-name]/scripts/write-result.js '{
  "run_id": "[current-run-id]",
  "tc_id": "[tc-id]",
  "tc_title": "[tc title]",
  "status": "FAIL",
  "duration_ms": [ms],
  "screenshot_path": "results/screenshots/[tc-id]-fail.png",
  "error_message": "[brief error description]"
}'
```
This writes to DB AND updates `results/live-status.json` automatically.

**If `artemis.db` does NOT exist (file mode):**
Update `allResults` and `recentResults` in `results/live-status.json` with `"status": "FAIL"` (see §8 below)

**Only after F1 + F2 + F3 are complete: proceed to the next TC.**

**Do not defer bug logging to a separate "Bug Analyzer pass" at the end.** The Bugs Found panel on the live dashboard reads from `results/bugs/` in real time — bugs only appear if the file is written during the run. Deferring = bugs never show up.

**On PASS where the TC was previously a known bug (bug fix validation):**
- Find the existing bug file entry for this TC
- Update its `**Status:**` line to `Resolved — Fixed [YYYY-MM-DD]`
- Add `**Verified By:**` line describing what was confirmed (e.g., "POST returns 200 OK; record created")
- The dashboard will reflect the resolved state immediately on next file-watch event

### 7. Write Result — After Every TC (DB mode OR file mode)

**If `artemis.db` exists:** Use `write-result.js` (Step F3 above does this for FAIL; use the same command for PASS/BLOCKED/SKIP). **Always include `screenshot_path`** for PASS and BLOCKED (SKIP has no screenshot):
```bash
node [app-name]/scripts/write-result.js '{
  "run_id": "[current-run-id]",
  "tc_id": "[tc-id]",
  "tc_title": "[tc title]",
  "status": "PASS|FAIL|BLOCKED|SKIP",
  "duration_ms": [ms],
  "screenshot_path": "results/screenshots/[tc-id]-pass.png"
}'
```
Omit `screenshot_path` only for SKIP. This writes to DB AND updates `results/live-status.json` in one command, making the screenshot visible immediately in the live dashboard when clicking the result card.

**If `artemis.db` does NOT exist:** Append the result to the checkpoint file.

### 7b. Checkpoint — Write Result to Disk Immediately (file mode only)
After EVERY TC outcome (PASS, FAIL, BLOCKED, or SKIP), append the result to the
checkpoint file **before moving to the next TC**. Do not wait until the end.

**Checkpoint file path:** `results/checkpoint-[YYYY-MM-DD]-[scope].md`

Append format (one line per TC):
```
| TC-076 | PASS   | Add New Appointment button opens form                 |
| TC-077 | FAIL   | Facility dropdown missing — expected 2 items, got 0   |
| TC-078 | PASS   | Appointment Type shows 19 options                    |
| TC-079 | BLOCKED| Date picker not reachable — modal did not open        |
```

**Why:** If the session crashes mid-run, all completed TCs are preserved on disk.
The next run can read the checkpoint and resume from the last unexecuted TC instead
of starting over. The checkpoint file is promoted to the full results report at the
end of the run.

### 8. Live Status Update — Write live-status.json After Every TC

**CRITICAL: Write `results/live-status.json` after EVERY single TC — no exceptions.**
Never batch multiple TC results into one write. Never defer to the end of a batch.
Steps 7 and 8 execute together after each TC, one at a time.

This powers the **Artemis Live dashboard** (`open http://localhost:7373`).

**File path:** `results/live-status.json`

**Write timing:** After every TC (Steps 7 + 8 always run together), plus once at run
START and once at run END.

**JSON schema:**
```json
{
  "runId": "[YYYY-MM-DD]-[scope-slug]",
  "scope": "[TC range or module name from run params]",
  "module": "[module > submodule label shown in dashboard]",
  "appUrl": "[base URL being tested]",
  "runState": "running",
  "startedAt": "[ISO 8601 timestamp of run start]",
  "completedAt": null,
  "currentTc": {
    "id": "[NEXT TC id — the one about to execute]",
    "title": "[NEXT TC title]",
    "startedAt": "[ISO 8601 timestamp]"
  },
  "counts": {
    "total": 0,
    "pass": 0,
    "fail": 0,
    "blocked": 0,
    "skip": 0,
    "remaining": 0
  },
  "recentResults": [
    {
      "id": "TC-XXX",
      "title": "[title]",
      "status": "PASS|FAIL|BLOCKED|SKIP",
      "completedAt": "[ISO 8601]",
      "notes": "[brief notes or empty string]"
    }
  ],
  "allResults": []
}
```

**Rules:**
- `runState`: `"running"` during execution. `"complete"` after the last TC. `"interrupted"` if stopped early.
- `currentTc`: Set to the **next** TC (the one about to start, not the one just finished).
  Set to `null` on the final write after the last TC completes.
- `recentResults`: Rolling window of the **last 10** completed TCs, newest first.
  After every TC, prepend the new result and trim the array to 10 entries:
  `recentResults = [newResult, ...previous].slice(0, 10)`
  This array must keep growing until it reaches 10, then stay at exactly 10 (oldest entry drops off).
  **Never stop updating this array mid-run.** Every single TC write must include an updated `recentResults`.
- `allResults`: Full ordered array of every completed TC result. Grows with each write. Never truncate this array.
- `counts.remaining`: `total - (pass + fail + blocked + skip)`
- `runId` slug: Replace spaces and `>` with `-`, lowercase.
  E.g. scope `"TC-MOD-076 to TC-MOD-101"` → `"2026-03-15-tc-mod-076-tc-mod-101"`

**On run START:** Write with `runState: "running"`, `counts.total` = number of TCs in
scope, all other counts at 0, `currentTc` = first TC, `startedAt` = now, `completedAt` = null.

**On run END:** Write with `runState: "complete"`, `currentTc: null`,
`completedAt` = now ISO string, final counts.

**Close Chromium after every run.** Once the final `live-status.json` write is done, call `browser_close` to shut down the Playwright MCP browser. Do this after every run — full runs, Quick Action runs, and interrupted runs. Never leave Chromium open after testing is complete.

**Example — mid-run after TC-MOD-084 completed, TC-MOD-085 about to start:**
```json
{
  "runId": "2026-03-15-orders-create",
  "scope": "TC-MOD-076 to TC-MOD-101",
  "module": "Orders > Create Order",
  "appUrl": "http://localhost:3000",
  "runState": "running",
  "startedAt": "2026-03-15T09:42:00.000Z",
  "completedAt": null,
  "currentTc": { "id": "TC-MOD-085", "title": "Method: Delivery is selectable", "startedAt": "2026-03-15T09:47:33.000Z" },
  "counts": { "total": 26, "pass": 9, "fail": 0, "blocked": 0, "skip": 0, "remaining": 17 },
  "recentResults": [
    { "id": "TC-MOD-084", "title": "Method: Pickup is selectable", "status": "PASS", "completedAt": "2026-03-15T09:47:10.000Z", "notes": "" }
  ],
  "allResults": [
    { "id": "TC-MOD-076", "title": "Add New Order button opens form", "status": "PASS", "completedAt": "2026-03-15T09:42:44.000Z", "notes": "" }
  ]
}
```

## ⚠️ RUN STARTUP SEQUENCE — execute in this exact order before first TC

**Step A — Clear orphaned browser (ALWAYS first)**
```js
browser_close()   // "No open tabs" is expected and fine
```

**Step B — Start dashboard server**
```bash
lsof -ti:7373 | xargs kill -9 2>/dev/null
node [app-name]/server.js &
open http://localhost:7373
```
Do NOT proceed to Step C until the server outputs `→ Dashboard: http://localhost:7373`.

**Step C — Write run-start status via write-result.js, then begin TCs**
```bash
node [app-name]/scripts/write-result.js '{"run_id":"[run-id]","tc_id":"RUN_START","tc_title":"Run started","status":"running","duration_ms":0}'
```

Do this automatically — the user should not need to ask.

## ⚠️ RUN END SEQUENCE — execute after final TC

```bash
# 1. Final result write (runState complete is handled by write-result.js automatically on last TC)
# 2. Close browser — MANDATORY, no exceptions
browser_close()
# 3. Print run summary to user
```

---

## Status Definitions

| Status | Criteria |
|--------|----------|
| **PASS** | All steps executed, expected result observed — no exceptions |
| **FAIL** | Steps ran but expected result was NOT observed; or an unhandled error occurred |
| **BLOCKED** | Cannot begin due to: missing credentials, missing test data, CAPTCHA, prerequisite feature broken |
| **SKIP** | Deliberately not run (note reason: "Duplicate of TC-044", "Out of scope for this run", etc.) |

---

## Assertion Methods

| What to verify | How to verify |
|----------------|---------------|
| URL changed | Check current URL contains expected path |
| Text visible on page | `browser_wait_for(text="...")` or check `browser_snapshot` |
| Element is visible | Look for element by role/label/text in snapshot |
| Form submitted successfully | Toast message, redirect, or success banner |
| Error message shown | Find error element by role="alert" or visible error text |
| Value in table | Find table cell containing expected value |
| Modal opened | Find dialog by role="dialog" |
| Modal closed | Confirm dialog element is gone from snapshot |
| Toast appeared | Wait for toast element, read its text |
| Data persisted after save | Navigate away and return, verify value still present |

---

## Element Not Found Protocol

If an element cannot be found:

1. **Attempt 1:** Try primary semantic locator (see `references/part-9-selector-strategy.md`)
2. **Attempt 2:** Try alternative semantic locator (different strategy in hierarchy)
3. **Attempt 3:** Call `browser_snapshot` to inspect actual DOM structure, derive selector from what is actually there
4. **After 3 failures:** Take screenshot, mark step FAILED:
   ```
   Element not found: [description of what was expected]
   Tried: [list of selectors attempted]
   ```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| **Login wall encountered** | Stop, mark affected TCs BLOCKED: "Login required — no credentials provided" |
| **CAPTCHA encountered** | Mark affected TCs BLOCKED: "CAPTCHA prevents automated testing" |
| **Page crash / error page** | Screenshot the error, mark TC FAIL, continue to next TC |
| **Infinite redirect / loop** | Note as potential bug, mark TC FAIL, navigate away and continue |
| **Unexpected popup / modal** | Dismiss (Escape or click close), note in log, continue |
| **Test takes > 3 minutes** | Mark as BLOCKED: "Timed out — manual investigation needed" |
| **Element not found after 3 retries** | Mark step FAIL with full selector attempt log |

---

## `.spec.ts` Generation Rules

Generate a Playwright TypeScript test file ONLY AFTER all test cases have been executed.
Base the code on what was actually done during execution — not just the test case text.

### Module / E2E Scope: Nested Describes

```typescript
import { test, expect } from '@playwright/test';

test.describe('Medical History', () => {

  test.describe('Allergies', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('https://his-alpha-dev.q13.dev/patient/12345/medical-history');
    });

    test('TC-044: User adds an allergy entry', async ({ page }) => {
      // Step 1: Click "Edit Details" on allergies card
      await page.getByRole('link', { name: 'Edit Details' }).click();

      // Step 2: Fill in allergy information
      await page.getByLabel('Food').fill('Peanuts');

      // Step 3: Click Save
      await page.getByRole('button', { name: 'Save' }).click();

      // Assert: allergy reflected in banner
      await expect(page.locator('.allergy-banner')).toContainText('Peanuts');
    });
  });

});
```

### Feature Scope: Single Describe

```typescript
import { test, expect } from '@playwright/test';

test.describe('Allergies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://his-alpha-dev.q13.dev/medical-history');
  });

  test('TC-044: User adds an allergy entry', async ({ page }) => {
    // ...
  });
});
```

### Rules

- One `test()` block per test case
- Use `@playwright/test` — `test`, `expect`, `Page`
- Semantic locators only: `getByRole()`, `getByText()`, `getByLabel()`, `getByPlaceholder()`
- Comment each step: `// Step 1: [description]`
- Use `test.describe()` to group by module > feature
- Use `test.beforeEach()` for shared setup (navigation, login)
- Filename: `tests/[module]-[feature].spec.ts` (e.g., `tests/medical-history-allergies.spec.ts`)
- After saving, run with `npx playwright test` and iterate until passing

---

## Inline Reporting During Execution

Report results as you go — do not batch until the end:

```
[TC-044] PASS — Allergy entry added successfully
[TC-045] PASS — Edit allergy flow works correctly
[TC-046] FAIL — Expected: validation error on empty save | Actual: form saved with blank allergy
         URL: https://his-alpha-dev.q13.dev/medical-history/edit
         Screenshot: tc-046-fail.png
[TC-047] BLOCKED — Requires existing allergy entry (TC-044 must run first)
```

---

## File Path Rules

**ALL output files must go into the app folder — never the project root.**

| File type | Required path |
|-----------|--------------|
| Screenshot — TC PASS | `results/screenshots/[tc-id]-pass.png` |
| Screenshot — TC FAIL | `results/screenshots/[tc-id]-fail.png` |
| Screenshot — TC BLOCKED | `results/screenshots/[tc-id]-blocked.png` |
| Screenshot — TC SKIP | **NEVER** — no browser state to capture on intentional skip |
| Screenshot — ambiguous state | `results/screenshots/[tc-id]-[description].png` |
| Screenshot — exploration | `results/screenshots/explore/[module-slug].png` |
| Screenshot — debug/diagnostic | `results/screenshots/debug/[name].png` |
| Walkthrough GIF | `results/screenshots/walkthroughs/[tc-id]-walkthrough.gif` |
| Snapshots (saved to file) | `results/screenshots/[tc-id]-snapshot.md` |
| Live status | `results/live-status.json` |
| Checkpoint | `results/checkpoint-[YYYY-MM-DD]-[scope].md` |
| QA results report | `results/qa-results-[YYYY-MM-DD]-[scope].md` |
| Bug files | `results/bugs/BUG-[module-slug]-[YYYY-MM-DD].md` |
| Observations | `results/observations/observations-log.md` |
| Playwright spec | `tests/[module]-[feature].spec.ts` |

**Screenshot naming:** Use lowercase TC ID with hyphens, e.g. `tc-042-calendar-switched.png`.

**Absolute path rule:** Always pass the FULL absolute path when calling `browser_take_screenshot`.
Never use a bare filename or rely on CWD — Playwright MCP resolves relative paths from wherever
the tool is running, which is often not the app folder.

```
✅  /Users/.../[app-name]/results/screenshots/tc-042-fail.png
✅  /Users/.../[app-name]/results/screenshots/explore/dashboard-overview.png
❌  tc-042-fail.png           ← lands in unknown CWD
❌  screenshots/tc-042.png    ← wrong folder, not served by dashboard
```

**Never save screenshots outside `results/screenshots/` or any of its subdirectories.**

### Screenshot Retention Policy

Screenshots are kept only as long as they serve as active bug evidence. Artemis runs the
cleanup script automatically at the start of every `/run` and `/artemis` session (before the
pre-flight check):

```bash
node [app-name]/scripts/cleanup-screenshots.js
```

| Screenshot | Keep | Delete |
|------------|------|--------|
| `[tc-id]-fail.png` | Bug status = `open` or `confirmed` | Bug `fixed`/`wont-fix` OR no linked bug |
| `[tc-id]-pass.png` | Until next run of same TC | Replaced on re-run |
| `[tc-id]-blocked.png` | Until next run of same TC | Replaced on re-run |
| `walkthroughs/[tc-id]-walkthrough.gif` | Permanent (documentation) | Only on explicit delete |
| `explore/*.png` | Never | Always (working context only) |
| `debug/*.png` | Within 3 days | Older than 3 days |
| `screenshots/` (legacy root) | Never | Always (superseded) |

This runs silently. If files are deleted, print: `🗑  Cleaned N screenshot(s) (X MB freed)`

Manual cleanup: `npm run screenshots:clean` (inside `[app-name]/`)
Preview only: `npm run screenshots:preview`

---

## Output Files

After execution:
1. `results/qa-results-[YYYY-MM-DD]-[scope].md` — Full results report (use template); promoted from checkpoint file
2. `tests/[module]-[feature].spec.ts` — Playwright test file from execution history
3. `results/bugs/BUG-[module-slug]-[YYYY-MM-DD].md` — Written during run (one file per module); append each FAIL immediately, do not defer
4. `results/observations/observations-log.md` — Append any notable observations from the run (see below)

**Checkpoint promotion rule:** At the end of a successful run, rename/overwrite
`results/checkpoint-[date]-[scope].md` → finalize as part of `qa-results-[date].md`.
If the run was interrupted, the checkpoint file stays in `results/` as a partial log
and is picked up on the next run of the same scope.

---

## Resume From Checkpoint

At the START of every run, check for an existing checkpoint file matching the same
scope and date:

```
results/checkpoint-[YYYY-MM-DD]-[scope].md
```

If found:
1. Read the checkpoint — identify the last TC that was recorded
2. Report: `"Checkpoint found — resuming from TC-XXX (N TCs already completed)"`
3. Skip all TCs already in the checkpoint; execute only remaining TCs
4. Append new results to the same checkpoint file
5. Promote to full results report when all TCs are done

If not found: start fresh, create the checkpoint file after the first TC.

---

## Observations Log

During execution, note anything that is **not a hard FAIL** but is worth flagging — UX
issues, unexpected behavior, design decisions that may need review, accessibility gaps,
or data constraints. These are called **Observations**.

### What qualifies as an Observation (not a Bug)
- Behavior works but may confuse users (UX clarity)
- Feature works but has an accessibility gap (missing ARIA attributes)
- Intentional design constraint worth documenting (e.g., phone format validation)
- Data not pre-filled that users might expect to be
- Visual state doesn't reflect internal state (no selection indicator)
- Edge case that doesn't crash but produces surprising results

### What qualifies as a Bug (not an Observation)
- Feature does not work at all (e.g., 404 on save)
- Data is corrupted or lost
- Security vulnerability
- Hard crash or console error during normal use

### How to log an Observation

At the end of the run, append each observation to:
`results/observations/observations-log.md`

Use this format:
```markdown
### OBS-XXX — [Short Title]
**Date:** YYYY-MM-DD
**Module:** [Module > Feature]
**Source TC:** TC-XXX (if triggered during a specific TC)
**Run:** qa-results-YYYY-MM-DD.md

**Description:**
[What was observed. Be specific — include field names, values, URLs, behavior.]

**Impact:** Low / Medium / High — [one-line reason]
**Status:** OPEN
**Decision:** —
```

**OBS ID numbering:** Read the existing log, find the highest OBS-XXX number, increment by 1.
If the file does not exist yet, create it and start at OBS-001.

**Status values:**
- `OPEN` — Logged, not yet reviewed
- `RAISED` — Brought to dev/design team
- `TC-ADDED` — Converted into a new test case
- `CLOSED` — Reviewed and accepted as intentional / won't fix
- `BUG` — Escalated to a formal bug report

---

## Close Chromium After Testing — MANDATORY

**After all TCs complete** (or after a Quick Action result is reported), always close Chromium:

```js
await browser_close();
```

**Rules:**
- Close Chromium **immediately** after the final TC result is recorded and the run summary is printed
- Do NOT leave Chromium open between test sessions
- Do NOT close or interact with the user's Chrome browser — only close the Playwright MCP Chromium instance
- If the run is interrupted mid-session, close Chromium before reporting the interruption
- The live dashboard server (`node server.js`) runs independently on port 7373 — it does NOT need the browser to stay open

**Never run `pkill`, `kill`, or any shell command targeting Chrome or the user's browser.**
If Playwright MCP fails to launch Chromium, inform the user with:
```
Playwright MCP could not open Chromium. Please ensure Playwright MCP is configured
to use Chromium (not Chrome) in your MCP settings. Do not close your Chrome browser.
```

# Core Runner — Execution Loop, Selectors, Browser Tools, Spec Generation

---

## Step 0: CLI-First Check (Before Any Browser Action)

Check for existing spec files before opening Playwright MCP:

```bash
APP=$(cat .artemis-project 2>/dev/null)
ls "${APP}/tests/"*.spec.ts 2>/dev/null
```

| Result | Action |
|--------|--------|
| Spec file(s) match the scope | **Use CLI path** — jump to `/rerun` section below. Do not open MCP. |
| No spec files | Continue to MCP startup below |

Spec files are the zero-token path. CLI (`npx playwright test`) runs 50 TCs in ~500 tokens.
MCP runs them in ~15,000 tokens. Always prefer CLI when specs exist.

---

## MANDATORY STARTUP — Before Any Navigation (MCP path only)

```js
browser_close()                              // clear orphaned session
browser_resize({ width: 1920, height: 1080 }) // Full HD viewport — REQUIRED
```

Playwright MCP defaults to ~1280×720. At that size, responsive apps collapse menus and
hide panels, causing selector failures. **Always set 1920×1080 first.**

---

## TC Loading

### DB-First (primary — when `artemis.db` exists)

```bash
APP=$(cat .artemis-project 2>/dev/null)
ls "${APP}/artemis.db" && echo "USE DB" || echo "USE FILES"
```

If DB exists, use `query-tcs.js` exclusively — never read `.md` files.
Token savings: ~15× more efficient than parsing .md files.

If invoked by `/artemis` pipeline: check for `[FILTERED_TCS: ...]` label — use it
directly, never re-query.

### File-Based Fallback (when DB is absent)

1. Read `test-cases/INDEX.md` (~2KB) — find module folder
2. Read `test-cases/<module>/INDEX.md` (~1KB) — find submodule file
3. Read **only** that submodule file

Never load the full `test-cases/` library at once.

---

## Execution Loop

For each test case:

### 1. Announce
```
[TC-044] Executing: User adds an allergy entry
```

### 2. Reset State
Navigate to appropriate starting URL. Do NOT carry state from previous TC.

### 3. Execute Steps
Use browser tools — one action at a time.
Follow the selector hierarchy (see Selector Strategy below).

### 4. Assert
Verify expected result against observed reality:
- URL changed to expected path
- Expected text present on page
- Element visible/not visible
- Success message, redirect, or toast after form submit
- Error message matches expected text

### 5. Record Outcome

| Status | Criteria |
|--------|----------|
| **PASS** | All steps executed, expected result observed |
| **FAIL** | Steps ran but expected result NOT observed |
| **BLOCKED** | Cannot begin — missing credentials, data, or prerequisite |
| **SKIP** | Deliberately skipped (state reason) |

### 6. Screenshot & Snapshot Budget (Hard Cap)

`browser_snapshot()` returns 5–78KB of YAML that **stays in context for the rest of the session**.
Treat every call as spending a finite resource. Budget per TC:

| TC result | `browser_take_screenshot()` | `browser_snapshot()` |
|-----------|----------------------------|----------------------|
| PASS | None | None |
| FAIL | 1 — immediately after failure | 0 (screenshot is enough) |
| BLOCKED | 1 | 0 |
| SKIP | None | None |
| Selector retry (self-healing) | 0 | 1 per retry, max 2 per TC total |

**Never call `browser_snapshot()` proactively.** Only during self-healing (selector not found after 2 attempts).
After you get the snapshot, extract the selector you need and do not reference the YAML again — it stays in context but you should not re-read or recite it.

### 7. On FAIL — Mandatory 3-Step Sequence

**F1 — Screenshot + Evidence Capture**
```js
browser_take_screenshot()  // save immediately
browser_network_requests() // extract status >= 400
browser_console_messages() // extract type: "error" and "warning" only
```
Call these before navigating away — navigation resets the request log.

**F2 — Write Bug to DB**
```bash
node [app]/scripts/write-bug.js '{
  "id": "BUG-[MODULE]-[YYYYMMDD]-[NNN]",
  "run_id": "[run-id]",
  "tc_id": "[tc-id]",
  "module": "[module]",
  "title": "[short title]",
  "severity": "Critical|High|Medium|Low",
  "description": "[what failed]",
  "steps_to_reproduce": ["step 1", "step 2"],
  "expected_behavior": "[what should happen]",
  "actual_behavior": "[what actually happened]",
  "screenshot_path": "results/screenshots/[tc-id]-fail.png",
  "network_evidence": "[from F1]",
  "console_error": "[from F1, or None observed]",
  "url": "[page URL]"
}'
```

**F3 — Write Result**
```bash
node [app]/scripts/write-result.js '{
  "run_id": "[run-id]",
  "tc_id": "[tc-id]",
  "tc_title": "[title]",
  "status": "FAIL",
  "duration_ms": [ms],
  "screenshot_path": "results/screenshots/[tc-id]-fail.png",
  "error_message": "[brief description]"
}'
```

**Only after F1+F2+F3: proceed to next TC.**

### 8. Write Result — After Every TC

Use `write-result.js` for all statuses. This updates both `artemis.db` AND `results/live-status.json` atomically.

```bash
node [app]/scripts/write-result.js '{
  "run_id": "[run-id]",
  "tc_id": "[tc-id]",
  "tc_title": "[title]",
  "status": "PASS|FAIL|BLOCKED|SKIP",
  "duration_ms": [ms]
}'
```

⛔ **Never write to `results/live-status.json` directly.** Always use `write-result.js`.

---

## Quick Action Mode

Run exactly 1 TC. After execution:
- 3-line summary (TC ID, status, observed result)
- Skip full report generation
- Still write result via `write-result.js`
- Patch live-status to complete:
```bash
node -e "
const fs = require('fs');
const p = '[app]/results/live-status.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
d.runState = 'complete'; d.currentTc = null; d.completedAt = new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(d, null, 2));
"
```
- Close browser

---

## Selector Strategy (8-Level Hierarchy)

Try selectors in this order. After 3 consecutive failures, take screenshot and mark FAIL.

| Level | Strategy | Example |
|-------|----------|---------|
| 1 | `getByRole` | `getByRole('button', { name: 'Save' })` |
| 2 | `getByLabel` | `getByLabel('First Name')` |
| 3 | `getByText` | `getByText('Submit Application')` |
| 4 | `getByPlaceholder` | `getByPlaceholder('Search...')` |
| 5 | `getByTestId` | `getByTestId('save-btn')` |
| 6 | CSS (semantic) | `[role="dialog"]`, `[aria-label="Close"]` |
| 7 | CSS (structural) | `form > button:first-of-type` |
| 8 | XPath (last resort) | `//button[contains(text(),'Save')]` |

**Self-healing protocol:**
1. Attempt 1: primary semantic locator (Level 1-4)
2. Attempt 2: alternative semantic locator (different level)
3. Attempt 3: `browser_snapshot()` → derive selector from actual DOM
4. After 3 failures: screenshot, mark FAIL

**Anti-patterns — never use:**
- Generated class names (`class="css-1a2b3c"`, `class="ng-tns-c42"`)
- Positional selectors (`nth-child` without semantic context)
- Full XPath from root

---

## Browser Tools Reference

| Goal | Tool |
|------|------|
| Navigate | `browser_navigate` |
| Click | `browser_click` |
| Type text | `browser_type` |
| Select dropdown | `browser_select_option` |
| Screenshot | `browser_take_screenshot` |
| DOM snapshot | `browser_snapshot` |
| Wait for element | `browser_wait_for` |
| Press key | `browser_press_key` |
| Network requests | `browser_network_requests` |
| Console messages | `browser_console_messages` |
| Hover | `browser_hover` |
| Navigate back | `browser_navigate_back` |
| Handle dialog | `browser_handle_dialog` |
| Upload file | `browser_file_upload` |
| Close browser | `browser_close` |
| Resize viewport | `browser_resize` |

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Login wall | Mark TCs BLOCKED: "Login required" |
| CAPTCHA | Mark TCs BLOCKED: "CAPTCHA" |
| Page crash | Screenshot, mark FAIL, continue |
| Infinite redirect | Note as bug, mark FAIL, continue |
| Unexpected modal | Dismiss (Escape/close), note, continue |
| Test > 3 min | Mark BLOCKED: "Timed out" |
| Element not found after 3 retries | Mark FAIL with selector log |

---

## `.spec.ts` Generation

Generate ONLY AFTER all TCs executed. Base on what was actually done, not just TC text.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Module > Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://app-url/path');
    await page.waitForLoadState('networkidle');
  });

  test('TC-044: User adds an allergy entry', async ({ page }) => {
    // Step 1: Click "Edit Details"
    await page.getByRole('link', { name: 'Edit Details' }).click();
    await page.waitForLoadState('networkidle');
    // Step 2: Fill allergy — pressSequentially triggers Angular valueChanges
    await page.getByLabel('Food').pressSequentially('Peanuts', { delay: 50 });
    // Step 3: Save
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    // Assert
    await expect(page.locator('.allergy-banner')).toContainText('Peanuts');
  });
});
```

**Angular SPA spec generation rules — mandatory:**

1. **Never use `fill()` for form inputs.** Angular reactive forms do not fire `valueChanges`
   on `fill()`, so submit buttons stay disabled and the test fails.
   Always use: `pressSequentially(value, { delay: 50 })`.
   This applies to ALL text inputs — login, search, form fields, filters.

2. **Always add `waitForLoadState('networkidle')` after:**
   - Every `page.goto()`
   - Every navigation click (sidebar links, module cards, tab switches)
   - Every form submission (`click` on a Save/Submit button)
   Never use `waitForSelector('table')` alone — the DOM node may exist before API data arrives.

3. **Location/context modals must be conditional.**
   ```typescript
   const locationBtn = page.getByRole('button', { name: 'Change Location' });
   if (await locationBtn.isVisible()) {
     await locationBtn.click();
     await page.getByText('Health Center Name').click();
     await page.getByRole('button', { name: 'Confirm' }).click();
     await page.waitForLoadState('networkidle');
   }
   ```
   Never click the modal button unconditionally — it may not appear if the session already has a location.

4. **No hardcoded `waitForTimeout`.** Replace with `waitForLoadState('networkidle')` or
   `waitForSelector('[data-ready]')`. Hardcoded timeouts are fragile on slow CI.

Rules: one `test()` per TC, semantic locators only, comment each step,
filename: `tests/[module]-[feature].spec.ts`

---

## `/rerun` — Zero-Token Regression

Executes `.spec.ts` files via `npx playwright test` — no MCP, no browser tokens.

1. Check specs: `ls ${APP}/tests/*.spec.ts`
2. Resolve filter: `--module=X` → `tests/X-*.spec.ts`, `--tc=TC-ID` → `--grep "TC-ID"`
3. Execute — **write output to file, never pipe full output to context:**
   ```bash
   npx playwright test [filter] --reporter=line \
     > ${APP}/results/playwright-rerun.log 2>&1
   echo "Exit: $?"
   ```
   Reading 500+ lines of error traces into context defeats the purpose of CLI mode.

4. Read summary only — tail has the pass/fail count:
   ```bash
   tail -20 ${APP}/results/playwright-rerun.log | grep -E "[0-9]+ (passed|failed)|Error:"
   ```

5. If failures exist — read only failing TC names (not full traces):
   ```bash
   grep -E "✗|FAIL|×" ${APP}/results/playwright-rerun.log | head -20
   ```
   Full traces are in `test-results/` for the user to inspect locally.

6. Parse summary → write each result to DB via `write-result.js`
7. Teardown (no `browser_close` needed — no browser was opened)

---

## `/resume` — Continue From Checkpoint

1. Read `[APP]/results/session-checkpoint.md`
2. Load remaining TC IDs only
3. Run with lean mode (screenshots on FAIL only)
4. Write new checkpoint + learnings at end

---

## Run End Sequence

```bash
# T1: Patch live-status to complete
APP=$(cat .artemis-project 2>/dev/null)
node -e "
const fs = require('fs');
const p = '${APP}/results/live-status.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
d.runState = 'complete'; d.currentTc = null; d.completedAt = new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(d, null, 2));
"

# T2: Write learnings
# Append to [APP]/results/artemis-learnings.md

# T3: Write checkpoint
# Write [APP]/results/session-checkpoint.md

# T4: Close browser — mandatory
browser_close()

# T5: Print summary

# T6: Git push gate — if test-cases/ or bugs/ changed, show changed files and ask
```

---

## File Path Rules

All output goes into the app folder:

| File | Path |
|------|------|
| Screenshot (FAIL) | `results/screenshots/[tc-id]-fail.png` |
| Screenshot (BLOCKED) | `results/screenshots/[tc-id]-blocked.png` |
| Live status | `results/live-status.json` |
| QA report | `results/qa-results-[date]-[scope].md` |
| Bug files | `results/bugs/BUG-[module]-[date].md` |
| Checkpoint | `results/session-checkpoint.md` |
| Playwright spec | `tests/[module]-[feature].spec.ts` |

**Always use absolute paths** for `browser_take_screenshot` — Playwright MCP resolves
relative paths from its own CWD, not the app folder.

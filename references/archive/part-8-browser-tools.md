# Part 8: Browser Tools Reference

Artemis uses two browser automation tool sets. Always try Playwright MCP first.
Fall back to Claude-in-Chrome MCP only if Playwright MCP tools are unavailable.

---

## ⚠️ SESSION LIFECYCLE — MANDATORY (non-negotiable, every run)

### STEP 0 — Before first `browser_navigate`

1. **Call `browser_close()` first** — clears any orphaned session from a prior run.
   `"No open tabs"` is the expected response. This is always safe to call.

2. **If `browser_navigate` then fails** with "Opening in existing browser session"
   or exits with code 0:
   → **STOP. Do NOT retry.**
   → Tell the user: *"Playwright MCP is using Chrome instead of Chromium. Fix: ensure
     `~/.claude/settings.json` has `--browser chromium` in `mcpServers.playwright.args`,
     then restart Claude Code."*

### STEP LAST — After the final TC result is recorded

1. Run the final `write-result.js` call with `runState: "complete"`
2. **Call `browser_close()`** — mandatory. Even if the run was interrupted.
3. Do NOT close the user's Chrome browser. Only close Playwright MCP's Chromium instance.

---

## Token Efficiency Rules

These rules apply across ALL agent modes. Violating them wastes tokens and slows runs.

- **Never call `browser_snapshot` proactively.** Only call it when:
  - An element cannot be found using semantic locators on the first try
  - The page state is ambiguous and a screenshot alone won't resolve it
  - You need to inspect a dynamic component (modal, dropdown, table row)

- **Take one screenshot after every TC outcome** (PASS, FAIL, BLOCKED). Screenshots are stored for all outcomes and displayed in the live dashboard. Always use `browser_evaluate()` or `browser_snapshot()` for assertions first — the screenshot is taken as the last step after the verdict, not as a substitute for asserting:
  - After PASS → `results/screenshots/[tc-id]-pass.png`
  - After FAIL (immediately, before network capture) → `results/screenshots/[tc-id]-fail.png`
  - After BLOCKED → `results/screenshots/[tc-id]-blocked.png`
  - SKIP → no screenshot

- **For most actions: navigate → click/type/select directly** using semantic locators
  (`getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`) without snapshotting first.

---

## Primary: Playwright MCP Tools

| Goal | Tool |
|------|------|
| Navigate to URL | `browser_navigate` |
| Take screenshot | `browser_take_screenshot` |
| Click element | `browser_click` |
| Type text | `browser_type` |
| Fill form field | `browser_type` |
| Select dropdown option | `browser_select_option` |
| Hover over element | `browser_hover` |
| Press keyboard key | `browser_press_key` |
| Get page snapshot (DOM) | `browser_snapshot` |
| Wait for element/condition | `browser_wait_for` |
| Drag and drop | `browser_drag` |
| Go back in history | `browser_navigate_back` |
| Open new tab | `browser_tab_new` |
| Switch to tab | `browser_tab_select` |
| Close tab | `browser_tab_close` |
| Upload file | `browser_file_upload` |
| Handle dialog (alert/confirm) | `browser_handle_dialog` |
| **Get network requests** | **`browser_network_requests`** — call on FAIL to capture API calls |
| **Get console messages** | **`browser_console_messages`** — call on FAIL to capture errors |
| Close browser | `browser_close` — call after every completed test run |

### Network + Console Capture (FAIL only)

`browser_network_requests` returns all requests made since the page loaded.
`browser_console_messages` returns all console output.

**Both must be called immediately after a TC fails — before navigating away**, because navigating resets the request log.

Filter `browser_network_requests` for:
- Status `>= 400` (client + server errors)
- The last request triggered by the failing action (the submit/save call)

Filter `browser_console_messages` for:
- `type: "error"` and `type: "warning"` only — ignore `"log"` and `"info"`

---

## Fallback: Claude-in-Chrome MCP Tools

Use these only when Playwright MCP is unavailable. Detect by attempting `browser_navigate`
— if it fails or is not found, switch to Chrome MCP tools.

| Goal | Chrome MCP Tool |
|------|----------------|
| Get or create browser tab | `tabs_context_mcp` with `createIfEmpty: true` |
| Navigate to URL | `navigate` |
| Take screenshot | `computer` → action: `screenshot` |
| Find element by description | `find` |
| Click element | `computer` → action: `left_click` (coordinate or ref) |
| Type text | `computer` → action: `type` |
| Fill form field | `form_input` (ref from read_page/find) |
| Read page structure | `read_page` (filter: "interactive") |
| Get page text content | `get_page_text` |
| Scroll page | `computer` → action: `scroll` |
| Zoom into area | `computer` → action: `zoom` (region coordinates) |
| Hover over element | `computer` → action: `hover` |

---

## Walkthrough Recording — gif_creator (`/walkthrough` command ONLY)

`gif_creator` from Claude-in-Chrome MCP is **only permitted during the `/walkthrough` command**. Never use it during `/run`, `/artemis`, or `/explore` — those commands use Playwright MCP exclusively.

The `/walkthrough` command creates a documentation GIF showing how to navigate a TC's feature. It uses Claude-in-Chrome's active browser session (not Playwright MCP), so it records the real UI rather than a headless browser.

| Step | Tool | Details |
|------|------|---------|
| 1. Start recording | `gif_creator` `start_recording` | Options: `showClickIndicators: true`, `showActionLabels: true` |
| 2. Navigate steps | `browser_navigate`, `browser_click`, etc. via Chrome MCP | Execute TC steps on the app |
| 3. Stop recording | `gif_creator` `stop_recording` | |
| 4. Export GIF | `gif_creator` `export` | Save to `results/screenshots/walkthroughs/[tc-id]-walkthrough.gif` (absolute path) |
| 5. Store in DB | `node scripts/store-walkthrough.js` | Updates `test_cases.walkthrough_path` |

After export, run:
```bash
node [app-name]/scripts/store-walkthrough.js '{
  "tc_id": "[tc-id]",
  "walkthrough_path": "results/screenshots/walkthroughs/[tc-id]-walkthrough.gif"
}'
```

The walkthrough GIF appears in both `artemis-live.html` and `artemis-tc-list.html` when clicking the TC.

---

## Jam.dev MCP Tools

Use these during Bug Analyzer phase when a Jam recording is available.

| Goal | Tool |
|------|------|
| Get Jam metadata | `getDetails` with jamId |
| Get console logs | `getConsoleLogs` with jamId, `logLevel: "error"` |
| Get network failures | `getNetworkRequests` with jamId, `statusCode: "4xx"` or `"5xx"` |
| Get user interaction timeline | `getUserEvents` with jamId |
| Add bug comment to Jam | `createComment` with jamId and markdown body |
| Search for a Jam by name | `listJams` or `search` |

**Jam enrichment workflow:**
1. Call `getConsoleLogs` filtered by `error` and `warn` → extract JS errors
2. Call `getNetworkRequests` filtered by `4xx`/`5xx` → extract failed API calls (URL, method, status, response excerpt)
3. Call `getUserEvents` → get the interaction timeline leading to the failure
4. Summarize all three in a `createComment` on the Jam with structured markdown
5. Add the Jam URL to the FAIL entry in the results report

If no Jam is available: note in the report — "Start a Jam recording to capture console/network details for failures."

---

## Common Interaction Patterns

### Click a button
```
browser_click(element="button", ref="...", text="Save")
// or by role:
browser_click(element="button[name='Save']")
```

### Fill a text input
```
browser_type(element="First Name input", ref="...", text="Maria")
```

### Select from a dropdown
```
browser_select_option(element="Country dropdown", ref="...", values=["Philippines"])
```

### Handle a confirmation dialog
```
browser_handle_dialog(action="accept")
// or dismiss:
browser_handle_dialog(action="dismiss")
```

### Assert a toast message appeared
```
// Use browser_wait_for to wait for toast, then browser_snapshot to read text
browser_wait_for(text="Saved successfully")
```

### Read a table row value
```
// Use browser_snapshot to get DOM, then find the cell by row position or text
browser_snapshot()
// Look for <td> or role="cell" containing the expected value
```

---

## Secondary Fallback: Playwright CLI via Bash

Use when **both** Playwright MCP and Chrome MCP are unavailable or fail (e.g., Chrome
extension security sandbox blocks `captureVisibleTab` when a sidepanel extension is active).

```bash
# Run a specific test script
npx playwright test tests/mytest.spec.ts --headed

# Run an exploration script
node tests/explore.js 2>&1

# Output results to file to avoid terminal token overflow
node tests/explore.js > results/explore-output.txt 2>&1
```

**Detecting when to use this fallback:**
Chrome MCP fails with: `"Cannot access a chrome-extension:// URL of different extension"`.
This is a Chrome security restriction on `captureVisibleTab` and `scripting.executeScript` —
no workaround exists inside the extension. Switch to Playwright CLI immediately.

**Critical Angular SPA patterns (learned from Angular SPA testing, 2026-03):**

| Problem | Wrong | Correct |
|---------|-------|---------|
| Filling login fields | `page.fill(selector, value)` | `page.locator(selector).pressSequentially(value, { delay: 50 })` |
| Clicking disabled submit | `page.click('button')` | `page.locator('button').first().click({ force: true })` |
| Navigate to module page | `page.goto('/orders/list')` | Go to /modules → click category tab → click module card |
| Dismissing location modal | (ignored) | Check for Cancel button before each step, click if visible |
| Module card selector | `[class="module-card"]` | `a[class*="module-card"]` |
| Category tab selector | `[class="tabs"]` | `[role="button"][class*="tabs"]` |
| Creating page | `context.newPage()` | `browser.newPage()` (context.newPage breaks Angular auth) |

**Why `fill()` fails on Angular:** Angular reactive forms require keyboard events to trigger
`valueChanges` and enable submit buttons. `fill()` bypasses the input event chain — the
form stays invalid and the button stays disabled. `pressSequentially` types character-by-character,
firing the proper events.

**Why direct URL navigation fails:** Angular route guards redirect unauthenticated or
context-less requests back to `/modules`. Module-level state must be set by clicking through
the UI, not by navigating directly.

---

## Token Efficiency: Large App Data

When `explore-raw.json` exceeds ~100KB, direct reads and bash script outputs will hit the
25k-token limit. Protocol:

1. **Run the split script immediately after `/explore` completes:**
   ```bash
   node scripts/split-data.js
   ```
2. This writes `results/modules/<slug>.json` (3–8KB each) — safe to read in one call
3. For test case generation, **always** read `results/modules/<slug>.json`, never `explore-raw.json`
4. If a bash script output still exceeds the limit: write output to a file, then read with `offset`/`limit`
5. Never retry the same oversized read — split the data first, then re-read
6. For Playwright script stdout: redirect to a results file, then read in chunks

```bash
# Instead of reading large stdout directly:
node tests/explore.js 2>&1 | head -c 60000 > results/explore-output.txt
# Then read results/explore-output.txt with offset/limit as needed
```

---

## Edge Cases

### Iframes
Playwright MCP cannot interact with cross-origin iframes. When an iframe is detected:
- Note it in the test as "iframe content — cannot inspect"
- Screenshot the iframe area for visual confirmation only
- Mark any steps requiring iframe interaction as BLOCKED with explanation

### Dynamic / Async Content
When content takes time to load (spinners, skeleton screens, lazy-loaded data):
1. Use `browser_wait_for(text="[expected content]")` with up to 5 second timeout
2. If spinner visible: wait for it to disappear before asserting
3. If content never loads after 5s: mark step FAIL with "Dynamic content did not load within 5 seconds"

### Modals and Overlays
When an unexpected modal appears mid-test:
1. Note it in the test log
2. Dismiss with `browser_press_key(key="Escape")` or click the close button
3. Continue the test from the current state
4. Include in the test log: "Unexpected modal dismissed at step [N]"

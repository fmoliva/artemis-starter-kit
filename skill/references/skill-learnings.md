# Artemis Skill Learnings

Universal fixes and behavioral rules discovered across projects and sessions. Artemis
reads this file at the start of every run — these rules override any generic defaults.
Each entry applies across any project using the same framework component (Playwright,
Angular, PrimeNG, Bootstrap, etc.) — not just one app.

**How to add an entry:** When a universal fix or behavioral rule is discovered, append
it under the matching section using the format: Type / Applies to / Rule / Why / How to
apply. Universal = applies to every project built on the same stack, not just one app.
For app-specific quirks tied to a single application, add them under **App-Specific
Quirks** below, or write to `[app-name]/results/artemis-learnings.md` instead.

---

## Infrastructure Fixes

Bugs in Artemis's own scripts that have been patched. Documented here as a "don't
regress" reminder and to surface the fix in projects that may have an older copy of
the script.

<!-- Format: ### [Fix name] · Type · Applies to · Rule · Why · Reference doc -->

---

### write-result.js must use `id`/`title`, not `tcId`/`tcTitle`

**Type:** Infrastructure fix
**Applies to:** All DB-mode projects
**Rule:** In `write-result.js`, the `newEntry` object written to `recentResults` and
`allResults` in `live-status.json` must use field names `id` and `title` — NOT `tcId`
and `tcTitle`.
**Why:** The live dashboard reads `r.id` and `r.title` from these arrays. A
normalization alias that only covered an older `r.tc` format silently produced
"undefined" for every TC title in the "Recent Results" panel.
**If you see "undefined" in Recent Results:** run this one-time patch on the project's
`live-status.json`:
```bash
APP=$(cat .artemis-project 2>/dev/null)
node -e "
const fs = require('fs');
const p = '${APP}/results/live-status.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const fix = r => ({ ...r, id: r.id || r.tcId, title: r.title || r.tcTitle });
d.recentResults = (d.recentResults || []).map(fix);
d.allResults    = (d.allResults    || []).map(fix);
fs.writeFileSync(p, JSON.stringify(d, null, 2));
"
```
**Reference doc:** `core-runner.md`

---

## Behavioral Rules

Procedural steps Artemis must follow that are easy to miss. Each rule includes what
breaks when it's skipped.

<!-- Format: ### [Rule name] · Type · Applies to · Rule · Why · How to apply -->

---

### Screenshots must go in `results/screenshots/` subfolders — never the project root

**Type:** Behavioral rule
**Applies to:** All projects — every command that takes a screenshot
**Rule:** Every screenshot taken during any Artemis command must be saved to the
correct subfolder of `${APP}/results/screenshots/`:
- `bugs/` — failure evidence referenced in a bug report
- `tc-evidence/` — pass/fail evidence for a specific TC
- `explore/` — navigation discovery, selector harvesting, feature walkthroughs

Never save to the project root, `.playwright-mcp/`, or `results/screenshots/`
directly. If a tool defaults to one of those locations, move the file immediately
before continuing.
**Why:** Screenshots that default to the project root or `.playwright-mcp/`
accumulate silently across sessions, requiring manual bulk cleanup.
**What breaks when skipped:** It becomes impossible to tell which files are
referenced evidence vs. disposable auto-snapshots.

---

### "quickly test X" is a Quick Action (1 TC only) — never a full-scope run

**Type:** Behavioral rule
**Applies to:** All projects — scope detection
**Rule:** When the user says "quickly test X", "quick check on X", or "just test X" —
this is Quick Action mode. Detect the module/submodule from X, then find the single
best-matching Happy Path TC. Execute exactly 1 TC. Print a short summary. Stop.
```bash
APP=$(cat .artemis-project 2>/dev/null)
sqlite3 "${APP}/artemis.db" \
  "SELECT id, title FROM test_cases WHERE lower(title) LIKE '%[keyword]%'
   ORDER BY CASE type WHEN 'Happy Path' THEN 1 ELSE 2 END LIMIT 1;"
```
**Why:** "quickly test X" is a spot-check, not a regression sweep. Running every TC in
the matched module defeats the purpose.
**Never do:** Load every TC in the matched module/submodule and loop through them for
a Quick Action request.

---

### The pre-run confirmation gate must fire before the browser opens — including for Quick Actions

**Type:** Behavioral rule
**Applies to:** All projects — every run, every scope size
**Rule:** Before calling any navigate/browser-open action, always show a pre-run
confirmation and wait for the user:
```
🎯 Artemis — [scope label]
  URL:   [app-url]
  TC(s): [TC-ID(s) — title(s)]
  Mode:  [e.g. 1 TC / short summary]
Proceed? (confirm to run)
```
For Quick Actions specifically, reorder the startup sequence so this gate fires
**first**, ahead of any other setup step (dashboard start, status writes, etc.) —
those can still run before the browser opens, but only after the user has confirmed:
  1. Read-only lookup to find the best-match TC (auto-allowed, no prompt)
  2. **Confirmation gate** — the only user touchpoint before execution
  3. Any local setup (status file writes, dashboard start)
  4. Close any lingering browser session, then execute

**Why:** Skipping this gate — or letting other setup calls run ahead of it — means
the browser opens and starts executing before the user can catch a wrong TC selection
or wrong scope. That breaks the human-in-the-loop contract the gate exists to
guarantee.

---

### DB-first: always check for a local test-case database before reading `.md` files

**Type:** Behavioral rule
**Applies to:** All DB-mode projects (projects where a local test-case DB, e.g.
`artemis.db`, exists)
**Rule:** Before reading any `.md` test case file, check whether the project's DB file
exists. If it does, query it exclusively — never fall back to reading `.md` files for
TC loading.
**Why:** Reading `.md` files when a DB already exists wastes roughly an order of
magnitude more tokens for the same information.
**Check:**
```bash
APP=$(cat .artemis-project 2>/dev/null)
ls "${APP}/artemis.db" && echo "USE DB" || echo "USE FILES"
```
**Reference doc:** `core-runner.md` (Scope Filtering), `optimization.md`

---

### Git push gate fires after teardown whenever test-cases/ or bugs/ changed

**Type:** Behavioral rule
**Applies to:** All projects — every run, including Quick Actions
**Rule:** After the run summary, always check for uncommitted changes in the
test-case and bug-report directories:
1. Resolve the app path from `.artemis-project`
2. Confirm the app directory is a git repo — if not, print info and stop
3. Run `git status --short test-cases/ bugs/` — if no changes, skip silently
4. If changes exist → ask the user for approval, showing the changed files and an
   auto-generated commit message
5. On approval → stage, commit, and push those paths only
**Auto-generated commit message format:**
`"artemis: [module] [scope] — [N pass], [N fail], [N bugs]"`
**Why:** New/updated test cases and bug reports are session output the user wants
tracked — but pushing should never happen silently without a look at what changed.

---

### Hard gate — the execution phase must not start until the discovery→execution handoff is complete

**Type:** Hard gate — execution is blocked until all conditions pass
**Applies to:** All projects — any run that uses a browser-based discovery phase
before CLI-driven test execution
**Gate conditions (must ALL be true before executing any TC):**
  1. The discovery-phase browser session has been explicitly closed — confirmed, not
     assumed
  2. Discovery output has been partitioned into per-module JSON files (confirm at
     least one exists)
  3. A short discovery summary file has been written

**If any condition fails — stop and run the missing step before proceeding:**
  - Missing browser close → close it now
  - Missing module JSON files → run the data-split script
  - Missing summary → write it now with ONLY: module list, form field labels,
    workflow sequences

**Rule:** After the discovery phase completes (all browser snapshot calls done):
  1. Close the browser session immediately — stops snapshot accumulation in context
  2. Partition discovery data into small per-module JSON files (a few KB each)
  3. Write a discovery summary containing ONLY: module list (names + URL paths), form
     fields per module (labels only, no raw markup), key workflow sequences (verb
     sequences, e.g. "search → select → submit")
  4. The execution phase loads ONLY from those module JSON files — it never re-reads
     raw discovery/snapshot content from context
**Why:** Raw accessibility-tree/DOM snapshots (tens of KB each) stay in context after
every discovery call. Without this gate as a hard stop (not a best-effort reminder),
that raw content carries into every execution message, consuming a large fraction of
the token budget before a single test runs.
**What breaks when skipped:** The execution phase re-reads or references snapshot
content from context, carrying tens to hundreds of KB of markup into the execution
phase unnecessarily — observed cost: 40–60% of a session's budget consumed by one
feature area.

---

### Selector catalog is the source of truth — build it before generating specs

**Type:** Behavioral rule
**Applies to:** All projects with a vault-style knowledge base — catalog-building,
spec-generation, and test-execution commands
**Rule:**
- A "catalog" command builds `vault/selectors/[module].md` from discovery output +
  any hand-written feature notes
- Spec-generation reads the catalog before generating code; it warns if the catalog is
  missing
- Test execution warns (does not block) when a spec contains a
  `// TODO: verify selector` placeholder
- Confirmed selectors in the catalog are marked `✓`; unverified are `?`; broken are `✗`
- When a selector breaks in production: update the catalog entry, not the spec (a
  well-written spec self-heals via a resilient-locator fallback helper — see below)
**Why:** A discovery/explore pipeline that only writes to per-module JSON files (and
never feeds back to a persistent knowledge base) creates a dead end where every new
spec has to rediscover the same selectors from scratch. The catalog closes that loop.
**How to apply:** Build the catalog for a module before authoring any specs for it,
for every module that doesn't already have one.

---

### spec generation must follow the selector hierarchy, catalog-first

**Type:** Behavioral rule
**Applies to:** All projects — automated spec (`.spec.ts`) generation
**Rule:** When generating spec code, apply the selector hierarchy in this order:

| Level | Strategy | Example |
|-------|----------|---------|
| L1 | `getByRole()` | `getByRole('button', { name: 'Save' })` — always for buttons/links |
| L2 | `getByLabel()` | `getByLabel('First Name')` — preferred for all reactive/form-bound inputs |
| L3 | `getByText()` | `getByText('Submit')` — for static text and tab labels |
| L4 | `getByPlaceholder()` | `getByPlaceholder('Search...')` — when a label is absent |
| L5 | framework-binding attribute (e.g. `formcontrolname`, `data-testid`) | fallback only, never primary |
| L6 | CSS class | anti-pattern section only |

**For every form field, generate a resilient-locator call with 2 candidates:**
```typescript
import { tryLocator } from './helpers/resilient-locator';

const field = await tryLocator(page, [
  () => page.getByLabel('First Name'),                      // L2 — stable
  () => page.locator('input[formcontrolname="first"]'),     // L5 — fallback
]);
await field.fill(value);
```

**Before generating selectors, check `vault/selectors/[module].md`:** if the catalog
exists, use its selectors — don't guess. If missing, generate with a
`// TODO: verify selector —` prefix and warn the user.

**Why:** Framework-binding attributes (like Angular's `formcontrolname`) are
implementation details. They disappear when forms are refactored or a component
library is upgraded. `getByLabel()` survives both because it reads the visible
`<label>` element, which stays stable as long as the UI text itself doesn't change.

**Anti-patterns — never write in new specs:**
- `locator('input[formcontrolname="..."]').first()` — positional selection on form
  controls
- `locator('option').nth(N)` — magic numbers for option order
- Internal/generated framework CSS classes (e.g. `.p-multiselect-panel`,
  `[class*="...-mask"]`)
- `waitForLoadState('domcontentloaded')` after an SPA route change — a no-op once the
  app is bootstrapped
- Clicking a `getByRole('checkbox', ...)` or the raw `<input>` directly when the
  framework's styled label intercepts pointer events — see the Bootstrap checkbox
  pattern below

---

### `expect().toHaveURL` and `waitForURL` have different default timeouts

**Type:** Behavioral rule
**Applies to:** All projects — any test that verifies a URL change after a save/submit
**Rule:** Use `waitForURL(pattern, { timeout: N })` with an explicit timeout when
waiting for a redirect after a save/submit. If using `expect(page).toHaveURL(pattern)`,
always pass `{ timeout: N }` explicitly.

| API | Default timeout |
|-----|----------------|
| `expect(page).toHaveURL(pattern)` | **10,000 ms** |
| `page.waitForURL(pattern)` | **30,000 ms** |

**Why:** A save/submit that triggers a server write (draft save, form submit) can take
10–20 seconds before the redirect fires. `expect().toHaveURL()` with its 10s default
silently times out while `waitForURL()` (30s) succeeds on the same operation — a
flaky test that passes on fast runs and fails on slow ones.
**How to apply:** Whenever a step saves/submits and then asserts on the resulting URL:
```typescript
// Preferred — explicit, consistent
await page.waitForURL(/expected-pattern/, { timeout: 30000 });
// Or when using expect assertion style
await expect(page).toHaveURL(/expected-pattern/, { timeout: 30000 });
```

---

### Never file an "X is missing" structural finding from a single immediate snapshot

**Type:** Behavioral rule
**Applies to:** All projects — any finding that a dropdown option, filter, column, or
other structural element is absent
**Core principle:** Trusting an accessibility-tree/DOM snapshot as ground truth,
without a screenshot, is itself a blackbox violation — a real user never sees the DOM,
only rendered pixels. Reading the DOM directly is a white-box shortcut that can
silently diverge from what's actually on screen (pre-hydration state, async-loaded
options, opacity:0 elements). The screenshot is the actual blackbox boundary.
**Rule:** Before filing or reporting any "missing" finding (option not in a `<select>`,
filter/column absent, etc.), take the snapshot after a short settle — don't snapshot
in the same call immediately following navigation — and confirm with a second read (a
screenshot of the opened dropdown/element, or a second snapshot a beat later). Never
conclude "missing" from one snapshot taken right after navigation.
**Why:** Confirmed on a production Angular app — a set of date-filter options were
filed as missing based on a single snapshot taken immediately post-navigation. A
re-check some hours later showed all options present, confirmed via screenshot. Root
cause was undetermined (a live deploy landing mid-session vs. an async-config-load
race caught by snapshotting too soon) — either way, one immediate DOM read wasn't
sufficient evidence to file the bug.
**How to apply:** After navigating to any page whose filters/columns will be checked,
insert a brief wait (or a throwaway interaction) before the snapshot used to judge
presence/absence. If a finding is "missing," don't file it until confirmed a second
way. Stay blackbox — the second read should still be UI-only (wait + re-snapshot, or
screenshot); don't escalate to API/network inspection or backend/deploy-log digging to
explain why a finding changed between rounds.

---

### Visual state assertions require a screenshot — DOM properties alone are insufficient

**Type:** Behavioral rule
**Applies to:** All projects — any assertion involving a visual or interactive state
**Rule:** For any assertion involving a visual or interactive state, take a screenshot
to confirm the visual matches the DOM. Do not declare pass or fail from DOM properties
alone.

**Items that always require a screenshot before asserting:**
- Toggle/switch on or off — a `checked` DOM attribute does not guarantee the correct
  visual color
- Badge/status color — class names may lag the actual rendered state
- Field disabled/enabled state — a framework may visually grey out a field without
  setting the HTML `disabled` attribute
- Conditional visibility — an element can be visually hidden (`display:none`,
  `opacity:0`) while still appearing in a snapshot's text/YAML output
- Modal open/close — an overlay node may persist in the DOM after it's visually
  dismissed

**How to apply:**
1. Perform the action (click toggle, close modal, etc.)
2. Wait briefly for rendering to settle
3. Take a screenshot of the relevant element
4. Assert pass or fail based on what is visible in the screenshot, not just DOM values
5. If DOM and screenshot disagree — the screenshot is authoritative; log a
   clarification note

**Why:** Confirmed on a production Angular + Bootstrap app — a toggle-state assertion
made from a snapshot's text output said one thing (an "active" class was present)
while the actual screenshot showed the toggle correctly rendered in its off/gray
state. Trusting the snapshot text produced a false-positive bug report that cost a
full retraction cycle.

---

### Loop limit: max 3 fix-rerun iterations per spec or investigation

**Type:** Behavioral rule
**Applies to:** Any fix → re-run loop, verification pass, or open-ended investigation
**Rule:** After 3 fix → re-run cycles on the same spec file or the same failing
scenario, stop. Do not attempt a 4th iteration.

Print:
```
⛔  Max iterations reached — [N] failures remain unresolved.
    Remaining failures:
      • [TC-ID]: [symptom]
    Action: manual investigation needed — stopping here.
```
**Why:** Looping past 3 iterations rarely resolves issues that survived 3 attempts —
it burns tokens and context without producing new information. The user is the right
next actor after 3 failed attempts.
**How to apply:** Count iterations explicitly. After iteration 3, print the stop
message above and wait for user input — don't silently start iteration 4.

---

### Never declare anything out of scope from written requirements without user confirmation

**Type:** Behavioral rule
**Applies to:** Any task driven by a written requirements doc, ticket, or spec note
**Rule:** Every requirement, behavior, or acceptance criterion in the source document
is in scope until the user explicitly removes it. Never pre-filter, collapse, or
silently drop items based on your own judgment (e.g. "this is covered by existing
tests," "this seems like a separate feature," "this is forward-looking/deferred").
**How to apply:**
- List every item from the source document as a scope line before starting work
- If two items appear to overlap, list both and note the overlap — let the user decide
- If an existing test already covers a scenario, note it but still include it in scope
- Only drop a scope item if the user explicitly says to skip it
**Why:** Self-granted scope exclusions — however reasonable they seem in the moment —
have repeatedly caused missed requirements and undetected bugs in exactly the areas
that were quietly excluded. The person who wrote the requirements decides the scope,
not the agent executing them.

---

### Read the full requirements/note file before starting any scoped task

**Type:** Behavioral rule
**Applies to:** Any task tied to a linked requirements file, ticket note, or spec
document
**Rule:** The linked document must be read in full before any other step begins.
"Full" means the entire file — no line limit, no summarization, no reliance on a
cached summary from a prior session or an assumption based on the title alone. If the
file cannot be found, stop and ask.
**Why:** Scope assumptions built from a title alone routinely miss requirements
buried in the body of the document — the document is the contract, and it has to be
read fresh every time, not reconstructed from memory.

---

### On a status board, column/board position is authoritative over stale note text

**Type:** Behavioral rule
**Applies to:** Any workflow that tracks task state on a kanban-style board (Pending /
In Progress / Done / Blocked, or a project-specific variant)
**Rule:** If a card's free-text note contradicts the column it currently sits in (e.g.
a note says "waiting on a fix" but the card has been moved back to the ready-to-work
column), treat the column position as the authoritative, current signal — the note
may simply be stale. Don't argue with the board based on note text; the move itself is
the user's deliberate signal.
**Why:** Notes are written once and often go stale as a card moves through states; the
column is actively maintained by the user and reflects the current decision, even when
it contradicts what the note used to say.
**How to apply:** When auto-picking or evaluating a task from a board, trust the
column list, not the prose inside each card, for what state that task is actually in.

---

## Framework Patterns

Interaction patterns discovered for specific frameworks/component libraries that apply
universally to any app built on the same stack.

<!-- Format: ### [Pattern Name] · Type · Applies to · Rule · Why · Example code snippet -->

---

### SPA route guards block direct URL navigation

**Type:** Framework pattern
**Applies to:** All single-page apps (Angular, React, Vue, etc.) with client-side
route guards
**Rule:** Never start a test by navigating directly to a deep sub-page URL (e.g.
`/dashboard/settings`). Always enter from the app's home/landing page by clicking
through the normal navigation (a module card, a sidebar link), then let the app's own
router take you to the target page.
**Why:** Route guards redirect unauthenticated (and sometimes authenticated) users
away from direct sub-page URLs — back to login, or to the app's home — if the guard
checks for a selected context, tenant, or role before allowing entry. A user who is
logged in but hasn't "entered" a context through the UI can still be silently
redirected.
**Reference doc:** `angular-spa.md`

---

### Bootstrap custom-control checkboxes: click the label, assert the input

**Type:** Framework pattern
**Applies to:** Any app using the Bootstrap 4 `custom-control` checkbox component
**Confirmed on:** A production Angular + Bootstrap app

**Rule:** Bootstrap custom checkboxes render a hidden `<input>` under a styled
`<label>`. A locator can find the `<input>` via `getByRole('checkbox')` but can't
click it — the `<label>` intercepts all pointer events. Always click the label; use
the input only for state assertions.

```typescript
// ✓ Click — always use the label
await page.locator('label[for="exact-match"]').click();

// ✓ Assert state — use the input
await expect(page.locator('input[formcontrolname="exact"]')).not.toBeChecked();

// ✗ Never — clicks the hidden input, throws "label intercepts pointer events"
await page.getByRole('checkbox', { name: 'Exact Match' }).click();
```

**Identifying the pattern:**
- Error message: `<label for="..." class="custom-control-label">…</label> intercepts
  pointer events`
- HTML signature: `<div class="custom-control custom-checkbox">` wrapping the input +
  label

**How to find the IDs:** the `id` on `<input>` matches the `for` on `<label>`; the
framework-binding attribute (e.g. `formcontrolname`) on `<input>` is what to use for
state assertions. Both are visible in the locator error log when a click attempt
fails.

---

### Session cookies rotating on a context switch require an `afterEach` storageState save

**Type:** Framework pattern
**Applies to:** Any app that rotates its session cookie whenever the user switches
context (tenant, workspace, location, facility, etc.)
**Confirmed on:** A production Angular app with a location/facility switcher

**Rule:** Some apps rotate their session cookie every time the user switches context
via an in-app switcher (not a full re-login). After rotation, the cookies saved in a
Playwright `storageState` file are stale — the next test context restored from that
file sends the old cookie and gets redirected to login.

```typescript
const STORAGE_STATE = path.join(__dirname, '../playwright/.auth/user.json');

test.afterEach(async ({ page }) => {
  // Keep storageState current — this app rotates its session cookie on every context switch.
  await page.context().storageState({ path: STORAGE_STATE });
});
```

**Diagnosis signal:** Tests pass individually but fail sequentially after the first
test that switches context — the screenshot shows a login page. Cookie expiry is days
away (not expired); the server has simply issued a new token.
**Why:** Playwright restores `storageState` once at context creation. Cookie changes
within a test (including server `Set-Cookie` responses) live only in that context's
memory. Without `afterEach`, every new context loads the original, pre-rotation
cookie.

---

### Mid-test cookie rotation needs a response listener, not just `afterEach`

**Type:** Framework pattern
**Applies to:** Any app from the pattern above, when a single test both switches
context AND makes authenticated calls afterward, within the same test body
**Rule:** `afterEach` only saves storageState after the test ends — too late when the
test itself switches context at step N and makes authenticated calls at steps
N+1…N+k. Attach a response listener that saves storageState the moment the
context-switch API call resolves:

```typescript
import { attachContextRotationListener } from '../helpers/navigation';

test('...', async ({ page }) => {
  const stopListener = attachContextRotationListener(page);
  // ... steps that include a context switch ...
  stopListener();
});
```
**When to use which:**
- `afterEach` storageState save → baseline for any spec that switches context at all
- A mid-test response listener → add on top when a single test switches context and
  then makes calls within that same test body
- Both together → maximum safety for multi-context test suites
**Diagnosis signal:** Same as above (login-page screenshot on a later test), but
occurring even within a single test that switches context partway through.

---

### Framework action controls may not be a native `<button>` — verify the ARIA role before asserting

**Type:** Framework pattern
**Applies to:** Any component-library-based app (PrimeNG, Material, custom design
systems) — any clickable action control in a form or record view
**Confirmed on:** A production PrimeNG app

**Rule:** Before writing `getByRole('button', { name: '...' })` for a clickable
control, take a snapshot to confirm the actual ARIA role. Common mismatches:

| Looks like | Actual element | Correct selector |
|---|---|---|
| Edit/action link | `<a>` | `getByRole('link', { name: '...' })` |
| Cancel/secondary action | `<div>` with `cursor: pointer` | `getByText('...', { exact: true })` |
| Submit button | `<button>` | `getByRole('button', { name: '...' })` ✓ |

**Diagnosis signal:** `getByRole('button', ...)` times out with "element(s) not
found" but a screenshot shows the element is visible — it's present under a different
ARIA role.
**How to avoid:** Always take a snapshot before writing the assertion, not after it
fails.

---

### PrimeNG TreeTable in scrollable mode renders as two separate `<table>` elements

**Type:** Framework pattern
**Applies to:** Any PrimeNG app using `p-treeTable` with `scrollable` mode enabled
**Confirmed on:** A production PrimeNG app

**Rule:** With `scrollable` mode, PrimeNG renders a TreeTable as two separate
`<table>` elements:
- **Header table** — a distinct scrollable-header class, contains `<th>` column
  headers, zero data rows
- **Body table** — no `<th>`, contains all `<tbody tr>` data rows

A plain `page.locator('table')` selector will hit the header table first, or throw a
strict-mode violation. Split into two locator helpers:
```typescript
function tableHeader(page: Page): Locator {
  return page.locator('table.p-treetable-scrollable-header-table');
}

function tableBody(page: Page): Locator {
  return page.locator('table')
    .filter({ hasNot: page.locator('th') })
    .first();
}
```
Use the header helper for column-header assertions, and the body helper for row
interactions.
**Diagnosis signal:** `tbody tr` count is 0 despite visible data rows on screen — the
header-only table is being targeted.

---

### PrimeNG `p-dialog` has no accessible name — assert the heading inside it, not the dialog role

**Type:** Framework pattern
**Applies to:** Any PrimeNG app using the `p-dialog` component
**Confirmed on:** A production PrimeNG app

**Rule:** PrimeNG's `p-dialog` renders `[role="dialog"]` but does not set an
accessible name (`aria-label`/`aria-labelledby`) on it. `getByRole('dialog', { name:
'...' })` matches on accessible name — which is empty — so it always fails, even with
the dialog visibly open.

```typescript
// ✗ Always fails — p-dialog has no accessible name on role="dialog"
await expect(page.getByRole('dialog', { name: 'Edit Item' })).toBeVisible();

// ✓ Correct — assert the heading rendered INSIDE the dialog
await expect(page.getByRole('heading', { name: 'Edit Item' })).toBeVisible();
```
**Diagnosis signal:** `getByRole('dialog', { name: '...' })` times out despite the
dialog being visibly open; strict mode reports 0 matches.

---

### PrimeNG `p-tabview` sub-tabs are `<div>` elements — use `[role="tabpanel"]` + `getByText()`

**Type:** Framework pattern
**Applies to:** Any PrimeNG app using `p-tabview` with nested sub-tabs
**Confirmed on:** A production PrimeNG app

**Rule:** PrimeNG `p-tabview` sub-tabs render as `<div>` elements inside a
`[role="tabpanel"]` container, not as native tab elements — `getByRole('tab', { name:
'...' })` never matches them. Scope to the tabpanel and use text instead:

```typescript
const tabEl = page.locator('[role="tabpanel"]').getByText(tabName, { exact: true });
await tabEl.waitFor({ state: 'visible', timeout: 8000 });
await tabEl.click();
```
**Diagnosis signal:** `getByRole('tab', { name: '...' })` returns 0 matches despite
the sub-tab being visible — the outer top-level tabs are real `[role="tab"]`
elements, the inner sub-tabs are not.
**How to apply:** Use `[role="tabpanel"]` + `getByText()` for the inner sub-tab
click; reserve top-level `getByRole('tab')` for the outer tab bar only.

---

### File upload widgets: target the hidden `<input type="file">`, never the visible "Browse" button

**Type:** Framework pattern
**Applies to:** Any app with a custom-styled file upload control (a styled
button/dropzone that triggers a hidden native file input)
**Confirmed on:** A production Angular app

**Rule:** `page.getByRole('button', { name: 'Browse...' }).setInputFiles(...)` throws
`Error: Node is not an HTMLInputElement` — `setInputFiles()` only works on the actual
`<input type="file">`, even though clicking the visible button is what a real user
does.

```typescript
// ✗ Throws — the button only triggers the native file chooser, it isn't the input
await page.getByRole('button', { name: 'Browse...' }).setInputFiles(filePath);

// ✓ Correct — target the hidden input directly
await page.locator('input[type="file"]').setInputFiles(filePath);
```
This is unrelated to an MCP-style `browser_file_upload` tool (which handles the
native OS file-chooser dialog raised by clicking the button) — CLI-driven specs never
see that dialog and should skip straight to the underlying input.
**Diagnosis signal:** `locator.setInputFiles: Error: Node is not an
HTMLInputElement`, with the log showing the locator resolved to a `<button>`.

---

## App-Specific Quirks

<!-- Entries added here during /explore or /verify for app-specific behavior -->
<!-- Format: ### [App Name] — [Quirk description] -->

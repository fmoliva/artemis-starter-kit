# Angular SPA Patterns

Load this document when `app-guide.md` indicates Angular, or when encountering
route guard redirects, `fill()` failures, or module card navigation.

---

## Core Rules

| Problem | Wrong | Correct |
|---------|-------|---------|
| Filling login fields | `page.fill(selector, value)` | `page.locator(selector).pressSequentially(value, { delay: 50 })` |
| Clicking disabled submit | `page.click('button')` | `page.locator('button').first().click({ force: true })` |
| Navigate to module page | `page.goto('/orders/list')` | Go to `/modules` → click category tab → click module card |
| Dismissing location modal | (ignored) | Check for Cancel/Confirm button before each step, click if visible |
| Module card selector | `[class="module-card"]` | `a[class*="module-card"]` |
| Category tab selector | `[class="tabs"]` | `[role="button"][class*="tabs"]` |
| Creating new page | `context.newPage()` | `browser.newPage()` (context breaks Angular auth) |

---

## Why `fill()` Fails

Angular reactive forms require keyboard events to trigger `valueChanges` and enable
submit buttons. `fill()` bypasses the input event chain — the form stays invalid and
the button stays disabled. `pressSequentially` types character-by-character, firing
the events Angular expects.

---

## Why Direct URL Navigation Fails

Angular route guards redirect unauthenticated or context-less requests back to `/login`
or `/modules`. Even logged-in users may be blocked if the guard checks for a selected
context (location, role, facility) before allowing entry.

**Rule:** Never start a test by navigating directly to a sub-page URL. Always enter
from the app's home page, click the module card, then navigate via the sidebar.

---

## Common Patterns

### Location/Facility Modal

Many Angular HIS apps show a location selection modal on first load. Handle it:

```
1. After login, check for modal: browser_snapshot()
2. If modal visible: select location from dropdown, click Confirm
3. Continue to module navigation
```

Do this **before every test session**, not just the first TC.

### Table Row Interaction

Angular Material tables often don't respond to row clicks directly:
- Use `tr:has(td)` then click the first `td` or action button within the row
- Or use `getByRole('row')` then `getByRole('cell')` within it

### Tab Components

Angular tabs are often custom components, not native `<tab>` elements:
- Try `[role="tab"]` first
- Then `[role="button"][class*="tab"]`
- Then `getByText('Tab Label')` within the tab bar container

### Save/Submit Timing

After clicking Save on Angular forms:
- Wait for the success toast or redirect (don't immediately assert)
- `browser_wait_for(text="saved successfully")` or similar
- Angular's change detection may need a tick before the UI updates

---

## Angular Stable Fixture

**File:** `tests/fixtures/angular-stable.ts`
**Scaffolded by:** `/init` when `tech_stack` contains `angular`; or auto-installed during `/explore` on detection.

The fixture extends Playwright's base `test` with an auto-use `page` fixture that hooks
`waitForAngularStable()` on every `page.on('load')` event. Every test in a spec gets the
Angular stability wait automatically — no per-test call needed.

**Why it matters:** `page.goto()` resolves on the browser's load event, which fires *before*
Angular bootstraps, runs route guards, and renders components. Without this fixture, Angular
route guards can silently redirect 2–5 seconds after `waitForURL` resolves — causing sporadic
failures that pass in headed mode and fail in CI.

**Usage — all Angular spec files:**
```typescript
import { test, expect } from './fixtures/angular-stable';
// Replaces: import { test, expect } from '@playwright/test';
```

**Rule:** Never use `waitForTimeout(3000)` as an Angular stability substitute.
Use this fixture instead. The timeout is a symptom; the fixture is the cure.

---

## Navigation Helpers

**File:** `tests/helpers/navigation.ts`
**Scaffolded by:** `/init` when `tech_stack` contains `angular`; or added manually for apps with a context/location/tenant switcher guarded by route logic.

| Function | What it handles |
|----------|----------------|
| `waitForAngularStable(page, timeout?)` | Polls Angular's testability API until zone.js has no pending work; standalone export (complements the fixture) |
| `handleLocationDialog(page, options?)` | Dismisses a location/facility/context selection modal that some apps show right after login; waits for the app's own confirmation signal (e.g. a `localStorage` key) before returning |
| `changeLocationTo(page, location, role?)` | Switches context via the app's own context-switcher UI; saves rotated session cookies to storageState immediately |
| `attachLocationRotationListener(page, urlPattern?)` | Saves storageState mid-test on every context-change API response; returns a `stop()` function |
| `gotoModule(page, moduleHref)` | Navigates to a module via a landing page → card click (respects route guards); app-specific implementation stub |

**Rule:** Import from this helper rather than reimplementing these patterns inline in spec files. Selector drift (e.g. if the location dialog button text changes) is then fixed in one place.

```typescript
import { handleLocationDialog, changeLocationTo, gotoModule } from '../helpers/navigation';
```

**When to use which wait strategy:**
| Scenario | Use |
|---|---|
| After `page.goto()` to any Angular route | `waitForAngularStable()` |
| After any navigation to the module/landing page | `handleLocationDialog()` |
| Test needs a different context/location | `changeLocationTo()` |
| Test changes context AND makes calls in the same test body | `attachLocationRotationListener()` + `afterEach` save |

---

## PrimeNG Helpers

**File:** `tests/helpers/primeng.ts`
**Scaffolded by:** `/init` when `tech_stack=angular+primeng`; or auto-installed during `/explore` on detection.

| Function | What it handles |
|----------|----------------|
| `clickDialogButton(page, text)` | Clicks inside a `p-dialog` regardless of element type (`<a>`, `<div>`, `<button>`) |
| `selectFromMultiselect(page, label, options[])` | Opens a `p-multiselect` panel, selects by text, closes with Escape |
| `fillCascadingDropdowns(page, level1, level2, level3)` | Cascading dependent dropdowns (e.g. country → state → city): selects level 1 → `waitForResponse` → level 2 → `waitForResponse` → level 3 |
| `waitForPrimeNGMask(page)` | Waits for `.p-dialog-mask` to detach; force-removes it if stuck |
| `getTableRow(page, columnName, cellValue)` | Returns the `<tr>` locator where `columnName`'s cell equals `cellValue` |

**Rule:** Never scatter PrimeNG patterns inline in spec files. Import from this helper so
selector drift is fixed in one place, not across every spec.

```typescript
import { clickDialogButton, selectFromMultiselect, waitForPrimeNGMask } from '../helpers/primeng';
```

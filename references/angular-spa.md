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

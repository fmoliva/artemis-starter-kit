# Part 9: Selector Strategy — Self-Healing

The 8-level selector hierarchy and 3-retry self-healing protocol. Apply this during
every browser interaction in Playwright Runner, Exploratory QA, and AI Test Generation.

---

## The 8-Level Selector Hierarchy

Always attempt selectors in this order. Start at level 1 and only move down if the
previous level fails.

| Level | Strategy | Example | Stability |
|-------|----------|---------|-----------|
| 1 | `getByRole` + accessible name | `getByRole('button', { name: 'Save' })` | Highest |
| 2 | `getByLabel` | `getByLabel('Last Name')` | High |
| 3 | `getByText` | `getByText('Edit Details')` | High |
| 4 | `getByPlaceholder` | `getByPlaceholder('Search patients...')` | Medium-High |
| 5 | `getByTestId` (data-testid) | `getByTestId('allergy-save-btn')` | High (when present) |
| 6 | CSS class selector | `.btn-primary`, `.allergy-form input` | Medium |
| 7 | CSS positional | `table tr:nth-child(2) td:first-child` | Low — use only as last resort |
| 8 | XPath | `//button[contains(@class, 'save')]` | Emergency only |

**Rule:** If you reach level 6 or below, annotate the selector in the `.spec.ts` comment
as "fragile — candidate for /improve".

---

## The 3-Retry Self-Healing Protocol

When an element cannot be found:

### Attempt 1 — Primary Semantic Selector
Try the most stable selector from the hierarchy.
```
getByRole('button', { name: 'Save' })
```
If not found → proceed to Attempt 2.

### Attempt 2 — Alternative Semantic Selector
Try a different strategy from the hierarchy.
```
getByText('Save')
// or
getByLabel('Save')
```
If not found → proceed to Attempt 3.

### Attempt 3 — DOM Inspection
Call `browser_snapshot` to get the actual current DOM structure.
Look for:
- An element with matching text content
- An element with a similar role
- An element near expected position with related attributes

Derive a new selector from what is actually in the DOM.

If all 3 attempts fail → **Mark FAIL:**
```
Element not found: Save button on allergy form
Tried:
  1. getByRole('button', { name: 'Save' })
  2. getByText('Save')
  3. browser_snapshot inspection — no Save button found in current DOM state
Screenshot: tc-044-element-not-found.png
```

---

## The 85% Confidence Threshold

When Attempt 3 requires deriving a selector from DOM inspection, assess confidence:

- **High confidence (>85%):** Element found with matching text AND matching role
  → Use it, note in `.spec.ts` comment: `// Derived from snapshot — consider adding data-testid`
- **Medium confidence (60-85%):** Element found with matching text but role unclear
  → Use it, annotate: `// [!] Medium-confidence selector — flag for /improve`
- **Low confidence (<60%):** Best guess based on proximity or partial match
  → Use it for this run only, annotate: `// [!] LOW CONFIDENCE — needs manual verification`
  → Add to the improvement log for next `/improve` run

---

## Fragile Selector Anti-Patterns

Never use these unless all other options are exhausted:

| Anti-Pattern | Why It's Fragile | Better Alternative |
|-------------|-----------------|-------------------|
| `nth-child(3)` without context | Breaks if a row is added above | `getByText('specific row content')` |
| Generated class names: `.sc-abc123` | Changes on every build | `getByRole` or `data-testid` |
| Hardcoded pixel coordinates | Breaks on any layout change | Semantic locators |
| Long CSS chains: `div > section > div:nth-child(2) > button` | Breaks on any DOM restructure | `getByRole('button', { name: 'Edit' })` |
| XPath with index: `//tr[3]/td[1]` | Breaks on data change | `getByText('specific cell value')` |

---

## Selector Documentation in `.spec.ts`

When writing generated test files, always comment the selector choice:

```typescript
// Good: self-documenting semantic selector
await page.getByRole('button', { name: 'Save' }).click();

// Medium: using placeholder (stable for inputs without labels)
await page.getByPlaceholder('Search patients...').fill('Silva');

// Flagged: derived from snapshot, candidate for improvement
await page.locator('.allergy-form .save-action').click();
// [!] Fragile CSS selector — add data-testid="allergy-save-btn" to improve

// Emergency XPath — document why
await page.locator('xpath=//button[contains(@class, "save") and @type="submit"]').click();
// [!] XPath emergency selector — getByRole failed, needs UI data-testid
```

---

## Improvement Tracking

When a selector fails and is healed during a test run:
1. Note it in the run log: `"Selector healed for TC-044 Step 3: updated from getByRole to getByText"`
2. Add to the improvement recommendations in the results report:
   `"TC-044: Save button selector is fragile — recommend adding data-testid='allergy-save-btn' to the component"`
3. When `/improve` is run, this flagged selector will be on the 5-axis review list

---

## Common Selector Patterns for HIS App

Reference patterns that work reliably in the HIS application:

```typescript
// Navigation
page.getByRole('link', { name: 'Medical History' })
page.getByRole('link', { name: 'Edit Details' })

// Form actions
page.getByRole('button', { name: 'Save' })
page.getByRole('button', { name: 'Cancel' })
page.getByRole('button', { name: 'Add' })

// Modal
page.getByRole('dialog')
page.getByRole('button', { name: 'Close' })

// Tables
page.getByRole('table')
page.getByRole('row', { name: 'Silva' })
page.getByRole('cell', { name: 'Active' })

// Alerts / toasts
page.getByRole('alert')
page.getByText('Saved successfully')

// Patient search
page.getByLabel('Last Name')
page.getByLabel('First Name')
page.getByPlaceholder('Search...')
```

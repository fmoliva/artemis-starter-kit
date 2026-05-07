# Context Vault Reference — `/context [module]`

Zero-browser workflow. Reads a human-written Obsidian vault to generate TCs and Playwright
`.spec.ts` files without any Playwright MCP calls.

---

## Startup

```bash
APP=$(cat .artemis-project 2>/dev/null | head -1)
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2)
VAULT="${VAULT/#\~/$HOME}"   # expand ~ to absolute path
```

If `VAULT` is empty → tell user to add `context_vault=<path>` to `.artemis-project` and stop.

---

## Step 1 — Read Vault Files (no browser)

Read in this order, enforcing line limits to protect token budget:

| File | Limit |
|------|-------|
| `[VAULT]/_app-overview.md` | 80 lines |
| `[VAULT]/_test-data.md` | 80 lines |
| `[VAULT]/modules/[module]/_module.md` OR `module.md` | 60 lines |
| `[VAULT]/modules/[module]/*.md` (all feature files, skip `_module.md`/`module.md`) | 100 lines each |

If a file is missing → skip silently, continue with what exists.

### Step 1b — Resolve Wikilinks

After reading each file, scan for `[[link]]` patterns and resolve:
- `[[_filename]]` → read `[VAULT]/_filename.md` (60 line limit)
- `[[module/feature]]` → read `[VAULT]/modules/module/feature.md` (60 line limit)
- `[[feature]]` (no path) → read `[VAULT]/modules/[module]/feature.md` (60 line limit)

Rules:
- Skip files already read this session (no double-read)
- Hard cap: 3 additional files resolved per `/context` run (token guard)
- If file not found → skip silently

---

## Step 2 — Read Existing TCs

```bash
ls [APP]/test-cases/[module]/
```

Read each TC file (skip INDEX.md). Extract TC IDs + titles + types already covered.

---

## Step 2b — Read Selector Catalog

**Read this BEFORE wikilink resolution** — the catalog is too large for the 3-file wikilink cap.

```bash
ls "${VAULT}/selectors/${MODULE}.md" 2>/dev/null && echo "CATALOG_EXISTS"
```

- If found: read with **limit 300 lines** — this is the full selector map for the module
- If missing: warn the user:
  ```
  ⚠️  No selector catalog found for: [module]
      Run /catalog [module] to build the verified selector map before authoring specs.
      Selectors generated without a catalog will be marked // TODO: verify selector
  ```

This step bypasses the wikilink 3-file cap and 60-line limit. The wikilink in the module file
(`[[../selectors/[module]]]`) is for Obsidian navigation only — Claude reads the catalog here.

---

## Step 3 — Read Explore Data (selectors)

```bash
cat [APP]/results/modules/[module].json 2>/dev/null
```

Extract `pageDetails[].inputs`, `pageDetails[].dropdowns`, `pageDetails[].buttons` for
selector hints. If file absent → rely on vault feature files and TC step descriptions.

---

## Step 4 — TC Gap Detection

For each feature described in vault files:
1. Check if a Happy Path TC exists covering that feature
2. Check if a corresponding Edge Case TC exists
3. Check if an Error Handling TC exists (for any form-submit or data-load feature)
4. Check if a Security TC exists (for any text input field)

**Gaps found → generate new TCs using these templates:**

### Edge Case template
```
### TC-[PREFIX]-NNN: [Feature] — [edge condition]
**Module:** [module] — [submodule]
**Type:** Edge Case
**Priority:** High
**Preconditions:** [state required]
**Steps:**
1. [steps]
**Expected Result:**
[what should happen]
```

### Error Handling template
```
### TC-[PREFIX]-NNN: [Feature] — [error condition]
**Type:** Error Handling
**Priority:** Medium
```

### Security template (for text inputs)
```
### TC-[PREFIX]-NNN: XSS Probe in [field] on [view]
**Type:** Security
**Priority:** Critical
**Steps:**
1. Enter `<script>alert('xss')</script>` in [field]
**Expected Result:**
No alert dialog. Script is escaped or rejected.
```

**Gate:** Present all new TCs to user for approval before writing.
After approval: write to `[APP]/test-cases/[module]/` + run `node [APP]/scripts/migrate-tcs.js`.

---

## Step 5 — Spec Generation

### File naming
One spec per submodule: `[APP]/tests/[module]-[submodule-slug].spec.ts`
Example: `tests/[module]-[feature-slug].spec.ts`

### Auth setup — storageState (not per-test login)

Auth uses a saved browser session via `storageState` — no `login()` call in `beforeEach`.

**Check before generating:**
1. Does `[APP]/tests/global-setup.ts` exist?
   - Yes → skip creation
   - No → create it:

```typescript
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const baseURL = process.env.APP_URL || '[APP_BASE_URL]';
  await page.goto(`${baseURL}/login`);
  await page.getByRole('textbox', { name: 'Username' }).fill(process.env.APP_USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.APP_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: path.join(__dirname, '../playwright/.auth/user.json') });
  await browser.close();
}
export default globalSetup;
```

2. Does `[APP]/playwright.config.ts` have `globalSetup` and `storageState`?
   - No → add both:
     - `globalSetup: './tests/global-setup'`
     - `storageState: './playwright/.auth/user.json'` inside `use`
     - `dotenv.config()` call at the top (before `defineConfig`)
3. Does `playwright/.auth/` exist? If not → `mkdir -p [APP]/playwright/.auth`
4. Is `playwright/.auth/` in `.gitignore`? If not → add it.

### Trigger path gate (modals and tab-sections only)

Before writing `beforeEach` for any feature with `subtype: modal` or `subtype: tab-section`:

1. Read `## Navigation to Trigger` in the feature's vault file.
   - **Present:** use the `Playwright path` field verbatim to build `beforeEach`. Never infer the trigger from prose or description.
   - **Missing:** write a placeholder `beforeEach` with `// TODO: confirm trigger navigation — run /explore first` and warn the user before completing the spec.

2. Check `_navigation-flow.md` for a named journey matching this feature.
   - If no journey entry: add one derived from the trigger section. Print: `Added Journey N to _navigation-flow.md — [feature name]`.

---

### Spec structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('[Module] — [Submodule]', () => {

  test.beforeEach(async ({ page }) => {
    // Auth via storageState in playwright.config.ts — no login() needed
    await page.goto('/[target-url]');
    // sub-tab click if needed
    // For modal features: use Playwright path from ## Navigation to Trigger in vault
  });

  test('TC-XXX-NNN: [title]', async ({ page }) => {
    // translated steps
    // assertions from Expected Result
  });

});
```

### Selector resolution (in priority order)
1. Vault feature file "Selector hints" section
2. `results/modules/[module].json` field names → `page.getByLabel('[name]')`
3. TC step text → parse field names → `page.getByRole('textbox', { name: '[label]' })`
4. Role-based fallback: `page.getByRole('button', { name: '[text]' })`
5. nth() fallback: `page.getByRole('combobox').nth(N)` — only when label unavailable
6. Leave `// TODO: verify selector` comment if none of the above resolves it

### Step translation patterns
| TC step pattern | Playwright code |
|----------------|-----------------|
| "Enter X in [Field] field" | `await page.getByLabel('[Field]').fill('X')` |
| "Click the [Button] button" | `await page.getByRole('button', { name: '[Button]' }).click()` |
| "Select [Option] from [Dropdown]" | `await page.getByRole('combobox', { name: '[Dropdown]' }).selectOption('[Option]')` |
| "Observe / Verify [element] visible" | `await expect(page.getByRole(...)).toBeVisible()` |
| "Navigate to [url]" | `await page.goto('[url]')` |
| "Click the [Tab] tab/sub-tab" | `await page.getByText('[Tab]').click()` |

### Assertion patterns (from Expected Result)
| Expected result phrase | Playwright assertion |
|-----------------------|----------------------|
| "table appears / is visible" | `await expect(page.getByRole('table')).toBeVisible()` |
| "N Results shown" | `await expect(page.getByText(/\d+ Results/)).toBeVisible()` |
| "button is disabled" | `await expect(page.getByRole('button', { name: '...' })).toBeDisabled()` |
| "error message / empty state" | `await expect(page.getByText('[message]')).toBeVisible()` |
| "no alert dialog / no XSS" | `page.on('dialog', d => { throw new Error('XSS: dialog fired') })` |
| "column header visible" | `await expect(page.getByRole('columnheader', { name: '...' })).toBeVisible()` |
| "navigates to [url]" | `await expect(page).toHaveURL(/[url-pattern]/)` |

---

## Step 6 — Gate + Write

Present spec outline (test names only, not full code) for user approval.
After approval: write spec files.

Then:
```bash
cd [APP] && npx playwright test --list
```

Report: files written, TC count, any `// TODO` selectors that need manual review.

After writing spec files, update markdown INDEX files:
```bash
# Update test-cases/[module]/INDEX.md TC count per file
# Update test-cases/INDEX.md total counts
node [APP]/scripts/migrate-tcs.js
```
Then manually correct the TC count rows in both INDEX.md files to match actual file contents.

---

## Step 6b — Next Steps Output

After writing spec files, always print this block (substitute real values):

```
📋  Next steps for [feature]:

  1. /explore [url]    — harvest live selectors, confirm // TODO entries, update catalog
  2. /verify [feature] — run spec → auto-fix remaining failures → record Last Green

  Selectors that need live confirmation before /verify will be reliable:
    • [list each // TODO: verify selector comment from the spec — field name + line number]

  Skip /explore only if the spec has zero // TODO comments.
```

If the spec has zero `// TODO: verify selector` comments: omit the selector list and note that
`/verify` can be run directly.

---

## playwright.config.ts Check

On every `/context` run, verify baseURL starts with `https://`.
If missing → fix automatically (no gate needed, non-destructive).

---

## Token Budget for `/context`

| Action | Snapshots | Expected tokens |
|--------|-----------|-----------------|
| Read vault files | 0 | ~2K |
| Read TC files | 0 | ~3K |
| Read explore JSON | 0 | ~1K |
| Write specs | 0 | ~2K output |
| **Total** | **0** | **~8K** |

Compare to `/run` one TC via MCP: 15–40K tokens.

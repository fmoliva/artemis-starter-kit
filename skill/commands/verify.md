Load the artemis skill, then execute the /verify command with these arguments: $ARGUMENTS

The /verify command runs the Playwright spec for a module, diagnoses failures, auto-fixes
selector issues, confirms catalog entries, and gates any new universal patterns into skill-learnings.md.

Read references/context-vault.md before starting (for vault path resolution).

---

## What /verify does

### Startup
```bash
APP=$(cat .artemis-project 2>/dev/null | head -1)
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
MODULE=$ARGUMENTS   # e.g., "auth" or "dashboard search"
```

---

### Step 0 — Check explore status

Read `${VAULT}/_pipeline.md` and find the row for the feature being verified.

**If Explored column is `—`:**
- Scan the spec file for `// TODO: verify selector` comments
- If any found, print:

  ```
  ⚠  Selectors unverified — consider running /explore [url] first.
  Unconfirmed selectors in this spec:
    • [selector description] (line N)
    ...
  Proceeding anyway — expect selector failures on the TODO lines.
  ```

- Continue to Step 1 (do NOT block)

**If Explored date is earlier than Last Updated:**
- Print: `⚠  Explore data may be stale (explored [date], spec updated [last-updated]). Re-run /explore [url] if selectors changed.`
- Continue to Step 1

**If Explored date is present and ≥ Last Updated:** no warning, continue normally.

---

### Step 1 — Locate spec
```bash
ls "${APP}/tests/${MODULE}"*.spec.ts 2>/dev/null
```
- If found: proceed
- If not found: stop and tell user to run `/context [module]` first

---

### Step 2 — Run via Playwright CLI
```bash
cd "${APP}" && npx playwright test "${SPEC_FILE}" 2>&1
```
Capture: total tests, pass count, fail count, and the full error block for each failure.

Print a one-line status after the run:
```
▶  [N] passed  [N] failed  ([spec-file])
```

---

### Step 3 — Classify each failure

Read the error output and classify using this table:

| Error signature | Classification | Auto-fixable |
|----------------|---------------|-------------|
| `intercepts pointer events` | Bootstrap custom checkbox — click label not input | ✓ Yes |
| `tryLocator: none of N candidates resolved` | Both selectors broken — catalog update needed | ✓ Yes |
| `locator...not found` or timeout on known selector | Selector completely changed | ✓ Attempt |
| `Expected: X, Received: Y` | Logic/data issue — wrong assertion or test data | ✗ No — flag to user |
| Network error / auth redirect | Environment issue | ✗ No — flag to user |
| `waitForURL` timeout | Page never navigated to expected URL | ✗ No — flag to user |

For each non-auto-fixable failure: print `⚠️  TC-XXX: [reason] — needs manual review` and continue
to the next test. Do not block the run on unfixable failures.

---

### Step 4 — Auto-fix selector failures

For each auto-fixable failure:

1. **Read the catalog entry** for the failing element:
   ```bash
   cat "${VAULT}/selectors/${MODULE}.md" 2>/dev/null | grep -A3 "[element-name]"
   ```

2. **Apply the fix** based on classification:

   **Bootstrap custom checkbox (`intercepts pointer events`):**
   - In the spec: replace `locator.click()` with `page.locator('label[for="<id>"]').click()`
   - For assertions: use `page.locator('input[formcontrolname="<name>"]')` — not the label
   - In the catalog: update entry to `✓` with note `Bootstrap pattern — click label, assert input`

   **Both tryLocator candidates failed (`none of N candidates resolved`):**
   - Open MCP browser to visually inspect the element on the live page (Gate: announce before opening)
   - Find the working selector
   - Update both the spec and catalog with the new candidate
   - Mark broken candidates `✗` in catalog

   **Single selector broken (primary only):**
   - Check if the fallback (formcontrolname) still works
   - If yes: the spec self-heals automatically on next run (tryLocator will use fallback)
   - Update catalog: mark broken primary `✗`, note fallback is active

3. **Write the spec fix** (Edit tool)
4. **Write the catalog fix** (Edit tool) — add `✓` and `confirmed: YYYY-MM-DD`

Max 3 fix→re-run iterations. After 3: stop, list remaining failures, tell user manual investigation needed.

---

### Step 5 — Re-run after fixes
```bash
cd "${APP}" && npx playwright test "${SPEC_FILE}" 2>&1
```
Repeat Step 2–4 until all auto-fixable failures are resolved or max iterations reached.

---

### Step 6 — Confirm catalog entries (green run only)

After a fully green run, scan `${VAULT}/selectors/${MODULE}.md` for all `?` entries.

For each `?` entry whose field appeared in the passing spec (match by getByLabel name or
formcontrolname):
- Update to `✓ (run-confirmed YYYY-MM-DD)`

**Why this works:** `tryLocator` tries the primary selector (getByLabel) first. A passing test
means the primary candidate resolved. Mark it confirmed. Leave the fallback as-is.

Print a confirmation table:
```
Catalog confirmations — vault/selectors/[module].md
  ✓  Last Name (getByLabel) — confirmed
  ✓  First Name (getByLabel) — confirmed
  ?  Month (getByLabel) — not exercised this run (TC-003 skipped)
```

---

### Step 7 — Learnings gate

After the green run, check if any auto-fix pattern discovered in Steps 3–4 is NOT already
documented in `references/skill-learnings.md`.

**What qualifies as universal:** a pattern that applies to any module using the same framework
component — not a data issue or a one-off app bug.

If a new universal pattern is found, show this gate:

```
🔔 New universal pattern detected — add to skill-learnings.md?

  Section: Framework Patterns
  Title:   [pattern name]
  Rule:    [one-line rule]
  Why:     [reason it applies universally]
  Example: [code snippet]

  Add to skill-learnings.md? (yes / skip)
```

On approval → append to `references/skill-learnings.md` under `## Framework Patterns`.
On skip → do nothing.

---

### Final Report

```
✅  /verify [module] — complete

  Spec:      tests/[spec-file].spec.ts
  Result:    [N] passed, [N] auto-fixed, [N] flagged for manual review
  Catalog:   [N] entries confirmed ✓, [N] still unverified ?
  Learnings: [N] new patterns added / skipped

Next steps:
  • Routine runs: npx playwright test (zero tokens)
  • On failure: paste error → Claude fixes catalog + spec → /verify confirms
```

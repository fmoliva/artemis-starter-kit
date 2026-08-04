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

**Screenshot path rule:** All screenshots taken during /verify must be saved to `${APP}/results/screenshots/tc-evidence/` (for passes) or `${APP}/results/screenshots/bugs/` (for failures). Never save to the project root or `.playwright-mcp/`.

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

### Step 0.5 — Load feature vault context and dependencies

Locate the feature's vault file:
```bash
# Check cross-module first, then modules/
ls "${VAULT}/cross-module/${MODULE}.md" 2>/dev/null || \
find "${VAULT}/modules" -name "${MODULE}.md" 2>/dev/null | head -1
```

If found: read it (limit 80 lines) and extract the `depends_on:` frontmatter list.
For each item in `depends_on:`, read the corresponding vault file (limit 80 lines each).

Store this as **Navigation Context** — it describes prerequisite states, alternative
access routes, and shared selectors. Use it in Step 3 when navigation fails.

If no vault file found: continue without Navigation Context, but note that navigation
dead-ends cannot be cross-referenced against vault docs.

Also read `${APP}/results/artemis-learnings.md` (limit 60 lines) — scan for prior findings on
this feature. If a prior entry shows a confirmed blocker (server bug, permission requirement,
test-data issue), treat it as authoritative context before running tests.

**Evidence Tier declaration (one line):** state which tier applies before running —
`Tier A (UI-only)` by default, or `Tier B (UI + API/DB)` only if this module's scope is
confirming data reaches a downstream destination (data-mapping / sync validation). Under
Tier B the rendered UI still wins if it disagrees with a raw API/DB value — see SKILL.md
"Evidence Tier."

---

### Step 1 — Locate spec
```bash
ls "${APP}/tests/${MODULE}"*.spec.ts 2>/dev/null
```
- If found: proceed
- If not found: stop and tell user to run `/context [module]` first

---

### Step 1b — Check for a corresponding UI-behavior spec

Some projects split functional assertions from pure UI-behavior assertions (visual
state, enabled/disabled, styling) into a companion spec file. After locating the
functional spec, derive the module prefix and check for a UI-behavior counterpart:

```bash
# Prefix matching — longest match wins
# e.g., "checkout-forms-shipping" → "checkout-forms"
# e.g., "checkout-cart-summary" → "checkout"
for prefix in "${MODULE}" "${MODULE%%-*}" cross-module; do
  UI_SPEC="${APP}/tests/ui-behavior/${prefix}-ui-behavior.spec.ts"
  [ -f "$UI_SPEC" ] && echo "found:$UI_SPEC" && break
done
```

**If found:** print `🎨 UI behavior spec found: tests/ui-behavior/[file] — will run after functional spec`

**After Step 5** (final green functional run), run the UI-behavior spec separately:
```bash
cd "${APP}" && npx playwright test "tests/ui-behavior/${prefix}-ui-behavior.spec.ts" 2>&1
```
- Report results on a separate line: `▶  UI Behavior: [N] passed  [N] failed  [N] skipped`
- Classify and auto-fix UI-behavior failures using the same Step 3–5 process
- Include UI-behavior results in the Final Report
- Update `_pipeline.md` for the UI-behavior feature row if all UI-behavior tests pass or skip

**If not found:** skip silently — not every feature has a UI-behavior spec.

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
| `toBeVisible` timeout but screenshot shows element IS visible | Role mismatch — element is present under a different ARIA role (e.g. `<a>` not `<button>`, `<div>` not `<button>`) | ✓ Attempt — take MCP snapshot to confirm actual role |
| Login page in screenshot after a state-changing test in a suite that runs sequentially | Session rotation — stored auth cookies are stale; add `afterEach` storageState save to spec | ✓ Yes — add afterEach save |
| Network error / auth redirect | Environment issue | ✗ No — flag to user |
| `waitForURL` timeout (no 5xx detected) | Navigation dead-end — check Navigation Context for alternative path | ✓ Attempt |
| Element absent from an expected list/table | Navigation dead-end — check Navigation Context for alternative path | ✓ Attempt |
| `waitForURL` timeout with 5xx detected | Page never navigated due to server error — STOP | ✗ No — stop immediately |
| `waitForURL` timeout (environment/auth issue) | Environment issue — flag to user | ✗ No — flag to user |
| **HTTP 5xx response** (visible in network log or toast) | **Backend/server bug — STOP** | ✗ No — stop immediately |
| **DB error** (`SQLSTATE`, constraint violation, type-mismatch error) | **Backend/server bug — STOP** | ✗ No — stop immediately |
| **System administrator message** in UI | **Backend/server bug — STOP** | ✗ No — stop immediately |

For each non-auto-fixable failure: print `⚠️  TC-XXX: [reason] — needs manual review` and continue
to the next test. Do not block the run on unfixable failures.

**Navigation Dead-End Protocol:**
If a test step fails because the expected element is not reachable via the primary route
(item not in a list, page didn't navigate, button not visible at current URL):
1. Check the **Navigation Context** loaded in Step 0.5 for an alternative path
   - Example: item not in the default list view → navigate via search instead
2. If an alternative path is found:
   - Update the spec step to use the alternative navigation
   - Add a comment in the spec noting why the alternative is used
   - Add a "Navigation Notes" entry to the feature's vault file
3. If no alternative found after checking Navigation Context:
   a. Log a preliminary entry in `${VAULT}/known-bugs.md` with status `Unconfirmed — navigation dead-end; needs user input` (feature, symptom, routes already checked)
   b. Stop immediately — do NOT write a new script, try another route, or re-enter this protocol
   c. Ask the user: which element was not found, which routes were tried, and what Navigation Context says

**STOP rule — server-side blockers (mandatory):**
If any failure is classified as a backend/server bug (5xx, DB error, system admin message):
1. **Stop all retry/workaround attempts immediately** — do not loop
2. Print:
   ```
   🛑  BLOCKED — Backend bug detected
       Feature:  [module/feature]
       TCs:      [list of affected TC IDs]
       Error:    [exact error message]
       Evidence: [HTTP status + endpoint + DB message]
       Action:   Needs backend fix — cannot be resolved by spec changes
   ```
3. Log the bug in `${VAULT}/known-bugs.md` under the appropriate feature
4. Update `_pipeline.md`: mark feature row with `⚠ blocked — server bug [date]`
5. **Move on to the next feature** — do not attempt any further runs against the blocked feature

---

### Step 4 — Auto-fix selector failures

#### MCP-First Rule (MANDATORY)

**Before attempting any code fix for a selector or navigation failure, take an MCP snapshot to visually confirm the page state.** Do not guess at fixes from error text alone.

| Failure type | MCP action before fixing |
|---|---|
| `intercepts pointer events` | `browser_screenshot` — identify what element is overlaying the target |
| `locator not found` / timeout on any element | `browser_snapshot` — confirm element role, text, and DOM position |
| `waitForURL` timeout (non-auth, non-5xx) | `browser_screenshot` — see where the page actually landed |
| `getByRole(...)` finds nothing | `browser_snapshot` scoped to the section — confirm actual ARIA role vs assumed |

**Why:** Error messages describe symptoms, not root causes. A `getByRole('link')` timeout could mean the element is a `<div>`, a `<button>`, or blocked by an overlay — three different fixes. A snapshot resolves this in seconds. Fixing blind can burn multiple re-run iterations on the wrong approach.

Navigate to the failing page state using the same navigation path the test uses, then take the snapshot. If the page requires prior steps (login, a dismissible dialog, tab click), replay those steps first.

---

For each auto-fixable failure:

1. **Take an MCP snapshot** (per MCP-First Rule above) — confirm actual page state before reading the catalog or writing any fix

2. **Read the catalog entry** for the failing element:
   ```bash
   cat "${VAULT}/selectors/${MODULE}.md" 2>/dev/null | grep -A3 "[element-name]"
   ```

3. **Apply the fix** based on classification:

   **Overlay blocking click (`intercepts pointer events`):**
   - Screenshot to identify the blocking element (overlay mask, dialog, animation)
   - If it's a component-library modal mask: dismiss/remove it before the click, replaying any dismissible-dialog handler the app requires
   - If Bootstrap custom checkbox: replace `locator.click()` with `page.locator('label[for="<id>"]').click()`
   - In the catalog: update entry to `✓` with a note describing the pattern used

   **Both tryLocator candidates failed (`none of N candidates resolved`):**
   - Snapshot already taken (MCP-First Rule) — use it to find the working selector
   - Update both the spec and catalog with the new candidate
   - Mark broken candidates `✗` in catalog

   **Single selector broken (primary only):**
   - Check if the fallback (formcontrolname) still works
   - If yes: the spec self-heals automatically on next run (tryLocator will use fallback)
   - Update catalog: mark broken primary `✗`, note fallback is active

4. **Write the spec fix** (Edit tool)
5. **Write the catalog fix** (Edit tool) — add `✓` and `confirmed: YYYY-MM-DD`

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

### Step 8 — Update Pipeline Tracker (MANDATORY)

After every verify run — pass or fail — update `${VAULT}/_pipeline.md` for the feature row:

| Outcome | Columns to update |
|---------|------------------|
| All tests pass | **Last Green** = today's date; clear any `⚠` |
| Partial pass (some auto-fixed) | **Last Green** = today's date; note auto-fixes in commit/summary |
| All fail / blocked | Leave Last Green unchanged; record blocker in session notes |
| Spec was patched during this run | **Last Updated** = today's date |

Do this **before** printing the Final Report. The pipeline is the authoritative source of truth for
what is green — if it is not updated, future sessions will waste tokens re-verifying already-green specs.

---

### Step 8.5 — Append to artemis-learnings.md (UNCONDITIONAL)

After every verify run — pass or fail — append one entry to `${APP}/results/artemis-learnings.md`:

```
## [DATE] — /verify [feature] | [passed N / failed N / blocked] | [new finding or 'none'] | [blocked TCs or 'none']
```

For blocked runs: include the blocker type (server bug / navigation dead-end / permission issue), the
exact error or missing prerequisite, and which TCs are affected.

For green runs with no new findings: write `none` in the last two columns — the timestamp still
proves the spec was last green on this date.

Create the file if it does not exist. This file is loaded at Step 0.5 — entries here prevent
re-investigation of known issues in future sessions.

---

### Final Report

```
✅  /verify [module] — complete

  Spec:      tests/[spec-file].spec.ts
  Result:    [N] passed, [N] auto-fixed, [N] flagged for manual review
  Catalog:   [N] entries confirmed ✓, [N] still unverified ?
  Learnings: [N] new patterns added / skipped
  Pipeline:  _pipeline.md updated — Last Green [YYYY-MM-DD]

Next steps:
  • Routine runs: npx playwright test (zero tokens)
  • On failure: paste error → Claude fixes catalog + spec → /verify confirms
```

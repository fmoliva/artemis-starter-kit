# Part 7: Test Improvement Agent

Enters **Improve Mode**: senior QA code review mindset. Every test must justify its existence.
The test suite is a codebase — it accrues technical debt, and `/improve` is how you pay it down.

---

## When to Run `/improve`

Trigger a full improvement pass when:

- After a major feature release (new pages added, existing flow changed)
- After 5+ new bugs discovered in a module (test gaps are present)
- Suite runtime exceeds 30 minutes (redundancy and inefficiency have crept in)
- False positives start appearing (tests passing when they shouldn't, or failing on irrelevant UI changes)
- After adding 10+ new TCs from `/explore` or `/parse` (quality check before they settle in)
- Before a release — final quality gate on the test library

---

## The 5-Axis Improvement Review

Score every test case on these 5 axes. Each axis has a scoring rubric.

---

### Axis 1: Redundancy

**Question:** Does this test cover a path already covered by another test?

**What to look for:**
- Two TCs with identical or near-identical steps
- Two TCs that differ only in test data but test the same validation rule (often consolidatable into one parameterized test)
- A regression TC that duplicates a happy path TC after a bug was fixed

**Actions:**
- **Exact duplicate:** Remove one — note: `"Removed TC-NNN: exact duplicate of TC-NNN"`
- **Near duplicate:** Consolidate into a single parameterized TC with a test data table
- **Redundant after fix:** Retire if regression TC fully supersedes the original

**Score:** 0 = no redundancy / 1 = minor overlap / 2 = clear duplicate

---

### Axis 2: Coverage Gaps

**Question:** What does the suite NOT test that it should?

**What to look for:**
- Forms with no edge case tests (empty, max-length, special characters)
- Features with only happy path tests — no error handling, no boundary values
- New pages in the app with no corresponding TCs
- Security probes missing from any form that accepts user input
- States not covered: empty list, single item, maximum items, concurrent edit

**Actions:**
- List the gap explicitly: `"Gap: /orders/export has no test for empty export (0 orders)"`
- Generate new TCs if gap is High priority (use part-10-ai-test-generation.md methodology)
- Present new TCs for user approval before adding to the file

**Score:** 0 = no gaps / 1 = minor gaps / 2 = significant gaps / 3 = critical path untested

---

### Axis 3: Assertion Strength

**Question:** Would this test pass with a broken implementation?

**Weak assertion signs:**
- Expected result is "page loads" or "form submits" — too vague
- No specific text, element, or value is verified
- Test checks that an element exists but not what it contains
- Test navigates to a page but never asserts the page rendered correctly

**Strengthening patterns:**

| Weak | Strong |
|------|--------|
| "Save button is clicked" | "Toast 'Saved successfully' appears within 2 seconds" |
| "User is redirected" | "URL changes to /dashboard and sidebar shows 'Maria Silva'" |
| "Form submits" | "New allergy 'Peanuts' appears in the allergy banner" |
| "Error is shown" | "Error message 'Please fill required fields' appears in red below the Save button" |
| "Record is updated" | "Record row for 'Silva, Maria' shows updated value 'Penicillin' in the Allergy column" |

**Actions:**
- Rewrite weak expected results with specific, observable outcomes
- Add a second assertion if the first only covers visibility (also check the value)

**Score:** 0 = all assertions specific / 1 = some weak / 2 = many weak / 3 = most tests would pass with any implementation

---

### Axis 4: Selector Fragility

**Question:** Are any selectors likely to break with a routine UI change?

**Fragile selector signals in test steps or notes:**
- Step says: "Click the third row's action button" → positional
- Step says: "Find the `.sc-abc123` element" → generated class name
- Selector in `.spec.ts` comment is annotated `// [!] Fragile` or `// [!] LOW CONFIDENCE`
- Step uses pixel coordinates instead of semantic locators

**What to check:**
1. Read the corresponding `.spec.ts` file if it exists
2. Search for `nth-child`, `nth-of-type`, hardcoded coordinates, generated class patterns
3. Review Improvement Tracking notes from the last run (logged in the TC file)

**Actions:**
- Flag selectors for update: `"TC-051 Step 3: CSS positional selector — recommend adding data-testid='save-btn'"`
- Rewrite `.spec.ts` selector using the 8-level hierarchy from part-9-selector-strategy.md
- Add to improvement recommendations: `"Add data-testid to the allergy save button to stabilize TC-051"`

**Score:** 0 = all semantic / 1 = a few fragile / 2 = many fragile / 3 = majority positional/generated

---

### Axis 5: Test Independence

**Question:** Does this test silently depend on another test's state?

**Dependency signals:**
- Preconditions say: "TC-044 must run first" or "Patient must have been created by previous test"
- No `beforeEach` login step — assumes user is already logged in from prior test
- Edits a record created by a different test
- Checks a count that depends on how many previous tests ran

**The independence rule:** Every TC must be executable in isolation. Starting from a fresh browser session and logged-in state (or with explicit login steps), the test should be able to run and produce the same result regardless of what ran before it.

**Actions:**
- Add explicit preconditions: "Create a fresh patient record 'Silva, Maria' before this test"
- Add login step to tests that assume already-logged-in state
- Replace shared state with test-specific data

**Score:** 0 = fully independent / 1 = minor assumptions / 2 = depends on prior tests / 3 = suite order-dependent

---

## Improvement Workflow

### Step 1: Read the Test File
Read the full `test-cases/[file].md` before making any assessments.
Do not score from memory — review actual content.

### Step 2: Score on 5 Axes
For each axis, list specific TCs that need attention.

Present a findings summary before making any changes:

```
## /improve Findings — test-cases/qc-his-test-cases.md

### Axis 1: Redundancy (Score: 1 — minor overlap)
- TC-046 and TC-051 have near-identical steps — consider consolidating

### Axis 2: Coverage Gaps (Score: 2 — significant gaps)
- /orders/export: no empty-state test
- Allergy form: no concurrent-edit test, no special character test
- TC-NEW-073 through TC-NEW-076 generated (see below for review)

### Axis 3: Assertion Strength (Score: 1 — some weak)
- TC-048: Expected result says "form submits" — does not verify data persisted

### Axis 4: Selector Fragility (Score: 1 — a few fragile)
- TC-051 Step 3: annotated as fragile CSS positional in spec file

### Axis 5: Test Independence (Score: 0 — fully independent)
- No issues found

---

Proposed changes:
1. Consolidate TC-046 + TC-051
2. Strengthen TC-048 assertion
3. Add TC-NEW-073 through TC-NEW-076 (pending your approval)
4. Flag TC-051 Step 3 selector for dev to add data-testid

Apply these changes? (y to apply / modify / skip specific items)
```

### Step 3: Get Approval
Never apply changes without presenting findings and receiving confirmation.
User may approve all, modify, or skip specific items.

### Step 4: Apply Changes
Apply only the approved changes. For each:
- Edit the TC in the file
- Note the change in the Improvement History section (see below)

### Step 5: Append Improvement History

Add or update the `## Improvement History` section at the bottom of the test file:

```markdown
---

## Improvement History

### YYYY-MM-DD — Artemis /improve run

**Axes reviewed:** Redundancy, Coverage Gaps, Assertion Strength, Selector Fragility, Independence

**Changes applied:**
- TC-045: Strengthened assertion — now checks specific error message text, not just element visibility
- TC-046: Removed — duplicate of TC-044 (identical steps and assertion)
- TC-NEW-073 to TC-NEW-076: Added security probe tests for the Allergy form
- TC-051: Selector fragility flag added — CSS positional in Step 3; recommend data-testid

**Coverage gaps identified (not yet addressed):**
- /orders/export: no empty-state test (Medium priority)
- Allergy form: no concurrent-edit test (Low priority)
```

---

## Living Test Library Rules

The `test-cases/` directory is a versioned artifact. Follow these rules to maintain its integrity:

### Adding a New Feature
1. Create a new `### Feature:` section under the appropriate `## Module:`
2. Add TCs starting from the next available TC number
3. Update the Module row in the index table (add feature name, expand TC range, update count)

### Adding a New Module
1. Create a new `## Module:` section at the bottom of the file
2. Add the module as a new row in the index table at the top

### Adding Edge Cases to Existing Feature
1. Append new TCs after the last TC in that feature
2. Update the TC range in the index table (e.g., TC-044–TC-060 → TC-044–TC-064)
3. Update the count in the index table

### Updating an Existing TC
1. Edit the TC in place
2. Add a comment at the end of the TC block:
   ```
   **Last Modified:** YYYY-MM-DD by Artemis /improve — [what changed]
   ```

### Retiring a TC
1. Do NOT delete the TC
2. Add `**Status:** RETIRED — [reason] — YYYY-MM-DD` to the TC block
3. Leave the TC ID in place — do not reuse the number

### File Format Rules
- Module headers: `## Module: [Name]`
- Feature headers: `### Feature: [Name]`
- TC headers: `#### TC-NNN: [Name]`
- Separator between TCs: `---`
- Index table at the top of the file, before first Module
- Improvement History section at the very bottom of the file

---

## Coverage Completeness Scoring

After an `/improve` run, calculate the overall test suite health score:

| Dimension | Score | Weight |
|-----------|-------|--------|
| Feature breadth (% of known features with at least 1 TC) | /10 | 30% |
| Edge case depth (% of features with edge + error cases) | /10 | 25% |
| Error handling (% of features with error/validation TCs) | /10 | 20% |
| Security coverage (% of forms with security probes) | /10 | 15% |
| Regression coverage (% of known bugs with regression TCs) | /10 | 10% |

**Weighted Score = (Feature × 0.30) + (Edge × 0.25) + (Error × 0.20) + (Security × 0.15) + (Regression × 0.10)**

Report as: `Suite Health: 7.4 / 10 — needs attention in security coverage (3/10)`

Include this score in the `/improve` summary and in the QA + Performance Report coverage section.

---

## Rebuild TC List After Improvement

After any `/improve` session that adds, modifies, or removes test cases, rebuild the manual QA checklist:

```bash
node [app-name]/scripts/build-dashboard.js
```

Then print:

```
✓ artemis-tc-list.html updated — N test cases across M modules
  Open: open /path/to/artemis-tc-list.html
```

Do this silently at the end of the session — the user should not need to ask.

# Part 6: Bug Analyzer Agent

Enters **Analyst Mode**: root cause > symptoms. Reproduce minimally. Enrich via Jam.dev.
Never write a bug report from a symptom description alone — always investigate the cause.

> **Canonical bug path:** All bug reports must be written to `[app-name]/results/bugs/` — this is the only path `server.js` reads for the live dashboard. Never write to a root-level `bugs/` folder. Use the format in `examples/bug-report-template.md` (`## BUG-NNN: Title` heading + `**Field:** value` inline fields + `### Section` blocks).

---

## Analyst Mindset

- **Symptoms are clues, not the bug.** "Button doesn't work" is a symptom. The bug is
  "onClick handler throws TypeError because formData.value is undefined at line 142."
- **Reproduce before analyzing.** If you can't reproduce it consistently, note the
  reproduction rate and the conditions under which it occurred.
- **Minimum reproduction is the goal.** Start with the full user path, then strip out
  steps one by one until you have the shortest sequence that reliably triggers the bug.
- **Layer matters.** UI bugs, API bugs, data bugs, and state management bugs require
  different fix approaches. Identify the layer before writing the report.

---

## Root Cause Framework

Determine which layer the bug lives in:

| Layer | Indicators | Examples |
|-------|-----------|---------|
| **UI Bug** | Visible in screenshots, no network errors, DOM issue | Missing validation, wrong element styled, modal not closing |
| **API Bug** | Network request returns 4xx/5xx, payload malformed | 400 on valid input, 500 on edge case, wrong status code |
| **Data Bug** | Record saved incorrectly, wrong value persisted | Blank field saved, incorrect default value, cascade not updating |
| **State Management Bug** | Works once, breaks on second try; depends on prior action | State not reset, stale cache, session data leaking between users |
| **Timing / Race Condition** | Intermittent, works under slow conditions | Double-submit, save before load completes, concurrent edit conflict |

Use this to fill the "Root Cause Hypothesis" field in the bug report.

---

## Reproduction Minimization Protocol

1. Write out the full reproduction path from how the tester discovered it
2. Remove the last step — does the bug still occur?
3. Remove another step — still occurring?
4. Continue until removing any step makes the bug disappear
5. That's your minimum reproduction

**Example:**
- Full path: Login → Navigate to Triage → Search patient → Open record → Go to Medical History → Edit Allergies → Leave blank → Save
- Minimum: Navigate to /medical-history/allergies/edit → Leave blank → Save

---

## Severity Classification

| Severity | Definition | Examples |
|----------|-----------|---------|
| **Critical** | Blocks a core user flow; no workaround exists | Login failure, data loss on save, crash on essential page |
| **High** | Impairs a major feature; workaround exists but is painful | Form validation missing, filter returns wrong results, export broken |
| **Medium** | Affects a secondary feature; easy workaround | Wrong error message text, incorrect sort order, hover state missing |
| **Low** | Cosmetic or very minor UX issue | Typo, alignment off by a few pixels, tooltip missing |

---

## Jam.dev Enrichment Workflow

When a Jam recording URL is available for a failed test:

1. **Get console errors:**
   ```
   getConsoleLogs(jamId, logLevel: "error")
   getConsoleLogs(jamId, logLevel: "warn")
   ```
   Extract: error message, file, line number, stack trace

2. **Get failed network requests:**
   ```
   getNetworkRequests(jamId, statusCode: "4xx")
   getNetworkRequests(jamId, statusCode: "5xx")
   ```
   Extract: method, URL, status code, response body excerpt

3. **Get user event timeline:**
   ```
   getUserEvents(jamId)
   ```
   Use to reconstruct the exact sequence of user actions leading to the bug.

4. **Add enriched comment to Jam:**
   ```
   createComment(jamId, body: [markdown summary below])
   ```

**Comment format for Jam:**
```markdown
## Artemis Bug Analysis — [TC-XXX: Test Name]

**Severity:** High
**Root Cause Hypothesis:** API bug — POST /api/allergies returns 200 but saves empty record

**Console Errors:**
- `TypeError: Cannot read property 'value' of undefined` at allergy.js:142

**Failed Network Requests:**
- None (server returned 200 with empty body — silent failure)

**Reproduction Steps (minimum):**
1. Navigate to /medical-history/allergies/edit
2. Leave all fields blank
3. Click Save

**Expected:** Validation error message shown, form not submitted
**Actual:** Form submitted with 200 OK, empty allergy record created

**Regression Test Added:** TC-NEW-070
```

---

## Bug Report Fields

Every bug report must include ALL of these:

| Field | Required | Notes |
|-------|----------|-------|
| Bug ID | Yes | Format: BUG-[YYYYMMDD]-[seq] e.g. BUG-20250311-001 |
| Title | Yes | Concise: "[Feature] — [What went wrong]" |
| Environment | Yes | URL, date, browser |
| Severity | Yes | Critical / High / Medium / Low |
| Reproduction Rate | Yes | Always / Intermittent (X of Y attempts) / Once observed |
| Minimum Steps | Yes | Shortest sequence to trigger |
| Expected Result | Yes | What should happen |
| Actual Result | Yes | What actually happened |
| Screenshot | Yes | Filename or "none" |
| Console Errors | If available | From browser DevTools or Jam.dev |
| Failed Network Requests | If available | Method, URL, status, response excerpt |
| Jam Recording URL | If available | Link to Jam session |
| Root Cause Hypothesis | Yes | Which layer + specific cause theory |
| Suggested Fix Direction | Yes | Brief, non-prescriptive direction |
| Regression TC | Yes | TC ID of the regression test case added |

See `examples/bug-report-template.md` for the full template.

---

## Regression Test Prescription

After every bug report, always generate a regression test case that:
- Directly targets the exact failure path (minimum reproduction steps)
- Has a specific expected result (the fixed behavior)
- Is marked `Type: Regression`
- Is appended to `test-cases/` under the appropriate module/feature

Example: After TC-046 FAIL (empty allergy save accepted), generate:

```markdown
#### TC-NEW-070: Allergy form rejects save with all blank fields (Regression — BUG-20250311-001)

**Preconditions:**
- User is logged in
- On /medical-history/allergies/edit page

**Steps:**
1. Leave all allergy fields blank
2. Click "Save"

**Expected Result:**
- Validation error "Please fill in required fields" is shown
- No allergy record is created in the system

**Priority:** High
**Type:** Regression
**Added by:** Artemis Bug Analyzer
**Date Added:** 2025-03-11
```

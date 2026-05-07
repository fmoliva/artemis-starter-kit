# Part 10: AI Test Generation

Used by the `/generate` command and during the Exploratory QA phase. Artemis enters
**Planner Mode**: think like a QA lead designing a test strategy from scratch.

---

## The Explore-First Principle

**Never write test cases from a description alone.** Always navigate to the feature
in the browser first.

1. Navigate to the target URL
2. Call `browser_snapshot` to get the full DOM structure
3. Identify ALL interactive elements:
   - Every form field (text, number, date, file, checkbox, radio, dropdown)
   - Every button and action link
   - Every table with sortable columns, filters, pagination, row actions
   - Every accordion, tab, modal trigger
   - Required vs. optional field indicators (asterisks, labels)
   - Default values and pre-populated data
4. Map the complete interaction surface before generating any test cases

---

## Generation Hierarchy

Generate test cases in this order. Do not skip levels.

### Level 1: Happy Path
The primary, intended user flow with valid data.
- One test per major action (add, edit, delete, search, submit, export)
- Use realistic test data (see HIS test data in `references/part-3-playwright-runner.md`)

### Level 2: Boundary Values
Tests at the limits of valid input.
- Maximum allowed length (fill the field to the limit)
- Minimum required value (1 character, value of 0, earliest allowed date)
- Exactly at the boundary (not over, not under)

### Level 3: Null / Empty / Invalid Input
Tests that probe validation behavior.
- Leave required fields empty and attempt to submit
- Enter only whitespace in required text fields
- Enter values of the wrong type (text in number fields, invalid dates)
- Select no option in a required dropdown

### Level 4: Security Probes
Apply to every form. Do not skip even when not explicitly requested.
- **XSS:** `<script>alert('xss')</script>` in every text field
- **SQL Injection:** `' OR '1'='1` in every text field
- **Long string:** 10,000-character string in text inputs
- **Special characters:** `!@#$%^&*()_+-=[]{}|;':"./<>?` in text inputs
- **Unicode / emoji:** `日本語テスト`, `👾`, Arabic text in name fields

### Level 5: Concurrency
Tests that probe simultaneous or repeated actions.
- Rapid double-click on submit buttons
- Submit the same form twice quickly
- Open the same record in two tabs and edit both

### Level 6: Error Recovery
Tests that probe what happens when something goes wrong.
- Network timeout during save (simulate via slow connection)
- Navigate away mid-form and return — is data preserved?
- Session expiry mid-action

### Level 7: Accessibility (when applicable)
- Tab through all fields — is focus order logical?
- Submit form using only keyboard
- Verify all fields have visible labels (not just placeholder text)

---

## Test Data Matrix

Apply this matrix to every form/input discovered:

| Input Type | Valid Example | Invalid Example | Edge Case |
|------------|--------------|-----------------|-----------|
| **Text field** | "John Smith" | null, "", "   " (spaces only) | 10,000 chars, emoji `👾`, `<script>alert(1)</script>`, `' OR '1'='1`, Arabic/Chinese chars |
| **Number field** | 42, 0 | -1, 999999999, "abc" | MAX_INT (2147483647), 0.1+0.2 precision, NaN |
| **Date field** | Today's date, valid past date | Feb 30, month 13 | Leap day (Feb 29), DST boundary, year 9999 |
| **File upload** | Valid PDF <5MB | 0-byte file, .exe, .js | File with Unicode in name, 100MB file, no extension |
| **Dropdown** | Any valid option | None selected (if required) | First option, last option, only option |
| **Checkbox** | Checked, unchecked | — | Check then immediately uncheck |
| **Email field** | user@example.com | "notanemail", "@", "a@" | user+tag@sub.domain.com, very long email |
| **Phone field** | +63 912 345 6789 | "abcdefg", "123" | International format, leading zeros, spaces |

---

## Security Probe Library

Insert these values into every text input field during security testing:

```
XSS basic:           <script>alert('xss')</script>
XSS img:             <img src=x onerror=alert(1)>
XSS event:           " onmouseover="alert(1)
SQL injection:       ' OR '1'='1
SQL injection 2:     '; DROP TABLE users; --
Path traversal:      ../../../etc/passwd
CRLF injection:      %0d%0aHeader: injected
Long string:         [10,000 character 'a' string]
Null byte:           \x00
Unicode overlong:    %C0%AE (overlong encoding of '.')
```

---

## Coverage Completeness Scoring

Before presenting generated test cases to the user, score the suite on this 10-point rubric:

| Check | Points |
|-------|--------|
| At least 1 happy path test per major action | 2 |
| At least 1 boundary value test per form field | 1 |
| At least 1 null/empty test per required field | 1 |
| At least 1 security probe per form | 2 |
| At least 1 error handling test (invalid input shows error) | 1 |
| Tests cover all discovered interactive elements | 1 |
| Tests are independent (no test assumes another's state) | 1 |
| Each test has a specific, verifiable expected result | 1 |
| **Total** | **/10** |

Present the score to the user. If score < 7, explain what's missing before proceeding.

---

## User Approval Workflow

Never save or execute AI-generated test cases without user approval.

Present like this:

```
Generated 8 test cases for Feature: Allergy Form (/medical-history/allergies/edit)
Coverage Score: 9/10 (missing: concurrent save test)

TC-NEW-070: User adds allergy with valid food entry (Happy Path)
TC-NEW-071: User saves allergy with blank fields — validation error expected (Null Input)
TC-NEW-072: User enters 10,000-character allergy note — truncation or error expected (Boundary)
TC-NEW-073: User enters <script>alert(1)</script> in allergy description (XSS Probe)
TC-NEW-074: User enters ' OR '1'='1 in allergy name field (SQL Injection Probe)
TC-NEW-075: User selects allergy type then deselects — no type selected at save (Edge Case)
TC-NEW-076: User saves allergy with Unicode characters in notes field (Unicode)
TC-NEW-077: User cancels mid-form — data is not saved (Error Recovery)

Save to test-cases/qc-his-test-cases.md and execute now? (y/n)
Or: Save only / Execute only / Modify first
```

Wait for explicit user choice before proceeding.

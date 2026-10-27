# Test Case Template

Two formats are supported: the **Standard Format** for manually written or parsed test
cases, and the **AI-Generated Extended Format** for test cases produced by `/generate`
or `/explore`.

---

## Standard Format

```markdown
## Module: [Module Name]

### Feature: [Feature Name]

#### TC-XXX: [Test Case Name]

**Preconditions:**
- [State that must be true before this test runs]
- [e.g., "User is logged in as a nurse", "Patient Doe, Jane exists in the system"]

**Steps:**
1. [Specific action with specific values — e.g., "Navigate to /medical-history"]
2. [Specific action — e.g., "Click 'Edit Details' on the Allergies card"]
3. [Specific action — e.g., "Fill 'Food' field with 'Peanuts'"]
4. [Specific action — e.g., "Click 'Save'"]

**Expected Result:**
- [Specific observable outcome — e.g., "Toast message 'Saved successfully' appears"]
- [Second outcome if applicable — e.g., "'Peanuts' appears in the allergy banner"]

**Priority:** High / Medium / Low
**Type:** Happy Path / Edge Case / Error Handling / Security / Regression
**Added by:** Manual / Artemis /generate / Artemis /explore
**Date Added:** YYYY-MM-DD
```

---

## AI-Generated Extended Format

Used when Artemis generates test cases via `/generate` or during exploratory testing.
Includes additional metadata for traceability and self-healing support.

```markdown
#### TC-XXX: [Test Case Name]

**AI Generation Context:**
- Discovered via: browser snapshot of [URL] on [date]
- Coverage category: [Boundary Value / Null Input / Security Probe / Error Handling / etc.]
- Generation trigger: [what UI element or flow prompted this test]

**Preconditions:**
- [State]

**Steps:**
1. [Action with exact values — e.g., "Enter '    ' (4 spaces) in the Last Name field"]
2. [Action]
3. [Action]

**Expected Result:**
- [Specific expected outcome]

**Test Data Used:**
| Field | Value | Rationale |
|-------|-------|-----------|
| Last Name | "    " (4 spaces) | Whitespace-only input — should fail validation |
| [Field] | [Value] | [Why this value was chosen] |

**Self-Healing Notes:**
- Primary selector: [e.g., `getByLabel('Last Name')`]
- Fallback selectors: [`getByPlaceholder('Last name')`, `getByRole('textbox', { name: 'Last Name' })`]
- Confidence: High / Medium / Low

**Priority:** High / Medium / Low
**Type:** Edge Case / Security Probe / Error Handling / Boundary Value
**Added by:** Artemis /generate
**Date Added:** YYYY-MM-DD
```

---

## Test Case File Structure

All test case files in `test-cases/` follow this hierarchy:

```markdown
# [Application Name] — Test Cases

## Test Case Index

| Module | Features | TC Range | Count |
|--------|----------|----------|-------|
| Authentication | Login, Location Selection | TC-001–TC-003 | 3 |
| Triage | Patient Search, Registration | TC-004–TC-013 | 10 |
| Medical History | Allergies, Past Medical, Medication | TC-044–TC-072 | 29 |

---

## Module: Authentication

### Feature: Login

#### TC-001: User logs in with valid credentials

**Preconditions:**
- Application is accessible at target URL
- Valid nurse credentials exist

**Steps:**
1. Navigate to the login page
2. Enter username "nurse@example.com"
3. Enter password "[valid password]"
4. Click "Login"

**Expected Result:**
- User is redirected to the dashboard
- Navigation bar shows the logged-in user's name

**Priority:** High
**Type:** Happy Path
**Added by:** Manual
**Date Added:** 2025-01-15

---

#### TC-002: Login fails with wrong password

**Preconditions:**
- Application is accessible at target URL

**Steps:**
1. Navigate to the login page
2. Enter username "nurse@example.com"
3. Enter password "wrongpassword123"
4. Click "Login"

**Expected Result:**
- Error message "Invalid credentials" is displayed
- User remains on the login page
- Password field is cleared

**Priority:** High
**Type:** Error Handling
**Added by:** Manual
**Date Added:** 2025-01-15
```

---

## Numbering Rules

- TC IDs are sequential across the entire file (TC-001, TC-002, ... TC-999)
- When adding new test cases, find the highest existing TC number and continue from there
- Never reuse or skip TC numbers
- If a TC is removed, its number is retired — do not reassign it

---

## Improvement History

When `/improve` is run on a test case file, append a history section at the bottom:

```markdown
---

## Improvement History

### 2025-03-11 — Artemis /improve run

**Axes reviewed:** Redundancy, Coverage Gaps, Assertion Strength, Selector Fragility, Independence

**Changes applied:**
- TC-045: Strengthened assertion — now checks specific error message text, not just element visibility
- TC-046: Removed — duplicate of TC-044 (identical steps and assertion)
- TC-NEW-223 to TC-NEW-226: Added security probe tests for the Allergy form (XSS, SQL injection, long string, unicode)
- TC-048, TC-051: Updated selectors from CSS positional to `getByLabel` — flagged as fragile

**Coverage gaps identified (not yet addressed):**
- Allergy form: no test for concurrent save by two users
- Patient Search: no test for special characters in name search field
```

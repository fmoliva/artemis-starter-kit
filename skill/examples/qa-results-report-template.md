# QA + Performance Report Template

Copy this structure for every `results/qa-results-[YYYY-MM-DD].md` file.

---

```markdown
# QA + Performance Report

## Run Metadata

| Field | Value |
|-------|-------|
| **Application URL** | https://[target-url] |
| **Date & Time** | YYYY-MM-DD HH:MM |
| **Browser** | Chromium (Playwright MCP) |
| **Agent** | Artemis v2.0 |
| **Scope** | [All / Module: X / Feature: Y / TC range: TC-001–TC-010] |
| **Test Cases File** | test-cases/[filename].md |
| **Run By** | [User name or "Artemis automated run"] |

---

## Executive Summary

[2-3 sentences on overall application health. Lead with the most critical finding.
Example: "The application is largely functional with 37 of 42 scripted tests passing.
A critical bug was found in the [feature] save flow where empty fields are accepted
without validation, creating a data integrity risk. Load testing revealed the login
endpoint degrades significantly under stress (P95 latency 980ms at 500 VUs)."]

**Overall Health: 🟢 Healthy / 🟡 Needs Attention / 🔴 Critical Issues**

---

## Results Overview

| Status | Count |
|--------|-------|
| ✅ PASS | X |
| ❌ FAIL | X |
| 🚫 BLOCKED | X |
| ⏭ SKIP | X |
| **Total Scripted** | **X** |
| **Newly Discovered** | X |

---

## Detailed Results

### ✅ Passed Tests

| TC | Name | Notes |
|----|------|-------|
| TC-001 | Login with valid credentials | — |
| TC-002 | Login fails with wrong password | Error message verified |
| TC-003 | [Name] | [Notes] |

---

### ❌ Failed Tests

#### TC-046: [Test Name] — FAIL

**Severity:** Critical / High / Medium / Low

**Steps Executed:**
1. Navigated to /[module]/[feature]/edit
2. Left all required fields blank
3. Clicked "Save"

**Expected Result:**
- Validation error message "Please fill in required fields" appears
- Form does not submit

**Actual Result:**
- No validation error shown
- Form submitted with blank entry
- Empty record now appears in list

**URL at Failure:** https://[target-url]/[module]/[feature]/edit
**Screenshot:** tc-046-fail.png
**Console Errors:** `TypeError: Cannot read property 'value' of undefined at [script].js:142`
**Failed Network Requests:** None
**Jam Recording:** https://jam.dev/c/[uuid] (if available)

---

#### TC-[XXX]: [Test Name] — FAIL

[Repeat block for each failure]

---

### 🚫 Blocked Tests

| TC | Name | Reason |
|----|------|--------|
| TC-047 | [Name] | Login required — no credentials provided |
| TC-052 | [Name] | CAPTCHA prevents automated testing |

---

### ⏭ Skipped Tests

| TC | Name | Reason |
|----|------|--------|
| TC-060 | [Name] | Out of scope for this run |

---

## Exploratory Discoveries

Tests discovered during the Exploratory QA phase that are NOT in the current test suite.

| ID | Page / Feature | What Was Found | Priority |
|----|----------------|----------------|----------|
| TC-NEW-001 | /[module]/edit | Empty save accepted without validation | High |
| TC-NEW-002 | /[module]/search | Search with `<script>` tag — no XSS protection visible | High |
| TC-NEW-003 | /[module] | Export button with no items selected — no feedback | Medium |
| TC-NEW-004 | /dashboard | Loading spinner appears but never disappears on slow connection | Medium |

**Full list of discovered TCs pending approval:** [Y/N — run `/improve` to add them]

---

## Performance Section

### Load Test Results

| Endpoint | Scenario | VUs | Duration | Avg Latency | P95 Latency | Error Rate | Status |
|----------|----------|-----|----------|-------------|-------------|------------|--------|
| POST /api/login | Baseline | 50 | 60s | 120ms | 280ms | 0.1% | ✅ Pass |
| POST /api/login | Stress | 500 | 5 min | 410ms | 980ms | 2.3% | ⚠️ Warn |
| GET /api/[resource] | Baseline | 50 | 60s | 95ms | 200ms | 0% | ✅ Pass |
| GET /api/[resource] | Spike | 1000 | 30s | 890ms | 3,200ms | 12% | ❌ Fail |

**k6 Scripts Generated:** `load-tests/login-baseline.js`, `load-tests/login-stress.js`, `load-tests/[resource]-spike.js`

### Performance Observations (Functional Testing)

Pages noted as slow during functional test execution:

| Page | Observed Load Time | Notes |
|------|--------------------|-------|
| /dashboard | ~4.2s | Likely large payload — check network tab |
| /[module]/history | ~3.8s | Pagination may help |

*These are observations, not test failures.*

---

## Coverage Summary

| Area | Pages Discovered | Pages Tested | Coverage |
|------|-----------------|--------------|----------|
| Authentication | 2 | 2 | 100% |
| [Module 1] | 5 | 4 | 80% |
| [Module 2] | 8 | 6 | 75% |
| [Module 3] | 4 | 2 | 50% |
| **Total** | **19** | **14** | **74%** |

**Untested Pages:** /[module]/history, /[module]/export, /settings/profile, /settings/roles, /reports/monthly

---

## Recommendations

### 🔴 Critical — Fix Before Release

1. **TC-046: [Feature] form accepts empty save** — No input validation on required fields.
   Empty records are created in the database. Fix: add server-side validation.
2. **Spike test failure on GET /api/[resource]** — 12% error rate at 1000 VUs with P95 >3s.
   Fix: add database query optimization and connection pooling.

### 🟠 High Priority

3. **TC-NEW-002: Potential XSS in [feature] search** — `<script>` tag in search field was
   not escaped in the response. Needs security review.
4. **POST /api/login stress test warning** — P95 latency reaches 980ms at 500 VUs.
   Consider rate limiting and session caching.

### 🟡 Observations

- `/dashboard` and `/[module]/history` load times exceed 3 seconds. Not failures, but
  user experience impact at scale.
- TC-047 and TC-052 were blocked due to automation limitations (login wall, CAPTCHA).
  Recommend running these manually or adding test credentials.

### Next Steps

1. Fix empty-save validation bug (Critical — TC-046)
2. Run security review on [feature] search endpoint
3. Optimize login and [resource] API under load
4. Run `/improve test-cases/[module]-test-cases.md` to add discovered TCs to the library
5. Retest TC-046 and TC-NEW-002 after fixes

---

## Generated Artifacts

| File | Description |
|------|-------------|
| `tests/[module]-[feature].spec.ts` | Playwright test for [Feature] — 4 tests, 3 passing |
| `load-tests/login-baseline.js` | k6 baseline load test for POST /api/login |
| `load-tests/login-stress.js` | k6 stress test for POST /api/login (ramp to 500 VUs) |
| `load-tests/[resource]-spike.js` | k6 spike test for GET /api/[resource] (1000 VUs) |
```

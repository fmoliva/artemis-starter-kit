# Coverage Matrix Template

Use this template for the `/coverage` command output.
Save as `results/coverage-matrix-[YYYY-MM-DD].md`.

---

```markdown
# Coverage Matrix
**Application:** [Application Name]
**URL:** https://[target-url]
**Generated:** YYYY-MM-DD
**Test Cases File:** test-cases/[filename].md

---

## Interaction Coverage by Feature

This matrix shows which test types are covered for each feature.
TC-XXX = covered by that test case | — = gap | [!] = weak assertion (flag for /improve)

| Feature | Happy Path | Boundary | Null/Empty | Invalid Input | Security Probe | Error Handling | Regression | Total |
|---------|------------|----------|------------|---------------|----------------|----------------|------------|-------|
| **Authentication / Login** | TC-001 | — | TC-002 | TC-003 | TC-NEW | — | — | 3 |
| **[Module] / [Feature 1]** | TC-004 | TC-005 | TC-006 | TC-007 | — | TC-008 | — | 5 |
| **[Module] / [Feature 2]** | TC-009 | TC-010 | TC-011 | — | — | TC-012 | — | 4 |
| **[Module 2] / [Feature]** | TC-044 | TC-045 | — | TC-046 | — | — | — | 3 |
| **[Feature]** | ... | ... | ... | ... | ... | ... | ... | N |

**Legend:**
- TC-XXX = covered
- — = gap (no test case)
- [!] = covered but assertion is weak (candidate for `/improve`)

---

## Page Coverage

| Page / URL | Status | Test Cases | Untested Interactions |
|------------|--------|------------|-----------------------|
| /login | ✅ Tested | TC-001, TC-002, TC-003 | — |
| /dashboard | ⚠️ Partial | TC-003 | Export button, notification bell, date filter |
| /[module]/[feature] | ✅ Tested | TC-004–TC-008 | — |
| /[module]/[feature-2] | ❌ Untested | — | Sort, filter, export, row click, pagination |
| /settings/profile | ❌ Untested | — | All fields, photo upload, password change |
| /reports/monthly | ❌ Untested | — | Date range picker, export, print |

**Status Legend:** ✅ All major interactions covered | ⚠️ Partial coverage | ❌ No coverage

---

## Coverage Health Score

Scoring on 5 axes, 0–100% each:

| Axis | Score | Status | Notes |
|------|-------|--------|-------|
| **Feature breadth** (% features with ≥1 TC) | 72% | 🟡 | 8 of 11 features have at least one test |
| **Edge case depth** (% features with ≥2 edge TCs) | 45% | 🔴 | Only 5 of 11 features have edge case coverage |
| **Error handling** (% features with ≥1 error TC) | 55% | 🟡 | 6 of 11 features have error path tests |
| **Security coverage** (% forms with ≥1 security probe) | 30% | 🔴 | Only 3 of 10 forms have XSS/SQL injection tests |
| **Regression coverage** (% known bugs with a regression TC) | 60% | 🟡 | 3 of 5 known bugs have a dedicated regression test |
| **Overall** | **52%** | 🔴 | |

**Score Thresholds:**
- 🟢 80–100%: Healthy coverage
- 🟡 60–79%: Needs attention
- 🔴 Below 60%: Critical gaps

---

## Highest-Risk Coverage Gaps

Ranked by risk (impact × likelihood):

| Rank | Feature | Missing Coverage | Risk | Recommended Action |
|------|---------|-----------------|------|--------------------|
| 1 | [Feature] form | Security probes, null input | High | Run `/generate` on /[module]/[feature]/edit |
| 2 | [Module] / History | All test types | High | Run `/explore` on /[module]/history |
| 3 | [Feature] form | Edge cases, error handling | Medium | Add 3 TCs manually or via `/generate` |
| 4 | Settings / Profile | All test types | Medium | Run `/explore` on /settings/profile |
| 5 | Login | Security probes | Medium | Run `/generate` for security tests |

---

## Recommended Next Steps

1. Run `/generate https://[url]/[module]/[feature]` to add security + null input TCs
2. Run `/explore https://[url]/[module]/history` to discover and test untested page
3. Run `/improve test-cases/[filename].md` to strengthen weak assertions ([!] entries)
4. After fixes: re-run `/coverage` to confirm improvement
```

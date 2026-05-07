# Bug Agent — /bug, /improve, /scope

Subagent context for analysis commands. No browser, no startup sequence.
Read only the sections relevant to the command being executed.

---

## `/bug [description-or-jam-url]`

Deep analysis of a single failure. Enter **Analyst Mode**.

### Root Cause Framework

1. **Reproduce** — If browser available, navigate to failure point. Otherwise, analyze from description + existing screenshots/logs.
2. **Classify layer:**
   - UI layer (render, selector, CSS)
   - API layer (4xx/5xx, timeout, wrong response)
   - Data layer (missing record, wrong format, constraint violation)
   - State layer (stale cache, wrong session, race condition)
   - Timing layer (async race, animation interference, lazy load)
3. **Severity:**
   - **Critical** — Data loss, security breach, complete feature failure
   - **High** — Major feature broken, no workaround
   - **Medium** — Feature partially works, workaround exists
   - **Low** — Cosmetic, minor UX issue

### Jam.dev Enrichment (when Jam URL available)

1. `getConsoleLogs` filtered by `error` + `warn` → extract JS errors
2. `getNetworkRequests` filtered by `4xx`/`5xx` → extract failed API calls
3. `getUserEvents` → interaction timeline leading to failure
4. `createComment` on Jam with structured summary

### Bug Report Format

Write to: `[APP]/results/bugs/BUG-[MODULE]-[YYYY-MM-DD].md`

```markdown
## BUG-[MODULE]-[DATE]-[NNN]: [Title]

**Severity:** [Critical|High|Medium|Low]
**Module:** [module]
**TC:** [TC-MOD-NNN] (if linked)
**URL:** [page URL]

**Steps to Reproduce:**
1. [step]
2. [step]

**Expected:** [what should happen]
**Actual:** [what happened]
**Screenshot:** [path or "none"]
**Network Evidence:** [API call details or "none"]
**Console Errors:** [error messages or "none"]
**Root Cause Hypothesis:** [layer + explanation]
**Impact:** [who is affected]
```

---

## `/improve [test-file]`

Review and improve an existing test suite. Enter **Improver Mode**.

### 5-Axis Scoring

| Axis | Weight | What to Check |
|------|--------|---------------|
| Coverage | 30% | Happy path + edge + error + security per feature |
| Selector Quality | 25% | Semantic (L1-4) vs fragile (L5-8) ratio |
| Independence | 20% | No TC assumes state from prior TC |
| Assertion Quality | 15% | Specific observable outcomes, not "verify it works" |
| Maintainability | 10% | Readable steps, good naming, reasonable length |

### Workflow

1. Read the test file
2. Score each axis → compute total (0-100)
3. Identify specific improvements with line references
4. Present improvement plan — **Gate 5: wait for user approval before writing**
5. On approval: apply changes, re-score, report delta

---

## `/scope [url] "feature-description"`

Regression scope recommender — identify TCs to run after a code change.

### Workflow

1. Parse description for: route, action, module, field signals
2. Read `[APP]/test-cases/INDEX.md` → module files → score every TC for relevance:

| Signal | Score |
|--------|-------|
| TC module matches changed module | +5 |
| TC title contains changed action verb | +3 |
| TC touches a form field mentioned in description | +2 |
| TC is Happy Path type in affected module | +1 |
| TC is in a different module entirely | -3 |

3. Select top TCs (default 20, max 30) above threshold score of 0
4. Print recommended scope as a ranked list + pre-filled `/run` command

### Output Format

```
Regression scope for: "[description]"
Recommended TCs (N total):

[TC-MOD-001] Login with valid credentials — score: 8
[TC-MOD-005] Save record — score: 6
...

Run command: /run TC-MOD-001,TC-MOD-005,... [url]
```

---

## HITL Gates (analysis commands only)

| Gate | When | What |
|------|------|------|
| **Gate 2** | AI-generated TCs (`/parse`) | Present TCs for approval before saving |
| **Gate 5** | Improvement changes (`/improve`) | Approve proposed changes before writing |
| **Gate 6** | Git push (teardown T4) | Approve commit + push |

Never invent additional prompts. Never ask permission for file reads or analysis.

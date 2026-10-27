# Advanced Commands — Load Testing, Bug Analysis, Improvement, Portability, Scope, HITL

---

## `/load [url] [scenario?]`

### Environment Check — MANDATORY before stress/spike/endurance

```
⚠ Is this URL a staging/test environment or production?
```
- If production or unclear → refuse: "Load tests can slow or crash a live server. Provide staging URL."
- If staging confirmed → proceed
- Baseline scenario → always safe without asking

### Scenarios

| Scenario | VUs | Duration | When |
|----------|-----|----------|------|
| Baseline | 1 | 30s | Always safe — default |
| Load | 10-50 | 2min | After baseline passes |
| Stress | 50-200 | 5min | Staging only — Gate 3 |
| Spike | 1→200→1 | 3min | Staging only — Gate 3 |
| Endurance | 20 | 30min | Staging only — Gate 3 |

### Endpoint Identification

1. During `/run` or `/explore`, capture network requests
2. Filter for API calls (POST, PUT, DELETE, GET with dynamic params)
3. Rank by frequency and criticality
4. Generate k6 script for top 5-10 endpoints

### k6 Script Template

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('${APP_URL}/api/endpoint');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timeit < 500,
  });
  sleep(1);
}
```

Save to: `load-tests/[scenario]-[endpoint].js`

---

## `/bug [description-or-jam-url]`

Deep analysis of a single failure. Enter **Analyst Mode**.

### Root Cause Framework

1. **Reproduce** — Navigate to the failure point
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

```markdown
## BUG-[MODULE]-[DATE]-[NNN]: [Title]

**Severity:** [Critical|High|Medium|Low]
**Module:** [module]
**TC:** [TC-ID] (if linked)
**URL:** [page URL]

**Steps to Reproduce:**
1. [step]
2. [step]

**Expected:** [what should happen]
**Actual:** [what happened]
**Screenshot:** [path]
**Network Evidence:** [API call details]
**Console Errors:** [error messages]
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
3. Identify specific improvements
4. Present improvement plan — **Gate 5: wait for approval**
5. On approval: apply changes, re-score, report delta

---

## `/port [source-project] [new-app-name] [url?]`

Copy test cases from a mature project to a new one.

### Workflow

1. **Inventory** — Count all source TCs by module
2. **Resolve target structure** — From existing files, URL crawl, or ask user
3. **Gate 4: Module Mapping** — Show mapping table, wait for approval
4. **Classify each TC:**
   - **PORTABLE** — Generic enough to apply (login, search, CRUD forms)
   - **FLAGGED** — Contains app-specific data or selectors → wrap in `[REVIEW:]` tags
5. **Transform** — New TC IDs, `Ported-from:` metadata
6. **Write to target** `test-cases/` with proper hierarchy
7. **Rebuild dashboard** for target project
8. **Report** — Modules ported, flagged count, next steps

### Portability Scoring

| Signal | Score | Rule |
|--------|-------|------|
| Generic action (login, search, save) | +3 | Always portable |
| Form validation (empty, long, special chars) | +3 | Always portable |
| Specific data reference (record ID, record name) | -2 | Flag with [REVIEW:] |
| Hardcoded URL path | -1 | Transform to relative |
| App-specific selector | -2 | Flag with [REVIEW:] |

PORTABLE threshold: score ≥ 2. Below → FLAGGED.

---

## `/scope [url] "feature-description"`

Regression scope recommender — identify TCs to run after a code change.

### Workflow

1. Parse description for: route, action, module, field signals
2. Lightweight crawl (nav structure only, max 3 pages, no interactions)
3. Score every TC for relevance:

| Signal | Score |
|--------|-------|
| TC module matches changed module | +5 |
| TC title contains changed action verb | +3 |
| TC touches a form field mentioned in description | +2 |
| TC is Happy Path type in affected module | +1 |
| TC is in a different module entirely | -3 |

4. Select top TCs (default 20, max 30) above threshold
5. Print recommended scope + pre-filled `/run` command

---

## Human-in-the-Loop Gates

Artemis pauses at exactly 5 defined checkpoints. Outside these gates, it proceeds autonomously.

| Gate | When | What |
|------|------|------|
| **Gate 1** | Pre-run (`/artemis`, `/run`) | Show scope + TC count, wait for "y" |
| **Gate 2** | AI-generated TCs (`/explore`, `/parse`) | Present TCs for approval before saving |
| **Gate 3** | Load test env check (`/load` stress+) | Confirm staging environment |
| **Gate 4** | Module mapping (`/port`) | Approve mapping table |
| **Gate 5** | Improvement changes (`/improve`) | Approve proposed changes |
| **Gate 6** | Git push (`teardown T4`) | Approve commit + push |

**Rules:**
- Never invent additional approval prompts mid-run
- No need to ask before navigating the target app, taking screenshots, or writing files and DB logs inside the project; destructive or external actions still need user confirmation
- If uncertain about scope, ask **before** Gate 1, not during execution

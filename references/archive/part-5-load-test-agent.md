# Part 5: Load Test Agent

Two-phase agent running in **Performer Mode**: identify choke points, think in concurrent
users, write real k6 scripts.

---

## ⚠ Environment Safety Check

**Run this check before executing any scenario above Baseline.**

Ask the user (or infer from the URL pattern):
> "Is this a staging/test environment, or production?"

| URL type | Baseline | Stress | Spike | Endurance |
|----------|----------|--------|-------|-----------|
| Local dev (`localhost`) | ✅ safe | ✅ safe | ✅ safe | ✅ safe |
| Staging / test server | ✅ safe | ✅ safe | ⚠ ask first | ⚠ ask first |
| Production / live users | ✅ safe | 🚫 refuse | 🚫 refuse | 🚫 refuse |
| Unknown / unclear | ✅ safe | 🚫 refuse | 🚫 refuse | 🚫 refuse |

**If production or unknown and user requests Stress / Spike / Endurance:**
```
⚠ Load tests send real concurrent traffic and can slow or crash a live server.
  I won't run Stress, Spike, or Endurance against a production URL.
  Please provide a staging or test environment URL, then re-run /load.
```

**Baseline is always safe** — it simulates normal expected traffic and should not impact a healthy server.

**Shared test servers** (e.g., a QA server used by multiple testers): run Stress and Endurance outside business hours only. Warn the user before proceeding: "This is a shared test server — running this during work hours may affect other testers. Proceed? (y/n)"

---

## Phase A: Load Test Planner

### Step 1: Identify Critical Endpoints

During Playwright Runner execution, capture all network requests. Identify the endpoints
most deserving of load testing by scoring on these criteria:

| Criterion | Score |
|-----------|-------|
| Auth endpoints (login, token refresh) | +3 |
| Data write endpoints (POST, PUT, PATCH, DELETE) | +2 |
| Heavy read endpoints (patient list, orders, reports) | +2 |
| Search/filter endpoints | +1 |
| File upload/download endpoints | +2 |
| Called on every page load | +1 |

Select the top 3–5 endpoints by score.

**Alternate discovery (if network capture unavailable):**
- Use Jam.dev `getNetworkRequests` on a recorded session to find API calls
- Navigate the app and observe `browser_snapshot` for network indicators (loading states)
- Ask the user: "Which endpoints are most business-critical?"

### Step 2: Select Scenarios

Propose these 4 scenarios for each selected endpoint:

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| **Baseline** | 50 | 60s | Normal production load |
| **Stress** | Ramp 50→500 | 5 min | Find the breaking point |
| **Spike** | 0→1000 (30s hold, then back) | 2 min | Burst traffic behavior |
| **Endurance** | 100 | 30 min | Memory leaks, connection pool exhaustion |

### Step 3: Get Approval

Present the plan before generating scripts:

```
Load Test Plan — POST /api/login

Scenarios to generate:
  1. Baseline:   50 VUs / 60s
  2. Stress:     Ramp 50 → 500 VUs / 5 min
  3. Spike:      0 → 1000 VUs for 30s, then back to 0
  4. Endurance:  100 VUs / 30 min

Also testing: GET /api/patients/search, POST /api/orders

Generate k6 scripts for all 4 scenarios on all 3 endpoints? (y/n)
Or select specific: Baseline only / Skip endurance / Custom
```

---

## Phase B: Load Test Generator

### k6 Script Structure

For each approved endpoint + scenario, generate a `.js` file:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  // SCENARIO-SPECIFIC: Replace with correct VU/duration config
  stages: [
    { duration: '1m', target: 50 },   // Baseline: hold 50 VUs for 60s
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // P95 must be under 500ms
    errors: ['rate<0.01'],             // Error rate must be under 1%
  },
};

// Setup: authenticate once, reuse token across VUs
export function setup() {
  const loginRes = http.post('https://his-alpha-dev.q13.dev/api/auth/login', JSON.stringify({
    username: 'test@example.com',
    password: 'testpassword',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, { 'login successful': (r) => r.status === 200 });
  return { token: loginRes.json('token') };
}

// Default function: runs once per VU per iteration
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Main request
  const res = http.post(
    'https://his-alpha-dev.q13.dev/api/patients/search',
    JSON.stringify({ lastName: 'Silva' }),
    { headers }
  );

  // Assertions
  const success = check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has results': (r) => r.json('data') !== null,
  });

  errorRate.add(!success);
  sleep(1);  // 1 second think time between requests
}
```

### Scenario Configurations

**Baseline (50 VUs / 60s):**
```javascript
stages: [{ duration: '60s', target: 50 }]
```

**Stress (ramp 50→500 / 5 min):**
```javascript
stages: [
  { duration: '1m',  target: 50  },  // ramp up to 50
  { duration: '3m',  target: 500 },  // ramp up to 500
  { duration: '1m',  target: 0   },  // ramp down
]
```

**Spike (0→1000 / 2 min):**
```javascript
stages: [
  { duration: '10s', target: 1000 }, // spike up instantly
  { duration: '30s', target: 1000 }, // hold spike
  { duration: '10s', target: 0    }, // drop
  { duration: '70s', target: 0    }, // recovery period
]
```

**Endurance (100 VUs / 30 min):**
```javascript
stages: [
  { duration: '5m',  target: 100 },  // ramp up
  { duration: '20m', target: 100 },  // sustained load
  { duration: '5m',  target: 0   },  // ramp down
]
```

---

## Metrics to Track

| Metric | k6 Property | Threshold |
|--------|------------|-----------|
| Average latency | `http_req_duration` (avg) | < 200ms |
| P95 latency | `http_req_duration` (p95) | < 500ms |
| P99 latency | `http_req_duration` (p99) | < 1000ms |
| Error rate | `http_req_failed` | < 1% |
| Throughput | `http_reqs` (rate) | Track only |
| Virtual users active | `vus` | Track only |

---

## Output

### Script Files
Save each script to: `load-tests/[endpoint-slug]-[scenario].js`

Examples:
- `load-tests/login-baseline.js`
- `load-tests/login-stress.js`
- `load-tests/patients-search-spike.js`
- `load-tests/orders-endurance.js`

### How to Run
```bash
k6 run load-tests/login-baseline.js
k6 run --out json=results/load-login-baseline.json load-tests/login-baseline.js
```

### Performance Report Section

After scripts are generated (or after user runs them and shares results), format the
performance section of the QA + Performance Report:

```markdown
## Performance Section

### Load Test Results

| Endpoint | Scenario | VUs | Duration | Avg Latency | P95 Latency | Error Rate | Status |
|----------|----------|-----|----------|-------------|-------------|------------|--------|
| POST /api/login | Baseline | 50 | 60s | 120ms | 280ms | 0.1% | ✅ Pass |
| POST /api/login | Stress | 500 | 5 min | 410ms | 980ms | 2.3% | ⚠️ Warn |
| GET /api/patients/search | Spike | 1000 | 2 min | 890ms | 3,200ms | 12% | ❌ Fail |

k6 Scripts: load-tests/login-baseline.js, load-tests/login-stress.js, load-tests/patients-search-spike.js
Run with: k6 run load-tests/[filename].js
```

---

## Performance Observations (From Functional Testing)

During Playwright Runner execution, note any pages that load slowly.
These go in the "Performance Observations" section of the report — they are NOT test failures.

Threshold: > 3 seconds = note as observation.

```markdown
### Performance Observations (Functional Testing)

| Page | Observed Load Time | Notes |
|------|--------------------|-------|
| /dashboard | ~4.2s | Potentially large initial data payload |
| /orders/history | ~3.8s | No pagination on first load? |
```

If > 30% of pages show load times > 3s, add a dedicated "Performance Risk" section to the
executive summary of the report.

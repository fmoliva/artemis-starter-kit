# Part 14: Human in the Loop

Artemis operates on an **"auto-proceed by default, pause at gates"** model.

Outside of the 5 defined gates below, Artemis executes autonomously — no mid-run
permission prompts, no approval requests for individual steps. At each gate, Artemis
presents context, states the decision clearly, waits for input, and acts only on approval.

**Read this file at the start of every session.** It defines exactly when to pause and
when to proceed without asking.

---

## The 5 HITL Gates

---

### Gate 1 — Pre-Run Confirmation

**Trigger:** Every `/artemis` and `/run` invocation — all scopes including Quick Action.

**What Artemis shows:**
```
─────────────────────────────────────────
Artemis QA Run — Pre-flight Check
─────────────────────────────────────────
URL:     [target URL]
Scope:   [module / feature / TC range / Quick Action]
TCs:     [N test cases]
Paths:   ✓ Playwright Runner
         ✓ Exploratory QA       (skipped for Quick Action)
         ✓ Load Test Planner    (skipped for Quick Action)
─────────────────────────────────────────
Proceed? (y/n)
```

**Decision the human makes:** Confirm the URL, scope, and which paths will run before
any browser opens or any test executes.

**Auto-skip:** Never — always shown, even for Quick Action scope.

**After approval:** Execute autonomously until the run ends. Do NOT pause mid-run to
ask about individual steps, navigation, file writes, or screenshots.

---

### Gate 2 — AI-Generated Test Case Approval

**Trigger:** `/explore` (new TCs discovered during autonomous crawl), `/parse` (TCs
converted from DOCX, markdown, or plain text).

**What Artemis shows:**
```
N new test cases ready for review:
  TC-XXX-001  [title]
  TC-XXX-002  [title]  ⚑ [INFERRED] — precondition unclear
  TC-XXX-003  [title]

Approve to save to test-cases/? (y / n / edit)
  y     — save all
  n     — discard all
  edit  — modify before saving (specify TC IDs to change)
```

**Decision the human makes:** Review AI-generated or AI-converted test cases before
they become part of the permanent library. Catch inferred preconditions, ambiguous
expected results, or duplicates before they accumulate.

**Auto-skip:** Never — AI-written test cases must never be saved without human review.

**After approval:** Save approved TCs to `test-cases/`, assign IDs, rebuild TC list.

---

### Gate 3 — Load Test Environment Check

**Trigger:** `/load` with scenario = `stress`, `spike`, or `endurance`.

**What Artemis shows:**
```
⚠ Load Test — Environment Confirmation Required
─────────────────────────────────────────────────
URL:      [target URL]
Scenario: [stress / spike / endurance]

Is this URL a staging or production environment?
Type "staging" to proceed or "production" to cancel.
```

**Decision the human makes:** Confirm the URL is a safe test/staging environment
before sending high-volume traffic that could degrade or crash a live server.

**Auto-skip:** `baseline` scenario only — Baseline is always safe to run without asking.
All scenarios above Baseline require explicit staging confirmation.

**If production or ambiguous:** Refuse and say:
> "Load tests send real traffic and can slow or crash a live server.
> Please provide a staging or test environment URL."

---

### Gate 4 — Module Mapping Approval (`/port`)

**Trigger:** `/port` Phase 3 — after inventory and module structure resolution, before
TC classification begins.

**What Artemis shows:**
```
Module Mapping — Review Before Porting
────────────────────────────────────────────────────────
  Source Module          →  Target Module          Confidence
  ─────────────────────────────────────────────────────────
  authentication         →  login                  HIGH
  triage/patient-search  →  patient-lookup         MEDIUM ⚑
  medical-history        →  [NO MATCH FOUND]       —  ✗
────────────────────────────────────────────────────────
⚑ = review recommended   ✗ = no target found, TCs will be skipped

Approve mapping? (y / n / edit row N)
```

**Decision the human makes:** Confirm, correct, or reject module-to-module mappings
before any TC porting begins. Incorrect mappings silently mis-route all ported TCs.

**Auto-skip:** Never — always required before Phase 4 (TC classification).

---

### Gate 5 — Test Improvement Changes Approval (`/improve`)

**Trigger:** `/improve` after 5-axis review completes.

**What Artemis shows:**
```
Test Improvement Review — N findings

  TC-044  REDUNDANT — same happy path as TC-043. Proposed: remove.
  TC-046  FRAGILE SELECTOR — uses [class*="btn-save"]. Proposed: fix selector.
  Module Allergies  COVERAGE GAP — no error handling cases. Proposed: add TC-NEW-073.
  TC-NEW-073  NEW TC — "Save with empty required field shows validation error" [preview]
  TC-NEW-074  NEW TC — "Maximum field length enforced" [preview]

N changes proposed. Apply all? (y / n / select)
  y        — apply all
  n        — apply none
  select   — list TC IDs to include (e.g. "046,NEW-073")
```

**Decision the human makes:** Approve, partially approve, or reject proposed test
library changes including deletions, selector fixes, and new AI-generated TCs.

**Auto-skip:** Never — deletions and restructuring must not be applied without consent.

---

### Gate 6 — Git Push Approval

**Trigger:** Teardown step T4 on every run — only when changes are detected in `test-cases/` or `bugs/`.

**What Artemis shows:**
```
📦 Git Push — Changes Detected
─────────────────────────────────────────
Modified files:
  M  test-cases/triage/search.md
  A  bugs/BUG-042-patient-search-empty-state.md

Commit message (auto-generated):
  "artemis: triage search — 1 PASS, 0 FAIL"
─────────────────────────────────────────
Push to origin? (approve / skip / edit message)
```

**Decision the human makes:** Confirm that the auto-generated commit message is accurate
and that the changed files are intentional before pushing to the remote.

**Auto-skip conditions (no Gate 6 shown):**
- No git repo exists in the project root → print info message, skip silently
- No changes in `test-cases/` or `bugs/` → skip silently
- Remote not configured → commit locally, print info message (no push attempted)

**On approval:** `git add test-cases/ bugs/` → `git commit` → `git push`
**On skip:** print `"Git push skipped."`, stop.
**On "edit message":** user provides revised message → commit + push with new message.

---

## Auto-Proceed Zones

The following actions happen **without asking** — they are always safe and expected:

| Action | Why no approval needed |
|--------|----------------------|
| Navigate between pages | Read-only browser action |
| Take screenshot on FAIL | Mandatory evidence — never optional |
| Write results to DB (`write-result.js`) | Logging, not destructive |
| Write bug to DB (`write-bug.js`) | Logging, not destructive |
| Update `live-status.json` | Dashboard sync — internal |
| Log observations to `observations-log.md` | Append-only notes |
| Close Chromium after run | Always required, no user impact |
| Start/restart dashboard server (port 7373) | Infrastructure, not data |
| Read test cases from DB | Read-only |
| Read `skill-learnings.md` and `app-guide.md` | Read-only context loading |
| Update Artemis reference docs after a learning | Self-improvement, no data risk |
| `git status` check in T4 | Read-only, no side effects |

---

## Gate Anti-Patterns — Never Do These

- ❌ **Mid-run interruptions** — after Gate 1 approval, run to completion without pausing
- ❌ **Silent TC saves** — AI-generated or converted TCs must always pass Gate 2
- ❌ **Skipping Gate 3 for stress/spike/endurance** — always check environment type
- ❌ **Auto-applying `/improve` changes** — always present findings at Gate 5 first
- ❌ **Auto-pushing git without Gate 6** — never push without human approval
- ❌ **Showing Gate 6 when nothing changed** — only fire if `git status` shows changes in `test-cases/` or `bugs/`
- ❌ **Inventing new approval gates** — only the 6 defined gates are HITL checkpoints
- ❌ **Asking "should I proceed?" mid-execution** — if Gate 1 was approved, proceed

---

## Gate Reference Summary

| Gate | Name | Trigger | Auto-skippable? |
|------|------|---------|-----------------|
| 1 | Pre-Run Confirmation | `/artemis`, `/run` | Never |
| 2 | AI TC Approval | `/explore`, `/parse` | Never |
| 3 | Load Test Env Check | `/load` stress/spike/endurance | Baseline only |
| 4 | Module Mapping | `/port` Phase 3 | Never |
| 5 | Improvement Changes | `/improve` | Never |
| 6 | Git Push Approval | Every teardown T4 (when changes exist) | Yes — skipped when no changes or no git repo |

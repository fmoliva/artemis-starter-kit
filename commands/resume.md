# /resume — Continue From Last Session Checkpoint

Resumes testing from where the last session left off. Reads `session-checkpoint.md`,
loads only the remaining TCs, and runs them. Writes a new checkpoint and learnings
entry at the end. Token cost: ~3–5% of a full session re-start.

**Startup tier:** Tier 1 (browser + dashboard server required)

---

## When to Use

- Last session was interrupted before completing the full scope
- User says "continue from where we left off", "resume testing", "finish what's remaining"
- S1 checkpoint detection showed a non-complete `Resume From:` during any prior command

## When NOT to Use

- `session-checkpoint.md` does not exist → run `/run` instead
- `Resume From: complete` → scope is done; use `/run` with a new scope
- User wants to start a different scope → use `/run [scope]` directly

---

## Execution Steps

### Step 1 — Read Checkpoint

```bash
APP=$(cat .artemis-project 2>/dev/null)
cat "${APP}/results/session-checkpoint.md"
```

Extract:
- `Run ID` → use as base for new run_id (append `-resumed`)
- `Scope` → confirm with user
- `Remaining` → TC ID list (comma-separated)
- `Resume From` → first TC to execute

If checkpoint is missing or `Resume From: complete`:
```
No incomplete session found. Use /run [scope] to start a new run.
```
Stop.

### Step 2 — Gate 1 (Pre-Run Confirmation)

Show before any browser or server action:

```
📋 Artemis — Resume Session
──────────────────────────────────────
  App:       [APP]
  Scope:     [scope from checkpoint]
  Remaining: [N] TCs
  From:      [TC-ID] — [TC title from DB]
──────────────────────────────────────
  Continue? (y / show list / cancel)
```

- `y` → proceed
- `show list` → print the Remaining TC list, then re-prompt
- `cancel` → stop, print: "Run /resume when you're ready."

### Step 3 — S1 (Session startup reads — already done if called from S1 detection)

If called standalone (user typed `/resume` without prior S1):
- Read `skill-learnings.md` (limit: 150)
- Read `app-guide.md` (limit: 150)
- Read `artemis-learnings.md` (limit: 150)
- Extract [KNOWN_BLOCKS] from Known Failing Tests table

### Step 4 — S2+S3 (Dashboard server + run-start status)

```bash
APP=$(cat .artemis-project 2>/dev/null)
# Start server if not running (standard S2 check — see skill-learnings.md)
# Write run-start status to live-status.json via write-result.js
```

### Step 5 — S4 (Clear browser session)

```js
browser_close()
browser_resize({ width: 1920, height: 1080 })
```

### Step 6 — Load Remaining TCs (DB-First)

```bash
# For each TC-ID in the Remaining list from checkpoint:
node ${APP}/scripts/query-tcs.js --tc-id=[TC-ID]
```

Apply [KNOWN_BLOCKS] check: any TC-ID in [KNOWN_BLOCKS] → mark BLOCKED immediately, skip browser execution.

**Label in context:** `[FILTERED_TCS: source=checkpoint, count=N, scope=[scope]]`

### Step 7 — Execute Remaining TCs

Follow `core-runner.md` execution loop exactly.
- Lean mode applies (screenshots on FAIL only)
- Known-block check applies per TC
- Write result after each TC via `write-result.js`

### Step 8 — Run End Sequence (T3a + T3b + T3c)

Same as any `/run` teardown:

**T3a** — Append to `artemis-learnings.md`:
```markdown
## [DATE] — resume (scope: [scope])
**TCs run:** [N pass, N fail, N blocked (auto), N blocked (execution)]
**New bugs:** [list IDs or "none"]
**Selector issues:** [or "none"]
**Token overflow:** [yes/no]
**Patterns to remember:** [or "none"]
**Resume from:** [next TC-ID or "complete"]
```

**T3b** — Overwrite `session-checkpoint.md` with updated state:
- Move previously-Remaining TCs to Completed
- Set `Resume From: complete` if all TCs done, otherwise the next unrun TC-ID

**T3c** — `browser_close()`

### Step 9 — Print Run Summary

```
Resume Complete — [APP] ([scope])
──────────────────────────────────────
  TCs run this session:  [N]
  PASS:    [N]
  FAIL:    [N]
  BLOCKED: [N] ([N] auto-blocked known bugs)
  Total completed:  [N] (including prior session)
  Remaining:  [N] (or "0 — scope complete")
──────────────────────────────────────
```

If all TCs are done: `"Scope complete. Run /run [new-scope] for the next module."`
If TCs remain: `"Run /resume again to continue, or /run [scope] to restart."`

# Artemis Skill-Level Learnings

Universal fixes and behavioral rules discovered across all projects and sessions.
Artemis reads this file at the start of every run. These rules override any generic defaults.

**How to add an entry:** When a universal fix or behavioral rule is discovered, append it here
using the format below. Universal = applies to every project, not just one app.
For app-specific learnings, write to `[app-name]/results/artemis-learnings.md` instead.

---

## Infrastructure Fixes

Bugs in Artemis scripts that have been patched. Documented here as a "don't regress" reminder
and to surface the fix in projects that may have an older copy of the script.

---

### write-result.js must use `id`/`title` not `tcId`/`tcTitle`

**Type:** Infrastructure fix
**Applies to:** All DB-mode projects
**Rule:** In `write-result.js`, the `newEntry` object written to `recentResults` and `allResults` in `live-status.json` must use field names `id` and `title` — NOT `tcId` and `tcTitle`.
**Why:** The live dashboard reads `r.id` and `r.title` from these arrays. The dashboard's normalization alias only covered the old `r.tc` format, not `r.tcId`. Result: "Recent Results" panel showed "undefined" for all TC titles.
**If you see "undefined" in Recent Results:** Run this one-time patch on the project's `live-status.json`:
```bash
APP=$(cat .artemis-project 2>/dev/null)
node -e "
const fs = require('fs');
const p = '${APP}/results/live-status.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const fix = r => ({ ...r, id: r.id || r.tcId, title: r.title || r.tcTitle });
d.recentResults = (d.recentResults || []).map(fix);
d.allResults    = (d.allResults    || []).map(fix);
fs.writeFileSync(p, JSON.stringify(d, null, 2));
"
```
**Reference doc:** `part-3-playwright-runner.md`

---

## Behavioral Rules

Procedural steps Artemis must follow that are easy to miss. Each rule includes exactly
what breaks when it is skipped.

---

### S2 server start must run BEFORE browser_navigate, no exceptions

**Type:** Behavioral rule
**Applies to:** All projects — every run including Quick Actions
**Rule:** Always execute S2 before any `browser_navigate` call. Never skip or defer it. The startup block reads the app name from `.artemis-project`, then starts the server if needed:
```bash
APP=$(cat .artemis-project 2>/dev/null)
if ! curl -s http://localhost:7373/api/db/stats > /dev/null 2>&1; then
  lsof -ti:7373 | xargs kill -9 2>/dev/null
  cd "$APP" && node server.js &
fi
```
Then poll for up: `curl -s http://localhost:7373/api/db/stats`
**Why:** The live dashboard backend must be running to receive `write-result.js` calls. Skipping S2 means all TC results are written to the DB but never reflected on the live dashboard — silently broken every time.
**What breaks when skipped:** Dashboard shows stale data; live status never updates during the run.

---

### "quickly test X" = Quick Action (1 TC only), never a full-scope run

**Type:** Behavioral rule
**Applies to:** All projects — scope detection
**Rule:** When the user says "quickly test X", "quick check on X", or "just test X" — this is Quick Action mode. Detect the module/submodule from X, then query the DB for the single best-matching Happy Path TC. Execute exactly 1 TC. Print a 3-line summary. Stop.
```bash
APP=$(cat .artemis-project 2>/dev/null)
sqlite3 "${APP}/artemis.db" \
  "SELECT id, title FROM test_cases WHERE lower(title) LIKE '%[keyword]%'
   ORDER BY CASE type WHEN 'Happy Path' THEN 1 ELSE 2 END LIMIT 1;"
```
**Why:** "quickly test X" should spot-check one behavior. Running all TCs in the matched module defeats the purpose.
**Never do:** Load all TCs in the matched module/submodule and loop through them for a Quick Action request.

---

### Gate 1 (pre-run confirmation) must fire for Quick Actions before browser opens

**Type:** Behavioral rule
**Applies to:** All projects — every Quick Action run
**Rule:** Before calling `browser_navigate`, always show Gate 1 and wait for user confirmation:
```
🎯 Artemis — Quick Action
  URL:   [app-url]
  TC:    [TC-ID] — [TC title]
  Mode:  1 TC / 3-line summary
Proceed? (confirm to run)
```
**Why:** Part-14 explicitly states Gate 1 fires for ALL scopes including Quick Action. Skipping it means the user cannot catch a wrong TC selection before execution begins.
**What breaks when skipped:** Artemis opens the browser and starts executing without user review — violating the Human-in-the-Loop contract.

---

### Quick Action run-end: always set runState complete and clear currentTc

**Type:** Behavioral rule
**Applies to:** All projects — every Quick Action run
**Rule:** After every Quick Action TC result is written, immediately patch `live-status.json` to set `runState: "complete"`, `currentTc: null`, and `completedAt` before closing the browser.
**Why:** The live dashboard reads `currentTc.id` to mark a TC as "currently executing." If `runState` stays `"running"` and `currentTc` is not cleared, the TC status icon shows in-progress instead of the correct PASS/FAIL color.
**Required code (run after every Quick Action result):**
```bash
APP=$(cat .artemis-project 2>/dev/null)
node -e "
const fs = require('fs');
const p = '${APP}/results/live-status.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
d.runState    = 'complete';
d.currentTc   = null;
d.completedAt = new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(d, null, 2));
"
```
**Reference doc:** `part-3-playwright-runner.md` (Quick Action Mode — MANDATORY Run-End Sequence)

---

### DB-First rule: always check for artemis.db before reading any .md file

**Type:** Behavioral rule
**Applies to:** All DB-mode projects (projects where `artemis.db` exists)
**Rule:** Before reading any `.md` test case file, run `ls [app-name]/artemis.db`. If the DB exists, use `query-tcs.js` exclusively — never read `.md` files for TC loading.
**Why:** Reading `.md` files when the DB exists wastes ~15× more tokens.
**Check:**
```bash
APP=$(cat .artemis-project 2>/dev/null)
ls "${APP}/artemis.db" && echo "USE DB" || echo "USE FILES"
```
**Reference doc:** `part-3-playwright-runner.md` (Scope Filtering — STEP 0), `part-11-optimization-protocol.md`

---

### T4: Git push gate fires after every teardown when test-cases/ or bugs/ changed

**Type:** Behavioral rule
**Applies to:** All projects — every run including Quick Actions
**Rule:** After T3 (run summary), always run T4:
1. Read app name: `APP=$(cat .artemis-project 2>/dev/null)`
2. Check `git rev-parse --git-dir` inside `$APP` — if no repo, print info and stop
3. Run `git status --short test-cases/ bugs/` — if no changes, skip silently
4. If changes exist → fire Gate 6 (AskUserQuestion) showing changed files + auto-generated commit message
5. On approval → `git add test-cases/ bugs/` → `git commit` → `git push`
**Auto-generated commit message format:** `"artemis: [module] [scope] — [N pass], [N fail], [N bugs]"`
**Reference doc:** `part-14-human-in-the-loop.md` (Gate 6)

---

### S2 must open the dashboard browser tab after server confirms up

**Type:** Behavioral rule
**Applies to:** All projects — every run including Quick Actions
**Rule:** After the server health check passes, immediately run:
```bash
open http://localhost:7373
```
This must be the last line of the S2+S3 combined block, after the poll loop confirms the server is up.
**Why:** Without this, the user sees no live feedback during the run and only finds results after teardown.
**What breaks when skipped:** User sees no live feedback. Dashboard only reflects final state.

---

### S2 must check if server is already running before killing it

**Type:** Behavioral rule
**Applies to:** All projects — every run
**Rule:** Before killing port 7373, always check if the server is already responding:
```bash
if ! curl -s http://localhost:7373/api/db/stats > /dev/null 2>&1; then
  lsof -ti:7373 | xargs kill -9 2>/dev/null
  APP=$(cat .artemis-project 2>/dev/null)
  cd "$APP" && node server.js &
fi
```
If the health check passes → skip kill+restart entirely.
**Why:** Unconditionally restarting adds ~3–4s to every consecutive run and causes a brief SSE disconnect flash.

---

### S3 status write runs in parallel with server poll, not after it

**Type:** Behavioral rule
**Applies to:** All projects — every run
**Rule:** Write `live-status.json` immediately after starting the server in background — do NOT wait for the server poll to complete first. The combined S2+S3 order is:
  1. Check/start server (background `&`)
  2. Write `live-status.json` (S3) ← runs while server is booting
  3. Poll loop until server responds
  4. `open http://localhost:7373`
**Why:** Running S3 during server boot overlaps I/O with wait time and saves ~1s per run.

---

### Quick Action: Gate 1 fires first, before any bash or browser calls

**Type:** Behavioral rule
**Applies to:** Quick Action mode only ("quickly test X", "quick check on X", "just test X")
**Rule:** For Quick Action runs, reorder the startup sequence so Gate 1 fires FIRST:
  0. DB query to find best-match TC (read-only Bash — auto-allowed, no prompt)
  1. **Gate 1 — AskUserQuestion** (TC confirmation — the only user touchpoint)
  2. S2+S3 — Start dashboard server + write run-start status + open dashboard
  3. S4 — browser_close()
  4. Execute TC → Teardown
**Why:** If S2/S3/S4 bash commands and browser_close run before Gate 1, the user may see permission prompts before they've even confirmed the TC.

---

## Framework Patterns

Interaction patterns discovered for specific app frameworks that apply universally
to any app built on the same stack.

---

### Startup must navigate to APP_URL after browser_close — never rely on cached state

**Type:** Behavioral rule
**Applies to:** All projects — every run
**Rule:** After `browser_close()` + `browser_resize()`, always call `browser_navigate` with the app's live URL:
```bash
APP=$(cat .artemis-project 2>/dev/null)
APP_URL=$(grep APP_URL "${APP}/.env" | cut -d= -f2)
browser_navigate({ url: APP_URL })
```
**Why:** Playwright MCP keeps a persistent browser context across sessions. If the previous session ended without calling `browser_close()` (interrupted, crashed), the MCP browser is still on a stale cached page. `browser_resize` alone does not trigger a navigation — subsequent TC navigations start from the old page's DOM. Explicitly navigating to APP_URL after resize guarantees a fresh page load from the live URL.
**What breaks when skipped:** Artemis appears to "test an old copy of the app" — `browser_snapshot` returns stale DOM content from a previous session's cached page.

---

### Prefer /rerun over /run when .spec.ts files exist

**Type:** Behavioral rule
**Applies to:** All projects — any regression run request
**Rule:** Before starting a `/run` (MCP), check whether `.spec.ts` files exist for the target module:
```bash
APP=$(cat .artemis-project 2>/dev/null)
ls "${APP}/tests/"*.spec.ts 2>/dev/null || echo "NO SPECS"
```
If specs exist → use `/rerun [--module=X]` (Playwright CLI, zero MCP tokens).
If NO specs exist → use `/run` (MCP, first-time execution).
**Why:** `/run` uses Playwright MCP tool calls that accumulate large YAML accessibility trees in Claude's context window throughout the entire run. A 20-TC module run can consume ~40% of session usage. `/rerun` uses `npx playwright test` — no MCP calls, no context growth.
**What breaks when skipped:** MCP token accumulation turns every regression run into a full-context session. Reserve `/run` for first-time module exploration only.

---

### Angular SPA route guards block direct URL navigation

**Type:** Pattern
**Applies to:** All Angular SPAs with route guards
**Rule:** Never start a test by navigating directly to a sub-page URL (e.g. `/dashboard/settings`). Always enter from the app's home page by clicking the module/section card, then navigate via the sidebar.
**Why:** Angular route guards redirect unauthenticated (and sometimes authenticated) users from direct sub-page URLs to `/login` or the app home. Even logged-in users may be blocked if the guard checks for a selected context or role before allowing entry.
**Reference doc:** `part-8-browser-tools.md` (Angular SPA patterns)

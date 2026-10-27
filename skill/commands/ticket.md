Load the artemis skill, then execute the /ticket command with these arguments: $ARGUMENTS

The /ticket command is the sprint QA mode for Artemis.
It handles new features and bug fixes raised during a scrum sprint:
test what is in the ticket → thorough edge case coverage → update vault context → create/update scripts.

Read references/context-vault.md before starting (for vault path resolution).
If this app is Angular/SPA-based, also read references/angular-spa.md for wait patterns.
Read references/report-template.md before Phase 5 (canonical validation report structure).

---

## What /ticket does

This command is invoked for any scrum sprint ticket — a new feature, bug fix, or enhancement
picked up from `_queue.md`. It is the FULL QA pipeline for a single ticket.

| Mode | What it covers |
|------|----------------|
| `/verify` | Re-runs the existing spec; auto-fixes broken selectors — routine regression only |
| `/explore` | Discovers selectors and UI structure; no systematic validation |
| `/ticket` | Tests the ticket scope + all edge cases → writes/updates TCs + spec → confirms green run |

**Every ticket produces test artifacts. A /ticket run is not done until the spec is green.**

---

## Startup

```bash
APP=$(cat .artemis-project 2>/dev/null | head -1)
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
TICKET=$ARGUMENTS   # ticket title passed as arg, OR read from queue if omitted
```

**Screenshot path rule — ALL phases:**
All screenshots taken during /ticket must be saved to `${APP}/results/screenshots/bugs/` (for failures) or `${APP}/results/screenshots/tc-evidence/` (for pass evidence). Never save to the project root, `.playwright-mcp/`, or any other location.

**Before Phase 0 — load session context (mandatory, every /ticket run):**

Read all five in order — do not skip any:
1. `${VAULT}/_test-data.md` (lines 1–80) — verify test credentials/records before any browser action
2. `${VAULT}/_invariants.md` (full file) — behavioral ground truths; check before diagnosing any unexpected UI state
3. `${VAULT}/_navigation-flow.md` (full file) — canonical redirects; required before any navigation step
4. `${APP}/results/artemis-learnings.md` (limit 60 lines) — prior session findings; if a confirmed blocker exists for this feature, stop immediately and report it to the user before proceeding
5. `${VAULT}/references/skill-learnings.md` or `~/.claude/skills/artemis/references/skill-learnings.md` — universal behavioral rules, including any project-specific naming/data conventions logged there and the stop-and-ask rule

---

## Phase 0 — Card Setup

### 0.1 — Locate the ticket

If `$ARGUMENTS` is provided: search `${VAULT}/_queue.md` for a card matching the title.
If omitted: read `${VAULT}/_queue.md` and pick the highest-priority card from 📥 Pending
using this order: `#high` → `#medium` → `#low` → untagged → position in column.

**Column rules:** Only `📥 Pending` is eligible for auto-pick. If the board has parked
states beyond Pending/In Progress/Done/Blocked (e.g. "Issues Found" or "Needs Fix" for
tickets awaiting a dev response), never auto-pick from those — they represent work that
is intentionally paused, not ready-to-test. If a Pending card's note still mentions an
older parked state, treat the column placement as authoritative and proceed anyway — the
user moving it back to Pending IS the retest signal. Do not ask the user to confirm
readiness based on stale note text.

Read the **full card** — title + ALL inline notes in `_queue.md`.

### 0.2 — Read the linked note file (HARD GATE)

The card title is a wikilink: `[[Title]]`. Resolve it:
```bash
find "${VAULT}" -maxdepth 1 -name "*.md" | xargs grep -l "^# ${TITLE}" 2>/dev/null | head -1
# Fallback: "${VAULT}/${TITLE}.md"
```

**This is a hard gate. Do NOT proceed past 0.2 until the note file has been read in full.**

- Read the full note file — no line limit. Every line is in scope until confirmed otherwise.
- If the file is missing or has no content beyond the title: stop and ask the user what to test. Do not guess from the card title alone.
- Do NOT summarize or truncate the note content internally — every requirement listed is a test item unless the user explicitly removes it.

### 0.2b — Read every referenced doc (HARD GATE)

**Do NOT form or assert any bug finding until every requirements/spec/mapping/mockup reference for this ticket has been opened and read.**

- Scan the note (0.2) and the card (0.1) for any link, path, or mention of an external
  reference — requirements doc, spec, field-mapping file (CSV or otherwise), wireframe,
  mockup, or dev-provided tracking file. Open and read each one fully before continuing.
- If a referenced doc is inaccessible (broken link, permissions, not found): move the ticket
  to `🚫 Blocked`. Do not substitute a proxy comparison (e.g. live API introspection standing
  in for a missing mapping doc) and do not guess at intended behavior instead.
- The recurring failure this prevents: flagging a bug from assumption, or from a live-app/API
  read alone, without checking it against the ticket's own reference docs first. Findings made
  before this gate is satisfied are not valid — re-verify them against the reference docs
  before they appear in any report.
- If this project has a hook that logs reference-doc reads and blocks bug-asserting report
  writes when none were read, it only checks that *a* plausible file was read — read the docs
  for real.

### 0.2c — Deliverable-template gate (HARD GATE, export/file-output tickets only)

If the ticket's deliverable is a generated file (title contains "Export", "Report", or "Download",
or the note has a file-format requirement), the Requirements must **link or attach the expected
template/sample file**. If that line is empty or the file is missing: move the card to
`🚫 Blocked`, write the stub, and **do no testing at all** (no browser, no exports). Do not
substitute the live table headers or a mapping file for the expected file format.

### 0.3 — Scope declaration (autonomous — no user confirmation needed)

After reading the note file, print the scope and proceed immediately:

```
📋  Ticket: [title]
    Source:  [[NoteFile]].md — [N] lines read

    In scope (all items from note):
      1. [specific item, behavior, or field from the note]
      2. [specific item, behavior, or field from the note]
      ...

    ▶  Starting Phase 1 now.
```

**Rules for this declaration:**
- Every requirement, acceptance criterion, or described behavior in the note must appear as a line item
- Do NOT pre-filter, collapse, or mark anything as "covered by existing tests" at this stage
- Do NOT mark anything out of scope based on your own judgment — the ticket notes define the scope
- Do NOT wait for the user's reply — proceed directly to Phase 1 after printing the scope
- If something is genuinely ambiguous (two possible interpretations of a requirement), note it in the report under `### Clarifications Needed` and test the most conservative interpretation
- **Conservative interpretation, defined:** the stricter/more restrictive of the two readings — treat
  the requirement as required/enforced rather than optional. Test against that reading, but flag the
  ambiguity in `### Clarifications Needed` either way — "tested conservatively" is not a substitute
  for asking.

### 0.3b — Source Conflict Check

After the scope declaration, diff the note against the vault feature file (loaded in Phase 1.2) and
any linked mockup/spec referenced in the note. This is a different check from ambiguity (0.3 above) —
ambiguity is an *underspecified* requirement; a conflict is *contradictory* sources (note says X,
vault says Y, mockup says Z).

- If the note and the vault feature file disagree on expected behavior, do NOT silently pick one —
  log it under `### Clarifications Needed` as a conflict, not an ambiguity, and state which source
  you tested against (default: the ticket note, since it represents the current sprint's intent).
- If the ticket's own linked mockup/wireframe contradicts the ticket's prose/requirements text, score
  against the mockup, not the erroneous text — but still flag the discrepancy so the note can be corrected.
- Do NOT resolve a genuine three-way conflict (note vs. vault vs. mockup) on your own judgment —
  flag it and ask, same as any other Stop-and-Ask trigger, rather than silently picking a reading.

### 0.4 — Move to In Progress

Immediately after printing the scope declaration, edit `${VAULT}/_queue.md`: move the card from `## 📥 Pending` → `## 🔄 In Progress`.
Add a line: `  - Started: [YYYY-MM-DD]`

---

## Phase 1 — Feature Context Load

### 1.1 — Identify the feature

From the note file, extract:
- **Module** (e.g., `checkout`, `cross-module`)
- **Feature** (e.g., `guest-checkout`, `password-reset`)
- **What changed** — the specific behavioral change, bug fix, or enhancement described

**Evidence Tier declaration (mandatory, one line):** state which tier applies before
testing starts — `Tier A (UI-only)` for functional and visual tickets, or `Tier B (UI +
API/DB)` only when the ticket's scope is confirming that data actually reached a
downstream destination (data-mapping / sync validation), per any documented
data-mapping validation process this project maintains. Tier A is the default. Tier B is
the exception — even under Tier B, the rendered UI wins if it disagrees with a raw
API/DB value.

**Entry-point declaration (mandatory whenever the app has multiple entry points that
can reach the same underlying data or produce overlapping-but-not-identical results):**
name the ticket's actual subject out loud before picking a screen — do not infer the
entry point from the ticket's own label. A ticket titled around one theme is not proof
it belongs to the workflow of the same name; check what the ticket is actually asking
you to validate.

If this project has documented multiple entry points for the same feature (see the
feature's vault file or `_navigation-flow.md`), state explicitly which one the ticket's
scope requires, and stay on it for the rest of the ticket. Do not cross-check via the
other entry point mid-ticket as a sanity check — a blank/broken result on the mandated
entry point IS the finding. Only cross-reference another entry point if the user
explicitly asks for that comparison.

### 1.2 — Load vault feature file

```bash
# Check cross-module first, then modules/
ls "${VAULT}/cross-module/${FEATURE}.md" 2>/dev/null || \
find "${VAULT}/modules" -name "${FEATURE}.md" 2>/dev/null | head -1
```

Read the feature vault file (no line limit for ticket mode — full context required).
Extract `depends_on:` frontmatter and read each dependency (limit 80 lines each).

### 1.3 — Load navigation context

Read `${VAULT}/_navigation-flow.md` — identify the entry point and expected post-action redirects
for this feature. Do NOT assume any navigation path from a prior session.

### 1.4 — Load selector catalog (if exists)

```bash
cat "${VAULT}/selectors/${MODULE}.md" 2>/dev/null
```

Use confirmed selectors from the catalog. Treat `?` entries as unconfirmed — take a snapshot
to verify before using them in assertions.

### 1.5 — Load prior learnings

```bash
cat "${APP}/results/artemis-learnings.md" 2>/dev/null | grep -A3 "${FEATURE}"
```

If a prior entry shows a confirmed blocker (server bug, permission requirement, test-data issue),
treat it as authoritative context before running any tests.

### 1.6 — Field Count Declaration (MANDATORY for any form / multi-field ticket)

Before any field interaction, count the data rows in the ticket note's own field-specification
table(s) (every `| Field Label | ... |` row across all sections, excluding header/separator
rows) and state the count in the scope output. Use the ticket's own table as the source of
truth — do not estimate it from the rendered page. At the end of Phase 2, compare the number of
fields actually exercised against this count; any gap must be reported as `⬜ Untested`, not
omitted. Exercising a handful of fields and then saving/finalizing a large form with most
fields untouched is the failure this guards against. (If the project has a field-fill guard
hook that reads an expected-count file, write the count where the hook expects it.)

---

## Phase 2 — Targeted Validation

**Goal:** Confirm that the specific items described in the ticket notes work as expected.

### 2.1 — Parse ticket scope

From the note file, extract a list of **specific items to validate**:
- Named fields, buttons, or UI elements that changed
- Specific behaviors that were fixed or added
- Any test data or conditions mentioned in the notes

Print the parsed scope before starting:
```
🎯  Ticket scope: [N] items to validate
    1. [item description]
    2. [item description]
    ...
```

**Field-by-field enumeration (mandatory when scope touches a form):** if the ticket
involves a form or multi-field data entry and the note/spec/mockup lists specific
fields, enumerate every one of those fields as its own scope line here — do not fold
them into one generic "form fields work" item. This is the default for every form
ticket, not something that needs to be requested. Each enumerated field gets its own
row in the Phase 5.2 report (see `references/report-template.md`) — never collapse a
large section into one aggregate pass line.

### 2.2 — Navigate and validate each item

Use Playwright MCP. For each item in the ticket scope:

1. Navigate to the feature (using navigation context from Phase 1)
2. Perform the action described in the ticket
3. Assert the expected outcome — **see visual validation rule below**
4. On PASS: log `✅  [item] — confirmed`
5. On FAIL: take a screenshot immediately, log `❌  [item] — failed: [actual vs expected]`

**Visual validation rule — MANDATORY:**

For any item involving visual or interactive state (toggle on/off, button enabled/disabled, badge color, conditional field visibility, modal open/close, read-only form), you MUST take a screenshot to confirm the visual state matches the DOM state. Do NOT rely on DOM properties alone (`checked`, `disabled`, `aria-selected`, class names) — component libraries frequently diverge from their visual presentation.

Examples that REQUIRE a screenshot:
- Toggle/switch: screenshot after clicking to confirm visual color (gray = off, blue = on)
- Disabled field: screenshot to confirm field appears grayed out visually
- Badge color (Active/Closed): screenshot to confirm green vs grey
- Conditional visibility: screenshot to confirm element is actually hidden from view
- Form read-only after close: screenshot to confirm inputs appear non-editable

**Token rules during Phase 2:**
- Visual state items: 1 screenshot per item (pass or fail)
- Non-visual items (API calls, text content, data presence): snapshot on FAIL only
- Share a browser session across items where the feature page is the same

**Evidence artifact per Field-by-Field section (mandatory when scope touches a form or list):**
When validating a named-item list (options, dropdown values, checkboxes, or any other section
that will become its own Field-by-Field table in the report), save the raw comparison data to
`${APP}/results/evidence/<ticket-slug>/<section-slug>.json` (or `.txt`) as you go — e.g. the DOM
extraction, the API response used for comparison, or the list-diff output itself. Do this at
validation time, not retroactively when writing the report; a file assembled after the fact
from memory defeats the point. The report's Field-by-Field section cites it with an
`**Evidence:** [path]` line.

### 2.3 — Server-Side Blocker Check

If any interaction produces HTTP 5xx, DB constraint error, or system administrator message:
1. Stop Phase 2 immediately
2. Log the bug in `${VAULT}/known-bugs.md` (status: `Confirmed — server bug`)
3. Update `_pipeline.md`: mark feature `⚠ blocked — server bug [date]`
4. Move card to 🚫 Blocked, append findings
5. Report to user — do NOT attempt Phase 3

---

## Phase 3 — Comprehensive Scenario Coverage

**Goal:** Cover ALL testable scenarios for the changed feature — not just the ticket items.
This is what makes `/ticket` different from a targeted smoke test.

### 3.1 — Derive scenario matrix

From the vault feature file + the change description, build a scenario matrix covering:

| Category | What to test |
|----------|-------------|
| **Happy path** | Full end-to-end flow with valid data — all permutations if multiple paths exist |
| **Edge cases** | Boundary values (empty, max length, special characters), optional vs required fields, pre-population behavior |
| **Error handling** | Required field validation, invalid data rejection, form state after failed save |
| **Adjacent interactions** | Other features that read or write the same data (e.g., if a registration form changed, check the profile view + edit flow) |
| **Regression checks** | Features that share the same form, component, or API endpoint as the changed item |
| **UI state** | Disabled states, conditional visibility, loading states, modal open/close cycles |

Print the scenario matrix before running:
```
📋  Scenario matrix — [feature]
    Happy Path:     [N] scenarios
    Edge Cases:     [N] scenarios
    Error Handling: [N] scenarios
    Adjacent:       [N] scenarios
    Regression:     [N] scenarios
```

If any scenario category involves a form's individual fields (e.g. edge cases on field
validation), reuse the field enumeration from Phase 2.1 rather than re-deriving it —
every named field still needs its own row in the eventual report, including here.

If a scenario in the matrix is already covered by a passing TC in an existing spec:
- Do NOT re-run it via MCP — note it as `✓ covered by [spec-file]` and skip
- Only run scenarios NOT already in the spec, or scenarios where the spec TCs are flagged stale

### 3.2 — Execute scenarios

Run each scenario not already covered. Use Playwright MCP.
Report inline after each scenario: `✅ PASS` or `❌ FAIL [detail]`.

**Snapshot budget:**
- FAIL: 1 screenshot immediately after failure
- PASS: 0 screenshots
- Do NOT snapshot navigational steps between scenarios

### 3.3 — Ambiguous Result Rule

If, after attempting a scenario once, the result is ambiguous (unexpected UI state, no clear pass/fail signal):
1. Take a screenshot
2. Log what was observed vs expected
3. Mark the scenario as `⚠️ Needs Clarification` — do NOT loop or retry
4. Continue to the next scenario
5. Log all `⚠️ Needs Clarification` items in the report under `### Clarifications Needed`
   — the user will review asynchronously; do NOT stop execution to ask

**Do NOT stop the ticket run for ambiguous results.** Only stop for server-side blockers (Phase 2.3).

---

## Phase 4 — Vault Documentation Update

**This phase is MANDATORY regardless of pass/fail outcome.**
Every ticket leaves the vault more accurate than it found it.

### 4.1 — Update the feature vault file

Open the feature vault file and apply these updates:

- **New behavior confirmed:** Add or update the relevant section (Steps, Expected Result, Notes)
- **Selector changes:** Update the selector hints section with any new confirmed selectors
- **Known behaviors discovered:** Add to ## Known Behaviors or ## Notes
- **Pre-conditions changed:** Update ## Prerequisites or ## Navigation to Trigger if the access pattern changed

Format changes as in-place edits — preserve the vault file structure (frontmatter, section headings).

### 4.2 — Update known-bugs.md

For each bug found (any FAIL in Phase 2 or 3 that is not a server-side blocker):

```markdown
## [BUG-MODULE-NNN] [Feature] — [symptom]
- **Status:** Confirmed
- **Severity:** [Critical / High / Medium / Low]
- **Found by:** /ticket [date]
- **Symptom:** [what was observed]
- **Expected:** [what should have happened]
- **Ticket:** [[Title]] (queue card)
```

For server-side blockers: status = `Confirmed — server bug`.

### 4.3 — Update Pipeline Tracker

Update `${VAULT}/_pipeline.md` for the affected feature row(s):

| Outcome | Update |
|---------|--------|
| All scenarios pass | Last Green = today; clear any `⚠` |
| Bugs found (non-server) | Last Updated = today; note bugs found in session notes column |
| Server bug | Mark `⚠ blocked — server bug [date]`; leave Last Green unchanged |
| Spec updated (behavior change) | Last Updated = today |

**Pipeline row update format:** Always update the structured table columns (`Last Updated`, `Last Green`, `TCs`) directly — do NOT use inline row comments in place of column updates. The header `last_updated` field must also be set to today.

### 4.4 — Phase 4 Completion Self-Check

Before moving to Phase 5, verify all four were completed:

1. [ ] **Feature vault file** — `last_updated` field changed to today OR new section/bug note added
2. [ ] **known-bugs.md** — every bug found in Phase 2 and Phase 3 has a structured entry; header `last_updated` updated to today
3. [ ] **_pipeline.md** — affected feature row(s) have updated column values; header `last_updated` updated to today
4. [ ] **Field coverage** — if Phase 2.1/3.1 enumerated a field checklist, the number of enumerated fields equals the number of individually-verdicted rows that will appear in the Phase 5.2 report. If they don't match, go back and fill the gap (or explicitly name the untested field/subsection in the report) before continuing — do not let a gap hide inside an aggregate pass count.

If any checkbox is unchecked, return to that section and complete it before continuing. This is an agent self-check — do not ask the user for confirmation.

---

## Phase 5 — Ticket Completion

### 5.1 — Move card in queue

Edit `${VAULT}/_queue.md`:
- If all Phase 2 + Phase 3 items pass, no bugs found: move card to `## ✅ Done`
- If bugs were found and confirmed but require a dev fix before the ticket can be considered
  resolved: move card to a parked "needs fix" state if your board has one (do NOT move to
  Done — that state is for "tested, bug logged, waiting on dev")
- If bugs were found but the user has explicitly said they're non-blocking / cosmetic /
  acceptable: move to `## ✅ Done`
- If a server-side blocker or other external blocker prevented completing the test scope
  (Phase 2.3): move card to `## 🚫 Blocked`
- If a Stop-and-Ask blocker fired mid-ticket (ambiguous result needing user input) and the
  ticket could not be completed: move card to a parked "issues found" state if your board
  has one, instead of leaving it in `🔄 In Progress`

**Card note stays short — MANDATORY.** The card is a pointer, not a report. Replace any longer
in-progress notes (e.g. 0.4's `Started:` line) with only this completion stub:
```
  - Started: [start date] | Completed: [today]
  - [Bugs Found summary line: bug IDs + severities, or "No bugs found"]
  - Full write-up: [[Title]] → Report + Session Notes
```
Do **not** put phase scoreboards, root-cause narrative, or vault-update lists on the card —
those belong in the note file's Session Notes (5.2b). A card that accumulates paragraph-length
bullets becomes unreadable and duplicates content that already lives, better organized, in
the note.

### 5.2 — Report (MANDATORY)

Insert a `## Report` section at the **top** of the linked note file (`[[Title]].md`) — immediately
below the title/frontmatter, before requirements, notes, or any other content. Do not append it at
the bottom.

**Use `references/report-template.md` for the exact structure — it is the single source of truth
for this format.** Do not improvise the section order or add a narrative/prose section; the
metadata block (Date/Environment/Evidence Tier/Tester) always leads, immediately followed by
`### Bugs Found` (or "None"), then Result Scoreboard → Field-by-Field → Clarifications Needed.
There is no Vault Updates section — the vault is already updated in Phase 4; don't restate it here.
On a retest, **overwrite** this section in place — never append a second copy or a
"CORRECTION:" paragraph above it.

If this project has a report-format validation hook or similar automated check, it may reject the
write if the structure doesn't match — treat that as a signal to re-check against
`references/report-template.md`, not to work around the check.

**Transcribe Field-by-Field rows FROM the Phase 2.2 evidence artifact — never from the
ticket's requirements/field-specification table.** The ordering matters:

1. Extract the real data from the live app (Phase 2.2) and save the raw output.
2. Open that saved artifact.
3. Write one row per item **that the artifact actually contains**.

Writing the table from the requirements doc and then producing an evidence file to match it
is the inversion this rule exists to prevent. If an item is in the requirements but NOT in your
extraction, that is either a bug to file or a row to mark `⬜ Untested` — never a `✅`. Likewise,
list named items one per row; do not collapse them into a single aggregate row ("all 27
options present") even if the arithmetic is consistent.

**Build against the template directly — do not draft a freeform report and reshape it
afterward.** Open `references/report-template.md` and write each section in the order it
defines, copying its headers verbatim. Drafting a custom shape first and fixing it only when a
check (or the user) rejects it forces a retest, which repeats usage already spent once.

### 5.2b — Session Notes (MANDATORY)

Immediately below the `## Report` section's closing fence in the same note file, add (or
overwrite, on a retest) a `## Session Notes` section — the process-level detail that must not
accumulate on the card.

**Do not wrap this section in a ` ```markdown ` fence** — plain headings and bullets, outside
any code fence, so tooling that locates the report block by its fences is not confused on the
next retest.

```
## Session Notes

- Started: [date] | Completed: [date]
- Phase 2 (Targeted): [N/N] ticket items validated — [N] Pass / [N] Fail
- Phase 3 (Comprehensive): [N] pass / [N] fail across [N] scenarios
- Root cause: [one line, if a bug was found — omit otherwise]
- Vault updated: feature doc ✓ | known-bugs.md ([bug IDs] or n/a) | _pipeline.md ✓
- Spec updated: [yes/no — path if yes]
```

- Bullets only, no multi-paragraph narrative.
- On a retest, **overwrite in place** — never append a second copy or dated history; long-term
  retest history belongs in the feature vault file (Phase 4.1).
- This is session metadata, not a second copy of the Bugs Found / Field-by-Field tables.

### 5.3 — Compliance Self-Verify (MANDATORY, HARD GATE)

**Do not move to Phase 6, move the card, or start the next queue card until this passes for
THIS ticket.** A step can silently not happen (a skipped edit, a check that never fired) and
nothing in the ticket's own narrative will reveal it. This step re-reads the files on disk the
way an outside reviewer would. Run it inline in this session.

1. **Re-open the linked note file fresh** — read it as it now exists on disk, not your
   in-memory copy of what you wrote.
2. **Report structure:** every section and header in `references/report-template.md` is
   present, in order. If a report-format check/hook exists, run it directly against the file.
3. **Report position:** the `## Report` heading is the first non-frontmatter content, directly
   followed by its fence — not appended after Requirements/other content, and in the linked
   note (not the feature vault file).
4. **Session Notes:** `## Session Notes` exists immediately below the report's closing fence,
   unfenced (5.2b).
5. **Vault docs:** the feature vault file's `last_updated` and `_pipeline.md`'s relevant row
   actually show today's date on disk.
6. **Queue card:** `_queue.md` shows the short stub (5.1) in the column matching the actual
   outcome (bugs found → needs-fix / parked state, unless explicitly user-accepted).

If any check fails, fix it now, in this same phase — do not ask permission to repair a
self-caught gap, and do not proceed on a failure.

---

## Phase 6 — QA Pipeline (TC library + spec + green run)

**This phase runs after the report is generated.** The testing is done and reported — now lock it into the test suite.

### 6.1 — TC library update

For each scenario validated in Phase 2 + Phase 3:

1. Check `${APP}/test-cases/[module]/` for an existing TC covering this scenario
2. If found and the expected result changed → update the Expected Result to match confirmed behavior
3. If not found → draft a new TC using the TC heading format (`### TC-[PREFIX]-NNN`) and present it to the user for approval before saving

After approval:
```bash
node "${APP}/scripts/migrate-tcs.js"
# Update INDEX.md with new TC IDs
```

### 6.2 — Playwright spec update

1. Locate the spec: `ls "${APP}/tests/${MODULE}"*.spec.ts`
2. If spec exists:
   - For each TC whose Expected Result changed → update the corresponding `expect()` assertion
   - For each NEW approved TC → add a `test()` block using the standard `beforeEach` skeleton (storageState, no login())
3. If no spec exists → generate one using confirmed selectors from Phase 2 + 3. Present for user approval before writing.

### 6.3 — Run spec to confirm green

```bash
cd "${APP}" && npx playwright test "${SPEC_FILE}" 2>&1
```

- All green → update `_pipeline.md` Last Green = today; done
- Failures → apply auto-fix (same as `/verify` Step 3–4 logic, max 3 iterations)
- Still failing after 3 → flag to user; mark spec `⚠ needs manual fix` in pipeline; do not block queue auto-continue

---

## Final Report

Print after Phase 6:

```
✅  /ticket [title] — complete

  Phase 2 (Targeted):      [N/N] ticket items validated
  Phase 3 (Comprehensive): [N] pass / [N] fail / [N] scenarios
  Bugs logged:             [N] (IDs: [list or "none"])
  Vault updated:           feature doc ✓ | known-bugs ✓ | pipeline ✓
  Report:                  written to top of [[Title]].md
  Phase 6 (QA pipeline):   [N] TCs created/updated | spec [green ✓ / ⚠ needs fix]
  Queue:                   card moved to [Done / Blocked]
```

---

## Auto-Continue Rule — MANDATORY

After printing the Final Report, **immediately** check `${VAULT}/_queue.md` for the next
card in `## 📥 Pending` (same priority order: `#high` → `#medium` → `#low` → untagged → position).
Never auto-pick from a parked state (see Phase 0.1 column rules). A card that was moved back
into Pending from a parked state is picked exactly like any other Pending card, with no extra
confirmation step, regardless of what its note text still says.

- **If a Pending card exists:** start Phase 0 for that card without asking the user. Print:
  ```
  ➡  Next ticket: [title] — starting now
  ```
- **If the Pending column is empty:** run `/compliance` with no argument (an independent,
  fresh-read audit of every card completed this drain run against this file's MANDATORY
  outputs). Phase 5.3 is the ticket checking its own work in the context that produced it;
  `/compliance` has no memory of what the session intended, which is what catches a fooled
  self-check. Do not skip it on the reasoning that 5.3 "already covered it." Then print:
  ```
  📭  Queue empty — all pending tickets complete.
  🔍  Compliance audit: [N] tickets checked, [N] failed checks, [N] unable to verify — see results/audits/compliance-YYYY-MM-DD.md
  ```
  If the audit finds any failed check, surface the failing ticket(s) and requirement(s) in this
  final message rather than leaving them buried in a file. Then stop.

**Only pause to ask the user when:**
1. The note file for the next card is missing or has no testable content (Phase 0.2 rule)
2. The scenario matrix exceeds 20 scenarios (ask which categories to prioritize)
3. A Stop-and-Ask blocker is hit mid-ticket (server bug, ambiguous result after one attempt)

Don't ask "Should I proceed to the next ticket?" between queue cards — continue automatically. This covers queue progression only; destructive or external actions still need user confirmation.

---

## Token Budget for /ticket

| Phase | Snapshots | Expected tokens |
|-------|-----------|-----------------|
| Phase 0–1 (card + vault load) | 0 | ~3K |
| Phase 2 (targeted: N items) | 0–N (fail only) | ~8K per item |
| Phase 3 (comprehensive: N scenarios) | 0–N (fail only) | ~6K per scenario |
| Phase 4 (vault writes) | 0 | ~2K output |
| **Total (typical ticket, 5 items + 10 scenarios)** | **0–5** | **~80–120K** |

If the scenario matrix exceeds 20 scenarios, present it to the user and ask which categories
to prioritize before running — do not silently cap coverage.

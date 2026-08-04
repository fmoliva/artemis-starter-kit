# Canonical QA Validation Report Template

This is the **single source of truth** for the "QA Validation Report" produced by
`/ticket` (Phase 5.2), `/bug` (dev-facing report), and any data-mapping/sync retest.
If the wording elsewhere (a command file, a vault process doc, or a stray convention
in `skill-learnings.md`) ever disagrees with this file, this file wins.

**Not the same thing as:**
- `examples/bug-report-template.md` — the live-dashboard parser format (`## BUG-NNN:`
  headings, `**Field:** value` inline metadata). Used only for TC-linked failures the
  dashboard needs to parse. Do not mix the two formats.
- `examples/qa-results-report-template.md` — the full `/artemis` pipeline run report
  (executive summary, load-test results, coverage grid). Used only for full-scope QA
  runs, not sprint tickets.

---

## Structure — MANDATORY order, no exceptions

1. **Metadata block** (Date/Environment/Evidence Tier/Test Data/Tester) — always
   leads, right after the title
2. **Bugs Found** table (or "None") — always immediately after the metadata block
3. **Result scoreboard** — compact pass/fail counts
4. **Field-by-field table(s)** — one row per named field, no matter how large the
   section is (see "Field coverage" below)
5. **Clarifications Needed** — only if non-empty; omit the section entirely if empty

Tables and bullets only. **No narrative prose, no "Retest History" section, no
"CORRECTION: ..." paragraph.** If a prior conclusion changes, overwrite the report in
place — don't explain the change in prose. If retest history genuinely needs
preserving, it goes in the FEATURE vault file (`cross-module/*.md` or
`modules/*/`) under its own dated heading — never in the ticket note or the standalone
dev report.

The full field-by-field table must be embedded **inside** the fenced ` ```markdown `
block below, not referenced separately or placed outside the fence.

---

## Template

````markdown
## QA Validation — [Ticket Title]

**Date:** [YYYY-MM-DD]
**Environment:** [STAGING / DEV / PROD]
**Evidence Tier:** [Tier A — UI/PDF-only | Tier B — UI + API/DB, data-mapping scope]
**Test Data:** [record/account used for this round — name, ID, or other identifier]
**Tester:** Artemis

### Bugs Found

| # | Bug ID | Summary | Severity |
|---|--------|---------|----------|
| 1 | [BUG-ID] | [one line] | [Critical/High/Medium/Low] |

_or "None" if no bugs found._

### Result Scoreboard

| Category | Pass | Fail | Total |
|----------|------|------|-------|
| Targeted Validation (ticket scope) | N | N | N |
| Comprehensive Coverage | N | N | N |

### Field-by-Field — [Section name]

| # | Field | Expected (per spec) | Actual (live) | Result |
|---|-------|---------------------|----------------|--------|
| 1 | [field name] | [expected] | [observed] | ✅ / ❌ |

_Repeat this table once per section — never collapse a large section (e.g. 200+ fields)
into one aggregate row. If part of a repeating grid wasn't individually re-verified,
name that gap explicitly in its own row — never let it hide inside a pass count._

### Clarifications Needed

_Omit this section entirely if empty — do not print an empty table._

| # | Item | Observed | Question |
|---|------|----------|----------|
| 1 | [scenario] | [what was seen] | [specific question for PM or dev] |
```
````

**Test Data field:** always state the record/account used for this test round — enough
to identify it (name, ID, username, etc.) per whatever test-data convention the project
has documented (see `_test-data.md` in the vault, if one exists). If multiple records
were used across different sections/rounds, list each one next to the section it
applies to instead of a single top-line value.

---

## Field coverage rule

If the ticket/spec scope touches a form (new form, revised form, settings panel,
multi-step wizard, or any structured input screen) and the requirement/note/mockup
lists specific fields, every one of those fields gets its own row — value entry,
validation, save/submit persistence, and prepop state+value where applicable. This
applies to the write-up as much as the browser execution: a section tested
field-by-field in the browser but summarized as one aggregate line in the report
("251/251 ✅") does not satisfy this rule.

## Reporting discipline (every retest)

1. On every retest result, **rewrite** (don't append to) the standalone dev report
   (`results/bugs/<ID>-*.md`) in full, using this template.
2. Copy that exact block to the top of the linked vault ticket note under a "Current
   status" / "GitHub Report" heading — mirrored, not paraphrased.
3. Severity reflects the *narrowed final* scope, not the scope from early retest
   rounds — downgrade as false positives get retracted during the session.
4. A **Match**/Pass row needs zero explanation. Only Fail/Mismatch rows get a detail
   note.

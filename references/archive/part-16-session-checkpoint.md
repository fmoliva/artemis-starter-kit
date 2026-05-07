# Part 16: Session Checkpoint Protocol

Every run writes a checkpoint. Every session start reads it. This makes session handoffs
zero-cost: a new AI session reads one ~20-line file instead of re-querying the DB and
re-establishing full scope context from scratch.

---

## Checkpoint File

**Location:** `[APP]/results/session-checkpoint.md`  
**Lifecycle:** Single file. Overwritten at the end of every run. Never appended — always replaced.

---

## Writing the Checkpoint (T3b — Mandatory)

Write this file as part of the Run End Sequence (T3b), after the learnings write (T3a)
and before closing the browser (T3c). Do this even for interrupted runs.

```markdown
# Session Checkpoint — [APP] — [ISO timestamp]
Run ID: [run_id]
Scope: [module / submodule / "all" / "exploration"]
Started: [ISO timestamp]
Ended: [ISO timestamp or "interrupted"]

## Completed ([N] TCs)
[TC-ID], [TC-ID], [TC-ID], ...
(comma-separated on one line; "none" if zero)

## Remaining ([N] TCs)
[TC-ID], [TC-ID], [TC-ID], ...
(TCs in scope that were not executed; "none" if complete)

## Module Coverage
Fully covered: [module list or "none"]
Partial: [module] ([N] of [M] TCs done)
Not started: [module list or "none"]

## Known FAIL/BLOCKED
[TC-ID]: [one-line reason]
[TC-ID]: [one-line reason]
(or "none")

## Resume From
[next TC-ID]
(or "complete" if all TCs in scope were executed)
```

**Rules:**
- Always overwrite — never append. One checkpoint file, always current state.
- `Resume From: complete` signals that the scope is done. The next session should not auto-prompt to resume.
- For exploration runs: set Scope to "exploration", Completed/Remaining to module names (not TC IDs), and Resume From to the next unvisited module or "complete".
- For interrupted runs: set `Ended: interrupted`, write what was completed, set `Resume From:` to the next TC that would have run.

---

## Reading the Checkpoint (S1 — Checkpoint Detection)

Checked automatically during S1 after reading `app-guide.md` and `artemis-learnings.md`:

```bash
APP=$(cat .artemis-project 2>/dev/null)
head -25 "${APP}/results/session-checkpoint.md" 2>/dev/null
```

**If checkpoint exists and `Resume From:` is not "complete":**
```
📋 Last session: [N] done, [N] remaining (scope: [scope], ended: [ended]).
   Resume from: [TC-ID]
   Continue? (y / start fresh / show remaining)
```

- `y` → load remaining TC list from checkpoint, proceed to Tier 1 startup (skip DB scope query)
- `start fresh` → ignore checkpoint, run full scope as requested
- `show remaining` → print the Remaining list from checkpoint, then ask "Continue? (y / start fresh)"

**If `Resume From: complete` or checkpoint does not exist:** proceed normally with no prompt.

---

## `/resume` Command Integration

`/resume` reads this checkpoint and executes the Remaining TC list directly.

**Startup cost:** ~50 tokens (one file read of 20 lines + S1 learnings) vs. ~2,000 tokens for
a full session re-orientation with DB query, scope resolution, and TC loading from scratch.

See `commands/resume.md` for the full command spec.

---

## Checkpoint vs. Legacy Checkpoint Files

The legacy `results/checkpoint-[date]-[scope].md` files (from v1) are separate — they are
session snapshots that expand into full `qa-results-*.md` reports.

`session-checkpoint.md` is different in purpose: it is a **resume pointer**, not a results log.
It is always overwritten (not accumulated) and contains only the fields needed to restart a run.

Both can coexist. `session-checkpoint.md` is always used for S1 detection and `/resume`.
Legacy checkpoint files are still promoted to QA results reports as before.

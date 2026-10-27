Load the artemis skill, then execute the /kanban-cleanup command with these arguments: $ARGUMENTS

Archives stale kanban ticket material in the vault: description files (and their
attachments) for cards no longer on the live board, plus — optionally — Done cards
older than the current work window, moved into `_queue.md`'s `## Archive` section.

No browser. Pure file/vault housekeeping, same class of utility as `/sync` and `/ingest`.

---

## Step 0 — Resolve paths

```bash
APP=$(cat .artemis-project 2>/dev/null | head -1)
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
KD="${VAULT}/kanban-descriptions"
ARCHIVE="${KD}/_archive"
Q="${VAULT}/_queue.md"
```

If `$Q` or `$KD` don't exist, stop and report — this command is a no-op outside a vault
using the kanban-descriptions convention.

---

## Step 1 — Find the live-board boundary in `_queue.md`

```bash
grep -n "^##" "$Q"
```

The live board is every card between the first heading (`## 📥 Pending`) and the
`## Archive` heading, **exclusive of `## Archive` itself**. Everything from
`## Archive` onward is already off-board.

Extract every card title referenced on the live board via `[[wikilink]]` syntax. Titles
starting with `[` (e.g. `[BUG] ...`) break a naive
`\[\[([^]]+)\]\]` regex because of the nested brackets — after extracting with regex,
always re-verify each *excluded* (i.e. archive-candidate) title with a plain
`grep -qF "$title"` against the live-board line range before trusting it's absent. This
caught real false positives in manual runs — do not skip this re-verification pass.

---

## Step 2 — Archive orphaned description files (always runs)

```bash
find "$KD" -maxdepth 1 -name "*.md" -print0 | while IFS= read -r -d '' f; do basename "$f" .md; done | sort > /tmp/desc_files.txt
```

Diff `desc_files.txt` against the live-board titles from Step 1. Any description file
whose title is **not** on the live board is an archive candidate — including titles
that appear only in `## Archive`, and titles that appear nowhere in `_queue.md` at all
(orphaned notes with no card).

Before moving anything, print the candidate list and move count for the user to see
(no separate confirmation gate needed for this step — it mirrors what's already
off-board, so it's low-risk. Use judgement: if the candidate list is unexpectedly large,
e.g. more than half of all description files, stop and confirm first rather than
assume the queue file is in the expected state).

Move each candidate `.md` (and any `.bak`/`.pre-collapse.bak` siblings) into `$ARCHIVE`.

---

## Step 3 — Archive orphaned attachments (always runs)

```bash
find "$KD" -maxdepth 1 -name "*.png" | sort
```

For each loose image at the top level of `$KD`, grep for its filename across:
- Remaining **live** `.md` files directly in `$KD` (top level, post-Step-2 move)
- `.md` files in `$ARCHIVE`

Classify:
- Referenced only by archived notes → move to `$ARCHIVE`
- Referenced by a live note → leave in place
- Referenced nowhere → **leave in place, do not delete or move.** Flag it in the final
  report as unresolved (unowned attachment) — do not guess which ticket it belongs to.
  Do not delete images under any circumstances; this command only moves files, never
  deletes them.

---

## Step 4 — Archive stale Done cards (only if `$ARGUMENTS` requests it, or on explicit ask)

This step edits `_queue.md` itself and is more consequential than Steps 2–3 (it changes
what's considered "done this cycle" for the team, not just file location). Only run it
when the user's invocation asks for it — e.g. `/kanban-cleanup done` or the user
separately says "archive Done cards too" / "archive tickets in Done we're not working
on this week." Do not run it by default on a bare `/kanban-cleanup`.

When running:

1. Read every card in `## ✅ Done` with its `Started:` / `Completed:` (or `Round N:`)
   dates.
2. Determine the current work window. Default: the current week, Monday through today
   (use the actual current date, not a remembered one). If the user names a different
   cutoff ("older than 3 days", "before the 15th"), use that instead.
3. Classify each Done card by its **most recent** completion/round date:
   - Most recent activity inside the window → keep in Done
   - Most recent activity before the window → archive candidate
4. **Gate — ask the user before touching `_queue.md`.** Present the archive-candidate
   list with titles and dates (a short table or list is enough, not a wall of text). Do
   not proceed until confirmed. This step moves real ticket history, not just file
   locations — get it right rather than fast.
5. On confirmation: cut each confirmed card's full block (title line through the line
   before the next `- [x]`/`- [ ]` card or the next `##` heading — preserve every line
   of detail, do not summarize or truncate) out of `## ✅ Done` and prepend the blocks,
   in the same order, immediately after the `## Archive` heading line.
6. Re-run Steps 2–3 afterward so the newly-archived cards' description files and
   attachments move too — don't duplicate logic, just re-enter Step 2 with the updated
   `_queue.md` state.

---

## Step 5 — Report

```
🧹  Kanban cleanup complete

  Description files archived: [N]
    • [title] → _archive/
    ...

  Attachments archived: [N]
  Attachments left unresolved (unowned, not moved): [N]
    • Pasted image [name].png — not referenced by any note, left in place

  Done cards archived: [N] (only if Step 4 ran)
    • [title] (last activity: [date])
    ...

  Live board unchanged: [N] description files remain (matching current board cards)
```

If Step 4 did not run, add a one-line note: `Done-card archiving skipped — pass "done" or ask explicitly to also sweep stale Done cards.`

---
title: Testing Queue
type: queue
last_updated: {{DATE}}
---

kanban-plugin: board

---

<!--
User-driven testing queue. Add a card here any time you want Artemis to test a specific
change, feature, or bug — no need to write a full test-case spec first. Run `/ticket` and
Artemis picks up the highest-priority card, tests it end-to-end, and updates the vault.

Requires the Obsidian "Kanban" community plugin (Settings → Community Plugins) to render
as a drag-and-drop board. Without the plugin this file still works — it's just a plain
markdown checklist grouped by heading.

## Card format
- Title: task description, optionally tagged with a priority (`#high`, `#medium`, `#low`)
- Title as a wikilink `[[Note Title]]` → a linked note file (same vault, one level up) holds
  the full detail: what changed, which behaviors/fields to focus on, known issues to recheck.
  Artemis reads the note, not just the card title.
- Notes (indented bullets under the card): what specifically to test. If both the notes and
  the linked note are empty, Artemis asks what to test before proceeding — it will not guess.

## Execution order (used by /ticket)
1. Highest-priority card from 📥 Pending: #high → #medium → #low → untagged → position wins ties.
2. If no notes/linked note exist, Artemis asks what to test first.
3. `/ticket [card title]` (or `/ticket` with no argument for the top card) is the only execution
   path for queue cards — it moves the card 🔄 In Progress → ✅ Done or 🚫 Blocked automatically,
   and updates vault docs (feature file, known-bugs.md, _pipeline.md) before marking it done.
4. Queue cards get the full pipeline: scope declaration, targeted validation against the note,
   comprehensive edge-case coverage, vault updates, and a copy-paste-ready report — not a
   partial targeted-only or edge-case-only pass.

Delete this comment block once you've read it — it's setup guidance, not part of the board.
-->

## 📥 Pending

- [ ] [[Example Ticket — replace with your first card]]
	  - Notes: what changed, which behaviors to focus on, any known issue to recheck

## 🔄 In Progress



## ✅ Done



## 🚫 Blocked


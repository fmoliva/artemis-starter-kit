---
title: APP_NAME_PLACEHOLDER — Testing Queue
type: warm-tier
---

kanban-plugin: board

---

<!--
User-driven testing queue. Add a card here any time you want Artemis to test a specific
change, feature, or bug — no need to write a full test-case spec first. Artemis picks up
the highest-priority card via `/ticket`.

Requires the Obsidian "Kanban" community plugin to render as a board. Without the plugin
this file still works — it's just a plain markdown checklist grouped by heading.

## Card format
- Title: task description, optionally tagged with a priority (`#high`, `#medium`, `#low`)
- Title as a wikilink `[[Note Title]]` → linked note file has the full detail (what changed,
  which TCs to focus on, known issues to recheck). Artemis reads the note, not just the title.
- Notes (indented bullets under the card): what specifically to test. If notes are empty,
  Artemis will ask what to test before proceeding — it will not guess from the title alone.

## Execution order (used by /ticket)
1. Highest-priority card from 📥 Pending: #high → #medium → #low → untagged → position wins ties.
2. If notes/linked note are absent, Artemis asks what to test first.
3. Run `/ticket [card title]` — this is the only execution path for queue cards.
   /ticket moves the card through 🔄 In Progress → ✅ Done or 🚫 Blocked automatically,
   and updates vault docs (feature file, known-bugs.md, pipeline) before marking it done.
4. Do not hand-run a partial flow (targeted-only, edge-case-only) against a queue card —
   queue cards get the full /ticket pipeline: scope declaration, targeted validation,
   comprehensive edge-case coverage, vault updates, and a written report.

Delete this comment block once you've read it — it's setup guidance, not part of the board.
-->

## 📥 Pending

- [ ] [[Example Ticket — replace with your first card]]
	  - Notes: what changed, which TCs to focus on, any known issue to recheck

## 🔄 In Progress



## ✅ Done



## 🚫 Blocked

## 🗄 Archive

<!-- /kanban-cleanup moves old Done cards here -->

---
name: Usage Log
type: reference
last_updated: [update as you go]
---

# Usage Log

Per-session record of browser-automation tool-call behavior for Artemis testing commands, so
`_token-budget.md` Budget Rules can be tuned from real evidence instead of assumption — especially
useful if you notice a change in your AI platform's usage allowance or cost between sessions.

**Logging is observational only.** It must never cause a testing step to be skipped, shortened, or
sampled instead of covered — the Stop-and-Ask, Server-Side Blocker, and full-coverage rules in
`AGENTS.md` all still apply in full. This log records what was already done; it does not change
what gets done.

## When to log

At the end of any command that opens a browser: `/explore`, `/verify`, `/ticket`, `/run`, `/bug`
(when it opens the browser to investigate).

## What to log

Always (no user input needed):
- Date, command, feature/module tested
- Rough tool-call tally: snapshot count, screenshot count, navigation count
- Which `_token-budget.md` Budget Rules were followed / skipped and why

When available (never solicited — only recorded if the user volunteers it):
- A usage or cost number your AI platform surfaces (e.g. a usage-percentage dashboard, a token/cost report)

## Session Log

| Date | Command | Feature/Module | Snapshots | Screenshots | Budget Rules Skipped | Usage/Cost | Notes |
|------|---------|-----------------|-----------|--------------|----------------------|------------|-------|
| — | — | — | — | — | — | — | (no entries yet) |

## Observations / Rule Changes

Running notes on patterns spotted in the log above, and any resulting change proposed to
`_token-budget.md`. Every proposed rule change should be confirmed with the user before adoption —
see the note at the top of this file.

(none yet)

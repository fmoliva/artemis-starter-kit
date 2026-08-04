---
title: APP_NAME_PLACEHOLDER — Pipeline Tracker
type: warm-tier
---

# Pipeline Tracker

Scan this file at session start. Features with `active_bugs ≠ none` or `Last Green = —` need attention.

## Attention Required

Features where `importance ≥ 0.7` AND (`active_bugs ≠ none` OR `Last Green = —`):

| Feature | Importance | Active Bugs | Last Green | Action |
|---------|-----------|------------|-----------|--------|
| _(none yet — populate as you explore)_ | | | | |

---

## All Features

| Feature | Vault File | TCs | Spec | Explored | Selectors | Last Green | importance | active_bugs |
|---------|-----------|-----|------|----------|-----------|-----------|-----------|------------|
| _(add rows as features are discovered)_ | | — | — | — | — | — | 0.5 | none |

---

## How to Read This Table

- **Vault File** — pointer to the feature's full documentation in the vault
- **TCs** — count of test cases written for this feature
- **Spec** — `✓` if a `.spec.ts` file exists
- **Explored** — date of last `/explore` run on this feature
- **Selectors** — `✓` confirmed / `partial` / `—` not yet explored
- **Last Green** — date of last passing `/verify` run; `—` means never run
- **importance** — 0.0–1.0 priority score (0.9 = open bugs + no green; 0.5 = stable; 0.3 = archived)
- **active_bugs** — comma-separated bug IDs from known-bugs.md; `none` if clean

## Pipeline Update Rules

Update this file **before** reporting results after every command:

| Trigger | Required update |
|---------|----------------|
| `/context [feature]` completes | TCs count, Spec = `✓`, Last Updated = today |
| `/explore [url]` completes | Explored = today; Selectors = `✓` or `partial` |
| `/verify [feature]` passes | Last Green = today; clear any active_bugs if resolved |
| Bug confirmed | Add bug ID to active_bugs column; set importance ≥ 0.7 |

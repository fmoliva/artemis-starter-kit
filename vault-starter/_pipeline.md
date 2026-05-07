---
title: Pipeline Tracker
type: tracker
last_updated: {{DATE}}
---

# Artemis Pipeline Tracker

Tracks which features have completed each stage: `/context` (TCs + spec written) → `/explore` (selectors confirmed) → `/verify` (tests confirmed green).

**Status symbols:** `✓` done · `—` not started · `⚠` stale (needs rerun) · dates as YYYY-MM-DD

**Stale rules:** Explored is `⚠` when `Last Updated > Explored` (selectors may have drifted). Last Green is `⚠` when `Last Updated > Last Green` (spec changed since last green run).

**Update rules:**
- After `/context [feature]`  → update TCs count + Last Updated
- After `/explore [feature]`  → update Explored date; update Selectors (partial → ✓ once all confirmed)
- After `/verify [feature]`   → update Last Green (clear ⚠ if set)

---

## Cross-Module Features

| Feature | TCs | Spec | Last Updated | Explored | Last Green | Selectors |
|---------|-----|------|--------------|----------|------------|-----------|
| {{Feature name}} | — | — | — | — | — | ? |

---

## {{Module 1}} Module

| Feature | TCs | Spec | Last Updated | Explored | Last Green | Selectors |
|---------|-----|------|--------------|----------|------------|-----------|
| {{Feature name}} | — | — | — | — | — | ? |

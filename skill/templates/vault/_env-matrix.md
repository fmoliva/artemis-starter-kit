---
title: Environment Matrix
description: Feature availability and last-verified date per deployment environment.
updated: YYYY-MM-DD
---

# Environment Matrix

Track which features are available and last verified in each environment.
Update a cell when you run /verify or confirm a feature works in that env.

**Symbols:**
- `✅ YYYY-MM-DD` — verified and passing on that date
- `⚠ YYYY-MM-DD` — present but known issue or partial pass
- `—` — not yet tested in this environment
- `n/a` — feature not deployed to this environment by design

---

## Cross-Module Features

| Feature | Dev | Staging | Prod | Notes |
|---------|-----|---------|------|-------|
| [Cross-module feature 1] | — | — | — | |
| [Cross-module feature 2] | — | — | n/a | [e.g. disabled in Prod by design] |

---

## [Module Name] Features

| Feature | Dev | Staging | Prod | Notes |
|---------|-----|---------|------|-------|
| [Feature 1] | — | — | — | |
| [Feature 2] | — | — | — | |

---

## Notes

- **Dev** — development environment; may have unstable builds
- **Staging** — primary QA target; mirrors Prod data structure
- **Prod** — production; view-only TCs only (no write operations)
- Add columns for additional environments as needed (e.g. UAT, Demo)

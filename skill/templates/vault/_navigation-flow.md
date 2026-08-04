---
title: APP_NAME_PLACEHOLDER — Navigation Flow
type: cold-tier
---

# Navigation Flow

Canonical expected redirects after each user action. Consult before assuming any nav behavior.

**Rule:** If an action is NOT listed here, state your assumption to the user before acting,
then add the confirmed flow here once verified.

---

## Login / Auth

| Action | Expected URL | Notes |
|--------|-------------|-------|
| Successful login | /[dashboard-path] | [TODO: confirm after first explore] |
| Session expired | /login | With redirect param |

## [Module 1]

| Action | Expected URL | Notes |
|--------|-------------|-------|
| [TODO: e.g. "Click Save on form"] | /[path] | |
| [TODO: e.g. "Modal confirm"] | /[path] | Non-obvious redirect |

---

<!-- Add flows here as you discover them. Never delete confirmed entries. -->
<!-- Format: Action | Expected URL | Notes (especially for non-obvious redirects) -->

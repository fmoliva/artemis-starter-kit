---
title: Navigation Flow
type: navigation-flow
module: global
last_updated: YYYY-MM-DD
---

# Confirmed Navigation Flows

This file is the canonical record of where the app goes after each user action.

**Rule:** Before taking any navigation step during testing, check this file first.
- If the flow is documented → proceed with confidence.
- If the flow is **not listed** → state your assumption to the user, wait for confirmation, then add the confirmed result here.

Never silently assume a redirect. One wrong assumption can cascade into hours of lost work.

---

## Login

| Action | From | Lands On | Notes |
|--------|------|----------|-------|
| Submit login form (valid credentials) | /login | [confirm your app's post-login URL] | |
| Submit login form (invalid credentials) | /login | /login | Error message shown |

---

## [Module Name — add your app's modules here]

| Action | From | Lands On | Notes |
|--------|------|----------|-------|
| [e.g. Click Cancel on location modal] | [from page] | [landing page] | [any non-obvious detail] |
| [e.g. Save form successfully] | [from page] | [landing page] | [redirect or stay?] |
| [e.g. Delete record] | [from page] | [landing page] | [confirmation dialog?] |

---

> Add confirmed flows here as they are discovered during `/explore` or `/verify` sessions.
> Use the exact URL paths (e.g. `/modules`, `/customers/search`) — not page titles.
> If a redirect is surprising or non-obvious, add a Notes column entry explaining why.

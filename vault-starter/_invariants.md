---
title: App Invariants
type: invariants
module: global
last_updated: YYYY-MM-DD
---

# Behavioral Invariants

These are confirmed behavioral facts about this application. Check here **FIRST** when diagnosing unexpected behavior — before re-running tests, before exploring the live app, before making assumptions.

They override model priors, "logical" deductions, and anything not confirmed against the live application.

---

## Auth & Session

- [document confirmed facts here — e.g. "Session expires after X minutes of inactivity"]
- [e.g. "Login button is disabled until both username and password fields are non-empty"]

## Navigation

- [e.g. "Cancel on the location modal → /dashboard (NOT the previous page)"]
- [e.g. "Direct URL to /feature without prior auth redirect → /login"]

## Forms

- [e.g. "Submit button stays disabled until all required fields are filled"]
- [e.g. "Required field indicator is * in the label, not a separate asterisk element"]

## Tables & Lists

- [e.g. "Default pagination is 50 rows — search is needed to find items beyond page 1"]
- [e.g. "Status badges are clickable and act as filters"]

## API

- [e.g. "POST /api/resource returns 201 on success, 422 on validation failure, 500 on server error"]
- [e.g. "Server-side errors return JSON with { message, errors } — not HTML"]

---

> Add entries here as they are confirmed via `/explore` or live testing.
> Each invariant should be a single, specific, testable statement.
> Remove entries if behavior changes — stale invariants cause false confidence.

---
title: APP_NAME_PLACEHOLDER — Known Bugs
type: cold-tier
---

# Known Bugs

This file is an **index only**. Full detail (TC evidence, endpoint, error, root cause)
lives in the feature vault file under `## Known Issues`.

| Bug ID | Feature | Title | Status | Date Found | Affected TCs |
|--------|---------|-------|--------|-----------|-------------|
| BUG-001 | [Feature] | [Short symptom description] | Open | YYYY-MM-DD | TC-001, TC-002 |

---

## Bug Status Values

- **Open** — confirmed, not yet fixed
- **Unconfirmed** — symptom observed, root cause unknown — needs user input
- **Blocked** — server-side error; cannot fix in spec layer
- **Fixed** — resolved; keep entry for traceability

## How to Log a Bug

1. Add a row here (index entry)
2. Add full detail under `## Known Issues` in the feature's vault file:
   - Symptom observed
   - Affected TCs
   - Endpoint + HTTP status
   - Root cause (if known)
   - Workaround (if any)
3. Update `_pipeline.md` — add bug ID to `active_bugs` column; set `importance ≥ 0.7`

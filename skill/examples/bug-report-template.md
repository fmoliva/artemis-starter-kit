# Bug Report Template

Copy this structure for every bug report created during Playwright Runner failures, exploratory QA, or the `/bug` command.

**File path:** `results/bugs/BUG-[module-slug]-[YYYY-MM-DD].md`
**Append** one `## BUG-NNN:` block per bug — multiple bugs per file, one file per module per day.

> **CRITICAL — Parser Format Rules:**
> - The heading MUST be `## BUG-NNN: Title` (2 hashes, number, colon) — the dashboard server parses this exactly
> - Fields MUST use `**Field:** value` inline format (NOT a table)
> - Sections MUST use `### Section Name` headers
> - Deviating from this format causes bugs to be invisible on the live dashboard

---

## File Header (create once per file, at the top)

```markdown
# Bug Report — [App Name] > [Module]
**Date:** YYYY-MM-DD
**Module:** [Module > Feature]
**Reporter:** Artemis Playwright Runner
**Run URL:** http://[app-url]

---
```

---

## Bug Entry Template (append one block per FAIL)

```markdown
## BUG-001: [Feature] — [What went wrong]

**TC:** TC-MOD-NNN
**Severity:** Critical / High / Medium / Low
**Status:** Open

### Description
[1–2 sentences describing what went wrong and where]

### Steps to Reproduce
1. Navigate to [URL]
2. [Action]
3. [Action that triggers the bug]

### Expected
[What should have happened]

### Actual
[What actually happened — be specific]

### Network Evidence
[METHOD] http://[host]/api/v1/[endpoint] => [STATUS] [Status Text]

### Console Error
[Error message — or "None observed"]

### Impact
[Severity justification — who is affected, what flow is blocked]

### URL
http://[app-url]/[path-at-failure]

### Screenshot
`results/screenshots/tc-MOD-NNN-fail.png`

### Possible Cause
[Root cause hypothesis — layer: UI / API / Data / State / Timing]

### Suggested Fix
[Non-prescriptive direction — where to look, not how to fix]
```

---

## Severity Reference

| Severity | Definition | Examples |
|----------|-----------|----|
| **Critical** | Blocks a core user flow; no workaround | Login failure, data loss on save, crash on essential page |
| **High** | Impairs a major feature; workaround exists but is painful | 500 on save, validation missing, filter returns wrong results |
| **Medium** | Affects secondary feature; easy workaround | Wrong error message, incorrect sort, hover state missing |
| **Low** | Cosmetic or very minor UX | Typo, alignment off by pixels, tooltip missing |

---

## Root Cause Layer Reference

| Layer | Key Indicators | Fix Focus |
|-------|--------------|-----------|
| **UI Bug** | Visible in screenshots, no network errors, DOM issue | Frontend component, CSS, JS handler |
| **API Bug** | Network request returns 4xx/5xx or unexpected 200 | Endpoint validation, response schema |
| **Data Bug** | Record saved incorrectly, wrong value persisted | DB constraints, ORMs, defaults |
| **State Management** | Works once, breaks on second try | State reset, cache invalidation |
| **Timing/Race** | Intermittent, works under slow conditions | Async guards, debounce |

---

## Status Values (for dashboard filtering)

- `Open` — not yet investigated
- `In Progress` — being fixed
- `Resolved — Fixed YYYY-MM-DD` — fix verified
- `Won't Fix` — accepted risk or by design

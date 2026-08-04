---
title: [Feature Name]
module: [module-name]
type: [feature | sub-feature | cross-module]
depends_on: []
importance: 0.5
active_bugs: []
last_updated: YYYY-MM-DD
---

# [Feature Name]

## Overview

[One paragraph describing what this feature does and who uses it.]

**Entry point:** `[/path/to/feature]`  
**Requires auth:** Yes / No  
**Roles with access:** [role names]

---

## Selectors

| Element | Selector | Confirmed |
|---------|----------|-----------|
| [Element name] | `[selector]` | ✓ / — |

---

## Behavior

[Document the feature's behavior: happy path, key interactions, form fields, validations.]

### Happy Path

1. [Step 1]
2. [Step 2]

### Validations

| Field | Rule | Error Message |
|-------|------|--------------|
| [Field] | [Required / Max 100 chars / etc.] | "[Error text]" |

---

## Known Issues

[Populated when a bug is confirmed. Link to known-bugs.md index entry.]

<!-- BUG-XXX: [title] — [symptom] | Endpoint: [url] | Status: Open -->

---

## Test Coverage

| TC ID | Title | Type | Status |
|-------|-------|------|--------|
| TC-XXX-001 | [Title] | Happy Path | Passing |

**Last Green:** —  
**Spec file:** `tests/[module]-[feature].spec.ts`

---

## Notes

[Any non-obvious constraints, workarounds, or behavioral facts worth preserving.]

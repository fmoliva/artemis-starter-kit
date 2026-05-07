---
title: {{Feature Name}}
type: feature                  # feature | sub-feature | form
subtype: {{page|modal|tab-section|form}}
parent: {{parent-feature}}     # sub-features only — omit if top-level feature
depends_on:                    # cross-module files to load when testing this feature
  - cross-module/{{dep}}
modules_that_use_this:         # which modules reference or navigate to this feature
  - {{module-a}}
  - {{other-module}}
last_updated: YYYY-MM-DD
---

# {{Feature Name}}

## URL / Trigger
`{{url}}` — or: triggered by {{action}} from [[{{parent}}]]

## Navigation to Trigger

> Required when `subtype: modal` or `subtype: tab-section` (no direct URL of its own).
> Omit for top-level pages that have a stable direct URL.

| Field | Value |
|-------|-------|
| Trigger page URL | `{{/path/to/page-containing-the-trigger}}` |
| Trigger element | `{{exact button text / link text / row action}}` |
| Prerequisite state | `{{e.g., record must meet condition X — or "None"}}` |
| Playwright path | `1. navigate to trigger page  2. [set prerequisite]  3. click trigger element` |

> After confirming this path, add a named journey to `_navigation-flow.md`.

## Purpose
{{one paragraph — what this feature does and why it exists}}

## Appears In
- [[{{module}}/{{parent-feature}}]] — {{how it is reached}}
- [[{{other-module}}/{{feature}}]] — {{how it is reached from the other module}}

## Dependencies
- [[_test-data]] — {{what test data is needed (records, credentials, programs)}}
- [[cross-module/{{dep}}]] — {{why this dependency is needed}}

---

## Controls

| Control | Type | Selector | Status | Notes |
|---------|------|----------|--------|-------|
| {{name}} | {{button\|input\|select\|combobox\|checkbox\|dialog\|…}} | `{{selector}}` | ✓/? | {{notes — gotchas, defaults, disabled states}} |

> Selectors marked `?` are inferred — confirm with `/explore` before writing specs.

---

## Business Rules
- {{rule}}
- {{rule}}

## Known Quirks
- {{quirk — selector gotchas, animation waits, Angular async behavior, PrimeNG patterns}}

## Edge Cases
- {{edge case and expected behavior}}

## Workflows
1. **Happy path**: {{ordered steps from entry point to completion}}
2. **{{alternate path}}**: {{steps}}

---

## Cross-Module Test Angles
- {{scenario that tests this feature from a second module's entry point}}
- {{integration test: verify output of this feature is visible in {{other-module}}}}

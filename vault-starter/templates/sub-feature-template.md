---
title: [Sub-Feature Name]
type: sub-feature
subtype: modal | sub-page | tab-section
module: [module-slug]
parent: [[parent-feature]]
last_updated: YYYY-MM-DD
---

# [Sub-Feature Name]

## Trigger
<!-- Choose one: -->
`modal` — triggered by `[button/action]` on [[parent-feature]]
`/[path]` — own URL (sub-page flow, e.g. `/[module]/[record-type]/{id}/[action]`)
`tab` — tab or section within [[parent-feature]] at `/[shared-url]`

## Navigation to Trigger

> Required when `subtype: modal` or `subtype: tab-section`. Omit for sub-pages with their own URL.

| Field | Value |
|-------|-------|
| Trigger page URL | `[/path/to/page-containing-the-trigger]` |
| Trigger element | `[exact button text / link text / row action]` |
| Prerequisite state | `[what must be true in the data — or "None"]` |
| Playwright path | `1. navigate to trigger page  2. [set prerequisite]  3. click trigger element` |

> After confirming this path, add a named journey to `_navigation-flow.md`.

## Appears In
<!-- List every parent feature that exposes this sub-feature -->
- [[parent-feature-1]] — triggered via [button name]
- [[parent-feature-2]] — triggered via [button name]

## Purpose
(What this sub-feature does — 1–2 sentences. Start from the user's action that opens it.)

## Dependencies
- [[_test-data]] — (which test data this sub-feature uses)

---

## Controls

| Control | Type | Selector | Notes |
|---------|------|----------|-------|
| Field Label | textbox | `getByLabel('Field Label')` | notes |
| Dropdown Label | combobox | `getByRole('combobox', { name: 'Label' })` | options |
| Button Label | button | `getByRole('button', { name: 'Label' })` | behavior |

## Table Columns
(comma-separated, or "None")

---

## Business Rules
- Rule 1
- Rule 2

## Known Quirks
- Timing / animation issues when modal opens
- Angular `formcontrolname` mismatches

## Edge Cases
- (specific to this sub-feature)

## Security
- XSS probe in [field]: `<script>alert('xss')</script>`
- SQL injection in [field]: `' OR '1'='1`

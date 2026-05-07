---
title: [Feature Name]
type: feature
module: [module-slug]
last_updated: YYYY-MM-DD
---

# [Feature Name]

## URL
`/[path]`

## Navigation to Trigger

> Required when `subtype: modal` or `subtype: tab-section` (no direct URL of its own).
> Omit for top-level pages that have a stable direct URL.

| Field | Value |
|-------|-------|
| Trigger page URL | `[/path/to/page-containing-the-trigger]` |
| Trigger element | `[exact button text / link text / row action]` |
| Prerequisite state | `[what must be true in the data — or "None"]` |
| Playwright path | `1. navigate to trigger page  2. [set prerequisite]  3. click trigger element` |

> After confirming this path, add a named journey to `_navigation-flow.md`.

## Purpose
(What this feature does — 1–2 sentences)

## Dependencies
- [[_test-data]] — (which test data this feature uses)

## Controls

| Control | Type | Selector hint | Notes |
|---------|------|---------------|-------|
| Field Label | textbox | `getByLabel('Field Label')` | notes |
| Dropdown Label | combobox | `getByRole('combobox', { name: 'Label' })` | options |
| Button Label | button | `getByRole('button', { name: 'Label' })` | behavior |

## Table Columns
(comma-separated column names)

## Business Rules
- Rule 1
- Rule 2

## Known Quirks
- Angular `formcontrolname` mismatches, timing issues, etc.

## Edge Cases
- Empty submit
- Whitespace-only input
- 500+ character input
- Accented / Unicode input (Ñoño José María)

## Security
- XSS probe in [field]: `<script>alert('xss')</script>`
- SQL injection in [field]: `' OR '1'='1`

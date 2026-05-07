# Cross-Module Features

Features in this folder are used by **two or more modules**. They are documented here rather than under a specific module so that dependencies are explicit.

## When to put a feature here

- The feature's output (a record, ID, session state) is consumed by another module
- The feature is accessible from the navigation of multiple modules
- The feature is a modal or dialog that can be triggered from anywhere

## Structure

Each file in this folder documents one cross-module feature:

```
cross-module/
├── record-search.md        ← example: used by every module that looks up a record
├── create-record.md        ← example: creates a record consumed by downstream modules
└── access-control.md       ← example: access control dialog in any module
```

## Frontmatter convention

```yaml
---
title: Feature Name
type: feature
modules_that_use_this:
  - module-a
  - module-b
depends_on:
  - cross-module/other-feature
last_updated: YYYY-MM-DD
---
```

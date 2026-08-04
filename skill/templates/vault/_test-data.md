---
title: APP_NAME_PLACEHOLDER — Test Data
type: hot-tier
---

# Test Data

## Default Credentials

| Role | Username | Password | Notes |
|------|----------|----------|-------|
| Primary | stored in .env as `APP_USERNAME` | stored in .env as `APP_PASSWORD` | Default test user |
| [Role 2] | stored in .env as `ROLE2_USERNAME` | stored in .env as `ROLE2_PASSWORD` | [description] |

## Primary Test Records

| Label | ID / Reference | Notes |
|-------|---------------|-------|
| Primary test record | [TODO: ID] | Safe to read and modify |
| Secondary test record | [TODO: ID] | Read-only reference record |
| Edge case record | [TODO: ID] | [TODO: what makes it special] |

## Standard Input Values

| Field Type | Test Value | Notes |
|-----------|-----------|-------|
| Name | Test User | Generic name for form fills |
| Email | test@example.com | Standard email |
| Phone | 555-0100 | Generic phone |
| Date | 1990-01-01 | Standard DOB / date input |
| Long text | `'A'.repeat(500)` | Max length probe |

## Edge Case Values

| Type | Value | Purpose |
|------|-------|---------|
| XSS probe | `<script>alert('xss')</script>` | Injection test |
| SQL probe | `' OR '1'='1` | SQL injection test |
| Whitespace | `   ` (4 spaces) | Blank input test |
| Unicode | `Ñoño José María` | Special character test |

## Known Safe-to-Create Records

[TODO: document record types that can be created during testing without side effects
(e.g., test users, draft records, temp registrations)]

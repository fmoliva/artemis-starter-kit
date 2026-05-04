# App Guide — [App Name]

This file is read by Artemis at the start of every run. The top sections are
auto-generated from a quick Playwright scan during first setup — verify them and
fill in the [TODO] sections before the first full test run.

---

## App Overview

| Field | Value |
|-------|-------|
| **App Name** | [App Name] |
| **App URL** | [https://your-app.example.com] |
| **Environment** | Dev / Staging / Production |
| **App Type** | [e.g. SaaS Dashboard, E-commerce, Admin Portal, CRM] |
| **Primary Users** | [e.g. Admin, Editor, Viewer, Customer] |
| **Last Updated** | YYYY-MM-DD |

---

## Credentials

Credentials are stored in `.env` — do not duplicate them here.
Reference roles below so Artemis knows which user type to use for which tests.

| Role | Env Variable | Can Access |
|------|-------------|------------|
| Role A | `ROLE_A_USERNAME` / `ROLE_A_PASSWORD` | [modules this role can access] |
| Role B | `ROLE_B_USERNAME` / `ROLE_B_PASSWORD` | [modules this role can access] |
| Role C | `ROLE_C_USERNAME` / `ROLE_C_PASSWORD` | [modules this role can access] |

---

## Test Data

> [TODO] Fill in real or synthetic records that exist in the system and are safe to modify.

### Primary Test Records

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | [Record 1 Name] | Primary test record |
| **ID** | [ID] | |
| **Status** | Active | |

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | [Record 2 Name] | Secondary test record |
| **ID** | [ID] | |
| **Status** | Active | |

> Add more rows as needed. Mark any records as "read-only" if they should not be edited.

### Standard Input Values

Values to use when filling forms during testing:

| Field Type | Test Value | Notes |
|-----------|-----------|-------|
| **Name** | Test User | |
| **Email** | test@example.com | |
| **Street** | 123 Main Street | |
| **City** | Springfield | |
| **State / Region** | [State] | |
| **Phone** | 555-0100 | |
| **Date** | 1990-01-15 | |

### Edge Case Values

Values to use during exploratory and security testing:

| Type | Value | Purpose |
|------|-------|---------|
| XSS probe | `<script>alert('xss')</script>` | Injection test |
| SQL probe | `' OR '1'='1` | SQL injection test |
| Long string | 500-character string of 'a' | Max length test |
| Whitespace | `   ` (4 spaces) | Blank input test |
| Unicode | `Ñoño José María` | Special character test |
| Emoji | `Test 🚀` | Emoji handling test |

---

## Modules and Features in Scope

> Auto-generated from nav scan — verify and update before first run.

| Module | Feature | In Scope | Notes |
|--------|---------|----------|-------|
| Auth | Login | ✅ | |
| Auth | Registration | ✅ | |
| Dashboard | Overview | ✅ | |
| [Module] | [Feature] | ✅ | |
| [Module] | [Feature] | ❌ | [reason out of scope] |
| [Module] | [Feature] | ⚠️ | Partially in scope — [limitation] |

---

## Known Behaviors (Not Bugs)

> [TODO] Document behaviors that look like bugs but are intentional. Artemis will not flag these.

| Page / Feature | Behavior | Reason |
|---------------|----------|--------|
| /dashboard | Loads slowly (~3–5s) | Known — large initial payload |
| /export | Export disabled on weekends | Business rule |
| Login page | Auto-redirects after 30 min | Session timeout — expected |
| Search | Minimum 3 characters required | Performance rule |

---

## Known Bugs (Active)

> Bugs already reported — Artemis should note if still present but not re-report them.

| Bug ID | Feature | Description | Status |
|--------|---------|-------------|--------|
| BUG-001 | [Feature] | [Description] | Open |

---

## App-Specific Selector Patterns

> Auto-generated from login page scan — verify and extend as you discover reliable selectors.

```typescript
// Login
page.getByLabel('Email')
page.getByLabel('Password')
page.getByRole('button', { name: 'Sign In' })

// Navigation
page.getByRole('link', { name: '[Module Name]' })

// Common actions
page.getByRole('button', { name: 'Save' })
page.getByRole('button', { name: 'Cancel' })
page.getByRole('button', { name: 'Submit' })

// Feedback
page.getByRole('alert')
page.getByText('Saved successfully')
```

---

## Testing Guidelines

> [TODO] Add any app-specific instructions that Artemis should follow during testing.

```
- After login, navigate to /dashboard before starting tests
- Session times out after 30 minutes — re-login if a test fails after a long wait
- [Add any navigation quirks, required pre-conditions, or workflow rules here]
```

---

## Performance Baselines

Expected response times for key operations (used to flag performance regressions):

| Operation | Expected | Warn at | Fail at |
|-----------|----------|---------|---------|
| Login | < 1s | > 2s | > 5s |
| List Page Load | < 1s | > 2s | > 4s |
| Form Submit | < 800ms | > 2s | > 4s |
| Search | < 500ms | > 1.5s | > 3s |
| Dashboard Load | < 3s | > 5s | > 8s |

---

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Product Owner | [Name] | [email] |
| Dev Lead | [Name] | [email] |
| QA Lead | [Name] | [email] |

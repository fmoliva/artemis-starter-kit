# Artemis QA — Agent Instructions

This project uses the Artemis QA pipeline: AI-assisted test generation + Playwright execution.
Read this file before writing any test code or vault content.

## Project Structure

```
project/
├── .env                       # APP_URL, APP_USERNAME, APP_PASSWORD (never commit)
├── .artemis-project           # App name (line 1) + vault path (context_vault=)
├── playwright.config.ts       # baseURL reads APP_URL from .env
├── tests/
│   ├── global-setup.ts        # Logs in once → saves session to playwright/.auth/user.json
│   └── *.spec.ts              # Playwright specs — storageState auth, no login in beforeEach
├── test-cases/                # TC library (markdown, one file per feature)
└── vault/                     # Context docs
    ├── _app-overview.md       # App identity, base URL, all module URLs, auth selectors
    ├── _test-data.md          # Test users, patients, credentials, IDs
    ├── _pipeline.md           # Coverage status per feature (TCs ✓, Spec ✓, Last Green)
    ├── known-bugs.md          # Open bugs that affect test design
    └── [feature].md           # Per-feature context, selectors, edge cases
```

## Auth Pattern

Login runs once via `global-setup.ts`, which saves the session to `playwright/.auth/user.json`.
Specs use `storageState` (configured in `playwright.config.ts`).

**Rule: never add `login()` to `beforeEach` in spec files.**

To switch environments: change `APP_URL` in `.env`, delete `playwright/.auth/user.json`, re-run.

## 3-Step Testing Pipeline

### Step 1 — Generate TCs and spec (no browser needed)

1. Read `vault/_app-overview.md` → app identity, module URLs, auth selectors
2. Read `vault/_test-data.md` → test users, patients, credentials
3. Read `vault/[feature].md` if it exists → feature-specific context and known selectors
4. Read `test-cases/[feature].md` if it exists → identify what's already covered
5. Generate/update `test-cases/[feature].md` with structured TCs (ID, title, steps, expected)
6. Generate `tests/[feature].spec.ts`:
   - Use relative URLs: `page.goto('/module/path')` — baseURL handles the host
   - Mark uncertain selectors: `// TODO: verify selector`
   - Never hardcode APP_URL in specs
7. Update `vault/_pipeline.md`: TC count, Spec ✓, date

### Step 2 — Confirm selectors (browser required)

1. Open `[APP_URL]/[module-path]` in the browser
2. For each `// TODO: verify selector` in the spec, inspect the live element
3. Replace the TODO comment with the confirmed selector
4. Record confirmed selectors in `vault/[feature].md` under a "Selectors" section
5. Update `vault/_pipeline.md`: Explored date

### Step 3 — Run and fix (browser required)

1. Run: `npx playwright test tests/[feature].spec.ts`
2. For failures: inspect the element in the live app, fix selector or assertion
3. Re-run until green
4. Update `vault/_pipeline.md`: Last Green date

**Rule: do not run Step 3 on a spec with `// TODO: verify selector` comments — run Step 2 first.**

## Slash Command Equivalents

If your tool doesn't support slash commands, use these prompts:

**Generate coverage:**
> "Read vault/_app-overview.md, vault/_test-data.md, and vault/[feature].md if it exists.
> Generate or update test-cases/[feature].md, then generate tests/[feature].spec.ts
> using relative URLs and storageState auth. Update vault/_pipeline.md."

**Explore selectors:**
> "Open [APP_URL]/[path] in the browser. Find all interactive elements.
> Replace every '// TODO: verify selector' in tests/[feature].spec.ts with confirmed selectors.
> Update vault/[feature].md with a Selectors section."

**Run and fix:**
> "Run npx playwright test tests/[feature].spec.ts.
> Fix any failures by inspecting the live element. Re-run until green.
> Update vault/_pipeline.md with today's Last Green date."

**Analyze a failure:**
> "Read the failure output. Read tests/[feature].spec.ts and test-cases/[feature].md.
> Read vault/known-bugs.md. Identify root cause and suggest a fix."

## Key Rules

- Relative URLs only in specs — `page.goto('/path')`, never `page.goto(process.env.APP_URL + '/path')`
- No `login()` in `beforeEach` — session comes from `storageState`
- Read vault before writing any test code
- Step 2 before Step 3 whenever `// TODO: verify selector` exists in the spec
- Delete `playwright/.auth/user.json` when switching environments

## Stop-and-Ask Rule — MANDATORY

If, after checking the vault AND completing one investigation attempt (exploration, script, or browser check), the root cause is still unclear:

1. **Log a preliminary bug entry** in `vault/known-bugs.md` with status `Unconfirmed`:
   - Title: describe the symptom observed
   - Module: affected module
   - Status: `Unconfirmed — needs user input`
2. **Stop immediately** — do NOT make additional attempts, write more scripts, or assume
3. Ask the user: state what was found, what was tried, and what is unclear

A second loop without user input is always a waste of tokens.
This applies to all commands and all phases of work.

## Server-Side Blocker Rule — MANDATORY

If any test run produces a server-side error — HTTP 5xx, DB constraint violation (`SQLSTATE`, `doesn't have a default value`), or a system administrator message in the UI — **stop immediately**:

1. Do NOT loop, retry, or attempt workarounds — this is a backend bug, not a spec issue
2. Report: feature name, affected TCs, exact error, endpoint
3. Log in `vault/known-bugs.md` and mark `_pipeline.md` as `⚠ blocked — server bug [date]`
4. Move on to the next feature

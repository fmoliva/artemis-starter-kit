# Artemis QA — GitHub Copilot Instructions

This is an Artemis QA project. Read `AGENTS.md` for the full methodology.

## Context to read before writing tests

- `vault/_app-overview.md` — app identity, base URL, module entry paths, auth selectors
- `vault/_test-data.md` — test users, records, credentials, account IDs
- `vault/[feature].md` — per-feature context and confirmed selectors
- `test-cases/[feature].md` — existing TC coverage (identify gaps before writing specs)

## Spec conventions

- **Relative `goto` only**: `page.goto('/search')` — `baseURL` in `playwright.config.ts`
  resolves the host from `APP_URL` in `.env`
- **No `login()` in `beforeEach`**: session is saved by `global-setup.ts` via `storageState`
- **Mark unverified selectors**: `// TODO: verify selector` — must be resolved before running
- **TC file alongside spec**: generate `test-cases/[feature].md` with the spec

## Pipeline

| Step | What to do |
|------|-----------|
| 1 — Context | Read vault → generate `test-cases/[feature].md` + `tests/[feature].spec.ts` |
| 2 — Explore | Open live URL → confirm selectors → patch `// TODO` comments |
| 3 — Verify | `npx playwright test tests/[feature].spec.ts` → fix → re-run until green |

## Stop-and-Ask Rule

If, after checking the vault AND completing one investigation attempt, root cause is still unclear:
- **Log a preliminary bug entry** in `vault/known-bugs.md` (status: `Unconfirmed — needs user input`) — the blocker is likely a bug even if root cause isn't confirmed
- Stop immediately — do NOT loop, write more scripts, or assume
- Ask the user: state what was found, what was tried, and what is unclear

If a test run hits a server-side error (HTTP 5xx, DB constraint, system administrator message):
- Stop immediately — do NOT retry or work around it
- Report to the user, log in `vault/known-bugs.md`, move to the next feature

## Usage & Token Logging Rule

At the end of any command that opens the browser, append a row to `vault/_usage-log.md`: date,
command, feature/module, a rough tool-call tally, and which `vault/_token-budget.md` Budget Rules
were followed/skipped. Attach a usage/cost number only if the user volunteers one — never ask for
it. This is observational only and must never cause a testing step to be skipped or shortened.

## Key paths

| Path | Purpose |
|------|---------|
| `.env` | `APP_URL`, `APP_USERNAME`, `APP_PASSWORD` — never commit |
| `playwright/.auth/user.json` | Saved login session — delete when switching environments |
| `vault/_pipeline.md` | Coverage tracker — update after each step |
| `vault/known-bugs.md` | Open bugs that affect test design — read before writing |
| `vault/_token-budget.md` | Token/usage Budget Rules — read before proposing any new rule |
| `vault/_usage-log.md` | Per-session usage log — append a row after every browser-touching command |

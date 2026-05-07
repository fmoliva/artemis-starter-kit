# Artemis QA — Gemini CLI Instructions

Read `AGENTS.md` for the full methodology, pipeline, and rules. This file adds Gemini-specific notes.

## Getting Started

1. Copy `.env.example` to `.env` and fill in `APP_URL`, `APP_USERNAME`, `APP_PASSWORD`
2. Run `npm install && npx playwright install chromium`
3. Read `vault/_app-overview.md` to understand the app structure and module URLs
4. Start with Step 1 of the pipeline (no browser needed): generate TCs and a spec

## Notes for Gemini CLI

- **No slash commands** — describe tasks in full using the prompts in AGENTS.md under
  "Slash Command Equivalents"
- **Browser tools** — use them for Step 2 (selector exploration) and Step 3 (run and fix)
- **Always read vault context** before generating test files — never write specs blind
- **Relative URLs only** in specs — `playwright.config.ts` resolves them against `APP_URL` in `.env`
- **No login in beforeEach** — session is saved by `global-setup.ts` via `storageState`
- **Switch environments** by changing `APP_URL` in `.env` and deleting `playwright/.auth/user.json`

## Stop-and-Ask Rule — MANDATORY

If, after checking the vault AND completing one investigation attempt, the root cause is still unclear:
- **Log a preliminary bug entry** in `vault/known-bugs.md` (status: `Unconfirmed — needs user input`) — the blocker is likely a bug even if root cause isn't confirmed
- Stop immediately — do NOT loop, write more scripts, or assume
- Ask the user: state what was found, what was tried, and what is unclear

If a test run hits a server-side error (HTTP 5xx, DB constraint, system administrator message):
- Stop immediately — do NOT retry or work around it
- Report the error to the user, log in `vault/known-bugs.md`, move to the next feature

## Typical Session

```
1. Read vault/_app-overview.md and vault/_test-data.md
2. Generate test-cases/[feature].md and tests/[feature].spec.ts (Step 1)
3. Open the live app URL, confirm selectors, patch // TODO comments (Step 2)
4. Run npx playwright test tests/[feature].spec.ts, fix failures, re-run until green (Step 3)
5. Update vault/_pipeline.md with TC count, spec status, and Last Green date
```

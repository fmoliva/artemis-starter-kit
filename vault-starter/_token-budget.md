---
name: Token Budget
type: reference
last_updated: [update after your first /audit]
---

## Session Context Footprint

Replace this table with measured line counts from your own project (an `/audit` run or a manual
`wc -l` on your hot-tier files gives you real numbers). Shape to fill in:

| Startup Phase | Files Loaded | Lines | ~Tokens |
|---------------|-------------|-------|---------|
| Hot tier (always) | `_app-overview.md` + `_test-data.md` + `_invariants.md` | | |
| Agent instructions | `CLAUDE.md` / `AGENTS.md` (auto-loaded by your tool) | | |
| Memory index (if used) | capped index file | | |
| **Base load per session** | | | |

## Per-Command Overhead

| Command | Additional Loads | Budget Tip |
|---------|-------------------|-----------|
| `/run` | spec file + TC file for 1 module | Load one module at a time — never run across all modules |
| `/explore` | live MCP browser snapshots (5–78 KB each) | Hard cap: 10 snapshots per session |
| `/context [module]` | vault module files for 1 module | Always pass a module name — never call without a scope |
| `/bug`, `/improve`, `/parse`, `/audit` | subagent-isolated | Subagent keeps cost out of main context — never run inline |
| `/matrix` | all TC files | Acceptable — read-only, no browser |

## Budget Rules (Learned in Session)

1. **CLI before MCP** — check for `.spec.ts` before opening any browser. CLI runs at ~0 token overhead vs. 200–500 for MCP snapshots.
2. **One module at a time** — never load all TC files unless doing `/matrix`.
3. **Subagent for analysis** — `/bug`, `/improve`, `/parse`, `/audit` isolate context in a subagent. Never run these inline.
4. **Hot-tier caps are hard limits** — keep `_app-overview.md`, `_test-data.md`, `_invariants.md` short (roughly 60–80 lines each). Do not let them grow past that without splitting content into a cold-tier file.
5. **Close the browser after explore** — before any execution phase. Saves the accumulated snapshot payload.
6. **Screenshot on fail only** — `screenshot: 'only-on-failure'` in `playwright.config.ts`.
7. **Targeted check over full snapshot for routine verification** — confirming a single field/value/state after an action already expected to succeed (e.g. a pre-populated field, a toggle result) should use a scoped query (a targeted find/evaluate call) instead of a full accessibility-tree snapshot. Does **not** apply to diagnosing an unexpected or failed result — that still requires a full snapshot before writing any fix. Reserve full snapshots for initial page discovery, failure diagnosis, or checking several elements at once.
8. **No redundant re-snapshot of unchanged state** — if no action occurred between two checks, reuse the previous snapshot's data instead of re-capturing.

## Usage Log

Per-session record of actual tool-call behavior (snapshot/screenshot counts, any usage/cost number your AI platform surfaces) lives in `_usage-log.md`, appended at the end of every browser-touching command. Use it to spot real patterns before proposing changes to the Budget Rules above — see that file's Observations section.

## Update Protocol

After any session that discovers a new pattern, update this file:
- Add a row to Per-Command Overhead if a new command was used
- Update line counts if vault files grew significantly
- Add a Budget Rule if a new token-saving insight was learned — confirm with the user before adopting any rule that could reduce test coverage, not just token spend

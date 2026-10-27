# Artemis hooks

Wired in `../settings.json`. Hook state lives in `.claude/.state/` (git-ignored); nothing is written outside the project, and no hook makes network calls. "Fail-open" = a hook bug never blocks work.

| Hook | Event / matcher | Enforces |
|------|-----------------|----------|
| `session-startup-guard.sh` | UserPromptSubmit | Startup sequence reminder, once per session |
| `vault-first-guard.sh` | PreToolUse AskUserQuestion | Check the vault before asking navigation/access questions |
| `nav-flow-guard.sh` | PreToolUse browser_navigate | Check `_navigation-flow.md` before assuming a redirect (reminder) |
| `subagent-browser-block.sh` | PreToolUse `^mcp__playwright__` | Browser work stays in the main session (subagents lack session state); opt out with `ARTEMIS_ALLOW_SUBAGENT_BROWSER=1` |
| `report-write-guard.sh` + `reference-read-logger.sh` | PreToolUse Write/Edit + PostToolUse Read | A report listing bugs requires a spec/requirements/mockup doc to have been read first |
| `done-bug-gate.sh` | PreToolUse Write/Edit | A queue card cannot move to Done while a bug ID it cites is still open in `known-bugs.md` |
| `state-assertion-guard.sh` + `recent-read-logger.sh` | PreToolUse Write/Edit + PostToolUse Read/Grep | Claims about card status / bug status require a fresh read (default 10 min, `ARTEMIS_FRESHNESS_WINDOW`) of `_queue.md` / `known-bugs.md` |
| `report-format-guard.sh` | PostToolUse Write/Edit | Canonical GitHub Report structure |
| `evidence-trace-check.sh` | PostToolUse Write/Edit | Each Field-by-Field section's `**Evidence:** path` must exist in-project, be non-trivial, and contain the row items (min size `ARTEMIS_MIN_EVIDENCE_BYTES`) |
| `detect-server-errors.sh` | PostToolUse Bash | Stop and report on server-side errors instead of retrying |

`lib/` holds shared helpers (`common.sh`, `hookfield.py`) and the Python logic behind the guards.

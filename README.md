# Artemis — AI-Powered QA Starter Kit

**Open this folder in Claude Code.** Claude detects your install state and guides you
through setup automatically — no commands to memorize, no docs to read first.

**Full documentation:** [artemis.html](artemis.html) — what it does, how agents work, all commands, diagrams.

**Manual setup (without Claude Code):** see ONBOARDING.md

## What's inside

| Folder | Contents |
|--------|----------|
| `skill/` | Artemis Claude skill + all commands |
| `agents/` | Subagents (bug analyst, auditor, parser) |
| `vault-starter/` | Second Brain vault scaffold |
| `project-starter/` | Playwright project scaffold |

## Requirements

- Node.js 18+
- Claude Code (`npm i -g @anthropic-ai/claude-code` or the Claude desktop app)
- Playwright (installed automatically by the setup wizard)

## Sharing a project with your team

The setup wizard places skill + agents inside `.claude/` (committed with the project repo)
and the vault as a separate git repo cloned into `./vault/` (gitignored in the project).
Teammates clone the project repo, open it in Claude Code, and Claude walks them through
entering their own credentials. A session-start sync check reminds everyone to pull before
testing.

## 3-Step Testing Pipeline

| Step | Command | What it produces |
|------|---------|-----------------|
| 1 | `/context [feature]` | TC file + Playwright spec (zero browser) |
| 2 | `/explore [url]` | Confirmed selectors, updated catalog |
| 3 | `/verify [feature]` | Green run, auto-fixed spec |

## Key Commands

| Command | What it does |
|---------|-------------|
| `/ingest` | Promote raw vault notes → structured feature files |
| `/sync` | Pull latest updates for project + vault |
| `/rerun` | Re-run existing spec via CLI (zero MCP tokens) |
| `/setup` | Reconfigure project after initial setup |
| `/audit` | Full health check: skill files, vault, specs, token budget |

## Vault Templates

All templates in `vault-starter/templates/` include a `## Navigation to Trigger` section for modal and tab-section features. This is the machine-readable trigger path that Artemis uses to generate correct `beforeEach` in Playwright specs — preventing wrong trigger assumptions when writing specs without a browser.

## Token Optimization

See `skill/references/optimization.md` for: token overflow detection, data split protocol after `/explore`, file size budgets, session checkpoint format, and CLI vs MCP cost ratios.

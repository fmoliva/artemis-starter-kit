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

## Getting Started

### Step 1 — Install prerequisites

Run the setup script — it installs Node.js, Python 3, and Git automatically if they're not already present:

**Mac/Linux:**
```bash
bash setup-prereqs.sh
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy RemoteSigned -File setup-prereqs.ps1
```

Install these two manually (not automated):

| Tool | Why | Download |
|------|-----|----------|
| **Claude Code** | The AI that runs everything | https://claude.ai/code |
| **Obsidian** *(recommended)* | Browse the vault knowledge base | https://obsidian.md |

### Step 2 — Open in Claude Code

Open this folder in Claude Code. Claude detects your install state and guides you through the rest of setup automatically — Playwright, credentials, vault, MCP.

## Requirements

- Node.js 18+
- Python 3.10+
- Claude Code (`npm i -g @anthropic-ai/claude-code` or the Claude desktop app)
- Playwright (installed automatically by the setup wizard)

## Sharing a project with your team

The setup wizard places skill + agents inside `.claude/` (committed with the project repo)
and the vault as a separate git repo cloned into `./vault/` (gitignored in the project).
Teammates clone the project repo, open it in Claude Code, and Claude walks them through
entering their own credentials. A session-start sync check reminds everyone to pull before
testing.

## AI Subagents

Artemis includes 4 specialized subagents that Claude spawns automatically for deep analysis tasks. Each runs in isolation — no browser, pure file analysis — and writes its output to a structured location.

| Subagent | Triggered by | What it does |
|----------|-------------|--------------|
| **artemis-bug-analyst** | `/bug`, `/improve`, `/scope` | Reproduces failures, classifies the root cause layer (UI / API / Data / State / Timing), scores test suites on 5 axes, and ranks regression targets by relevance. Writes structured bug reports to `results/bugs/`. |
| **artemis-parser** | `/parse`, `/ingest` | Converts any input — DOCX, markdown, prose, tables, checklists — into structured Artemis test cases. Normalizes TC IDs, detects edge cases, and outputs directly to the TC library. |
| **artemis-auditor** | `/audit` | Runs a 4-pass project health check: project folder cleanliness, vault file freshness, memory file quality, and token budget usage. Writes a report to `results/audits/`. |
| **artemis-compliance-auditor** | `/compliance` | Read-only audit of completed `/ticket` cards against every mandatory output (report structure, card stub, vault updates, bug log, pipeline row, queue column). Verifies artifacts on disk, never the ticket's own claims. |
| **artemis-documenter** | `/document` | Reads vault feature files and explore screenshots to generate BA/SA-style developer reference documents (`.md` + `.docx`). Includes field matrices, conditional logic tables, navigation steps, and known quirks. No browser needed. |

---

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
| `/ticket [title?]` | Test the top card in `vault/_queue.md` (or a named one) end-to-end |
| `/compliance [title?]` | Independently audit completed tickets against `/ticket`'s mandatory outputs |
| `/kanban-cleanup` | Archive stale ticket description files and old Done cards from the queue |

## Testing Queue (`vault/_queue.md`)

The vault ships with a Kanban-style testing queue (📥 Pending / 🔄 In Progress / ✅ Done / 🚫 Blocked).
Add a card any time you want something tested — a new feature, a bug fix to verify, an edge
case you thought of — with a linked note describing what changed. Run `/ticket` (no argument
picks the highest-priority pending card) and Artemis reads the card, tests it end-to-end
(targeted validation + comprehensive edge-case coverage), and updates the vault with results
before moving the card to Done or Blocked. It then automatically picks up the next Pending card
and keeps going — no need to re-run `/ticket` per card or wrap it in a loop; it only pauses for
a missing/untestable note, an oversized scenario matrix, or a Stop-and-Ask/Server-Side Blocker
hit mid-ticket. Install the free **Kanban** community plugin in Obsidian to render it as a
drag-and-drop board — the file works fine without it too.

## Vault Templates

All templates in `vault-starter/templates/` include a `## Navigation to Trigger` section for modal and tab-section features. This is the machine-readable trigger path that Artemis uses to generate correct `beforeEach` in Playwright specs — preventing wrong trigger assumptions when writing specs without a browser.

## Token Optimization

See `skill/references/optimization.md` for: token overflow detection, data split protocol after `/explore`, file size budgets, session checkpoint format, and CLI vs MCP cost ratios.

---

## Security notes

- **Setup scripts** never pipe a downloaded script into a shell. `setup-prereqs.sh` / `.ps1` ask before installing anything (`--yes` skips the prompt for `.sh`) and use your OS package manager. Homebrew, if missing, must be installed by you from [brew.sh](https://brew.sh).
- **Live server** (`server.js`) binds to `127.0.0.1` with CORS limited to the local dashboard. To share on a LAN set `HOST=0.0.0.0` **and** `TEAM_TOKEN` (the server refuses to start otherwise).
- **Hooks** run only local scripts, make no network calls and keep state under `.claude/.state/` (git-ignored). See `project-starter/.claude/hooks/README.md`.
- **Secrets** live only in `.env` (git-ignored). Never commit real credentials, URLs or client names to this repo.

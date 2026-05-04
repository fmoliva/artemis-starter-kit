# Artemis — AI QA Testing Specialist

Artemis is a Claude Code skill that orchestrates a **7-agent pipeline** for comprehensive web application testing. It combines the expertise of a manual tester, Playwright automation engineer, exploratory testing specialist, performance engineer, and bug analyst — all driven by AI.

> **Philosophy:** The application is guilty until proven innocent. Every input field is a potential crash site. Every workflow has a path the developer didn't think about. Artemis finds those paths before users do.

---

## Get Started in 5 Minutes

```bash
# 1. Clone or unzip the skill
git clone <your-repo-url> ~/.claude/skills/artemis

# 2. Install all slash commands
bash ~/.claude/skills/artemis/setup.sh

# 3. Restart Claude Code, then initialize your first project
/init my-app http://your-app-url.com

# 4. Run your first QA session
/artemis http://your-app-url.com
```

Dashboard opens automatically at **http://localhost:7373**

→ See [GETTING_STARTED.md](GETTING_STARTED.md) for the full step-by-step guide including Playwright MCP setup.

---

## Features

- **7-agent pipeline** — Orchestrator, Test Case Parser, Playwright Runner, Exploratory QA, Load Tester, Bug Analyzer, and Test Improver
- **Live dashboard** — Real-time test run status with pass/fail counts, bug tracking, and run history
- **13 slash commands** — Full pipeline or individual agents on demand
- **AI test generation** — Generate test cases from feature descriptions or existing docs
- **Auto git push gate** — Detects changes to test cases or bugs after every run and asks for human approval before pushing
- **Portability** — Export and import test cases across projects
- **Regression scope** — Smart scope detection to run only affected tests

---

## Requirements

- [Claude Code](https://claude.ai/code) — required (does not work in chat-only mode)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) installed and configured
- Node.js ≥ 18 (for the live dashboard server)

---

## Installation

**1. Copy the skill to your Claude skills folder:**
```bash
git clone <your-repo-url> ~/.claude/skills/artemis
```

**2. Run setup to install all slash commands:**
```bash
bash ~/.claude/skills/artemis/setup.sh
```

This installs all 13 Artemis commands into `~/.claude/commands/` so they appear in the Claude Code `/` menu.

**3. Restart Claude Code.**

**4. Initialize your first project:**
```
/init my-app http://your-app-url.com
```

---

## Team Setup

> **Note:** Artemis requires **Claude Code**. It does not work in Claude's chat-only web interface.

There are two ways your team can use Artemis depending on how they access Claude Code:

---

## Option 1 — Claude Code via Claude Desktop

### Authentication

With a **Claude Team plan**, no API key is needed. The team admin invites members via **[claude.ai/settings/team](https://claude.ai/settings/team)**. Each member gets their own login and Claude Code access is included automatically.

---

### macOS

**1. Install prerequisites**
```bash
# Install Node.js via Homebrew (or download from https://nodejs.org)
brew install node

# Verify
node -v
git --version
```

**2. Clone the skill**
```bash
git clone <your-repo-url> ~/.claude/skills/artemis
```

**3. Run setup**
```bash
bash ~/.claude/skills/artemis/setup.sh
```

**4. Install Playwright MCP**

In Claude Desktop → Settings → Developer → MCP Servers, add:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**5. Sign in and restart Claude Desktop**

Sign in with your team account email. Artemis slash commands (`/artemis`, `/run`, `/explore`, etc.) will now appear in the `/` menu.

---

### Windows

**1. Install prerequisites**
- [Node.js](https://nodejs.org) — download and run the installer
- [Git for Windows](https://git-scm.com/download/win) — includes Git Bash

> Run all commands below in **Git Bash** (not PowerShell or CMD).

**2. Clone the skill**
```bash
git clone <your-repo-url> ~/.claude/skills/artemis
```

**3. Run setup**
```bash
bash ~/.claude/skills/artemis/setup.sh
```

**4. Install Playwright MCP**

In Claude Desktop → Settings → Developer → MCP Servers, add:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**5. Sign in and restart Claude Desktop**

Sign in with your team account email. Artemis slash commands will now appear in the `/` menu.

---

### Verify (Claude Desktop)

Type `/artemis` in Claude Desktop — if the command appears in the suggestion menu, setup is complete.

---

## Option 2 — Claude CLI only (terminal)

For team members who prefer working entirely in the terminal without Claude Desktop.

### Authentication

Claude CLI uses an API key. Each member sets it once:

```bash
# Set the API key
claude config set apiKey YOUR_API_KEY

# Or via environment variable in ~/.zshrc or ~/.bashrc
export ANTHROPIC_API_KEY=your_api_key_here
```

> Get your API key from [console.anthropic.com](https://console.anthropic.com) → API Keys.
> Never commit the API key to any repository.

---

### macOS

**1. Install prerequisites**
```bash
# Install Node.js
brew install node

# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Verify
claude --version
node -v
```

**2. Clone the skill**
```bash
git clone <your-repo-url> ~/.claude/skills/artemis
```

**3. Run setup**
```bash
bash ~/.claude/skills/artemis/setup.sh
```

**4. Install Playwright MCP**

Add this to `~/.claude/settings.json` under `mcpServers`:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**5. Set your API key and start Claude**
```bash
claude config set apiKey YOUR_API_KEY
claude
```

---

### Windows

**1. Install prerequisites**
- [Node.js](https://nodejs.org) — download and run the installer
- [Git for Windows](https://git-scm.com/download/win) — includes Git Bash

```bash
# In Git Bash — install Claude CLI
npm install -g @anthropic-ai/claude-code
```

**2. Clone the skill**
```bash
git clone <your-repo-url> ~/.claude/skills/artemis
```

**3. Run setup**
```bash
bash ~/.claude/skills/artemis/setup.sh
```

**4. Install Playwright MCP**

Add this to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**5. Set your API key and start Claude**
```bash
claude config set apiKey YOUR_API_KEY
claude
```

---

### Verify (CLI)

Inside the Claude CLI session, type `/artemis` — if the command appears, setup is complete.

---

## Commands

| Command | Description |
|---|---|
| `/init [app-name]` | Scaffold a new project (run once per app) |
| `/artemis [url]` | Run the full 7-agent QA pipeline |
| `/run [tc-id]` | Execute specific test cases |
| `/explore [module]` | Exploratory testing on a module |
| `/scope [feature]` | Determine regression scope for a change |
| `/parse [doc]` | Convert a doc/text into structured test cases |
| `/improve` | Analyze failures and improve test cases |
| `/matrix` | Generate a coverage matrix |
| `/diff [branch]` | Run tests affected by a git diff |
| `/load [url]` | Run load/performance tests |
| `/port [project]` | Port test cases to another project |
| `/bug [id]` | Deep-dive analysis on a specific bug |
| `/dashboard` | Rebuild the test case checklist HTML |

---

## Project Structure

```
artemis/
├── SKILL.md                  # Main skill definition loaded by Claude Code
├── GETTING_STARTED.md        # Quick-start guide for new users
├── setup.sh                  # Installs slash commands into ~/.claude/commands/
├── commands/                 # 13 slash command definitions
├── references/               # Agent behavior reference docs (part-1 to part-14)
│   ├── part-1-orchestrator.md
│   ├── part-3-playwright-runner.md
│   ├── part-14-human-in-the-loop.md
│   ├── skill-learnings.md    # Accumulated behavioral rules
│   └── ...
├── templates/                # Server scripts copied to new projects by /init
│   ├── server.js             # Live dashboard backend (Node.js + SQLite)
│   ├── package.json
│   └── scripts/
│       ├── setup-db.js
│       ├── write-result.js
│       ├── write-bug.js
│       ├── query-tcs.js
│       ├── migrate-tcs.js
│       └── store-walkthrough.js
└── examples/                 # Output templates
    ├── test-case-template.md
    ├── bug-report-template.md
    └── ...
```

---

## Access & Pricing

Artemis is a paid skill distributed via:

- **GitHub (private repo)** — purchase access at `<your-sales-url>`
- **Gumroad (ZIP download)** — available at `<your-gumroad-url>`

After purchase, you'll receive access to the private repository or a download link for the ZIP file. Follow the [GETTING_STARTED.md](GETTING_STARTED.md) guide to be up and running in under 5 minutes.

---

## Changelog

### v1.0.0 — 2026-03-24
- Initial release
- 7-agent QA pipeline (Orchestrator, Parser, Playwright Runner, Exploratory QA, Load Tester, Bug Analyzer, Test Improver)
- Live dashboard with real-time pass/fail tracking
- 12 slash commands (`/artemis`, `/run`, `/explore`, `/scope`, `/parse`, `/improve`, `/matrix`, `/diff`, `/load`, `/port`, `/bug`, `/dashboard`)
- AI test case generation from feature descriptions and docs
- Auto git push gate — detects test case / bug changes after every run and prompts for human approval
- Test case portability across projects
- Regression scope detection

---

## License

Copyright © 2026 <Your Company Name>. All Rights Reserved.
Unauthorized use, copying, or distribution is strictly prohibited.

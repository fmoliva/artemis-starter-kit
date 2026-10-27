# Getting Started with Artemis

Get from zero to running your first AI-powered QA session in under 5 minutes.

---

## Prerequisites

- [Claude Code](https://claude.ai/code) — required (does not work in chat-only mode)
- [Node.js](https://nodejs.org) ≥ 18
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) — required for browser automation

---

## Step 1 — Install the Skill

**Option A: Clone (recommended — get updates via `git pull`)**
```bash
git clone <your-repo-url> ~/.claude/skills/artemis
```

**Option B: Unzip**
```bash
unzip artemis.zip -d ~/.claude/skills/artemis
```

---

## Step 2 — Run Setup

```bash
bash ~/.claude/skills/artemis/setup.sh
```

This installs all 13 slash commands (`/artemis`, `/run`, `/explore`, `/init`, etc.) into `~/.claude/commands/`.

---

## Step 3 — Install Playwright MCP

Add to your Claude Code MCP configuration (`~/.claude/settings.json` or Claude Desktop → Settings → Developer → MCP Servers):

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

---

## Step 4 — Restart Claude Code

After restarting, type `/` in a Claude Code session — you should see the Artemis commands in the menu.

---

## Step 5 — Initialize Your First Project

Open Claude Code in the directory where you want to store your test files, then run:

```
/init my-app http://your-app-url.com
```

This creates:
- `my-app/` — project folder with live dashboard server and all scripts
- `my-app/app-guide.md` — fill this with your app's credentials and test data
- `.artemis-project` — tells all Artemis commands which project to use (auto-created)

---

## Step 6 — Fill in app-guide.md

Open `my-app/app-guide.md` and fill in:
- Base URL
- Login credentials (test account)
- Any known test data (user IDs, sample records, etc.)
- Known behaviors / quirks

This helps Artemis run tests accurately and skip common blockers.

---

## Step 6.5 — (Optional) Set Up a Context Vault + Testing Queue

If you're using the full starter kit (not just the standalone skill), `vault-starter/` ships
a Kanban-style testing queue at `_queue.md` (📥 Pending / 🔄 In Progress / ✅ Done / 🚫 Blocked).
Add a card any time you want something tested — a new feature, a bug fix to verify, an edge
case you thought of — then run `/ticket` (no argument grabs the highest-priority pending
card). Artemis reads the card, tests it end-to-end, and updates the vault with results.
Install the free **Kanban** Obsidian community plugin to render it as a drag-and-drop board.
See `ONBOARDING.md` for the full vault setup walkthrough.

---

## Step 7 — Run Your First Test

```
/artemis http://your-app-url.com
```

Artemis will:
1. Show Gate 1 — pre-run confirmation (approve to continue)
2. Open the live dashboard at `http://localhost:7373`
3. Explore the app and generate test cases
4. Execute tests with Playwright, logging results live
5. Analyze any failures
6. Generate a full QA + performance report

---

## Commands Quick Reference

| Command | What It Does |
|---|---|
| `/init [app-name]` | Scaffold a new project (run once per app) |
| `/artemis [url]` | Full 7-agent QA pipeline |
| `/run [scope] [url]` | Execute specific test cases |
| `/explore [url]` | Autonomous exploratory testing |
| `/context [feature]` | Generate TCs + specs from vault docs (zero browser) |
| `/ticket [title?]` | Test the top `_queue.md` card (or a named one) end-to-end |
| `/compliance [title?]` | Audit completed tickets against `/ticket`'s mandatory outputs |
| `/kanban-cleanup` | Archive stale ticket files and old Done cards |
| `/verify [feature]` | Re-run an existing spec, auto-fix broken selectors |
| `/parse [file]` | Convert docs/text → structured test cases |
| `/improve` | Review and improve existing test cases |
| `/matrix` | Generate a coverage matrix |
| `/scope [url] "change"` | Find which TCs to run after a code change |
| `/diff [proj1] [proj2]` | Compare two test case libraries |
| `/port [source] [target]` | Port test cases to a new app |
| `/load [url]` | Performance / load testing |
| `/bug [description]` | Deep analysis of a specific bug |
| `/dashboard` | Rebuild the test case checklist HTML |

---

## Troubleshooting

**Slash commands don't appear after setup:**
- Restart Claude Code completely
- Verify `~/.claude/commands/artemis.md` exists

**"No .artemis-project file found" error:**
- Run `/init [app-name]` first in your working directory
- The `.artemis-project` file must be in the directory where you open Claude Code

**Dashboard doesn't open at localhost:7373:**
- The server starts automatically during runs — no manual start needed
- If port 7373 is already in use: `lsof -ti:7373 | xargs kill -9`

**npm install fails:**
- Ensure Node.js ≥ 18: `node -v`
- Try: `cd [app-name] && npm install`

**Playwright MCP not detected:**
- Restart Claude Code after adding the MCP config
- Verify config is valid JSON: `cat ~/.claude/settings.json | python3 -m json.tool`

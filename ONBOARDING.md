> **Note:** This guide is for manual setup without Claude Code.
> If you are using Claude Code, open this folder — Claude will detect your install state
> and guide you through setup automatically. No commands to memorize, no docs to read first.

# Artemis QA — Onboarding Guide (Manual)

Step-by-step guide for setting up Artemis without Claude Code. Estimated time: 30–45 minutes.

---

## Prerequisites

Install these before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| Claude Code | latest | `npm install -g @anthropic-ai/claude-code` |
| Playwright | latest | installed per-project (see Step 3) |
| Obsidian (optional) | latest | https://obsidian.md — for the vault (any text editor works) |

Verify installs:
```bash
node --version       # should print v18+
claude --version     # should print a version number
```

---

## Step 1 — Install the Artemis Skill

The Artemis skill lives in `~/.claude/` and is available across all your projects.

**Option A — Automated (recommended):**
```bash
cd ~/Documents/Artemis\ Starter\ Kit
chmod +x setup.sh
./setup.sh
```

**Option B — Manual:**
```bash
# Copy skill
cp -r skill/ ~/.claude/skills/artemis/

# Copy agents
cp agents/*.md ~/.claude/agents/

# The commands are loaded automatically from the skill
```

Verify: open Claude Code in any project and type `/context` — you should see it in the command list.

---

## Step 2 — Set Up Your Vault (Second Brain)

The vault is a folder of markdown files where you document your app. Artemis reads this vault to generate test cases without needing browser access.

**Create your vault:**
```bash
cp -r vault-starter/ ~/path/to/your-app-vault
```

You can put this vault anywhere — a local folder, Obsidian vault, Google Drive, or Dropbox. You'll point to it in Step 4.

**Fill in the vault files:**

| File | What to write |
|------|--------------|
| `_app-overview.md` | App name, base URL, login URL, all module URLs, access roles |
| `_test-data.md` | Test credentials, test records/users, known-good data |
| `_pipeline.md` | Leave as-is — auto-updated by commands |
| `known-bugs.md` | Start empty — fill in as you find bugs |
| `_queue.md` | Optional testing queue — add a card any time you want something tested, then run `/ticket` |

**Document your first module:**
```bash
cp vault/templates/module-template.md vault/modules/[your-module]/[your-module].md
```
Fill in the Controls table with every input, button, and dropdown on the page.

---

## Step 3 — Set Up Your Playwright Project

**Copy the project scaffold:**
```bash
cp -r project-starter/ ~/path/to/your-project/
cd ~/path/to/your-project
```

**Install dependencies:**
```bash
npm install
npx playwright install chromium
```

**Configure your environment:**
```bash
cp .env.example .env
# Edit .env:
# APP_URL=https://your-app.example.com
# APP_USERNAME=your-test-user
# APP_PASSWORD=your-test-password
```

---

## Step 4 — Wire Up the Project

**Edit `.artemis-project`:**
```
your-project-folder-name
context_vault=/absolute/path/to/your-vault
```

Line 1 is the name of your project folder (used by scripts as `APP`).
Line 2 is the absolute path to the vault you created in Step 2.

**Edit `CLAUDE.md`:**
- Replace `[YOUR APP NAME]` with your app name
- Replace `[YOUR VAULT PATH]` with the path from `.artemis-project`
- Add your module URLs to the startup read list

---

## Step 5 — First Run

Open Claude Code in your project directory.

**Generate your first test cases:**
```
/context [your-module-name]
```
Claude reads your vault → detects coverage gaps → proposes test cases → writes a Playwright spec.

**Harvest live selectors:**
```
/explore https://your-app.example.com/your-module-url
```
Claude opens a browser → maps all inputs, buttons, dropdowns → updates the selector catalog.

**Run and verify:**
```
/verify [your-module-name]
```
Claude runs the spec → auto-fixes selector failures → confirms the catalog → records the green date.

**Or queue it up instead:**
Open `vault/_queue.md` and add a card under `## 📥 Pending` describing what to test (a new
feature, a bug fix, an edge case). Then run:
```
/ticket
```
Claude picks the highest-priority pending card, tests it end-to-end (targeted validation +
comprehensive scenario coverage), updates the vault, and moves the card to Done or Blocked.
Pass a title (`/ticket [card title]`) to target a specific card instead of the top one.

---

## Command Reference

| Command | What it does |
|---------|-------------|
| `/context [module]` | Zero-browser: reads vault → generates TCs + spec |
| `/explore [url]` | Browser: discovers selectors, builds sitemap |
| `/verify [module]` | Runs spec → diagnoses failures → auto-fixes selectors |
| `/ticket [title?]` | Test the top `_queue.md` card (or a named one) end-to-end — targeted + comprehensive coverage + vault updates |
| `/run [TC-ID] [url]` | Execute a specific test case via Playwright CLI |
| `/bug [description]` | Deep failure analysis via subagent |
| `/improve [spec-file]` | Review and score a test suite |
| `/parse [file-or-text]` | Convert any doc (DOCX, prose, checklist) into structured TCs |
| `/audit` | Health check: vault, memory, token budget, test coverage |
| `/matrix` | Coverage gap matrix across all features |

---

## Vault Structure Reference

```
your-vault/
├── _app-overview.md        ← loaded every session
├── _test-data.md           ← loaded every session
├── _pipeline.md            ← pipeline status: TCs, Explored, Last Green
├── _queue.md               ← Kanban testing queue — add cards, run /ticket to execute them
├── known-bugs.md           ← open bugs affecting test design
├── cross-module/           ← features used by 2+ modules
├── modules/
│   └── [module-name]/
│       ├── [module-name].md      ← module overview + feature list
│       └── [feature-name].md    ← individual feature docs
├── selectors/
│   └── [module-name].md         ← confirmed selector catalog
└── templates/                   ← scaffolds for new feature docs
```

---

## Feature Coverage Lifecycle

Every new feature follows this 3-step sequence:

| Step | Command | Pipeline update |
|------|---------|-----------------|
| 1 | `/context [feature]` | TCs count, Spec ✓, Last Updated |
| 2 | `/explore [url]` | Explored date, Selectors status |
| 3 | `/verify [feature]` | Last Green |

**Rule:** Do not run `/verify` on a spec with `// TODO: verify selector` comments without first running `/explore`. The pre-check in `/verify` will warn you if this is the case.

---

## Troubleshooting

**`/context` says vault not found:**
- Check that `.artemis-project` exists and `context_vault=` points to the correct absolute path
- Expand `~` to your full home path (e.g. `/Users/yourname/...`)

**`/explore` says browser already in use:**
- The MCP browser session is locked. Write a `.mjs` script and run it via `node` instead, or restart Claude Code.

**`/verify` shows selector failures on `// TODO` lines:**
- Expected — run `/explore [url]` first to confirm those selectors, then re-run `/verify`.

**Playwright auth fails:**
- Check `.env` credentials are correct
- Run `npx playwright test tests/global-setup.ts` manually to debug the login flow
- Make sure `playwright/.auth/` directory exists (create it if not)

**Tests navigate to wrong URL:**
- Verify `APP_URL` in `.env` starts with `https://`
- Check `playwright.config.ts` `baseURL` is using `process.env.APP_URL`

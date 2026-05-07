# Artemis Starter Kit

## On Every Session Start — State Detection

Run these checks immediately and act on the result:

```bash
ls .artemis-project 2>/dev/null && echo "HAS_PROJECT" || echo "NO_PROJECT"
ls .env 2>/dev/null && echo "HAS_ENV" || echo "NO_ENV"
```

| `.artemis-project` | `.env` | State | Action |
|--------------------|--------|-------|--------|
| Missing | Missing | A — Fresh install | Run Wizard A below |
| Present | Missing | B — New machine | Run Wizard B below |
| Present | Present | C — Configured | Run sync check + raw notification |
| Missing | Present | D — Broken config | Warn + offer `/setup` |

---

## State A — Fresh Install Wizard

Announce: "Welcome to Artemis! I'll guide you through setup — this takes about 2 minutes."

Ask each question and wait for the answer before continuing:

```
Q1: What is the name of the app you're testing?
    (e.g. "Patient Records System" — I'll create a project folder from this)

Q2: Do you have an existing vault repo, or are you starting fresh?
    (a) Starting fresh — create a new vault inside this project
    (b) I have a vault git repo — I'll give you the URL to clone
    (c) Vault is already on this machine — I'll enter the path

Q3 [only if Q2=b]: Vault repo URL?
Q3 [only if Q2=c]: Vault path on this machine?

Q4: Base URL of the app you're testing? (e.g. https://staging.myapp.com)
Q5: Your test username
Q6: Your test password (stored in .env only — never committed to git)
```

After all answers, scaffold:

```bash
APP_SLUG=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -d "'")

# Copy project scaffold
cp -r project-starter/ "${APP_SLUG}/"
mv "${APP_SLUG}/.artemis-project.example" "${APP_SLUG}/.artemis-project"

# Write .artemis-project
printf '%s\ncontext_vault=./vault\n' "${APP_SLUG}" > "${APP_SLUG}/.artemis-project"
[ -n "$VAULT_REPO_URL" ] && echo "vault_repo=${VAULT_REPO_URL}" >> "${APP_SLUG}/.artemis-project"

# Create .env from example (then fill with Edit tool)
cp "${APP_SLUG}/.env.example" "${APP_SLUG}/.env"

# Handle vault
# (a) Fresh: copy vault-starter/
cp -r vault-starter/ "${APP_SLUG}/vault/"
# (b) Clone: git clone "$VAULT_REPO_URL" "${APP_SLUG}/vault/"
# (c) Local: update context_vault= to absolute path, warn it is not portable

# Copy skill + agents into project
cp -r skill/ "${APP_SLUG}/.claude/skills/artemis/"
mkdir -p "${APP_SLUG}/.claude/agents"
cp -r agents/ "${APP_SLUG}/.claude/agents/"

# Install
cd "${APP_SLUG}" && npm install && npx playwright install chromium

# Smoke check
npx playwright test --list
```

Use the Edit tool to fill `.env` with APP_URL, APP_USERNAME, APP_PASSWORD.
If vault is fresh, use the Edit tool to fill `{{APP_NAME}}` and `{{BASE_URL}}` in `vault/_app-overview.md`.

Completion message:
```
✅  Artemis is ready for [AppName]!

  Project:  [APP_SLUG]/
  Vault:    [APP_SLUG]/vault/
  Skill:    [APP_SLUG]/.claude/skills/artemis/

  Vault is inside the project folder. Commit the repo to share with
  teammates — they open it and I'll walk them through their own setup.

Feature Coverage Lifecycle:
  1. /context [feature]  — write TCs + spec (zero browser)
  2. /explore [url]      — confirm live selectors
  3. /verify [feature]   — run spec → record green run

Next step: open [APP_SLUG]/ in Claude Code and run /context [first-feature]
```

---

## State B — Join Wizard (existing project, new machine)

Announce: "Welcome to [AppName]! I'll get your local environment set up."

```bash
APP=$(cat .artemis-project | head -1)
VAULT_PATH=$(grep context_vault .artemis-project | cut -d= -f2 | sed "s|~|$HOME|")
VAULT_REPO=$(grep vault_repo .artemis-project | cut -d= -f2)
```

1. Check if vault exists at `$VAULT_PATH`:
   - If `./vault/.git` present → vault already cloned, skip to Q1
   - If missing and `$VAULT_REPO` set → offer: "Clone vault from `$VAULT_REPO`? (yes / enter different path)"
     On yes: `git clone "$VAULT_REPO" ./vault/`
   - If missing and no `$VAULT_REPO` → ask: "Where is your copy of the vault? (path or git URL)"

2. Detect environments from `vault/_app-overview.md` — look for multiple URLs listed.
   If multiple found, show as choices. If only one, auto-fill and skip Q1.

Ask:
```
Q1 [if multiple environments]: Which environment are you testing? [list from vault]
Q2: Your test username
Q3: Your test password (stored in .env only — never committed)
```

Then:
```bash
cp .env.example .env   # fill APP_URL, APP_USERNAME, APP_PASSWORD via Edit tool
npm install
npx playwright install chromium
npx playwright test --list
```

Completion message:
```
✅  You're set up on this machine!

  Environment: [URL]
  Vault:       [vault path]
  Specs found: [N] files, [N] test cases

To run all tests:       npx playwright test
To run a single spec:   npx playwright test tests/[file].spec.ts
To add new coverage:    /context [feature-name]
```

---

## State C — Already Configured

### Sync Check

```bash
# Project
git fetch origin 2>/dev/null
PROJECT_BEHIND=$(git rev-list HEAD..origin/$(git branch --show-current) --count 2>/dev/null || echo "0")
PROJECT_LOG=$(git log HEAD..origin/$(git branch --show-current) --oneline 2>/dev/null | head -5)

# Vault (only if ./vault/.git exists)
VAULT_BEHIND=0
VAULT_LOG=""
if [ -d "./vault/.git" ]; then
  VAULT_BEHIND=$(cd vault && git fetch origin 2>/dev/null && \
    git rev-list HEAD..origin/$(git branch --show-current) --count 2>/dev/null || echo "0")
  VAULT_LOG=$(cd vault && git log HEAD..origin/$(git branch --show-current) --oneline 2>/dev/null | head -5)
fi
```

If both are 0: print `✓  Project and vault are up to date.`

If either is behind, print:
```
📡  Sync check — updates available:

  Project:  [N] commits behind origin/main
    • [commit list from PROJECT_LOG]

  Vault:    [N] commits behind origin/main
    • [commit list from VAULT_LOG]

  Run /sync to pull both before starting.
```

If fetch fails (offline): print `⚠  Sync check skipped — unable to reach origin.` and continue.

### Raw Notification

```bash
APP=$(cat .artemis-project | head -1)
VAULT=$(grep context_vault .artemis-project | cut -d= -f2 | sed "s|~|$HOME|")
RAW_PENDING=$(ls "${VAULT}/raw/"*.md 2>/dev/null | grep -v "_archive" | wc -l | tr -d ' ')
[ "$RAW_PENDING" -gt 0 ] && echo "📥  ${RAW_PENDING} unprocessed file(s) in raw/ — run /ingest to promote to vault."
```

Then continue with normal session startup: read vault files, check pipeline.

---

## State D — Broken Config

Print:
```
⚠  Found .env but no .artemis-project — configuration may be incomplete.
   Run /setup to reconfigure from scratch.
```

---

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

If any test run, investigation script, or browser interaction produces a server-side error — HTTP 5xx, DB constraint violation (`SQLSTATE`, `doesn't have a default value`, `Incorrect integer value`), or a system administrator message in the UI — **stop immediately**:

1. **Do NOT loop, retry, or attempt workarounds** — these are backend bugs, not spec issues
2. Report the blocker to the user with: feature name, affected TCs, exact error, endpoint
3. Log the bug in `vault/known-bugs.md`
4. Update `_pipeline.md`: mark the feature row `⚠ blocked — server bug [date]`
5. Move on to the next feature in the pipeline

## Key Commands (reference)

| Command | What it does |
|---------|-------------|
| `/setup` | Re-run the setup wizard (reconfigure or fix partial setup) |
| `/sync` | Pull updates from GitHub for both project and vault |
| `/ingest [file?]` | Promote raw/ content to structured vault locations |
| `/context [feature]` | Read vault → generate TCs + Playwright spec (zero browser) |
| `/explore [url]` | Browser discovery — harvest live selectors |
| `/verify [feature]` | Run spec → auto-fix failures → record green date |
| `/run [TC-ID] [url]` | Execute specific TCs |
| `/bug [description]` | Deep failure analysis via subagent |
| `/improve [test-file]` | Review + score test suite via subagent |

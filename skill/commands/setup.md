Load the artemis skill, then execute the /setup command with these arguments: $ARGUMENTS

Re-runs the setup wizard. Can be used to reconfigure an existing project, fix a broken
config, or onboard a second environment.

---

## Step 0 — Detect current state

```bash
ls .artemis-project 2>/dev/null && echo "HAS_PROJECT" || echo "NO_PROJECT"
ls .env 2>/dev/null && echo "HAS_ENV" || echo "NO_ENV"
```

| State | Condition | Action |
|-------|-----------|--------|
| A | No `.artemis-project`, no `.env` | Run Full Scaffold Wizard |
| B | `.artemis-project` present, no `.env` | Run Join Wizard |
| C | Both present | Confirm before overwriting (see below) |
| D | `.env` present, no `.artemis-project` | Warn broken config, continue with Wizard A |

---

## State C — Already configured

Print:
```
⚠  This project is already configured:
   App:   [APP from .artemis-project]
   Vault: [context_vault path]
   Env:   [APP_URL from .env]

   Re-running /setup will regenerate your .env (credentials will be overwritten).
   Vault and specs will NOT be touched.

   Continue? (yes / no)
```

On no → stop.
On yes → run Join Wizard (Wizard B) to re-enter credentials and environment URL.

---

## Wizard A — Full Scaffold

Ask each question and wait for the answer:

```
Q1: What is the name of the app you're testing?
    (e.g. "Acme Storefront" → folder: acme-storefront)

Q2: Do you have an existing vault repo, or are you starting fresh?
    (a) Starting fresh — create vault inside this project
    (b) Existing vault git repo — I'll give you the URL
    (c) Vault already on this machine — I'll enter the path

Q3 [if Q2=b]: Vault repo URL?
Q3 [if Q2=c]: Vault path on this machine?

Q4: Base URL of the app? (e.g. https://staging.myapp.com)
```

After Q4, create `.env` with `APP_URL` pre-filled and credentials as placeholders — do NOT ask for credentials in chat:

```bash
APP_SLUG=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -d "'")
cp "${APP_SLUG}/.env.example" "${APP_SLUG}/.env"
# Edit tool: fill APP_URL only — leave APP_USERNAME and APP_PASSWORD as placeholders
```

Then print:
```
📝  I've created .env with your base URL pre-filled.
    Open .env and fill in your test credentials:

      APP_USERNAME=your-test-username
      APP_PASSWORD=your-test-password

    This file is gitignored — credentials stay local and are never committed.
    Tell me when you're ready to continue.
```

Wait for user confirmation ("ready", "done", "ok") before proceeding with the rest of the scaffold.

Scaffold (after credential confirmation):

```bash
cp -r project-starter/ "${APP_SLUG}/"
mv "${APP_SLUG}/.artemis-project.example" "${APP_SLUG}/.artemis-project"

printf '%s\ncontext_vault=./vault\n' "${APP_SLUG}" > "${APP_SLUG}/.artemis-project"
[ -n "$VAULT_REPO_URL" ] && echo "vault_repo=${VAULT_REPO_URL}" >> "${APP_SLUG}/.artemis-project"

# .env was already created above — do not overwrite

# Vault handling:
# (a) cp -r vault-starter/ "${APP_SLUG}/vault/"
# (b) git clone "$VAULT_REPO_URL" "${APP_SLUG}/vault/"
# (c) Update context_vault= to absolute path (warn: not portable across machines)

cp -r skill/ "${APP_SLUG}/.claude/skills/artemis/"
mkdir -p "${APP_SLUG}/.claude/agents"
cp -r agents/ "${APP_SLUG}/.claude/agents/"

cd "${APP_SLUG}" && npm install && npx playwright install chromium
npx playwright test --list
```

If vault was scaffolded fresh: use Edit tool to replace `{{APP_NAME}}` and `{{BASE_URL}}`
in `vault/_app-overview.md`.

Completion message:
```
✅  Artemis is ready for [AppName]!

  Project:  [APP_SLUG]/
  Vault:    [APP_SLUG]/vault/
  Skill:    [APP_SLUG]/.claude/skills/artemis/

Next step: open [APP_SLUG]/ in Claude Code and run /context [first-feature]
```

---

## Wizard B — Join Existing Project

Used when `.artemis-project` is present but `.env` is missing, or when reconfiguring
after Wizard A ran on a different machine.

```bash
APP=$(cat .artemis-project | head -1)
VAULT_PATH=$(grep context_vault .artemis-project | cut -d= -f2 | sed "s|~|$HOME|")
VAULT_REPO=$(grep vault_repo .artemis-project | cut -d= -f2)
```

1. Check vault:
   - `./vault/.git` present → already cloned, continue
   - Missing + `$VAULT_REPO` set → offer to clone: `git clone "$VAULT_REPO" ./vault/`
   - Missing + no `$VAULT_REPO` → ask for location

2. Detect environments from `vault/_app-overview.md`:
   - If multiple URLs → show as a list for Q1
   - If one URL → auto-fill, skip Q1

3. Ask:
```
Q1 [if multiple environments]: Which environment are you testing?
```

4. Create `.env` with `APP_URL` pre-filled and credentials as placeholders — do NOT ask for credentials in chat:
```bash
cp .env.example .env
# Edit tool: fill APP_URL only — leave APP_USERNAME and APP_PASSWORD as placeholders
```

Then print:
```
📝  I've created .env with your environment URL pre-filled.
    Open .env and fill in your test credentials:

      APP_USERNAME=your-test-username
      APP_PASSWORD=your-test-password

    This file is gitignored — credentials stay local and are never committed.
    Tell me when you're ready to continue.
```

Wait for user confirmation ("ready", "done", "ok"), then run:
```bash
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

To run all tests:     npx playwright test
To add new coverage:  /context [feature-name]
```

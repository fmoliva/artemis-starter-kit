# /init — Initialize Artemis Project

Scaffold a new Artemis project folder with the live dashboard server, all required scripts, and directory structure. Run once per app you want to test.

## Usage

```
/init [app-name] [url?]
```

- `app-name` — kebab-case name for the project folder (e.g. `my-app`, `portal`, `admin`)
- `url` — (optional) the app's URL; stored in `app-guide.md` for reference

## What This Command Does

1. Creates `[app-name]/` directory with required subdirectories
2. Copies all server scripts from `~/.claude/skills/artemis/templates/` into `[app-name]/`
3. Writes `.artemis-project` file in the current directory (enables all other Artemis commands to auto-resolve paths)
4. Creates `[app-name]/app-guide.md` from the examples template
5. Runs `npm install` in `[app-name]/`
6. Prints a success summary with next steps

## Execution

When the user runs `/init [app-name]`:

### Step 1 — Validate input

```bash
APP_NAME="[app-name argument]"
if [ -z "$APP_NAME" ]; then
  echo "Usage: /init [app-name] [url?]"
  echo "Example: /init my-app http://localhost:3000"
  exit 1
fi
```

### Step 2 — Create directory structure

```bash
mkdir -p "$APP_NAME/scripts"
mkdir -p "$APP_NAME/results/bugs"
mkdir -p "$APP_NAME/results/screenshots"
mkdir -p "$APP_NAME/results/screenshots/walkthroughs"
mkdir -p "$APP_NAME/results/observations"
mkdir -p "$APP_NAME/test-cases"
mkdir -p "$APP_NAME/bugs"
mkdir -p "$APP_NAME/tests"
mkdir -p "$APP_NAME/load-tests"
mkdir -p "$APP_NAME/web"
```

### Step 3 — Copy templates

```bash
SKILL_DIR=~/.claude/skills/artemis
cp "$SKILL_DIR/templates/server.js"                        "$APP_NAME/server.js"
cp "$SKILL_DIR/templates/package.json"                     "$APP_NAME/package.json"
cp "$SKILL_DIR/templates/scripts/db.js"                    "$APP_NAME/scripts/db.js"
cp "$SKILL_DIR/templates/scripts/setup-db.js"              "$APP_NAME/scripts/setup-db.js"
cp "$SKILL_DIR/templates/scripts/write-result.js"          "$APP_NAME/scripts/write-result.js"
cp "$SKILL_DIR/templates/scripts/write-bug.js"             "$APP_NAME/scripts/write-bug.js"
cp "$SKILL_DIR/templates/scripts/query-tcs.js"             "$APP_NAME/scripts/query-tcs.js"
cp "$SKILL_DIR/templates/scripts/migrate-tcs.js"           "$APP_NAME/scripts/migrate-tcs.js"
cp "$SKILL_DIR/templates/scripts/store-walkthrough.js"     "$APP_NAME/scripts/store-walkthrough.js"
cp "$SKILL_DIR/references/build-dashboard.template.js"     "$APP_NAME/scripts/build-dashboard.js"
```

### Step 4 — Write .artemis-project config

```bash
echo "$APP_NAME" > .artemis-project
```

### Step 5 — Create app-guide.md from template

Copy `~/.claude/skills/artemis/examples/app-guide-template.md` to `[app-name]/app-guide.md`.
If the user provided a URL, pre-fill the `**Base URL:**` field in the copied file.

### Step 6 — Run npm install

```bash
cd "$APP_NAME" && npm install
```

### Step 7 — Initialize database

```bash
node "$APP_NAME/scripts/setup-db.js"
```

### Step 8 — Print success summary

```
✦ Artemis — Project Initialized
─────────────────────────────────────────
  Project:    [app-name]/
  Dashboard:  http://localhost:7373
  DB:         [app-name]/artemis.db ✓
─────────────────────────────────────────

Next steps:
  1. Fill in [app-name]/app-guide.md with credentials and test data
  2. Run /artemis [url] to start the full QA pipeline
     — or —
     /explore [url] to discover the app first
     /parse [file] to import existing test cases

Dashboard will be available at http://localhost:7373 when you run your first test.
```

## Error Handling

- **`.artemis-project` already exists:** Warn the user:
  ```
  ⚠ .artemis-project already points to: [existing-name]
  Override and switch to [new-name]? (yes / no)
  ```
  If yes → overwrite. If no → abort.
- **`[app-name]` directory already exists:** Continue without error — `mkdir -p` is safe. This allows re-running `/init` to refresh scripts in an existing project.
- **`npm install` fails:** Print the error and tell the user to check Node.js ≥ 18 is installed.
- **Templates directory missing:** Print: `Templates not found at ~/.claude/skills/artemis/templates/. Re-clone the skill repo.`

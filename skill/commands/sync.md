Load the artemis skill, then execute the /sync command with these arguments: $ARGUMENTS

Pulls updates from GitHub for both the project repo and the vault repo independently.
Reports files changed in each. Stops on merge conflicts.

---

## Step 0 — Resolve paths

```bash
APP=$(cat .artemis-project 2>/dev/null | head -1)
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
```

---

## Step 1 — Record baseline (for diff reporting)

```bash
PROJECT_HEAD=$(git rev-parse HEAD 2>/dev/null)
VAULT_HEAD=""
[ -d "./vault/.git" ] && VAULT_HEAD=$(cd vault && git rev-parse HEAD 2>/dev/null)
```

---

## Step 2 — Pull project

```bash
git pull origin "$BRANCH"
```

If this fails with a merge conflict:
- Print: `⚠  Merge conflict in project repo. Resolve conflicts in the files listed below before re-running /sync.`
- List the conflicting files (`git diff --name-only --diff-filter=U`)
- STOP. Do not attempt vault pull.

---

## Step 3 — Pull vault (if present)

```bash
if [ -d "./vault/.git" ]; then
  VAULT_BRANCH=$(cd vault && git branch --show-current 2>/dev/null || echo "main")
  cd vault && git pull origin "$VAULT_BRANCH" && cd ..
fi
```

If vault pull fails with a merge conflict:
- Print: `⚠  Merge conflict in vault repo. Resolve conflicts then run /sync again.`
- List conflicting vault files
- STOP.

---

## Step 4 — Report changes

```bash
# Project files changed
PROJECT_FILES=$(git diff --name-only "$PROJECT_HEAD"..HEAD 2>/dev/null)

# Vault files changed
VAULT_FILES=""
[ -n "$VAULT_HEAD" ] && VAULT_FILES=$(cd vault && git diff --name-only "$VAULT_HEAD"..HEAD 2>/dev/null)
```

Print:

```
✅  Sync complete

  Project ([N] files updated):
    • tests/triage-patient-registration.spec.ts
    • .claude/skills/artemis/commands/verify.md
    [or: No changes]

  Vault ([N] files updated):
    • known-bugs.md
    • _pipeline.md
    [or: Vault not connected / No changes]
```

If both had zero changes: `✓  Already up to date — nothing to pull.`

---

## Step 5 — Raw notification after vault update

If vault files changed and any `.md` files landed in `vault/raw/` (not `_archive`):

```bash
RAW_PENDING=$(ls "${VAULT}/raw/"*.md 2>/dev/null | grep -v "_archive" | wc -l | tr -d ' ')
[ "$RAW_PENDING" -gt 0 ] && echo "📥  ${RAW_PENDING} new file(s) in vault/raw/ from this sync — run /ingest to promote them."
```

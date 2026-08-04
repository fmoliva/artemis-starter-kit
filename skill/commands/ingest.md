Load the artemis skill, then execute the /ingest command with these arguments: $ARGUMENTS

Reads files from the vault's raw/ folder, classifies their content, routes each section
to the correct vault location, and archives the processed file.

If $ARGUMENTS is a file path (e.g. `/ingest raw/session-2026-04-28.md`): process that
file only. If no arguments: process all unprocessed files in raw/ one at a time.

---

## Step 0 — Resolve paths

```bash
APP=$(cat .artemis-project 2>/dev/null | head -1)
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
```

---

## Step 1 — List unprocessed files

```bash
ls "${VAULT}/raw/"*.md 2>/dev/null | grep -v "_archive"
```

If none found: print `No unprocessed files in raw/. Nothing to ingest.` and stop.

If `$ARGUMENTS` names a specific file: process only that file and skip to Step 2.

---

## Step 2 — Read and classify each file

Read the file fully. Identify the module from:
1. Filename pattern (e.g. `session-2026-04-28-checkout-flow.md` → checkout)
2. Section headers (e.g. `## Checkout` or `## Account Settings`)
3. Feature names or URLs mentioned in the content

Classify each section using these signals:

| Classification | Signals | Routes to |
|---|---|---|
| Bug observation | "bug", "issue", "fail", "broken", "unexpected", "#NNN", error stack traces | `vault/known-bugs.md` Open Bugs table |
| Feature description | Prose describing how a screen or flow works, step-by-step behavior | `vault/modules/[module]/[feature].md` (new or append) |
| Test scenarios / steps | Numbered steps, Given/When/Then, "click", "enter", "select", "verify" | artemis-parser agent → `test-cases/[module]/` |
| Selector / UI details | Field names, `formcontrolname=`, button labels, CSS selectors, DOM IDs | `vault/selectors/[module].md` (append, status `?`) |
| Mixed | Multiple types in one file | Split into sections and route each |

---

## Step 3 — Gate: show proposed routing before writing anything

```
📥  Ingesting: raw/[filename].md

  Module detected: [module]

  Detected sections:
    [A] Bug observations (N items)
          → vault/known-bugs.md (append to Open Bugs table)
    [B] Feature description: [feature name]
          → vault/modules/[module]/[feature].md ([new file / append])
    [C] Test scenarios (N steps found)
          → artemis-parser → test-cases/[module]/[feature].md
    [D] Selector notes (N fields)
          → vault/selectors/[module].md (append, status ?)

  Proceed with this routing? (yes / edit routing / skip)
```

- `yes` → write all sections
- `edit routing` → ask user to clarify module or target file for any section
- `skip` → leave file in raw/, do not archive, stop

---

## Step 4 — Write to vault locations

### Bugs → `vault/known-bugs.md`

Read the current highest `#` number in the Open Bugs table. Assign sequential numbers.

Append to the Open Bugs table:
```markdown
| #NNN | [title] | [module] | [severity: Low/Medium/High/Critical] | — | Open |
```

### Feature docs → `vault/modules/[module]/[feature].md`

If file does not exist: create it using `vault/templates/feature-template.md` as the base.
Fill in the sections that the raw content describes. Leave remaining sections as `TODO`.

If file exists: append new content under the appropriate section headers.

### Test scenarios → artemis-parser agent

Spawn the **artemis-parser** agent with the extracted test content:

"Parse the following into structured test cases for app [APP]: [content]
Present all generated TCs for Gate 2 user approval before saving.
After approval: write to [APP]/test-cases/[module]/ and run node [APP]/scripts/migrate-tcs.js"

Wait for user approval of generated TCs before writing.

### Selectors → `vault/selectors/[module].md`

Append each selector entry with `?` status (unconfirmed until `/explore` or `/verify` runs):
```markdown
| [field name] | `[selector]` | ? | — |
```

---

## Step 5 — Archive processed file

```bash
mkdir -p "${VAULT}/raw/_archive"
mv "${VAULT}/raw/[filename].md" "${VAULT}/raw/_archive/[filename].md"
```

---

## Step 6 — Completion summary

```
✅  Ingestion complete — raw/[filename].md

  Bugs:      [N] entries appended to known-bugs.md (#NNN–#NNN)
  Feature:   vault/modules/[module]/[feature].md ([created / updated])
  TCs:       [N] written to test-cases/[module]/[feature].md
  Selectors: [N] entries appended to vault/selectors/[module].md

  Archived:  raw/_archive/[filename].md

  [Next step if TCs or feature docs written]:
    /context [module] → regenerate specs with new content
```

If multiple files were processed: show one summary block per file, then a total.

---

## Naming convention (recommended, not required)

Claude classifies by content regardless of filename. Naming is a helpful hint:

```
raw/[type]-[YYYY-MM-DD]-[topic].md

Types: session | feature | bug | explore | req
```

Examples:
- `raw/session-2026-04-28-checkout-flow.md`
- `raw/feature-2026-04-28-saved-payment-methods.md`
- `raw/bug-2026-04-28-concurrent-cart-update.md`

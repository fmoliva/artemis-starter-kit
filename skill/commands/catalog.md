Load the artemis skill, then execute the /catalog command with these arguments: $ARGUMENTS

The /catalog command builds a selector catalog for a module from existing explore output.
Read references/context-vault.md before starting (it contains vault path resolution logic).

## What /catalog does

1. **Resolve vault path**
   ```bash
   APP=$(cat .artemis-project 2>/dev/null | head -1)
   VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
   MODULE=$ARGUMENTS  # e.g., "auth"
   ```

2. **Check for existing explore output**
   ```bash
   ls "${APP}/results/modules/${MODULE}.json" 2>/dev/null || echo "MISSING"
   ```
   - If found: read it — this is the label-based page inventory from `/explore`
   - If missing: warn the user and offer to run `/explore` first

3. **Check if catalog already exists**
   ```bash
   ls "${VAULT}/selectors/${MODULE}.md" 2>/dev/null && echo "EXISTS"
   ```
   - If exists: show a diff preview of what would change, ask before overwriting

4. **Read existing vault feature files for this module**
   ```bash
   ls "${VAULT}/modules/${MODULE}/" 2>/dev/null
   ```
   Read each feature file (limit 60 lines each) — extract any selectors already documented.

5. **Build the catalog**

   Apply the selector hierarchy to every interactive element found in the explore JSON and vault files:

   | Level | Strategy | Use when |
   |-------|----------|----------|
   | L1 | `getByRole()` | Buttons, links, checkboxes, comboboxes, dialogs |
   | L2 | `getByLabel()` | Form inputs with associated `<label>` elements |
   | L3 | `getByText()` | Static text, tab labels, section headings |
   | L4 | `getByPlaceholder()` | Inputs with placeholder attribute |
   | L5 | `formcontrolname` | Angular inputs with no accessible label |
   | L6 | CSS class | PrimeNG overlay containers only (anti-pattern section) |

   **Rules:**
   - Every form field entry must have: best semantic selector (L1–L4) + formcontrolname fallback (L5) if known
   - Every button must use `getByRole('button', { name: '...' })` — no exceptions
   - Positional selectors (`.first()`, `.nth()`, `.last()`) go in the Anti-Patterns section only
   - PrimeNG internal classes (`.p-*`) go in the Anti-Patterns section only
   - Confirmation status defaults to `?` (not yet live-tested) unless pulled from a live-confirmed session

6. **Write the catalog**
   ```
   ${VAULT}/selectors/${MODULE}.md
   ```

   Use this header format:
   ```markdown
   # [Module Name] — Selector Catalog
   Generated: [YYYY-MM-DD] | Source: results/modules/[module].json + vault/modules/[module]/
   ```

   Sections:
   - One section per form/page (e.g., "Registration Form", "Search Form")
   - Form Fields table: Element | L2 getByLabel | L4 getByPlaceholder | L5 formcontrolname | Confirmed
   - Buttons table: Element | getByRole | Notes
   - Anti-Patterns table: Pattern | Why | Use Instead

7. **Report**
   After writing, print:
   ```
   ✓ Selector catalog written: vault/selectors/[module].md
     [N] form fields cataloged
     [N] buttons cataloged
     [N] anti-patterns documented
     [N] entries marked ✓ (live-confirmed)
     [N] entries marked ? (needs live verification)

   Next steps:
   1. Review the catalog and mark any ? entries you can confirm as ✓
   2. Run /context [module] to generate specs that use tryLocator() from this catalog
   3. Run npx playwright test to execute at zero token cost
   ```

## Gate behavior

When `/context [module]` is run and `vault/selectors/[module].md` does NOT exist:
- Generate specs normally but prefix every selector-based line with `// TODO: verify selector —`
- Print a warning at the end:
  ```
  ⚠️  No selector catalog found for: [module]
      Run /catalog [module] to build the verified selector map.
      [N] selectors in the generated spec are unverified placeholders.
  ```

When `/run` detects `// TODO: verify selector` in a spec file:
- Print before executing:
  ```
  ⚠️  [N] unverified selectors found in [spec].spec.ts
      These may fail if selectors have changed. Run /catalog [module] to resolve.
      Proceeding anyway — check results carefully.
  ```
  (Do not block — warn only, since existing specs predate the catalog system)

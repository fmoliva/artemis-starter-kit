# Explore & Parse — Sitemap, Interaction Harvesting, TC Generation

---

## `/explore [url] [area?]`

Autonomous discovery without a pre-written script. Uses **Playwright MCP** (Phase 1 tool).

### Pre-Phase 0 — Tech stack detection (only when `tech_stack=unknown`)

Read `.artemis-project`. If line 2 is `tech_stack=unknown` (or the line is absent):

1. Navigate to the target URL and take an initial `browser_snapshot`
2. Inspect the DOM for framework signals:
   - `ng-version` attribute on `<html>` or `<body>` → **Angular**
   - `data-reactroot` or `/_next/` path in source → **React / Next.js**
   - `data-v-` attributes or `__vue__` in window → **Vue**
   - None of the above → **html**
3. If Angular detected, check for PrimeNG:
   - Any of `p-dialog`, `p-multiselect`, `p-table`, `p-button` in DOM → add `+primeng`
4. If detection is unambiguous → set `DETECTED_STACK` and proceed automatically.
   If ambiguous → ask the user once: "I detected [X] — is that correct?"
5. Update `.artemis-project` line 2: `tech_stack=<detected>`
6. Run conditional scaffolding (same as `/init` Step 3a) — copy templates on the fly:
   ```bash
   SKILL_DIR=~/.claude/skills/artemis
   [ -d "$SKILL_DIR" ] || SKILL_DIR="./.claude/skills/artemis"
   APP=$(cat .artemis-project | head -1)
   if [[ "$DETECTED_STACK" == angular* ]]; then
     cp "$SKILL_DIR/templates/tests/fixtures/angular-stable.ts"  "$APP/tests/fixtures/"
     cp "$SKILL_DIR/templates/tests/helpers/navigation.ts"       "$APP/tests/helpers/"
   fi
   if [[ "$DETECTED_STACK" == "angular+primeng" ]]; then
     cp "$SKILL_DIR/templates/tests/helpers/primeng.ts"          "$APP/tests/helpers/"
   fi
   ```
7. Print: `"🔍 Detected stack: [stack] — helpers scaffolded. Continuing with explore..."`

If no `.artemis-project` found: skip this step entirely.

---

### Pre-Phase 1 — Load vault context

Before navigating, resolve the vault and check for a feature file matching the area being explored:

```bash
VAULT=$(grep context_vault .artemis-project 2>/dev/null | cut -d= -f2 | sed "s|~|$HOME|")
# Check cross-module first, then modules/
ls "${VAULT}/cross-module/[area].md" 2>/dev/null || \
find "${VAULT}/modules" -name "[area].md" 2>/dev/null | head -1
```

If found: read it (limit 80 lines) and extract the `depends_on:` frontmatter list.
Load those dependency files too (limit 80 lines each).

Use this as **Navigation Context** throughout exploration:
- It tells you which paths are valid entry points before you start clicking
- If a navigation path is blocked (element not found, button missing), check here for documented alternatives before treating it as a dead-end
- If no vault file found: continue normally without cross-reference context

**Trigger verification (modals and tab-sections only):**

If the loaded vault file has `subtype: modal` or `subtype: tab-section`:

1. Read `## Navigation to Trigger` from the vault file.
   - **Section IS present:** navigate to `Trigger page URL`, confirm the `Trigger element` exists in the DOM (do NOT click yet — just verify it is reachable).
     Print: `✓ Trigger confirmed — [element] on [url]`
   - **Section IS MISSING:** print `⚠ No trigger path documented for [feature]. Confirming live...`
     Navigate to the most likely entry point (from `depends_on:` or `_navigation-flow.md`), locate the trigger element, and fill in the `## Navigation to Trigger` section in the vault file before proceeding to Phase 1.

2. If the trigger element is **NOT found** on that page: **stop immediately.** Ask the user:
   > "I expected to find [element] on [url] but it wasn't there. Where is [feature] triggered from?"
   Do NOT proceed to control exploration with an unconfirmed trigger.

---

### Phase 1: Build Sitemap

1. **Navigate to URL** → login if credentials in `.env`
2. **Capture top-level nav:** Read all sidebar links, top nav items, module cards
3. **For each module/page (max 3 levels deep):**
   - Navigate to page
   - Capture: URL path, page title, visible inputs (labels), buttons (labels, max 10),
     table headers, tabs, dropdown options
   - Take one **screenshot** per module-level page (not snapshot — screenshot is a PNG, no YAML) — save to `${APP}/results/screenshots/explore/`
   - Note any modals, alerts, or overlays that appear
4. **Build module map:** Group pages by nav hierarchy → module → submodule

### Snapshot Budget During Explore

`browser_snapshot()` returns raw YAML DOM trees (5–78KB each) that accumulate in context.
Each call increases the token footprint of every subsequent message in the session.

| Situation | Allowed |
|-----------|---------|
| Sitemap discovery (nav reading) | 0 — use `browser_navigate` + read page title/URL |
| Form field discovery | 1 per form (only if labels are not visible from screenshot) |
| Selector debugging | 1 per page, only if a click fails |
| **Total explore budget** | **Max 10 `browser_snapshot()` calls per explore session** |

If you've used 10 snapshots and still have pages to map — stop exploring deeper and work from what you have. It's better to have a partial sitemap with a lean context than a complete sitemap with a bloated one.

After reaching the snapshot cap, switch to screenshots-only and note any remaining pages as `[TODO — not explored]`.

### Phase 2: Interaction Harvesting

For each discovered page:
1. Identify interactive elements from screenshots and page structure (no additional snapshots needed)
2. Note which navigation paths, forms, tabs, and dropdowns are visible
3. Record sequences that form complete workflows (e.g., search → select → edit → save)
4. Only trigger interactions (click, open dropdown) when a workflow path is genuinely ambiguous

### Stop Conditions

- All nav-reachable pages visited (no infinite crawl)
- Max 30 unique pages (reduced from 50 to protect context budget)
- Max 10 `browser_snapshot()` calls total (hard cap — see Snapshot Budget above)
- Return to dashboard after each module exploration

### Output

Write to `results/explorations/explore-[scope]-[YYYY-MM-DD].json`:
```json
{
  "sitemap": [{ "module": "...", "url": "...", "children": [...] }],
  "pageDetails": [
    {
      "url": "[MODULE_URL]",
      "moduleName": "[Module]",
      "inputs": ["Search keyword", "Last Name", "First Name"],
      "buttons": ["Search", "Clear", "Register New"],
      "tableHeaders": ["Name", "Age", "Status"],
      "tabs": ["[Tab 1]", "[Tab 2]", "[Tab 3]"]
    }
  ]
}
```

**Immediately after:** Run `node scripts/split-data.js` (reads the most recent file in
`results/explorations/`) to partition into per-module JSON files in `results/modules/`.
Each file should be 3-8KB. Never read the exploration JSON directly for test generation.

### Spelling Harvest (end of Phase 1 — forms, modals, and pages with stable text labels)

After completing Phase 1 discovery for any form, modal, or page:

1. Collect all **stable UI label strings** that appear on the page: section headings, tab names,
   dropdown options, column headers, scale option labels, modal row names.
   **Exclude:** record data, dynamic values, timestamps, IDs, or any text that changes per-record.

2. Check `tests/ui-baselines/spelling-reference.json` for an existing key covering this feature area.
   - **Key exists:** verify current approved values still match live app; update any that changed.
   - **No key yet:** create a new key using the naming convention `[module]FormSections`, `[modal]Names`,
     `[feature]Labels`, etc. Populate with the confirmed live strings.

3. If `tests/ui-behavior/[module]-ui-behavior.spec.ts` exists, scan for `assertSpelling` calls that
   reference empty arrays `[]` in the matching key — fill them now while live strings are in context.

4. Print harvest summary before closing the browser:
   ```
   📝  Spelling harvest — [feature]
     Updated keys: [list or "none"]
     New keys:     [list or "none"]
     Skipped:      [dynamic fields skipped]
   ```

---

### Post-Explore Handoff (Required before CLI phase)

1. Call `mcp__playwright__browser_close` — stops snapshot accumulation in context
2. Run `node scripts/split-data.js` — partitions data into `results/modules/<slug>.json` (3–8KB each)
3. Write `results/explorations/explore-summary-[YYYY-MM-DD].md` with ONLY:
   - Module list (names + URL paths)
   - Form fields per module (labels only, no YAML)
   - Key workflow sequences (verb sequences, e.g. "search → select → admit")
4. All subsequent phases load from `results/modules/*.json` — never re-read MCP snapshot content from context
5. **If this project uses a vault, update `${VAULT}/_pipeline.md`** (MANDATORY — do this before reporting to the user):
   - Set **Explored** = today's date for every feature whose selectors were confirmed
   - Set **Selectors** = `✓` if all key selectors resolved; `partial` if any remain unconfirmed
   - If a spec was also patched during this session (TODOs cleared), set **Last Updated** = today

   Missing this step causes pipeline drift — the tracker must reflect actual explore coverage.

**Compact Summary Format:**
```markdown
# Explore Summary — [scope] — [YYYY-MM-DD]

## Modules Discovered
| Module | URL Path | Forms | Key Workflows |
|--------|----------|-------|---------------|
| [Module] | [/path]  | 3     | search → select → submit |

## Forms per Module
**[Module] — [Form Name]:** Field 1, Field 2, Field 3, ...

## Token Cost Saved
MCP snapshots in context: ~[N]KB → CLI phase loads from [M]KB module files
```

### TC Generation from Explore Data

For each module JSON file, generate TCs covering:
1. **Happy path** — primary workflow (1 TC per workflow)
2. **Edge cases** — at least 2 per form (empty submit, long input)
3. **Error handling** — at least 1 per form (invalid input, missing required field)
4. **Security** — every form gets: empty fields, XSS probe, SQL probe, long string

Present generated TCs for **user approval** before saving (Gate 2).

---

## `/parse [file-or-text]`

Convert any input format to structured Artemis test cases.

### Supported Inputs

- DOCX files (extract text, preserve structure)
- Markdown files
- Plain text / prose descriptions
- Numbered lists / checklists
- Tables (markdown or pasted)

### Parsing Rules

1. **Detect structure:** Find numbered steps, bullet points, "Given/When/Then", headers
2. **Normalize each TC to:**
   ```markdown
   ### TC-[PREFIX]-[NNN]: [Title]

   **Module:** [module]
   **Type:** Happy Path | Edge Case | Error Handling | Security
   **Priority:** Critical | High | Medium | Low
   **Preconditions:** [required state]

   **Steps:**
   1. [action]
   2. [action]
   3. [action]

   **Expected Result:**
   [specific, observable outcome — not "verify it works"]
   ```
3. **Assign IDs:** Use module-prefixed format: `TC-MOD-001`, `TC-ADM-015`
4. **Resolve ambiguity:** If input says "verify login works" → expand to specific steps
   and observable results. Never leave vague assertions.

### Output Structure

```
test-cases/
├── INDEX.md              (links to module folders, max 80 lines)
├── [module]/
│   ├── INDEX.md          (submodule file list, max 40 lines)
│   ├── [submodule].md    (TCs, max 300 lines per file)
```

If a submodule file approaches 300 lines, split into:
- `[submodule]-happy-path.md`
- `[submodule]-edge-cases.md`

### TC Heading Format

⚠ **Use exactly `### TC-` (three hashes)** — `migrate-tcs.js` splits on `/^### TC-[A-Z]/m`.
Two hashes will cause the entire file to be silently skipped during DB migration.

### After Writing TCs

1. Run `node [app]/scripts/migrate-tcs.js` — verify output shows "Files processed: N"
2. If "Files skipped" appears → fix heading format
3. Rebuild dashboard: `node [app]/scripts/build-dashboard.js`

---

## AI Test Generation Rules

### Edge Case Catalog

For every form discovered, generate at minimum:

| Type | Test |
|------|------|
| Empty submit | Submit form with all required fields empty |
| Long input | 500+ chars in each text field |
| Special chars | Unicode: `Ñoño José María`, Emoji: `Test 🚀` |
| Whitespace only | 4 spaces in text fields |
| XSS probe | `<script>alert('xss')</script>` in every text input |
| SQL probe | `' OR '1'='1` in every text input |
| Boundary values | Min-1, Min, Max, Max+1 for numeric fields |
| Date fields | Past date, today, future date, invalid format |

### Coverage Requirements per Feature

- ≥1 Happy Path TC
- ≥2 Edge Case TCs
- ≥1 Error Handling TC
- ≥1 Security TC (for any feature with form inputs)

### Test Data

Use generic, reusable values for test data:

| Field | Default Value |
|-------|---------------|
| Last Name | [TEST_KEYWORD] |
| First Name | Common names (Alex, Jordan, Morgan, Taylor, Casey) |
| Search keyword | [TEST_KEYWORD] |
| Email | test@example.com |
| Phone | 555-0100 |

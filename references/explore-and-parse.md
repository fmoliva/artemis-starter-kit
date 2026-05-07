# Explore & Parse — Sitemap, Interaction Harvesting, TC Generation

---

## `/explore [url] [area?]`

Autonomous discovery without a pre-written script. Uses **Playwright MCP** (Phase 1 tool).

### Phase 1: Build Sitemap

1. **Navigate to URL** → login if credentials in `.env`
2. **Capture top-level nav:** Read all sidebar links, top nav items, module cards
3. **For each module/page (max 3 levels deep):**
   - Navigate to page
   - Capture: URL path, page title, visible inputs (labels), buttons (labels, max 10),
     table headers, tabs, dropdown options
   - Take one screenshot per module-level page
   - Note any modals, alerts, or overlays that appear
4. **Build module map:** Group pages by nav hierarchy → module → submodule

### Phase 2: Interaction Harvesting

For each discovered page:
1. Identify interactive elements (forms, buttons, links, tabs, dropdowns)
2. Try basic interactions: click buttons, open dropdowns, switch tabs
3. Note which interactions trigger: navigation, modal, toast, form submission, error
4. Record sequences that form complete workflows (e.g., search → select → edit → save)

### Stop Conditions

- All nav-reachable pages visited (no infinite crawl)
- Max 50 unique pages
- Max 200 interactions per session
- Return to dashboard after each module exploration

### Output

Write to `results/explore-raw.json`:
```json
{
  "sitemap": [{ "module": "...", "url": "...", "children": [...] }],
  "pageDetails": [
    {
      "url": "/triage/patient-search",
      "moduleName": "Triage",
      "inputs": ["Search keyword", "Last Name", "First Name"],
      "buttons": ["Search", "Clear", "Register New"],
      "tableHeaders": ["Name", "Age", "Status"],
      "tabs": ["Patient Search", "Patient Worklist", "Appointments"]
    }
  ]
}
```

**Immediately after:** Run `node scripts/split-data.js` to partition into per-module JSON
files in `results/modules/`. Each file should be 3-8KB. Never read `explore-raw.json`
directly for test generation.

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
3. **Assign IDs:** Use module-prefixed format: `TC-TRI-001`, `TC-PHA-015`
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
| Special chars | Unicode: `Ñoño José María`, Emoji: `Test 🏥` |
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

When testing HIS/healthcare apps:

| Field | Default Value |
|-------|---------------|
| Last Name | Silva |
| First Name | Filipino names (Maria, Juan, Jose, Ana, Carlos) |
| Country | Philippines |
| Address | Philippine addresses (province, city, barangay) |
| Phone | Philippine phone format |

Use "Silva" as default search keyword for patient-related tests.

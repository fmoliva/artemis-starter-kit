# Part 12: TC Portability Agent

Used exclusively by the `/port` command. Artemis enters **Port Mode**: think like a senior QA lead migrating a test library to a new application — preserving reusable coverage while flagging what needs human review.

---

## 1. Source Project Inventory

### Reading the Source TC Library

Read all `.md` files under `[source-project-path]/test-cases/` recursively. Skip any file named `INDEX.md`.

For each file, parse using the same block-split regex as `build-dashboard.js`:
```
/(?=^### TC-[A-Z]+-\d+:)/m
```

Extract per TC:
- `id` — from `### TC-[PREFIX]-[NNN]:`
- `title` — from same line after colon
- `module` — parent folder name
- `submodule` — filename without `.md`
- `prefix` — first segment of id (e.g., `AUTH` from `TC-AUTH-001`)
- `priority`, `type` — from `**Priority:**` and `**Type:**` lines
- `steps` — numbered list under `**Steps:**`
- `preconditions` — bullets under `**Preconditions:**`
- `expectedResult` — bullets under `**Expected Result:**`

Build an inventory object:
```javascript
{
  totalTCs: N,
  modules: [
    {
      folder: "authentication",
      prefix: "TC-AUTH",
      submodules: ["login"],
      tcs: [ /* TC objects */ ]
    },
    ...
  ]
}
```

Print inventory summary before proceeding to Phase 2:
```
Source inventory: [source-app-name]
  14 modules · 68 submodule files · 767 test cases
  Module list: Authentication (13) · Orders (136) · Pharmacy (72) · ...
```

---

## 2. Module Matching Algorithm

### Step 1: Exact Name Match
Compare source module folder names to target module folder names (or inferred names from URL crawl). Match is EXACT if folder names are identical (case-insensitive, ignoring hyphens vs. underscores).

### Step 2: Fuzzy Label Match
Compare human-readable module labels from INDEX.md or inferred navigation labels:
- Tokenize both labels into words
- Compute overlap: `overlap = matching_words / max(word_count_a, word_count_b)`
- Score thresholds:

| Overlap | Match Type | Action |
|---------|-----------|--------|
| ≥ 0.75 | STRONG | Auto-suggest match, highlight green |
| 0.40–0.74 | PARTIAL | Suggest match with `~`, highlight yellow |
| < 0.40 | NONE | Mark as unmatched, highlight red |

### Step 3: Semantic Category Fallback
If label fuzzy match is NONE, check domain keywords:
- Both have "login", "auth", "credential" → STRONG
- Both have "patient", "registration", "orders" → PARTIAL
- Source has "pharmacy", target has "dispensary" → PARTIAL
- Source has "utilities", target has "settings", "admin", "config" → PARTIAL

### Module Mapping Table Format

Present this table and **WAIT for user approval** before proceeding to Phase 4:

```
─────────────────────────────────────────────────────────────────────────────────
/port — Module Mapping Table
Source: source-app  →  Target: clinic-portal
─────────────────────────────────────────────────────────────────────────────────
Source Module          TCs   Match Type   Target Module          Est. Portable
─────────────────────────────────────────────────────────────────────────────────
authentication         13    EXACT ✓      authentication         11 / 13  (85%)
orders                136    PARTIAL ~    patient-intake        112 / 136  (82%)
pharmacy               72    EXACT ✓      pharmacy               72 / 72  (100%)
laboratory            102    PARTIAL ~    lab-results            91 / 102  (89%)
utilities             146    STRONG ✓     utilities             143 / 146  (98%)
[module]-claims        38    NONE   ✗     [no match found]         0 / 38   (0%)
reporting              63    PARTIAL ~    reports                56 / 63   (89%)
─────────────────────────────────────────────────────────────────────────────────
Totals: 570 of 767 TCs estimated portable (before app-specific flag review)

MATCH KEY:  ✓ EXACT/STRONG — auto-selected   ~ PARTIAL — review recommended
            ✗ NONE — excluded by default

Approve all EXACT/STRONG matches? (y / modify / select individually)
Enter new target folder name for any PARTIAL match, or press enter to accept suggestion.
Modules with NONE match will be excluded unless you explicitly add them.
─────────────────────────────────────────────────────────────────────────────────
```

**Do not proceed until user responds.** Accept these responses:
- `y` — approve all suggested mappings as shown
- `modify` — enter a list of changes before approving
- `select` — present each module one by one for approval
- Module name corrections typed inline: `orders → intake-form`

---

## 3. Portability Classification Rules

### Signals That Mark a TC as FLAGGED (app-specific)

Scan every step and expected result for these patterns:

**URL Signals (+3):**
- Absolute URLs containing the source app's domain or IP (e.g., `http://localhost:3000`)
- Specific route paths unlikely to be universal (e.g., `/orders/patient-worklist`, `/[feature]/appointment/save`)
- Generic paths like `/login`, `/dashboard` are **NOT** flagged

**Field Label / Proper Noun Signals (+2):**
- Names of this specific app's features or product names: "[app-name]", "[feature]", "[module]"
- Column headers or dropdown values specific to this app's data model ("Per Program tab", "Break-the-Glass modal")
- Specific patient records, usernames, or test data values (`richard.reyes`, `patient ID 4891`)

**Business Term Signals (+1):**
- Clinical or domain terms specific to one country/org ("barangay", "lying-in", "ITR form", or other locale-specific terms)
- Form field labels unique to this vendor's implementation

### Signals That Keep a TC as PORTABLE

- Generic CRUD verbs: "Click Save", "Fill in the form", "Click Submit", "Click Cancel"
- Generic status outcomes: "Success message appears", "Record appears in table", "Error message is shown"
- Generic navigation: "Click the module in sidebar", "Navigate to [Module]"
- Generic validation: "Required field shows error", "Field accepts only numbers"
- Generic pagination: "Table shows 10 rows per page", "Next page button is enabled"
- Generic empty states: "Table shows 'No records found'"
- Generic security probes: all XSS, SQL injection, boundary value tests

### Classification Scoring

```
SCORE = 0
For each step/expected line:
  if matches URL signal pattern → SCORE += 3
  if matches source-app proper noun → SCORE += 2
  if matches business term signal → SCORE += 1

If SCORE >= 2 → mark TC as FLAGGED (wrap flagged text in [REVIEW:])
If SCORE == 1 → mark TC as PORTABLE with inline [REVIEW:] on specific substring only
If SCORE == 0 → PORTABLE (no annotation needed)
```

### Always Excluded from `/port`

**Security Probes (`TC-SEC-*`)** — always excluded by default. Security probes are generic by definition but should be regenerated fresh for the target app using `/explore`. The source app's security probes may reference app-specific routes that don't exist in the target.

---

## 4. Transformation Rules

### 4.1 ID Assignment

Before transformation, build the target prefix map from the approved module mapping table. If the target project already has TCs, scan for the highest existing ID per prefix and start from N+1. If no existing TCs, start from 001.

Assign IDs sequentially within each module:
- `authentication` → `TC-AUTH-001`, `TC-AUTH-002`, ...
- `pharmacy` → `TC-PHA-001`, `TC-PHA-002`, ...

When a target module has a different name than source (e.g., `orders` → `patient-intake`), infer the prefix from the first 3–4 letters of the target module name or ask the user:
- `patient-intake` → `TC-INT` (suggested)
- If the user accepted `orders → patient-intake` without specifying a new prefix, ask: "Use TC-INT for patient-intake? (or enter a custom prefix)"

### 4.2 Ported-From Metadata Line

Insert after `**Type:**` and before `**Preconditions:**`:

```markdown
**Ported from:** TC-AUTH-001 (source-app)
```

This line is intentionally placed between Type and Preconditions so:
1. The `build-dashboard.js` parser ignores it (it only regex-matches known field labels)
2. It is visually adjacent to the TC header when reading the file
3. It is human-readable without tools

### 4.3 Inline Flagging of App-Specific Text

When a step or expected result line contains a flagged signal, wrap only the specific substring — not the whole line:

```markdown
**Steps:**
1. Navigate to [REVIEW: was "http://localhost:3000/login" in source-app]
2. Enter username in the "Enter Username" field
3. Enter valid password
4. Click the "Login" button

**Expected Result:**
- User is redirected to the dashboard
- Page shows [REVIEW: was "[app-name] welcome message" in source-app]
```

Rules for `[REVIEW:]` wrapping:
- Wrap only the app-specific **substring**, not the surrounding generic structure
- Use the **exact original text** from the source TC — do not paraphrase
- If an entire step is app-specific: `[REVIEW: was "Select the '[app-name]' system from the dropdown" in source-app]`
- Never wrap inside a `**Label:**` bold marker — only inside the content after it

### 4.4 Preserve Structure

The following MUST be preserved exactly:
- `### TC-[NEW-ID]: [original title]` — only the ID changes, title is preserved verbatim
- `**Priority:**` value — preserved exactly
- `**Type:**` value — preserved exactly
- All steps — preserved except for inline `[REVIEW:]` wrapping
- All preconditions — preserved except for inline `[REVIEW:]` wrapping
- All expected result lines — preserved except for inline `[REVIEW:]` wrapping
- Step numbering order — never reordered

---

## 5. Output File Writing Rules

### Module File Structure

Write output to match the source project's directory structure:
```
[new-app-name]/test-cases/
├── INDEX.md                           ← master index
├── authentication/
│   ├── INDEX.md
│   └── login.md                       ← ported TCs
├── pharmacy/
│   ├── INDEX.md
│   └── [submodule].md
...
```

### File Header Format

Each ported submodule file must begin with:
```markdown
# [Module Label] — [Submodule Label]

**Module:** [Module Label]
**TC Prefix:** [TC-PREFIX]
**TC Range:** [TC-PREFIX-001]–[TC-PREFIX-NNN]
**Ported from:** [source-app-name] by Artemis /port — [YYYY-MM-DD]
**Original file:** [source-project-path]/test-cases/[module]/[submodule].md

---
```

### Module INDEX.md Format

Use the same format as the source project's existing module INDEX.md files. Include TC range, TC count, and a note: `Ported from [source-app-name]`.

### Master INDEX.md

Create `[new-app-name]/test-cases/INDEX.md` following the same format as the source project's INDEX.md exactly:
- Module Index table: Module | Folder | TC Prefix | ~TCs
- Category Breakdown section if applicable
- TC Prefix Reference table
- Port metadata at bottom: total ported, source project, date

### Existing TCs Conflict

If the target module already has TCs, ask before appending:
```
Module [X] already has N TCs (last ID: TC-XXX-NNN).
Append N ported TCs after TC-XXX-NNN? (y / review first / skip this module)
```

Never silently overwrite or merge.

---

## 6. Build-Dashboard Integration

After all TC files are written:

1. Check if `[new-app-name]/scripts/build-dashboard.js` exists
2. If not: copy `references/build-dashboard.template.js` verbatim into that path
3. Run: `node [new-app-name]/scripts/build-dashboard.js`
4. Confirm output: `✓ artemis-tc-list.html updated — N test cases across M modules`

The ported TCs will appear in the dashboard automatically because they follow the `### TC-[A-Z]+-\d+:` heading format that `build-dashboard.js` parses.

**`[REVIEW:]` tags will appear in step text in the dashboard** — this is intentional. Testers will see them inline and know which assertions need to be verified against the new app.

---

## 7. Portability Report Format

Print this report to chat after all files are written and dashboard is rebuilt:

```
─────────────────────────────────────────────────────────────────────────────
✓ /port complete — [N] TCs ported from [source-app] to [new-app]
─────────────────────────────────────────────────────────────────────────────

Module Portability:
  [source-module]  →  [target-module]    [ported]/[total]  ([pct]%)  — [note]
  Authentication   →  authentication           11/13   (85%)  — 2 flagged (specific URLs)
  Orders           →  patient-intake          112/136  (82%)  — 24 flagged ([app-name]-specific fields)
  Pharmacy         →  pharmacy                 72/72  (100%)  — generic dispensing flows
  Laboratory       →  lab-results              91/102  (89%)  — 11 flagged (specific test codes)
  Utilities        →  utilities               143/146  (98%)  — 3 flagged (app-specific config)
  [Skipped]        →  [module]-claims            0/38   (0%)  — excluded (no match in target)

─────────────────────────────────────────────────────────────────────────────
Total:  [ported] / [source total] TCs ported  ·  [flagged] contain [REVIEW:] tags
Files:  [new-app]/test-cases/ — [M] modules · [F] submodule files
─────────────────────────────────────────────────────────────────────────────

Flagged TCs: [N] total
  Open artemis-tc-list.html to review [REVIEW:] tags in step text.
  Each [REVIEW:] tag shows the original source-app text — replace with the target-app equivalent.

Next steps:
  1. Open [new-app]/test-cases/ and review flagged TCs (search for "[REVIEW:")
  2. Run /explore [url] to discover app-specific TCs not in the source project
  3. Run /run authentication [url] to verify ported auth TCs work against the new app

─────────────────────────────────────────────────────────────────────────────
```

If no URL was provided and target module structure was inferred interactively, add:
```
Note: No URL provided — run /explore [url] to validate module structure matches
target app before executing ported TCs.
```

---

## 8. Anti-Patterns

- **Do not port `TC-SEC-*` security probes.** Security probes are excluded by default. Regenerate fresh for the target app using `/explore`.
- **Do not port result files, bug reports, or `.spec.ts` files.** Only `test-cases/**/*.md`.
- **Do not auto-merge with existing target TCs.** If the target project already has TCs in a module, ask before adding.
- **Do not change TC titles.** The original title is preserved verbatim — the user may refine titles during review using `/improve` later.
- **Do not create a single flat file.** Always use the module/submodule directory structure even if the source project used flat files.
- **Do not skip the module mapping approval step.** Always present the table and wait for explicit `y / modify / select` before writing any files.
- **Do not silently resolve PARTIAL matches.** PARTIAL-matched modules require the user to confirm or rename the target folder before TCs are written.

---

## Rebuild TC List After Porting

After writing all TC files and running `build-dashboard.js`, print:

```
✓ artemis-tc-list.html updated — N test cases across M modules
  Open: open /path/to/artemis-tc-list.html
```

Do this at the end of the port session — the user should not need to ask.

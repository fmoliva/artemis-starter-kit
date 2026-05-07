# Part 2: Test Case Parser Agent

Enters **Parse Mode**: extract structure from chaos. Convert any input format into the standard
TC format. Never discard a test, never silently skip ambiguous items — always flag and infer.

---

## Input Formats Supported

| Format | What it Looks Like | Parser Strategy |
|--------|--------------------|-----------------|
| **DOCX file** | Word document with test cases | Convert via `textutil`, then normalize |
| **Markdown file** | .md file with varied formatting | Read directly, normalize headers |
| **Numbered list** | `1. Login with valid creds` | Each item = one TC; infer steps + expected |
| **Checklist** | `- [ ] Verify save works` | Each unchecked item = one TC |
| **Prose description** | "The user should be able to login and see the dashboard" | Extract intent, derive steps |
| **Table format** | Columns: Test Name, Steps, Expected | Map columns to TC fields |
| **Screenshot / OCR** | Image of a test document | Read text content, apply normalization |

---

## DOCX Conversion

When a `.docx` file path is provided:

### Step 1: Convert to HTML
```bash
textutil -convert html /path/to/test-cases.docx -output /tmp/test-cases.html
```

### Step 2: Extract Text Content
Read `/tmp/test-cases.html`. Strip HTML tags to get raw text structure.
Look for:
- Heading patterns → Module / Feature boundaries
- Bold text → Often TC names or field labels
- Numbered items → Steps
- Bullet items → Expected results or preconditions

### Step 3: Normalize (see below)

**If `textutil` is unavailable:** Read the .docx as text using the Read tool directly.
Most .docx files have enough readable text content for extraction despite the XML wrapper.

---

## Format Normalization Protocol

Apply these rules to any input format:

### Rule 1: Identify Structure Signals
Look for these signals to determine boundaries:

| Signal | Meaning |
|--------|---------|
| `TC-NNN`, `Test-NNN`, `Test Case NNN` | Start of a new test case |
| Heading levels (H1/H2/H3/##/###) | Module > Feature > TC hierarchy |
| "Steps:", "How to test:", numbered list | Beginning of steps section |
| "Expected:", "Should:", "Result:" | Expected result section |
| "Pre:", "Preconditions:", "Setup:" | Preconditions section |
| "Priority:", "P1/P2/P3", "High/Med/Low" | Priority field |

### Rule 2: Infer Missing Fields
When a required field is absent:

| Missing Field | Inference Rule |
|--------------|----------------|
| **TC ID** | Assign next available number (see TC Numbering below) |
| **Preconditions** | Default: "User is logged in, application is accessible" — flag with `[INFERRED]` |
| **Expected Result** | Extract from last step ("verify", "confirm", "check", "should see") — flag with `[INFERRED]` |
| **Priority** | Default: Medium — flag with `[INFERRED]` |
| **Type** | Infer from content: safety/validation → Error Handling; normal flow → Happy Path |
| **Steps** | If only a description exists, convert to 2-3 inferred steps — flag with `[INFERRED]` |

### Rule 3: Never Discard
If a test case is:
- Vague: parse it, add `[VAGUE]` flag in the Notes, include it anyway
- Duplicate-looking: include both, add `[POSSIBLE DUPLICATE of TC-NNN]` note
- Incomplete: include with `[INCOMPLETE — missing: expected result]` annotation

---

## TC Numbering

### Finding the Next Available Number

Before assigning any TC IDs:

1. Check if a test cases file already exists in `test-cases/`
2. If yes: scan it for the highest TC number
   ```
   Grep pattern: TC-\d+
   ```
3. Take the highest number found + 1 as the starting point for new TCs
4. Assign sequentially from there

**Example:** If `test-cases/qc-his-test-cases.md` ends at TC-072, new TCs start at TC-073.

### Rules
- TC IDs are sequential across the entire file — never module-specific
- Never reuse a retired TC number
- Never skip numbers (TC-073, TC-074, TC-075 — not TC-073, TC-075)
- New TCs from `/parse` and `/explore` both use the same sequence

---

## Output: Structured TC File

### Step 1: Determine File Location

Check if a test-cases file already exists:
- If yes → append to existing file, update the index table
- If no → create `test-cases/[app-name]-test-cases.md`

### Step 2: Write Normalized TCs

Use the Standard Format from `examples/test-case-template.md`:

```markdown
#### TC-NNN: [Test Case Name]

**Preconditions:**
- [Condition] [INFERRED] if not in source

**Steps:**
1. [Step]
2. [Step]

**Expected Result:**
- [Observable outcome]

**Priority:** High / Medium / Low
**Type:** Happy Path / Edge Case / Error Handling / Security / Regression
**Added by:** Artemis /parse
**Date Added:** YYYY-MM-DD
```

### Step 3: Update the Index Table

Add new TCs to the index table at the top of the file:

```markdown
| Module | Features | TC Range | Count |
|--------|----------|----------|-------|
| Authentication | Login, Location | TC-001–TC-003 | 3 |
| [New Module] | [Feature] | TC-073–TC-081 | 9 |   ← Add row
```

If adding to an existing module, update the TC range and count.

---

## Ambiguity Resolution

### When Intent is Unclear

Flag ambiguous TCs with a question for the user before saving:

```
⚠️ AMBIGUITY DETECTED — TC-NNN

Source text: "Verify that save works correctly"

Inferred interpretation:
- Steps: 1. Fill in form fields  2. Click Save
- Expected: Success message appears AND data is persisted

Is this interpretation correct? Or did you mean:
A) Confirm — use as-is
B) The save should FAIL in this case (error handling test)
C) Specify the exact expected result: ___
```

### When There Are Multiple Valid Interpretations

Present the interpretations and ask for selection before writing the TC.
Never silently choose one.

---

## Bulk Parsing Flow

When parsing a file with 10+ test cases:

1. **Parse silently** — do not ask about each TC individually
2. **Produce a parse summary** showing:
   - Total TCs found and parsed
   - TC ID range assigned
   - Items flagged: `[INFERRED]`, `[VAGUE]`, `[INCOMPLETE]`, `[POSSIBLE DUPLICATE]`
   - Any ambiguities that need resolution
3. **Present the summary** to the user for review
4. **Ask for approval** before saving:
   ```
   Parse complete. Found 14 test cases → TC-073 through TC-086.

   Flags requiring review:
   - TC-077: Expected result INFERRED — source only said "verify save works"
   - TC-081: POSSIBLE DUPLICATE of TC-044 (same steps, same expected)
   - TC-085: VAGUE — source text: "test the search" — steps derived from UI context

   Shall I save these to test-cases/qc-his-test-cases.md? (y to save / specify changes)
   ```
5. **Save only after confirmation**

---

## Module and Feature Header Rules

When organizing parsed TCs into the file:

### New Module
Add a new `## Module:` section after the last existing module.

### Existing Module, New Feature
Add `### Feature:` section inside the appropriate module.

### Existing Feature
Append new TCs after the last TC in that feature.

**Never reorder existing TCs.** Insertion only — never move existing content.

---

## Validation Before Saving

Before writing to disk, verify each TC has:
- [ ] TC ID (no duplicates, no gaps)
- [ ] A name that is specific (not "Test save", but "Allergy form saves with valid input")
- [ ] At least 1 step
- [ ] A specific, observable expected result (not "it works", but "Toast 'Saved' appears")
- [ ] Priority assigned
- [ ] Type assigned
- [ ] Date added

Flag any TC that fails this check — do not silently write invalid TCs.

---

## Rebuild TC List After Saving

After writing or modifying any test cases, always rebuild the manual QA checklist:

```bash
node [app-name]/scripts/build-dashboard.js
```

Then print:

```
✓ artemis-tc-list.html updated — N test cases across M modules
  Open: open /path/to/artemis-tc-list.html
```

Do this silently at the end of the session — the user should not need to ask.

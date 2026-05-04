# Part 4: Exploratory QA Agent

The Exploratory QA agent enters **Explorer Mode**: curious, adversarial, and systematic.
It crawls the application autonomously to discover untested functionality, probe interactions,
and surface bugs that scripted tests miss.

---

## Exploration Strategy

Two-phase approach:
1. **Breadth-first sitemap** — discover all pages before going deep on any
2. **Depth-first interaction harvesting** — probe each untested page thoroughly

---

## Phase 1: Build the Sitemap

Navigate to the target URL and extract all navigable links from:
- Primary navigation (header menu, sidebar, hamburger menu)
- Secondary navigation (tabs, sub-menus, breadcrumbs)
- Footer links
- Dashboard cards / quick-action buttons
- "View all", "See more", pagination links
- Any embedded links within page content

Record each discovered URL with:
- URL path
- Page title / heading
- Navigation source (where the link was found)

### Coverage Comparison

Compare discovered pages against the test case library (`test-cases/`):
- **TESTED** — page or feature has ≥1 TC in the library
- **UNTESTED** — page discovered, no TC in library
- **UNKNOWN** — page discovered, unclear if covered

Present the coverage map before deep exploration:

```
Sitemap Discovery Complete
─────────────────────────────
Pages Found:     19
Tested:           14 (74%)
Untested:          5 (26%)
Unknown:           0

Untested pages:
  - /orders/history
  - /orders/export
  - /settings/profile
  - /settings/roles
  - /reports/monthly

Proceeding with depth-first exploration of untested pages...
```

---

## Phase 2: Interaction Harvesting

For each untested (or partially tested) page:

### 2a. Screenshot + Snapshot
Take a screenshot to see the page, then `browser_snapshot` to get interactive elements.

**Screenshot path for exploration:** always save to `results/screenshots/explore/[module-slug].png`
using the full absolute path, e.g.:
```
/Users/.../[app-name]/results/screenshots/explore/triage-create-appointment.png
```
Never save explore screenshots to the project root, to `screenshots/` (root-level), or without an explicit path.

### 2b. Identify Page Purpose
Determine: what is this page for? What are the main user actions?

### 2c. Probe These Interaction Types

| Type | What to Do |
|------|-----------|
| **Forms** | Fill all fields, submit with valid data. Note all field types and required/optional. |
| **Action buttons** | Click each one. Note what happens. |
| **Data tables** | Try: sort by each column, filter, paginate, click row actions, select all. |
| **Search bars** | Search with valid term, empty term, special characters. |
| **CRUD flows** | Create a record, edit it, delete it. Verify each step. |
| **Status changes** | Change a status/dropdown on an item. Verify the change persists. |
| **Overflow menus (⋮)** | Open and try each option. |
| **Hover states** | Hover over icons, table rows — are tooltips, edit buttons revealed? |
| **Keyboard shortcuts** | Try Tab, Enter, Escape on forms and modals. |

### 2d. Probe Empty State
Navigate to the page with no data (or clear filters to show nothing):
- Does the page show an appropriate empty state message?
- Are action buttons still functional when no records exist?
- Does pagination handle 0 results gracefully?

### 2e. Probe Error State
Trigger error conditions:
- Submit a form with invalid data — does an error message appear?
- Navigate to a non-existent record URL — does a 404 or meaningful error appear?
- Attempt an action without required permissions (if multiple roles exist)

---

## Phase 3: Post-Exploration Data Split (Required for apps with 20+ pages)

After raw data is written to `results/explore-raw.json`, immediately run:

```bash
node scripts/split-data.js
```

This generates `results/modules/<slug>.json` — one file per module, each 3–8KB.

**This step is mandatory.** `explore-raw.json` for large apps (100KB+) cannot be read in
a single operation. All subsequent test case generation MUST use the per-module files.

**If `scripts/split-data.js` does not exist in the project**, create it. The script should:
- Read `results/explore-raw.json`
- Group `pageDetails` entries by module (using `module` or `parent` field from `sitemap`)
- For each module, write `results/modules/<kebab-slug>.json` containing only:
  - `module` name, `category`, and `pages` array
  - Per page: `url` (path only), `inputs` (labels), `buttons` (top 10), `tableHeaders`, `sidebarLinks` (top 15, deduped), `tabs`
- Strip: raw HTML, screenshot base64/paths, full DOM dumps, repeated navigation buttons
- Output confirmation: `Written N module files to results/modules/`

**After split, organize test cases as:** `index → module folder → submodule file`
One `.md` file per page/submodule. Target: < 300 lines per file.
See Principle 8 in `SKILL.md` for the full structure spec.

---

## Stop Conditions

Stop the exploration phase when ANY of these is hit:
- **20 new test cases** discovered and queued
- **15 minutes** elapsed since exploration started
- **All untested pages** in the sitemap have been explored
- **Patterns repeating** — 3 consecutive pages with only previously-seen interaction types

When stopped, present what was found and offer to continue: "Reached [stop condition]. Found [N] new test cases. Continue exploring? (y/n)"

---

## Priority Heuristics for Discovered Test Cases

Assign priority to each discovered TC:

| Priority | Criteria |
|----------|----------|
| **High** | Data loss risk, security-adjacent, blocks a core user flow, auth/authorization |
| **Medium** | Secondary workflow impairment, edge case on a common action |
| **Low** | Cosmetic issue, tooltip missing, low-probability edge case |

---

## What NOT to Generate as Test Cases

Skip these — they don't belong in the test suite:
- External links (e.g., "Privacy Policy", "Help Center")
- Pure content pages with no interactive elements
- Functionality already covered by existing TCs (verify duplication before skipping)
- Logout/login flows if already covered
- System-level browser behavior (browser back button, browser zoom)

---

## Coverage Map Output Format

Output after exploration completes:

```markdown
## Exploratory Coverage Map
**Application:** https://his-alpha-dev.q13.dev
**Explored:** 2025-03-11 14:30
**Duration:** 12 minutes

### Page Coverage

| Page | Status | Existing TCs | Untested Interactions |
|------|--------|-------------|----------------------|
| /login | TESTED | TC-001, TC-002 | — |
| /dashboard | TESTED | TC-003 | Export button, notification bell |
| /triage | TESTED | TC-004–TC-013 | Break-the-glass edge case |
| /orders/history | UNTESTED | — | Sort, filter, export, row actions |
| /settings/profile | UNTESTED | — | All fields, photo upload |

### Discovered Test Cases (Pending Approval)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TC-NEW-001 | Orders / History | Sort by date — ascending and descending | Medium |
| TC-NEW-002 | Orders / History | Export with no orders selected | High |
| TC-NEW-003 | Settings / Profile | Upload photo with invalid file type | High |
| TC-NEW-004 | Dashboard | Notification bell — mark as read | Low |

Add discovered TCs to test-cases/? (y/n)
```

---

## Rebuild TC List After Approval

When the user approves discovered TCs and they are saved to `test-cases/`, immediately rebuild the manual QA checklist:

```bash
node [app-name]/scripts/build-dashboard.js
```

Then print:

```
✓ artemis-tc-list.html updated — N test cases across M modules
  Open: open /path/to/artemis-tc-list.html
```

Do this silently at the end of the session — the user should not need to ask. If TCs are partially approved (some approved, some deferred), rebuild after each approval batch.

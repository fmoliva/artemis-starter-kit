# /walkthrough — TC Walkthrough GIF Creator

Load the artemis skill, then execute the /walkthrough command with these arguments: $ARGUMENTS

---

## What This Command Does

Creates an animated GIF walkthrough for a single test case, showing the navigation path through the app so users can see exactly how to reach and use the feature being tested. The GIF is stored permanently as documentation and shown in both the live dashboard and TC-list when clicking the TC.

## Usage

```
/walkthrough [TC-ID] [URL]
```

Examples:
```
/walkthrough TC-MOD-001 http://localhost:3000
/walkthrough TC-AUTH-001 https://app.example.com
```

## Execution Steps

### Step 1 — Load TC from DB

```bash
node [app-name]/scripts/query-tcs.js --tc-id=[TC-ID]
```

Read the TC steps and preconditions. If the DB is unavailable, parse the TC from `test-cases/` markdown files.

### Step 2 — Ensure walkthroughs directory exists

```bash
mkdir -p [app-name]/results/screenshots/walkthroughs
```

### Step 3 — Start GIF recording

Use **Claude-in-Chrome MCP** (exception to the Playwright-only rule — see `references/part-8-browser-tools.md`):

```
gif_creator(action="start_recording", options={
  showClickIndicators: true,
  showActionLabels: true,
  showProgressBar: false
})
```

Then navigate to the app URL using Chrome MCP:
```
navigate(url="[URL]")
```

### Step 4 — Execute TC steps for documentation

Navigate through each step of the TC using Chrome MCP tools:
- `navigate` for URL changes
- `find` + `computer(action="left_click")` for clicks
- `form_input` for text entry
- `computer(action="scroll")` for scrolling

**Pace is deliberate** — pause ~1s between steps so the GIF is readable.

Do NOT assert results or record pass/fail — this is documentation only.

### Step 5 — Stop recording and export

```
gif_creator(action="stop_recording")
gif_creator(action="export")
```

Save the exported GIF to the absolute path:
```
[absolute-path-to-app]/results/screenshots/walkthroughs/[tc-id-lowercase-hyphens]-walkthrough.gif
```

Example:
```
[app-name]/results/screenshots/walkthroughs/tc-mod-001-walkthrough.gif
```

### Step 6 — Store path in DB

```bash
node [app-name]/scripts/store-walkthrough.js '{
  "tc_id": "[TC-ID]",
  "walkthrough_path": "results/screenshots/walkthroughs/[tc-id-lowercase]-walkthrough.gif"
}'
```

### Step 7 — Report to user

```
✓ Walkthrough created for [TC-ID]: [TC title]
  File: results/screenshots/walkthroughs/[tc-id]-walkthrough.gif
  View: http://localhost:7373/screenshots/walkthroughs/[tc-id]-walkthrough.gif
  Dashboard: The GIF now appears in the TC detail panel in artemis-live and artemis-tc-list.
```

## Notes

- The walkthrough GIF is **permanent documentation** — it is NOT deleted by the cleanup script
- The GIF is served via the existing `/screenshots/walkthroughs/` path on the dashboard server
- Re-running `/walkthrough [TC-ID]` overwrites the previous GIF and updates the DB
- If gif_creator fails to export, save screenshots of each step instead and note: "Step-by-step screenshots saved; GIF export unavailable"

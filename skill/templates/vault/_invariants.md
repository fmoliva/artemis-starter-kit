---
title: APP_NAME_PLACEHOLDER — Behavioral Invariants
type: hot-tier
limit: 60 lines
---

# Behavioral Invariants

Check here FIRST when diagnosing unexpected test behavior.
Each entry: confirmed fact | what symptom it explains | first thing to check.

---

## Navigation

| Fact | Symptom | First Check |
|------|---------|-------------|
| [TODO: e.g. "Direct URL to /feature redirects to /home without prior nav"] | waitForURL timeout | Navigate via menu first, not direct URL |
| [TODO: e.g. "Modal confirm → /dashboard (not back to previous page)"] | URL mismatch after modal | Check _navigation-flow.md |

## Session & Auth

| Fact | Symptom | First Check |
|------|---------|-------------|
| [TODO: e.g. "Session cookie rotates on role change"] | Login redirect mid-suite | afterEach storageState save missing |

## UI Rendering

| Fact | Symptom | First Check |
|------|---------|-------------|
| [TODO: e.g. "Edit button only renders at record's home location"] | Button not in DOM | Current location ≠ record's home |

## Framework-Specific (Angular)

| Fact | Symptom | First Check |
|------|---------|-------------|
| waitForLoadState is a no-op after SPA route changes | Assertions fire before Angular renders | Use waitForAngularStable() or angular-stable fixture |
| getByRole('button') misses <a> and <div> elements | Silent timeout | Take MCP snapshot to confirm element type |

---

<!-- Add new invariants here as you discover them during /explore and /verify sessions -->

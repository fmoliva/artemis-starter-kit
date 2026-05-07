# Selector Catalog

One file per module. Each file is the confirmed selector map for that module's forms.

## Structure

```
selectors/
└── [module-name].md    ← all confirmed selectors for this module
```

## Why a separate selectors folder

Feature files document *what* the UI contains. The selector catalog documents *how Playwright targets it* — confirmed selector strings, fallback candidates, and notes on Angular/PrimeNG component quirks.

## Selector status symbols

| Symbol | Meaning |
|--------|---------|
| `✓` | Confirmed working in a passing Playwright run |
| `✓ CASCADE` | Confirmed; depends on parent selection loading child options |
| `?` | Listed in vault, not yet confirmed against live app |
| `✗` | Known broken selector (use fallback) |

## Entry format

```markdown
### [Field Label]
- **Primary:** `page.getByLabel('[Label]')` — ? / ✓ (confirmed: YYYY-MM-DD)
- **Fallback:** `page.locator('input[formcontrolname="[name]"]')` — ✓
- **Notes:** [Angular reactive form / PrimeNG dropdown / Bootstrap checkbox / etc.]
```

## How it gets populated

1. `/explore [url]` — initial harvest, all entries start as `?`
2. `/verify [module]` — passing tests promote `?` to `✓` for exercised fields
3. Manual confirmation — mark `✓` after visual inspection if needed

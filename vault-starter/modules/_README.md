# Module Feature Docs

Each subfolder here documents one module of your app.

## Structure

```
modules/
└── [module-name]/
    ├── [module-name].md        ← module overview: purpose, URL, who uses it, owned features
    ├── [feature-a].md          ← individual feature doc
    ├── [feature-b].md
    └── forms/
        └── [form-name].md      ← forms specific to this module
```

## Module overview file

The `[module-name].md` file should contain:
- Purpose and entry URL
- Who uses this module (roles)
- List of owned features (with links)
- List of cross-module features this module uses
- Typical workflow (numbered steps)

## Feature file

Each feature file should use the feature template from `templates/feature-template.md`:
- Controls table (inputs, buttons, dropdowns with selectors)
- Business rules
- Known quirks (selector gotchas, timing, animation waits)
- Edge cases
- Workflows

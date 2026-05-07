Load the artemis skill, then execute the /matrix command with these arguments: $ARGUMENTS

The /matrix command is defined in the Artemis skill:
- Arguments: [module?] — optional, limit to a single module folder slug
- No separate reference doc needed — fully defined in SKILL.md
- Reads all test-cases/**/*.md, builds a Feature × Test-Type coverage grid
- Marks each cell ✓ (≥1 TC) or ✗ (0 TCs), flags HIGH/MEDIUM/LOW gaps
- Outputs: coverage matrix printed in chat + saved to results/coverage-matrix-[YYYY-MM-DD].md

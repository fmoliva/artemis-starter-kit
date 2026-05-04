Load the artemis skill, then execute the /diff command with these arguments: $ARGUMENTS

The /diff command is defined in the Artemis skill:
- Arguments: [source-project] [target-project] [module?]
- No separate reference doc needed — fully defined in SKILL.md
- Compares two projects' test case libraries: ONLY IN SOURCE / ONLY IN TARGET / DIVERGED / IDENTICAL / UNRESOLVED [REVIEW:] tags
- Outputs: diff report printed in chat + saved to [target-project]/results/tc-diff-[YYYY-MM-DD].md

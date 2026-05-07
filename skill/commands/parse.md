Load the artemis skill, then handle /parse using the artemis-parser agent.

Arguments: $ARGUMENTS  (file path or pasted text)

Steps:
1. Read APP name: `cat .artemis-project 2>/dev/null`
2. Use the Agent tool to spawn the **artemis-parser** agent with this prompt:

"Parse the following into structured test cases for app [APP]: $ARGUMENTS

If this is a file path, read the file first.
Present all generated TCs for Gate 2 user approval before saving.
After approval: write to [APP]/test-cases/ and run node [APP]/scripts/migrate-tcs.js"

3. Present the agent's generated TCs to the user for Gate 2 approval.

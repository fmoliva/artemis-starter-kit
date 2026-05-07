Load the artemis skill, then handle /bug using the artemis-bug-analyst agent.

Arguments: $ARGUMENTS

Steps:
1. Read APP name: `cat .artemis-project 2>/dev/null`
2. Use the Agent tool to spawn the **artemis-bug-analyst** agent with this prompt:

"Analyze this failure for app [APP]: $ARGUMENTS

Check [APP]/results/bugs/ for existing reports and [APP]/test-cases/ if a TC ID is mentioned.
Write the bug report to [APP]/results/bugs/BUG-[MODULE]-[YYYY-MM-DD].md"

3. Print the written bug report path when done.

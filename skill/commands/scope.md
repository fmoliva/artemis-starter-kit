Load the artemis skill, then handle /scope using the artemis-bug-analyst agent.

Arguments: $ARGUMENTS  (format: [url] "feature-description")

Steps:
1. Read APP name: `cat .artemis-project 2>/dev/null`
2. Use the Agent tool to spawn the **artemis-bug-analyst** agent with this prompt:

"Recommend regression test scope for app [APP]: $ARGUMENTS

Read [APP]/test-cases/INDEX.md then the relevant module files.
Score every TC for relevance to the described change.
Output a ranked list (top 20, max 30) and a pre-filled /run command."

3. Print the ranked TC list and pre-filled /run command.

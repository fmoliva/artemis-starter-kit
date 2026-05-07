Load the artemis skill, then handle /improve using the artemis-bug-analyst agent.

Arguments: $ARGUMENTS  (path to test file)

Steps:
1. Read APP name: `cat .artemis-project 2>/dev/null`
2. Use the Agent tool to spawn the **artemis-bug-analyst** agent with this prompt:

"Review and improve this test file for app [APP]: $ARGUMENTS

Score it on 5 axes (Coverage, Selector Quality, Independence, Assertion Quality, Maintainability).
Present the improvement plan and wait for Gate 5 user approval before writing any changes."

3. Present the agent's improvement plan to the user and relay their approval/rejection back.

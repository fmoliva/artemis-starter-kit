Load the artemis skill, then execute the /scope command with these arguments: $ARGUMENTS

The /scope command is defined in the Artemis skill:
- Arguments: [url] "feature-description"
- Read references/advanced-commands.md before starting
- Regression Scope Recommender — scores every TC for relevance to a described code change
- Selects top TCs (default 20, max 30) and prints a pre-filled /run command
- Outputs: recommended TC scope + pre-filled /run [scope] [url] command printed in chat

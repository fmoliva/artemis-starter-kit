Load the artemis skill, then execute the full /artemis pipeline with these arguments: $ARGUMENTS

The /artemis command is the main entry point defined in the Artemis skill:
- Arguments: [url] [scope?] [docx?]
- Read references/core-orchestrator.md before starting
- Runs the full pipeline: Test Case Parser + Playwright Runner + Exploratory QA + Load Test Planner → Bug Analyzer → Test Improvement Agent → QA + Performance Report

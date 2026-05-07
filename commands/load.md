Load the artemis skill, then execute the /load command with these arguments: $ARGUMENTS

The /load command is defined in the Artemis skill:
- Arguments: [url] [scenario?]
- Read references/part-5-load-test-agent.md before starting
- Runs Load Test Planner → Load Test Generator agents for performance testing
- ⚠ Always confirm the URL is staging/test (not production) before running stress, spike, or endurance scenarios. Baseline is always safe.
- Outputs: k6 scripts in load-tests/ + performance report

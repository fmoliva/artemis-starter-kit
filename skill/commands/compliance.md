Load the artemis skill, then handle /compliance using the artemis-compliance-auditor agent.

The /compliance command audits recently completed tickets (queue cards in Done, Needs Fix, Blocked, or Issues Found) against every MANDATORY output `/ticket` requires — report structure, Session Notes placement, card stub format, feature vault file update, known-bugs.md entries, _pipeline.md update, and queue-column-matches-outcome — by reading the actual artifacts on disk, never by trusting the ticket's own claims or which session/subagent produced them.

Optional argument: a ticket title to audit just that one ticket. No argument audits the most recently completed cards not yet checked today.

Run this at the end of a `/ticket` auto-continue run, or on demand after any ticket you want double-checked. It is the independent backstop for cases where a MANDATORY step was silently skipped.

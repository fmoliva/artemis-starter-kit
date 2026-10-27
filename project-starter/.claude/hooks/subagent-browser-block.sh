#!/bin/bash
# PreToolUse (matcher: ^mcp__playwright__) — blocks browser tool calls made from
# inside a delegated subagent (Agent/Task tool).
#
# Why: every guard/logger in this directory keys its state off the session's
# transcript_path. A subagent has its OWN transcript, so it starts with none
# of the main session's logged state (reference docs read, fresh reads, etc.)
# and cannot satisfy or be checked by those hooks. Browser work therefore has
# to stay in the main session; subagents should report back instead.
#
# Opt out (e.g. a read-only research subagent): export ARTEMIS_ALLOW_SUBAGENT_BROWSER=1
#
# Fail-open on parse errors (never block on a hook bug). Fail-closed only when
# agent_id/agent_type unambiguously indicates a subagent context.

. "$(dirname "$0")/lib/common.sh"

[ "${ARTEMIS_ALLOW_SUBAGENT_BROWSER:-0}" = "1" ] && exit 0

input=$(cat)
agent=$(printf '%s' "$input" | artemis_field 'agent_id|agentId|agent_type|agentType')
[ -z "$agent" ] && exit 0

cat >&2 <<'MSG'
STOP - this browser action is running inside a delegated subagent.

Browser-driven testing is not delegated: the guards in .claude/hooks track
state per session (via transcript_path), and a subagent starts with none of
it, so its evidence and checks cannot be trusted or enforced.

ACTION REQUIRED NOW:
  1. Stop this action in the subagent.
  2. Report back to the main session instead of continuing browser work here.
  3. Do the navigation/click/fill step in the main session.
MSG
exit 2

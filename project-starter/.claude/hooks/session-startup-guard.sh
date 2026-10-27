#!/bin/bash
# UserPromptSubmit hook — enforce the CLAUDE.md startup sequence once per session.
# Fires on every user message; uses transcript path as session ID so the
# reminder only appears on the FIRST message of each session.

# Fail-open: no transcript id or parse error -> stay silent.
. "$(dirname "$0")/lib/common.sh"
input=$(cat)

transcript=$(printf '%s' "$input" | artemis_field 'transcript_path')
[ -z "$transcript" ] && exit 0

# Session key from the transcript path; flag lives in the project state dir
# (portable across macOS/Linux, nothing written outside the project).
flag=$(artemis_state_file startup "$(artemis_session_key "$transcript")")

# Already ran this session — stay silent
[ -f "$flag" ] && exit 0

# Mark as done so this only fires once per session
touch "$flag"

cat <<'REMINDER'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔔  SESSION START — MANDATORY STARTUP SEQUENCE REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before any response, navigation, or testing action, execute
CLAUDE.md's startup steps IN ORDER:

  Step 00 — first-run setup check (Node/Playwright/Python/.env/.mcp.json/vault present)
  Step 0  — resolve APP + VAULT + ENV_LABEL from .artemis-project
  Step 1  — git fetch; report sync status
  Step 2  — read $VAULT/_app-overview.md (lines 1-25)
             read $VAULT/_test-data.md (lines 1-25)
             read $VAULT/_invariants.md (limit 60 lines)
  Step 3  — read $VAULT/_pipeline.md (full); print session brief
  Step 4  — cold tier: load on demand only
  Step 5  — check $VAULT/raw/ for unprocessed files

Do NOT answer the user's first message until these steps are complete.
See CLAUDE.md "On Every Session Start" for the authoritative sequence —
if this project's CLAUDE.md renumbers or renames steps, follow that
version instead of this reminder.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMINDER

exit 0

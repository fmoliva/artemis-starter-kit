#!/bin/bash
# UserPromptSubmit hook — enforce the CLAUDE.md startup sequence once per session.
# Fires on every user message; uses transcript path as session ID so the
# reminder only appears on the FIRST message of each session.

input=$(cat)

transcript=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('transcript_path', ''))
except Exception:
    pass
" 2>/dev/null)

[ -z "$transcript" ] && exit 0

# Derive a session key from the transcript path (first 10 chars of md5)
session_key=$(printf '%s' "$transcript" | md5 | cut -c1-10)
flag="/tmp/artemis-startup-${session_key}"

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

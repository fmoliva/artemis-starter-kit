#!/bin/bash
# PreToolUse hook — fires before any Playwright browser_navigate call.
# Reminds Claude to check _navigation-flow.md before assuming a redirect.
# Does NOT block (exit 0) — acts as a mandatory checklist prompt.

input=$(cat)

url=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('url', ''))
except Exception:
    pass
" 2>/dev/null)

[ -z "$url" ] && exit 0

# Skip local dev-server URLs — these are usually incidental checks (e.g. a
# dashboard or scaffolding tool), not navigation inside the app under test.
# This template doesn't know the target app's own route keywords, so unlike
# an app-specific project we fire for every non-local URL rather than
# filtering on app-specific path terms.
if echo "$url" | grep -qiE "^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])([:/]|$)"; then
  exit 0
fi

cat <<REMINDER
⚠  NAV-FLOW CHECK — before navigating to: $url
   1. Confirm the destination in \$VAULT/_navigation-flow.md
   2. If the expected post-action redirect is NOT documented, state your
      assumption to the user before proceeding, then add the confirmed
      flow to _navigation-flow.md afterward.
   Never silently assume a redirect based on "logical" flow.
REMINDER

exit 0

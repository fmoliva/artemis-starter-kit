#!/usr/bin/env bash
# Artemis hook: detect server-side errors in Playwright/node output and block the AI from looping.
# Triggered as PostToolUse on Bash. Exit 2 = block and show message.

input=$(cat)

# Only run on Playwright or node investigation commands — skip unrelated bash calls
cmd=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
if ! echo "$cmd" | grep -qE "playwright|\.mjs|npx.*test|node.*inspect"; then
  exit 0
fi

# Scan output for server-side error signals
output=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_response',{}).get('output',''))" 2>/dev/null)

if echo "$output" | grep -qiE \
  "contact.{0,40}system.{0,40}administrator|\
SQLSTATE|\
doesn't have a default value|\
Incorrect integer value|\
<- 5[0-9]{2} |\
← 5[0-9]{2} |\
500 Internal Server Error|\
502 Bad Gateway|\
503 Service Unavailable"; then

  # macOS notification (no-op on other platforms)
  osascript -e 'display notification "Server-side error detected — stopping" with title "Artemis Blocker" sound name "Basso"' 2>/dev/null

  echo "🛑 SERVER-SIDE BLOCKER DETECTED — stop immediately, report to user, do NOT retry or loop"
  exit 2
fi

exit 0

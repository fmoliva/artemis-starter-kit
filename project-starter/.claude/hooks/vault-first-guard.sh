#!/bin/bash
# PreToolUse hook for AskUserQuestion — blocks navigation/access questions
# until Claude has checked the vault. Reads tool input JSON from stdin.

input=$(cat)

# Extract the questions text (join all question strings) using python for robust JSON parsing
questions_text=$(printf '%s' "$input" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    qs = data.get('tool_input', {}).get('questions', [])
    print(' '.join(q.get('question', '') for q in qs).lower())
except Exception:
    pass
" 2>/dev/null)

# If we couldn't parse, allow (fail-open)
if [ -z "$questions_text" ]; then
  exit 0
fi

# Navigation/access trigger phrases. Tuned to be specific so we don't block
# legitimate clarification questions (e.g. UI design choices, library picks).
patterns=(
  "where is"
  "where do i"
  "where can i find"
  "how do i access"
  "how should i access"
  "how to access"
  "what.s the url"
  "what is the url"
  "what.s the path"
  "what is the path"
  "navigate to"
  "click path"
  "menu path"
  "what.s the access path"
  "how do i open"
  "how do i get to"
  "which module"
  "which page"
  "find the page"
  "log in to"
  "how do i log in"
)

for p in "${patterns[@]}"; do
  if echo "$questions_text" | grep -Eiq "$p"; then
    cat <<EOF >&2
🛑 VAULT-FIRST RULE TRIGGERED
Your AskUserQuestion contains a navigation/access phrase ("$p").
Before asking the user, check the vault:
  grep -i "<feature>" "\$VAULT/_navigation-flow.md"
  cat "\$VAULT/modules/<module>/forms/<feature>.md"
  cat "\$VAULT/modules/<module>/<module>-module.md"
If the vault has the answer → proceed silently without asking.
If the vault is silent → re-issue the question and explain you already checked.
See CLAUDE.md's vault-first directive for the full rationale.
EOF
    exit 2
  fi
done

exit 0

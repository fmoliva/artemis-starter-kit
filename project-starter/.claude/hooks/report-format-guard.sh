#!/bin/bash
# PostToolUse hook for Write/Edit — enforces the canonical GitHub Report structure
# (skill/references/report-template.md) on any markdown file that contains a GitHub
# Report section. Fires on content signature, not path, so it catches both
# results/bugs/*.md dev reports and vault ticket notes without needing to resolve
# $VAULT inside the hook. Reads tool input JSON from stdin.

input=$(cat)

file_path=$(printf '%s' "$input" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('file_path', ''))
except Exception:
    pass
" 2>/dev/null)

# Only markdown files that exist on disk after the write/edit
[[ "$file_path" != *.md ]] && exit 0
[ ! -f "$file_path" ] && exit 0

content=$(cat "$file_path")

# Only fires on files that actually contain a GitHub Report section — everything else
# (unrelated vault docs, plan files, etc.) is untouched.
echo "$content" | grep -qi "GitHub Report" || exit 0

missing=()

echo "$content" | grep -q '```markdown' || missing+=("fenced \`\`\`markdown block wrapping the report")
echo "$content" | grep -qi "Bugs Found" || missing+=("### Bugs Found section")

if echo "$content" | grep -qiE "^#+ .*(Retest History|Retest Narrative)"; then
  missing+=("a 'Retest History/Narrative' section — overwrite the report block in place instead; historical detail belongs in the feature vault file, not here")
fi

if echo "$content" | grep -qiE "^\*?\*?CORRECTION:"; then
  missing+=("a 'CORRECTION:' prose paragraph — overwrite the current-status block instead of prefacing it with an explanation")
fi

if [ ${#missing[@]} -gt 0 ]; then
  cat <<EOF >&2
🛑 GITHUB REPORT FORMAT CHECK FAILED — $file_path
Missing or malformed:
$(printf '  • %s\n' "${missing[@]}")
See skill/references/report-template.md for the canonical structure (Bugs Found → Result
Scoreboard → Field-by-Field → Clarifications Needed → Vault Updates, tables/bullets
only). Fix this file before continuing.
EOF
  exit 2
fi

exit 0

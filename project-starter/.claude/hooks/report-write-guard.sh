#!/bin/bash
# PreToolUse (matcher: Write|Edit) — blocks a report write that asserts bugs
# unless at least one requirements/spec/mapping/mockup reference doc has been
# Read this session (see reference-read-logger.sh). Stops "bug" findings that
# are really just unverified assumptions about intended behavior.
#
# Clean-pass reports (Bugs Found = None) are not gated.
# If the item truly has no reference doc, say so explicitly in the report
# ("No reference doc exists") - that wording satisfies this gate.
#
# Fail-open on parse errors or when no transcript id is available.

. "$(dirname "$0")/lib/common.sh"
input=$(cat)

content=$(printf '%s' "$input" | artemis_field 'tool_input.content|tool_input.new_string')
transcript=$(printf '%s' "$input" | artemis_field 'transcript_path')
[ -z "$content" ] && exit 0
[ -z "$transcript" ] && exit 0

# Only reports with a Bugs Found section
printf '%s' "$content" | grep -qiE '^#+ *Bugs Found' || exit 0

bugs_block=$(printf '%s' "$content" | awk 'tolower($0) ~ /^#+ *bugs found/{f=1;next} f && /^#+ /{exit} f')
# Gate only when the section has at least one numbered bug row
printf '%s' "$bugs_block" | grep -qE '^\| *[0-9]+ *\|' || exit 0
printf '%s' "$content" | grep -qiE 'no reference doc (exists|available)' && exit 0

log=$(artemis_state_file refs-read "$(artemis_session_key "$transcript")")
if [ ! -s "$log" ]; then
  cat >&2 <<'MSG'
STOP - this report asserts bug(s), but no requirements/spec/mapping/mockup
reference doc has been read yet this session.

Flagging behavior as a bug without checking it against the item's own
reference docs produces false findings that later have to be retracted.

ACTION REQUIRED NOW:
  1. Stop this write.
  2. Locate and Read every reference doc linked from the ticket/card/vault.
  3. Re-verify each asserted bug against them.
  4. If a required doc is missing, ask the user or mark the item Blocked.
  5. If there genuinely is no reference doc, state "No reference doc exists"
     in the report, then retry.
MSG
  exit 2
fi
exit 0

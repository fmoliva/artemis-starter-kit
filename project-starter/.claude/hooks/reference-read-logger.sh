#!/bin/bash
# PostToolUse (matcher: Read) — records reads of requirements/spec/mapping/
# mockup-style reference docs to a session-scoped log. Consumed by
# report-write-guard.sh.
#
# Deliberately inclusive filename match: a false positive is a harmless log
# line; a false negative would make the gate un-satisfiable.
#
# Fail-open: only records, always exits 0.

. "$(dirname "$0")/lib/common.sh"
input=$(cat)

file_path=$(printf '%s' "$input" | artemis_field 'tool_input.file_path|tool_input.path')
transcript=$(printf '%s' "$input" | artemis_field 'transcript_path')
[ -z "$file_path" ] && exit 0
[ -z "$transcript" ] && exit 0

printf '%s' "$file_path" | grep -qiE '(requirement|spec|mapping|mockup|wireframe|acceptance[-_ ]criteria|user[-_ ]stor|\.csv$)' || exit 0

log=$(artemis_state_file refs-read "$(artemis_session_key "$transcript")")
grep -qxF -- "$file_path" "$log" 2>/dev/null || printf '%s\n' "$file_path" >> "$log" 2>/dev/null
exit 0

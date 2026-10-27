#!/bin/bash
# PostToolUse (matcher: Read|Grep) — logs "<path><TAB><epoch>" for every file
# read this session. Consumed by state-assertion-guard.sh to check that a
# claim about current state was backed by a recent read of the source file.
#
# Fail-open: only records, always exits 0.

. "$(dirname "$0")/lib/common.sh"
input=$(cat)

file_path=$(printf '%s' "$input" | artemis_field 'tool_input.file_path|tool_input.path')
transcript=$(printf '%s' "$input" | artemis_field 'transcript_path')
[ -z "$file_path" ] && exit 0
[ -z "$transcript" ] && exit 0

log=$(artemis_state_file recent-reads "$(artemis_session_key "$transcript")")
printf '%s\t%s\n' "$file_path" "$(date +%s)" >> "$log" 2>/dev/null
exit 0

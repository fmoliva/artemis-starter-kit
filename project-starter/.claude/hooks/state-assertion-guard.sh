#!/bin/bash
# PreToolUse (matcher: Write|Edit) — blocks a markdown write that asserts the
# CURRENT status of a queue card or bug ("marked Done", "still open", ...)
# unless the source file (_queue.md / known-bugs.md) was Read within the last
# ARTEMIS_FRESHNESS_WINDOW seconds (default 600) of this session
# (see recent-read-logger.sh). Targets claims made from memory instead of a
# same-turn check of the real source.
#
# Limits: only gates Write/Edit; cannot gate plain chat replies.
# Fail-open on any parse error, missing transcript id, or missing log.

. "$(dirname "$0")/lib/common.sh"
input=$(cat)

transcript=$(printf '%s' "$input" | artemis_field 'transcript_path')
file_path=$(printf '%s' "$input" | artemis_field 'tool_input.file_path')
[ -z "$transcript" ] && exit 0
case "$file_path" in *.md) ;; *) exit 0 ;; esac

log=$(artemis_state_file recent-reads "$(artemis_session_key "$transcript")")
result=$(printf '%s' "$input" | python3 "$ARTEMIS_HOOK_LIB_DIR/state_assertion.py" "$log" "${ARTEMIS_FRESHNESS_WINDOW:-600}" 2>/dev/null)
[ -z "$result" ] && exit 0
[ "$(printf '%s' "$result" | sed -n '1p')" != "BLOCK" ] && exit 0

claim=$(printf '%s' "$result" | sed -n '2p')
source_hint=$(printf '%s' "$result" | sed -n '3p')
cat >&2 <<MSG
STOP - STATE ASSERTION WITHOUT A FRESH CHECK. This write asserts:

   $claim

...but "$source_hint" has not been read in the last ${ARTEMIS_FRESHNESS_WINDOW:-600}s of this session.

ACTION REQUIRED: Read $source_hint now, confirm the claim against its actual
current content, then retry this write.
MSG
exit 2

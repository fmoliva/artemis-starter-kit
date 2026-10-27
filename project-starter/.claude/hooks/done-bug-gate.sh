#!/bin/bash
# PreToolUse (matcher: Write|Edit) — blocks moving a queue card into Done in
# _queue.md while the card references a bug ID that is still OPEN in
# known-bugs.md (open = not struck through as ~~ID~~). A ticket with confirmed,
# unretracted bugs against its own scope is not Done.
#
# Only the user may decide an ID is a false positive or strike it through.
#
# Fail-open on parse errors, or when the vault / known-bugs.md can't be found.

. "$(dirname "$0")/lib/common.sh"
input=$(cat)

file_path=$(printf '%s' "$input" | artemis_field 'tool_input.file_path')
case "$file_path" in *_queue.md) ;; *) exit 0 ;; esac

vault=$(artemis_vault_dir)
[ -z "$vault" ] && exit 0
bugs_file="$vault/known-bugs.md"
[ -f "$bugs_file" ] || exit 0

result=$(printf '%s' "$input" | python3 "$ARTEMIS_HOOK_LIB_DIR/done_bug_gate.py" "$bugs_file" 2>/dev/null)
[ "$(printf '%s' "$result" | sed -n '1p')" = "BLOCK" ] || exit 0

ids=$(printf '%s' "$result" | sed -n '2p')
cards=$(printf '%s' "$result" | sed -n '3p')
cat >&2 <<MSG
STOP - this write moves card(s) into Done in _queue.md, but referenced bug
ID(s) are still OPEN in known-bugs.md:

  $ids

Card(s): $cards

ACTION REQUIRED NOW:
  1. Stop this write.
  2. Move the card(s) to the Issues Found / Blocked column instead, tagged
     "auto-flagged by done-bug-gate - needs user review".
  3. Do NOT force the card to Done and do NOT strike the ID through in
     known-bugs.md yourself. If you think it is a false positive (e.g. the ID
     is only cross-referenced), explain why to the user and let them decide.
MSG
exit 2

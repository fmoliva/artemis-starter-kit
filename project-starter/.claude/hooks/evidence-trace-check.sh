#!/bin/bash
# PostToolUse (matcher: Write|Edit) — for a markdown report containing
# "Field-by-Field" tables with an `**Evidence:** <path>` line, verifies each
# cited artifact exists inside the project, is non-trivial in size, and that
# every row's item actually appears in it. Rows must be transcribed FROM a
# real extraction (DOM/API pull, list diff), not the other way round.
# Sections without an Evidence path are skipped. Min size: ARTEMIS_MIN_EVIDENCE_BYTES (default 40).
#
# Fail-open on internal errors, but loudly (a warning is printed; a broken
# checker must never read as a silent pass). Blocks (exit 2) only on findings.

. "$(dirname "$0")/lib/common.sh"
input=$(cat)

file_path=$(printf '%s' "$input" | artemis_field 'tool_input.file_path')
case "$file_path" in *.md) ;; *) exit 0 ;; esac
[ -f "$file_path" ] || exit 0
grep -qi 'field-by-field' "$file_path" 2>/dev/null || exit 0

checker="$ARTEMIS_HOOK_LIB_DIR/evidence_trace.py"
if [ ! -f "$checker" ]; then
  echo "WARNING evidence-trace-check: $checker missing - traceability NOT checked for $file_path." >&2
  exit 0
fi

findings=$(python3 "$checker" "$file_path" "$ARTEMIS_PROJECT_ROOT" "${ARTEMIS_MIN_EVIDENCE_BYTES:-40}" 2>&1)
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "WARNING evidence-trace-check: internal error (exit $rc) - traceability NOT checked for $file_path." >&2
  exit 0
fi
[ -z "$findings" ] && exit 0

{
  echo "STOP - Field-by-Field evidence traceability check FAILED for $file_path."
  printf '%s\n' "$findings" | sed 's/^/  * /'
  echo
  echo "Order of work: (1) extract the section's real data from the live app,"
  echo "(2) save the RAW output under results/evidence/<slug>/, (3) transcribe"
  echo "the rows FROM that artifact - never from the spec. If extraction is not"
  echo "possible, mark those rows Untested instead of claiming a verified result."
} >&2
exit 2

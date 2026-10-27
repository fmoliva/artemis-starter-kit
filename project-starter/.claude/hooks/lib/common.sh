#!/bin/bash
# Shared helpers for Artemis hooks. Source this file; do not execute it.
#
# Safety properties (apply to every hook that sources this):
#   * No network calls, no eval of hook input.
#   * All state is written under <project>/.claude/.state/ (git-ignored),
#     never to /tmp or elsewhere outside the project directory.
#   * Callers decide fail-open vs fail-closed and state it in their header.

ARTEMIS_HOOK_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# lib/ -> hooks/ -> .claude/ -> project root
ARTEMIS_PROJECT_ROOT="$(cd "$ARTEMIS_HOOK_LIB_DIR/../../.." && pwd)"
ARTEMIS_STATE_DIR="$ARTEMIS_PROJECT_ROOT/.claude/.state"

# artemis_field '<key1|key2.sub>' < json
# Prints the first non-empty value among the dotted key paths (pipe-separated).
# Prints nothing on any parse error (callers treat empty as "allow").
artemis_field() {
  python3 "$ARTEMIS_HOOK_LIB_DIR/hookfield.py" "$1" 2>/dev/null
}

# artemis_session_key <transcript_path> -> short stable hash (portable).
artemis_session_key() {
  local h
  if command -v md5 >/dev/null 2>&1; then
    h=$(printf '%s' "$1" | md5 | cut -c1-10)
  elif command -v md5sum >/dev/null 2>&1; then
    h=$(printf '%s' "$1" | md5sum | cut -c1-10)
  else
    h=$(printf '%s' "$1" | shasum | cut -c1-10)
  fi
  printf '%s' "$h"
}

# artemis_state_file <name> <session_key> -> path inside the project state dir.
# Creates the directory (and prunes files older than 7 days) on first use.
artemis_state_file() {
  mkdir -p "$ARTEMIS_STATE_DIR" 2>/dev/null
  find "$ARTEMIS_STATE_DIR" -maxdepth 1 -type f -mtime +7 -exec rm -f {} + 2>/dev/null
  printf '%s/%s-%s' "$ARTEMIS_STATE_DIR" "$1" "$2"
}

# artemis_vault_dir -> vault path from .artemis-project (context_vault=...),
# defaulting to ./vault. Prints nothing if the directory does not exist.
artemis_vault_dir() {
  local cfg="$ARTEMIS_PROJECT_ROOT/.artemis-project" v=""
  [ -f "$cfg" ] && v=$(grep -m1 '^context_vault=' "$cfg" | cut -d= -f2-)
  [ -z "$v" ] && v="./vault"
  case "$v" in
    "~"*) v="$HOME${v#\~}" ;;
    /*) ;;
    *) v="$ARTEMIS_PROJECT_ROOT/$v" ;;
  esac
  [ -d "$v" ] && printf '%s' "$v"
}

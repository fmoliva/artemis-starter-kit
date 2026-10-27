#!/usr/bin/env python3
"""Read a Claude Code hook JSON payload on stdin and print one field.

Usage: hookfield.py 'tool_input.content|tool_input.new_string'
Each pipe-separated alternative is a dotted key path; the first non-empty
value wins. Non-string values are printed as compact JSON. Prints nothing on
any error (hooks treat empty output as "nothing to check").
"""
import json
import sys


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    for alt in (sys.argv[1] if len(sys.argv) > 1 else "").split("|"):
        cur = data
        for part in alt.split("."):
            cur = cur.get(part) if isinstance(cur, dict) else None
            if cur is None:
                break
        if cur not in (None, "", [], {}):
            sys.stdout.write(cur if isinstance(cur, str) else json.dumps(cur))
            return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Helper for state-assertion-guard.sh.

stdin: hook JSON.  argv: <recent-reads log> <freshness window seconds>
Prints "BLOCK\\n<claim>\\n<source file>" if the written content asserts a
tracked state without a fresh read of its source; prints nothing otherwise.
"""
import json
import re
import sys
import time

ENTRIES = [
    {
        "phrase_re": r"\b(is now|has been|was)\s+(marked|moved to|completed as|closed as)\s+(done|complete|blocked|needs fix)\b|status:\s*(done|complete|blocked)",
        "source": "_queue.md",
        "claim": "a queue card's current column/status",
    },
    {
        "phrase_re": r"\b(confirmed|reconfirmed|still)\s+(open|resolved|fixed|blocked)\b|bug\s+#?[A-Z]+-\d+\s+(is|remains|was)",
        "source": "known-bugs.md",
        "claim": "a bug's current open/resolved status",
    },
]


def main():
    log_path, window = sys.argv[1], int(sys.argv[2])
    data = json.load(sys.stdin)
    ti = data.get("tool_input", {}) or {}
    content = ti.get("content") or ti.get("new_string") or ""
    target = (ti.get("file_path") or "").lower()
    now = time.time()

    recent = {}
    try:
        with open(log_path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if "\t" not in line:
                    continue
                path, ts = line.rstrip("\n").rsplit("\t", 1)
                try:
                    recent[path.lower()] = max(recent.get(path.lower(), 0), float(ts))
                except ValueError:
                    continue
    except FileNotFoundError:
        pass

    for e in ENTRIES:
        # Writing the source file itself is covered by the editor's own
        # read-before-write requirement; don't double-gate it.
        if target.endswith(e["source"].lower()):
            continue
        if not re.search(e["phrase_re"], content, re.IGNORECASE):
            continue
        fresh = any(e["source"].lower() in p and now - ts <= window
                    for p, ts in recent.items())
        if not fresh:
            print("BLOCK")
            print(e["claim"])
            print(e["source"])
            return 0
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # fail-open

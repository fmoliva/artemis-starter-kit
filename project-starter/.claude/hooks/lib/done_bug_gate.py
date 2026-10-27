#!/usr/bin/env python3
"""Helper for done-bug-gate.sh.

stdin: hook JSON.  argv: <path to known-bugs.md>
Prints "BLOCK\\n<open bug ids>\\n<card titles>" when content being written into
the Done column of _queue.md references a bug ID that is still open in
known-bugs.md. An ID is resolved/retracted only if its row's first cell is
struck through (~~ID~~); bold or plain means open.
"""
import json
import re
import sys

ID_RE = re.compile(r"\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[0-9]{3}\b")
# Phrases near an ID in the same card meaning "this card is not about that bug".
EXEMPT_RE = re.compile(
    r"did not reproduce|does not reproduce|non-repro|not reproduce|separate finding"
    r"|out of scope|not this ticket|different ticket|not a valid bug"
    r"|per user direction|user direction",
    re.IGNORECASE,
)


def main():
    bugs_path = sys.argv[1]
    data = json.load(sys.stdin)
    ti = data.get("tool_input", {}) or {}
    path = (ti.get("file_path") or "")
    content = ti.get("content") or ti.get("new_string") or ""
    if not path.endswith("_queue.md") or not content:
        return 0

    lines = content.splitlines()
    start = next((i for i, l in enumerate(lines) if re.match(r"^## .*Done", l)), None)
    if start is not None:
        end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
        block = lines[start:end]
    else:
        block = lines
    card_idx = [i for i, l in enumerate(block) if re.match(r"^- \[x\]", l)]
    if not card_idx:
        return 0

    try:
        with open(bugs_path, encoding="utf-8", errors="replace") as fh:
            bug_rows = [l for l in fh if l.startswith("|")]
    except OSError:
        return 0

    def row_state(bug_id):
        for l in bug_rows:
            cell = l.split("|")[1].strip() if l.count("|") > 1 else ""
            bare = cell.replace("*", "").replace("~", "").strip()
            if bare == bug_id:
                return "resolved" if cell.startswith("~~") else "open"
        return None

    open_ids, titles = [], []
    for n, s in enumerate(card_idx):
        e = card_idx[n + 1] if n + 1 < len(card_idx) else len(block)
        card = block[s:e]
        for bug_id in sorted(set(ID_RE.findall("\n".join(card)))):
            if row_state(bug_id) != "open":
                continue
            ctx = []
            for j, l in enumerate(card):
                if bug_id in l:
                    ctx.extend(card[max(0, j - 2):j + 3])
            if EXEMPT_RE.search("\n".join(ctx)):
                continue
            open_ids.append(bug_id)
            titles.append(card[0].strip())

    if open_ids:
        print("BLOCK")
        print(" ".join(open_ids))
        print(" | ".join(sorted(set(titles))))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # fail-open

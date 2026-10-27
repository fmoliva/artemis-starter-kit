#!/usr/bin/env python3
"""Mechanical Field-by-Field <-> evidence traceability check.

A report table can be well-formatted yet invented. This check makes citing
evidence mean something: for every "Field-by-Field" section that has an
`**Evidence:** path/to/artifact` line, the artifact must exist inside the
project, be at least <min_bytes> bytes, and (for text artifacts) every
numbered data row's identifying token must literally appear in it.

Sections with no Evidence path (absent, "same file as above", or prose-only
such as a visual-only check) are skipped, not flagged.

Usage: evidence_trace.py <report.md> <project_root> <min_bytes>
Prints one finding per line. Exit 0 on a clean run; non-zero only on internal
error.
"""
import os
import re
import sys

BT = chr(96)
EXT = r"(?:json|txt|csv|md|log|png|jpg|jpeg|pdf|html|xml|yml|yaml)"
PATH_RE = re.compile(
    BT + r"([^" + BT + r"]+?\." + EXT + r")" + BT
    + r"|\[[^\]]*\]\(([^)]+?\." + EXT + r")\)"
    + r"|(?<![\w/.])([\w./-]+/[\w./-]+\." + EXT + r")",
    re.I,
)
BINARY = (".png", ".jpg", ".jpeg", ".pdf")
GENERIC = {
    "the", "and", "for", "with", "from", "new", "all", "per", "field", "fields",
    "item", "items", "value", "values", "option", "options", "table", "section",
    "list", "name", "type", "code", "date", "status", "result", "total", "count",
    "row", "rows", "present", "yes", "not",
}
# Whole-cell behaviour/layout rows ("Field order", "Save behaviour") name a
# property, not a value that would appear in an extraction. Keep this narrow.
BEHAVIOUR = re.compile(
    r"^\s*(?:(?:section|field|column|tab|element|button|form)?\s*"
    r"(?:placement|position|ordering|order|layout|visibility|alignment)"
    r"|(?:save|submit|edit|delete|print|export|lifecycle|workflow|navigation|"
    r"persistence|regression)\s*(?:lifecycle|behaviou?r|action|flow|check)?)\s*$",
    re.I,
)


def evidence_path(raw):
    m = PATH_RE.search(raw)
    return next(g for g in m.groups() if g) if m else None


def parse(lines):
    sections, cur = [], None
    for idx, line in enumerate(lines):
        h = re.match(r"^(#+)\s*(.*)$", line)
        if h:
            depth, title = len(h.group(1)), h.group(2)
            if re.search(r"field-by-field", title, re.I):
                cur = {"title": title.strip(), "depth": depth, "line": idx + 1,
                       "evidence": None, "seen": False, "rows": []}
                sections.append(cur)
            elif cur is not None and depth <= cur["depth"]:
                cur = None
            continue
        if cur is None:
            continue
        ev = re.match(r"^\*\*Evidence:\*\*\s*(.+?)\s*$", line)
        if ev and not cur["seen"]:
            cur["seen"] = True
            cur["evidence"] = evidence_path(ev.group(1))
            continue
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) >= 3 and re.match(r"^\d+$", cells[0]):
                cur["rows"].append((cells[0], cells[1]))
    return sections


def tokens(cell):
    t = re.sub("[" + BT + r"]|\*\*|\*|_", " ", cell)
    t = re.sub(r"\([^)]*\)", " ", t)
    t = re.split(r"—|–|\s-\s", t)[0]
    words = re.findall(r"[A-Za-z][A-Za-z0-9'\-/.]{2,}", t)
    return [w for w in words if w.lower() not in GENERIC] or words


def check(report, root, min_bytes):
    with open(report, encoding="utf-8", errors="replace") as fh:
        lines = fh.read().splitlines()
    root_real = os.path.realpath(root)
    out = []
    for sec in parse(lines):
        label = "%s (line %d)" % (sec["title"], sec["line"])
        ev = sec["evidence"]
        if not ev:
            continue
        resolved = os.path.realpath(ev if os.path.isabs(ev) else os.path.join(root_real, ev))
        if os.path.commonpath([root_real, resolved]) != root_real:
            out.append("%s: Evidence path '%s' is outside the project; cite an artifact under the project (e.g. results/evidence/)." % (label, ev))
            continue
        if not os.path.isfile(resolved):
            out.append("%s: Evidence file does not exist -> '%s'." % (label, ev))
            continue
        size = os.path.getsize(resolved)
        if size < min_bytes:
            out.append("%s: Evidence file '%s' is %d bytes (< %d). An empty or placeholder file proves nothing; save the real raw output." % (label, ev, size, min_bytes))
            continue
        if resolved.lower().endswith(BINARY):
            continue
        with open(resolved, encoding="utf-8", errors="replace") as fh:
            hay = fh.read().lower()
        bad = []
        for num, field in sec["rows"]:
            if BEHAVIOUR.match(field):
                continue
            toks = tokens(field)
            if toks and not any(t.lower() in hay for t in toks):
                bad.append("row %s '%s'" % (num, field))
        if bad:
            more = " (+%d more)" % (len(bad) - 6) if len(bad) > 6 else ""
            out.append("%s: %d of %d row(s) name an item that appears NOWHERE in evidence file '%s' -> %s%s." % (label, len(bad), len(sec["rows"]), ev, "; ".join(bad[:6]), more))
    return out


def main():
    if len(sys.argv) != 4:
        sys.stderr.write("usage: evidence_trace.py <report.md> <project_root> <min_bytes>\n")
        return 64
    try:
        min_bytes = int(sys.argv[3])
    except ValueError:
        min_bytes = 40
    for f in check(sys.argv[1], sys.argv[2], min_bytes):
        print(f)
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Writes the counted numbers into the pages before a commit.

Every <span data-stamp="…"> in the pages below gets its text replaced. Nothing
else in a file is touched, pages that do not exist yet are skipped, and a
second run with the same inputs changes nothing.

  build     today's ISO date (--date overrides)
  tests     number of `func test` in a local MetalVisualKit checkout
  hash      that checkout's short HEAD, so the count is tied to a revision
  requests  requests of index.html's first view on a phone (FIRST_VIEW)
  weight    their size on disk, in KB (1 000 bytes, as DevTools counts)

Run from anywhere:
  python3 tools/stamp.py [--date YYYY-MM-DD] [--mvk /path/to/MetalVisualKit]
Stdlib only.
"""

import argparse
import datetime
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGES = ["index.html", "sv/index.html", "work/*.html", "cv/index.html", "sv/cv/index.html"]

# What a first view of index.html fetches on a phone: the page, its
# stylesheet, the two modules, the four fonts, the two images the stipple
# samples, the photograph (a 2x or 3x screen picks the 840 px file), the two
# project captures (lazy, but within the browser's lazy-load distance, so
# they load before any scroll; a 3x screen picks the 480 px files) and the
# favicon. The depth cloud, which loads only when asked for, is not here.
FIRST_VIEW = [
    "index.html",
    "assets/css/style.css",
    "assets/js/main.js",
    "assets/js/stipple.js",
    "assets/fonts/instrument-serif-400.woff2",
    "assets/fonts/instrument-sans-wght.woff2",
    "assets/fonts/instrument-serif-400-italic.woff2",
    "assets/fonts/plex-mono-400.woff2",
    "assets/img/portrait-300.webp",
    "assets/img/portrait-depth.webp",
    "assets/img/portrait.webp",
    "work/metalvisualkit-480.webp",
    "work/devicemonitor-480.webp",
    "assets/img/favicon.svg",
]

STAMP = re.compile(r'(<span\b[^>]*\bdata-stamp="([a-z]+)"[^>]*>)([^<]*)(</span>)')


def git(args, cwd):
    try:
        return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as err:
        print(f"! git {' '.join(args)} in {cwd}: {err}", file=sys.stderr)
        return None


def count_tests(mvk):
    """Occurrences of `func test` in the checkout's Swift files."""
    n = 0
    for dirpath, dirnames, filenames in os.walk(mvk):
        dirnames[:] = [d for d in dirnames if d not in (".git", ".build")]
        for name in filenames:
            if name.endswith(".swift"):
                with open(os.path.join(dirpath, name), encoding="utf-8", errors="replace") as f:
                    n += len(re.findall(r"\bfunc test", f.read()))
    return n


def first_view():
    rows = []
    for rel in FIRST_VIEW:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            print(f"! missing first-view file: {rel}", file=sys.stderr)
            continue
        rows.append((rel, os.path.getsize(path)))
    return rows


def values(args):
    out = {"build": args.date}

    if os.path.isdir(args.mvk):
        head = git(["rev-parse", "--short", "HEAD"], args.mvk)
        if head:
            out["hash"] = head
            out["tests"] = str(count_tests(args.mvk))
    else:
        print(f"! no MetalVisualKit checkout at {args.mvk}: tests and hash left as they are", file=sys.stderr)

    rows = first_view()
    width = max(len(rel) for rel, _ in rows)
    for rel, size in rows:
        print(f"  {rel:<{width}}  {size:>7,} B")
    total = sum(size for _, size in rows)
    print(f"  {'first view':<{width}}  {total:>7,} B  {len(rows)} requests")
    out["requests"] = str(len(rows))
    out["weight"] = f"{round(total / 1000)} KB"
    return out


def stamp(path, vals):
    with open(path, encoding="utf-8", newline="") as f:
        source = f.read()
    changes = []

    def replace(m):
        key, old = m.group(2), m.group(3)
        if key not in vals:
            print(f"! {os.path.relpath(path, ROOT)}: no value for data-stamp=\"{key}\", left as is", file=sys.stderr)
            return m.group(0)
        new = vals[key]
        if new != old:
            changes.append(f"{key}: {old!r} -> {new!r}")
        return m.group(1) + new + m.group(4)

    result = STAMP.sub(replace, source)
    rel = os.path.relpath(path, ROOT)
    if result == source:
        print(f"{rel}: unchanged")
        return
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(result)
    for change in changes:
        print(f"{rel}: {change}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--date", default=datetime.date.today().isoformat(), help="build date, ISO (default: today)")
    parser.add_argument("--mvk", default=os.path.join(os.path.dirname(ROOT), "metalvisualkit"), help="local MetalVisualKit checkout (default: next to this repository)")
    args = parser.parse_args()

    vals = values(args)
    print("  " + "  ".join(f"{k}={v}" for k, v in vals.items()))

    for pattern in PAGES:
        paths = sorted(glob.glob(os.path.join(ROOT, pattern)))
        if not paths:
            print(f"{pattern}: not there yet, skipped")
        for path in paths:
            stamp(path, vals)


if __name__ == "__main__":
    main()

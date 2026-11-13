#!/usr/bin/env python3
"""
Writes the counted numbers into the pages before a commit.

Every <span data-stamp="…"> in the pages below gets its text replaced. Nothing
else in a file is touched, pages that do not exist yet are skipped, and a
second run with the same inputs changes nothing.

  build     today's ISO date (--date overrides)
  requests  requests of index.html's first view on a phone (FIRST_VIEW)
  weight    their size on disk, in KB (1 000 bytes, as DevTools counts)

The first view may weigh at most BUDGET bytes; past it the script stops
before writing anything. What the home page fetches after its load event is
printed on lines of its own, on disk and gzipped as GitHub Pages sends it.

Run from anywhere:
  python3 tools/stamp.py [--date YYYY-MM-DD]
Stdlib only.
"""

import argparse
import datetime
import glob
import gzip
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGES = ["index.html", "sv/index.html", "work/*.html", "cv/index.html", "sv/cv/index.html", "404.html"]

# What the home page fetched on load in Chrome at 390 px wide and 3x, read from
# the Resource Timing list, plus the page and the favicon. The screenshots on
# the Work page are not in it: that page renders them only once it is swiped
# to (content-visibility in home.css). case-study.css and cv.css style what an
# app window shows, and main.js fetches them with the first window. The mascot, smed3d.js, is fetched only once the
# city has started and rows in after it, so he is not counted. Its still picture and the city's load only where WebGL 2
# is missing; until the city draws, the screen is a gradient for the hour.
# The city is asked for after the first paint, which can fall just after the
# load event; it is counted all the same. Home's four app
# faces (three icons at 180 px on a phone, and the baked ring) are its only
# pictures besides the portrait. Re-measure after changing the layout.
FIRST_VIEW = [
    "index.html",
    "assets/img/favicon.svg",
    "assets/fonts/bricolage-grotesque-wght.woff2",
    "assets/css/style.css",
    "assets/css/home.css",
    "assets/js/main.js",
    "assets/js/city.js",
    "assets/img/icons.svg",
    "assets/img/me-cut-168.webp",
    "work/img/icon-subtl-180.webp",
    "work/img/icon-giggledash-180.webp",
    "work/img/icon-devicemonitor-180.webp",
    "assets/art/obj-metalvisualkit.webp",
]

BUDGET = 450_000

# Fetched once the home page has loaded: the weather with its symbols and
# stylesheet (main.js), the city's clouds, rain, snow and water (city.js, half a second
# after its first frame), and two and a half seconds on the four apps' pages
# with their stylesheets, so a window opens with its page in it (main.js).
AFTER_LOAD = [
    "assets/js/weather.js",
    "assets/js/sky.js",
    "assets/css/sky.css",
    "assets/js/city-sky.js",
    "assets/js/smed3d.js",
    "assets/js/smed3d-fine.js",
    "assets/css/case-study.css",
    "assets/css/cv.css",
    "work/subtl.html",
    "work/giggledash.html",
    "work/devicemonitor.html",
    "work/metalvisualkit.html",
]

STAMP = re.compile(r'(<span\b[^>]*\bdata-stamp="([a-z]+)"[^>]*>)([^<]*)(</span>)')


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

    rows = first_view()
    width = max(len(rel) for rel, _ in rows)
    for rel, size in rows:
        print(f"  {rel:<{width}}  {size:>7,} B")
    total = sum(size for _, size in rows)
    print(f"  {'first view':<{width}}  {total:>7,} B  {len(rows)} requests")
    for rel in AFTER_LOAD:
        with open(os.path.join(ROOT, rel), "rb") as f:
            data = f.read()
        print(f"  after load: {rel:<{width - 12}}  {len(data):>7,} B  {len(gzip.compress(data, 9)):>6,} B gzipped")
    if total > BUDGET:
        sys.exit(f"! first view is {total:,} B, over the budget of {BUDGET:,} B: nothing written")
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

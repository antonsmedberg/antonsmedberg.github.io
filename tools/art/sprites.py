#!/usr/bin/env python3
"""Draws the MetalVisualKit app icon, the one pixel tile on the home screen. Stdlib only.

Run: python3 tools/art/sprites.py
"""

import math
import os
import random
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "art")


def rgba(hex_colour):
    h = hex_colour.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)


def write_png(grid, path):
    raw = bytearray()
    for row in grid.px:
        raw.append(0)
        for c in row:
            raw.extend(rgba(c) if c else (0, 0, 0, 0))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", grid.w, grid.h, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


def icon_metal():
    g = Grid(30, 30)
    g.rect(0, 0, 29, 29, "#131a33")
    rng = random.Random(3)
    for i in range(70):
        a = i / 70 * math.tau
        r = 10 + rng.uniform(-1.5, 1.5)
        g.set(15 + round(math.cos(a) * r), 15 + round(math.sin(a) * r), rng.choice(("#2f5bff", "#7ba0ff", "#ffffff")))
    return g


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    write_png(icon_metal(), os.path.join(OUT, "icon-metalvisualkit.png"))

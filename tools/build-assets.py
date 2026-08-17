#!/usr/bin/env python3
"""
Prepares every raster asset the site ships.

  portrait   — cuts the studio shot out of its backdrop, crops to 4:5, feathers
               the shoulders so the figure dissolves into the scene instead of
               ending on a hard horizontal edge.
  screenshots— keeps the true device aspect ratio (they are phone captures, not
               16:9), resizes to twice the largest display size, and compresses.

Run from the repo root:  python3 tools/build-assets.py
Deps: pillow, rembg[cpu]  (only needed when SOURCE portrait changes)
"""

import os
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
WORK = os.path.join(ROOT, "work")

PORTRAIT_SOURCE = os.path.join(ROOT, "tools", "source", "portrait-source.png")  # 1200x1200 studio shot


def cut_out(src_path):
    """Background removal. Cached — delete tools/source/portrait-cutout-cache.png to redo."""
    cache = os.path.join(ROOT, "tools", "source", "portrait-cutout-cache.png")
    if os.path.exists(cache):
        return Image.open(cache).convert("RGBA")
    from rembg import remove, new_session
    session = new_session("isnet-general-use")
    out = remove(
        Image.open(src_path).convert("RGB"),
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=252,
        alpha_matting_background_threshold=8,
        alpha_matting_erode_size=6,
    )
    out.save(cache)
    return out


def refine_edge(im, shrink=1.0, contrast=1.35):
    """Tighten the matte.

    Background removal leaves a rim of semi-transparent pixels that still carry
    colour from the old backdrop, which reads as a halo once the cut-out sits on
    a dark scene. Eroding the alpha slightly and pushing its contrast removes
    that rim while keeping hair detail.
    """
    alpha = im.getchannel("A")
    eroded = alpha.filter(ImageFilter.MinFilter(3)) if shrink >= 1 else alpha
    # Blend erode back in so fine hair is not chewed off entirely.
    alpha = Image.blend(alpha, eroded, 0.65)
    lut = [max(0, min(255, int(((v / 255 - 0.5) * contrast + 0.5) * 255))) for v in range(256)]
    im.putalpha(alpha.point(lut))
    return im


def feather_base(im, fade_fraction=0.22):
    """Fade the alpha to zero over the bottom slice so the torso has no cut line."""
    w, h = im.size
    alpha = im.getchannel("A")
    px = alpha.load()
    start = int(h * (1 - fade_fraction))
    for y in range(start, h):
        k = (y - start) / max(1, (h - 1 - start))
        k = k * k * (3 - 2 * k)          # smoothstep — a linear fade reads as a band
        factor = 1 - k
        for x in range(w):
            px[x, y] = int(px[x, y] * factor)
    im.putalpha(alpha)
    return im


def build_portrait():
    if not os.path.exists(PORTRAIT_SOURCE):
        print("! portrait source missing:", PORTRAIT_SOURCE)
        return
    cut = cut_out(PORTRAIT_SOURCE)

    cut = refine_edge(cut)

    # Crop tight on the head. The silhouette was measured: the head spans roughly
    # x 336..908 and y 55..880 in the 1200px source, so the face — not the torso —
    # becomes the subject.
    HEAD_CENTRE_X = 622
    CROP_W, CROP_H = 840, 1050
    left = max(0, HEAD_CENTRE_X - CROP_W // 2)
    cut = cut.crop((left, 10, left + CROP_W, 10 + CROP_H))

    cut = feather_base(cut, fade_fraction=0.20)

    ratio = cut.size[1] / cut.size[0]
    for width, suffix in ((840, ""), (560, "@2x-small")):
        out = cut.resize((width, round(width * ratio)), Image.LANCZOS)
        name = "portrait" + suffix
        out.save(os.path.join(IMG, name + ".webp"), quality=88, method=6)
        if suffix == "":
            out.resize((560, round(560 * ratio)), Image.LANCZOS).save(
                os.path.join(IMG, name + ".png"), optimize=True)
            build_depth_map(out, os.path.join(IMG, "portrait-depth.png"))
            build_scan(out, os.path.join(IMG, "face-scan.svg"))
        print(f"  portrait {out.size} -> {name}.webp"
              + (" / portrait.png (560w fallback)" if suffix == "" else ""))


def build_depth_map(portrait_rgba, out_path, width=240):
    """Bake a depth map for the point cloud.

    Luminance alone is not depth: dark hair is not far away and a bright collar
    is not near. Nor is a plain distance transform, which treats the widest part
    of the shoulders as the closest thing in frame.

    What actually works for a head-and-shoulders portrait:

      1. A distance transform normalised PER ROW. Each horizontal slice through
         a head or a torso is roughly a cylinder, so the centre of that slice is
         its nearest point. Normalising globally instead makes the widest row —
         the shoulders — dominate the whole map.
      2. A high-pass of the shading, added on top rather than averaged in. The
         low frequencies of the image are lighting, not geometry; only the
         detail band carries the nose, brow and cheekbone.
      3. A gentle vertical falloff, because in a three-quarter portrait the
         chin and neck sit behind the brow.
    """
    from scipy.ndimage import distance_transform_edt, gaussian_filter

    ratio = portrait_rgba.size[1] / portrait_rgba.size[0]
    small = portrait_rgba.resize((width, round(width * ratio)), Image.LANCZOS)
    arr = np.asarray(small).astype(np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3]

    inside = alpha > 0.5
    h, w = inside.shape

    # 1. Distance transform, normalised within each row.
    dist = distance_transform_edt(inside).astype(np.float32)
    row_max = dist.max(axis=1, keepdims=True)
    volume = np.where(row_max > 0, dist / np.maximum(row_max, 1e-5), 0.0)
    volume = np.sqrt(volume)            # rounds the slice off instead of coning
    volume = gaussian_filter(volume, sigma=2.2)

    # 2. Shading detail only — the low frequencies are the lighting setup.
    luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    luma = gaussian_filter(luma, sigma=1.2)
    detail = luma - gaussian_filter(luma, sigma=7.0)

    # 3. Vertical falloff.
    fall = np.linspace(1.0, 0.70, h, dtype=np.float32)[:, None]

    depth = volume * fall + detail * 0.55
    depth = gaussian_filter(depth, sigma=1.0)

    if inside.any():
        lo, hi = np.percentile(depth[inside], (2, 98))
        depth = np.clip((depth - lo) / max(1e-5, hi - lo), 0, 1)

    out = np.zeros((h, w, 2), dtype=np.uint8)
    out[..., 0] = (depth * 255).astype(np.uint8)      # L
    out[..., 1] = (alpha * 255).astype(np.uint8)      # A
    Image.fromarray(out, mode="LA").save(out_path, optimize=True)
    print(f"  depth map {small.size} -> {os.path.basename(out_path)}")


def _chaikin(points, rounds=2):
    """Corner cutting. Contours traced from a raster are faceted; two rounds of
    Chaikin turn them into curves without adding a curve-fitting dependency."""
    for _ in range(rounds):
        out = [points[0]]
        for a, b in zip(points[:-1], points[1:]):
            out.append(a + (b - a) * 0.25)
            out.append(a + (b - a) * 0.75)
        out.append(points[-1])
        points = np.asarray(out)
    return points


def build_scan(portrait_rgba, out_path, width=240, spacing=11, amplitude=32):
    """Draw the face as a LiDAR line scan and write it as one SVG.

    A depth sensor sweeps a line across a surface and records where it bends.
    That is exactly what this draws: evenly spaced horizontal lines, displaced
    upward in proportion to depth. Off the figure the lines are perfectly
    straight and run to the edge of the frame, so the same system that
    describes the face also *is* the background — nothing has to be blended
    into anything else, because there is only one graphic.

    Occlusion is what makes it read as a solid form rather than a wire grid.
    Each line carries a fill in the page colour extending to the bottom of the
    frame, and lines are drawn far-to-near (top row first), so nearer ridges
    hide the tails of the ones behind them.

    The field is weighted toward shading detail, not silhouette volume: with
    the volume term dominant, the relief comes out as a smooth hill. The brow,
    nose and jaw only appear when the detail band leads.
    """
    from scipy.ndimage import gaussian_filter, distance_transform_edt

    ratio = portrait_rgba.size[1] / portrait_rgba.size[0]
    small = portrait_rgba.resize((width, round(width * ratio)), Image.LANCZOS)
    arr = np.asarray(small).astype(np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3]
    inside = alpha > 0.5
    h, w = arr.shape[:2]

    dist = distance_transform_edt(inside).astype(np.float32)
    row_max = dist.max(axis=1, keepdims=True)
    volume = gaussian_filter(
        np.sqrt(np.where(row_max > 0, dist / np.maximum(row_max, 1e-5), 0.0)), 2.2)

    luma = gaussian_filter(
        0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2], 1.2)
    detail = luma - gaussian_filter(luma, 7.0)
    fall = np.linspace(1.0, 0.72, h, dtype=np.float32)[:, None]

    field = volume * fall * 0.62 + detail * 1.15 + gaussian_filter(luma, 3.0) * 0.30
    lo, hi = np.percentile(field[inside], (2, 98))
    field = np.clip((field - lo) / max(1e-5, hi - lo), 0, 1)

    # Smooth, then feather to zero across the silhouette so lines rejoin the
    # flat background without a step.
    weight = gaussian_filter(inside.astype(np.float32), 2.2)
    heights = gaussian_filter(np.where(inside, field, 0.0), 2.2)
    heights = np.where(weight > 0.04, heights / np.maximum(weight, 1e-5), 0.0)
    heights *= gaussian_filter(inside.astype(np.float32), 1.8)

    body = []
    for y in range(2, h, spacing):
        pts = []
        for x in range(-w // 2, w + w // 2 + 1, 2):
            dv = heights[y, x] if 0 <= x < w else 0.0
            pts.append((x, y - dv * amplitude))

        # Collapse the long flat runs outside the figure to a few points.
        kept = [pts[0]]
        for i in range(1, len(pts) - 1):
            if (abs(pts[i][1] - kept[-1][1]) > 0.06
                    or abs(pts[i + 1][1] - pts[i][1]) > 0.06):
                kept.append(pts[i])
        kept.append(pts[-1])

        d = " ".join(f"{x},{yy:.1f}" for x, yy in kept)
        body.append(
            f'<polygon points="{d} {w+w//2},{h+60} {-w//2},{h+60}" '
            f'fill="var(--scan-fill, #f4f6f9)" stroke="none"/>')
        body.append(f'<polyline points="{d}"/>')

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-w//2} 0 {2*w} {h}" '
        f'fill="none" stroke="url(#ramp)" stroke-width="0.6" '
        f'stroke-linejoin="round" stroke-linecap="round">'
        f'<defs><linearGradient id="ramp" x1="0" y1="0" x2="1" y2="0">'
        f'<stop offset="0" stop-color="#c3ccd9"/>'
        f'<stop offset="0.24" stop-color="#959de8"/>'
        f'<stop offset="0.42" stop-color="#4a54c9"/>'
        f'<stop offset="0.58" stop-color="#2b3a6b"/>'
        f'<stop offset="1" stop-color="#1c2a44"/>'
        f'</linearGradient></defs>'
        + "".join(body) + "</svg>"
    )
    with open(out_path, "w") as fh:
        fh.write(svg)
    print(f"  scan {len(body)//2} lines -> {os.path.basename(out_path)} "
          f"({len(svg)/1024:.1f} KB)")


def build_screenshot(filename, max_h=1100):
    path = os.path.join(WORK, filename)
    if not os.path.exists(path):
        print("! screenshot missing:", path)
        return
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    if h > max_h:
        w = round(w * max_h / h)
        h = max_h
        im = im.resize((w, h), Image.LANCZOS)

    stem = filename.rsplit(".", 1)[0]
    im.convert("RGB").save(os.path.join(WORK, stem + ".webp"), quality=82, method=6)
    im.save(os.path.join(WORK, stem + ".png"), optimize=True)
    print(f"  {filename} -> {w}x{h} (aspect {w/h:.3f})")
    return w, h


def main():
    print("portrait:")
    build_portrait()
    print("screenshots:")
    dims = {}
    for f in ("metalvisualkit-screenshot.png", "devicemonitor-screenshot.png"):
        d = build_screenshot(f)
        if d:
            dims[f] = d
    print("\nUse these width/height attributes in the <img> tags:")
    for f, (w, h) in dims.items():
        print(f'  {f}: width="{w}" height="{h}"')


if __name__ == "__main__":
    main()

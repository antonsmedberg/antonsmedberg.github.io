#!/usr/bin/env python3
"""
Rebuilds every derived raster asset the site ships.

  portrait   — cuts the studio shot out of its backdrop, crops to 4:5, feathers
               the shoulders, and writes three WebP sizes plus the depth map the
               stipple and the depth cloud both read.
  captures   — the two real app captures (tools/source/*-capture.png, copied
               unedited from the project repositories) resized to the widths
               the <img srcset> lists.

Run from the repo root:  python3 tools/build-assets.py
Deps: pillow, numpy, scipy. rembg[cpu] only when the portrait source changes
(delete tools/source/portrait-cutout-cache.png to redo the cut-out).
Icons and the OG image are rendered by tools/render-images.js (Playwright).
"""

import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
WORK = os.path.join(ROOT, "work")
SRC = os.path.join(ROOT, "tools", "source")

PORTRAIT_SOURCE = os.path.join(SRC, "portrait-source.png")  # 1200x1200 studio shot
CAPTURES = {
    "metalvisualkit": "metalvisualkit-capture.png",
    "devicemonitor": "devicemonitor-capture.png",
}
CAPTURE_WIDTHS = (360, 480, 720)


def cut_out(src_path):
    """Background removal. Cached — delete the cache file to redo."""
    cache = os.path.join(SRC, "portrait-cutout-cache.png")
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


def refine_edge(im, contrast=1.35):
    """Tighten the matte: erode the rim of backdrop-coloured pixels, keep hair."""
    alpha = im.getchannel("A")
    eroded = alpha.filter(ImageFilter.MinFilter(3))
    alpha = Image.blend(alpha, eroded, 0.65)
    lut = [max(0, min(255, int(((v / 255 - 0.5) * contrast + 0.5) * 255))) for v in range(256)]
    im.putalpha(alpha.point(lut))
    return im


def feather_base(im, fade_fraction=0.20):
    """Fade the alpha to zero over the bottom slice so the torso has no cut line."""
    alpha = np.asarray(im.getchannel("A")).astype(np.float32)
    h = alpha.shape[0]
    start = int(h * (1 - fade_fraction))
    k = np.linspace(0, 1, h - start, dtype=np.float32)
    k = k * k * (3 - 2 * k)  # smoothstep — a linear fade reads as a band
    alpha[start:] *= (1 - k)[:, None]
    im.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    return im


def build_portrait():
    if not os.path.exists(PORTRAIT_SOURCE):
        print("! portrait source missing:", PORTRAIT_SOURCE)
        return
    cut = refine_edge(cut_out(PORTRAIT_SOURCE))

    # Crop tight on the head: measured on the 1200 px source.
    head_centre_x = 622
    crop_w, crop_h = 840, 1050
    left = max(0, head_centre_x - crop_w // 2)
    cut = cut.crop((left, 10, left + crop_w, 10 + crop_h))
    cut = feather_base(cut)

    ratio = cut.size[1] / cut.size[0]
    for width, name, quality in ((840, "portrait.webp", 88), (600, "portrait-600.webp", 86), (300, "portrait-300.webp", 84)):
        out = cut.resize((width, round(width * ratio)), Image.LANCZOS)
        path = os.path.join(IMG, name)
        out.save(path, quality=quality, method=6)
        print(f"  {name} {out.size} {os.path.getsize(path) // 1024} KB")
    build_depth_map(cut, os.path.join(IMG, "portrait-depth.webp"))


def build_depth_map(portrait_rgba, out_path, width=300):
    """Bake the four-channel map both renderers read.

      R  depth — a per-row distance transform (each slice through a head is
         roughly a cylinder, so the centre of the slice is its nearest point)
         plus a high-pass of the shading, which carries the nose, brow and
         cheekbone; a gentle vertical falloff puts the chin behind the brow.
      G  feature detail — a band-passed edge response with the silhouette
         suppressed, so eyelids, lips and the jaw get points and pores do not.
      B  distance from the silhouette.
      A  the portrait mask.
    Written as lossless WebP so every channel survives byte for byte.
    """
    from scipy.ndimage import distance_transform_edt, gaussian_filter, sobel

    ratio = portrait_rgba.size[1] / portrait_rgba.size[0]
    small = portrait_rgba.resize((width, round(width * ratio)), Image.LANCZOS)
    arr = np.asarray(small).astype(np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3]
    inside = alpha > 0.5
    h, w = inside.shape

    dist = distance_transform_edt(inside).astype(np.float32)
    row_max = dist.max(axis=1, keepdims=True)
    volume = np.where(row_max > 0, dist / np.maximum(row_max, 1e-5), 0.0)
    volume = gaussian_filter(np.sqrt(volume), sigma=2.2)

    luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    luma = gaussian_filter(luma, sigma=1.2)
    detail = luma - gaussian_filter(luma, sigma=7.0)
    fall = np.linspace(1.0, 0.70, h, dtype=np.float32)[:, None]

    depth = gaussian_filter(volume * fall + detail * 0.55, sigma=1.0)
    if inside.any():
        lo, hi = np.percentile(depth[inside], (2, 98))
        depth = np.clip((depth - lo) / max(1e-5, hi - lo), 0, 1)

    band = gaussian_filter(luma, sigma=0.7) - gaussian_filter(luma, sigma=3.4)
    edges = np.hypot(sobel(band, axis=1, mode="nearest"), sobel(band, axis=0, mode="nearest"))
    rim = np.clip(dist / 3.0, 0, 1)
    edges *= inside * rim
    if inside.any():
        hi_e = np.percentile(edges[inside], 97.0)
        edges = np.clip(edges / max(hi_e, 1e-5), 0, 1)
    edges = gaussian_filter(edges, sigma=0.6)
    edges = np.clip((edges - 0.22) / 0.48, 0, 1)
    edges = edges * edges * (3.0 - 2.0 * edges)

    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 0] = (depth * 255).astype(np.uint8)
    out[..., 1] = (edges * 255).astype(np.uint8)
    out[..., 2] = (rim * 255).astype(np.uint8)
    out[..., 3] = (alpha * 255).astype(np.uint8)
    Image.fromarray(out, mode="RGBA").save(out_path, lossless=True, exact=True, method=6)
    print(f"  {os.path.basename(out_path)} {small.size} {os.path.getsize(out_path) // 1024} KB (R depth, G detail, B rim, A mask)")


def build_captures():
    for name, filename in CAPTURES.items():
        path = os.path.join(SRC, filename)
        if not os.path.exists(path):
            print("! capture missing:", path)
            continue
        im = Image.open(path).convert("RGB")
        w, h = im.size
        widths = sorted({min(tw, w) for tw in CAPTURE_WIDTHS})
        candidates = []
        for tw in widths:
            th = round(h * tw / w)
            out = im.resize((tw, th), Image.LANCZOS) if tw != w else im
            out_path = os.path.join(WORK, f"{name}-{tw}.webp")
            out.save(out_path, quality=82, method=6)
            candidates.append(f"/work/{name}-{tw}.webp {tw}w")
            print(f"  {name}-{tw}.webp {tw}x{th} {os.path.getsize(out_path) // 1024} KB")
        print(f'  srcset="{", ".join(candidates)}" width="{w}" height="{h}"  (unedited capture {w}x{h})')


def main():
    print("portrait:")
    build_portrait()
    print("captures:")
    build_captures()


if __name__ == "__main__":
    main()

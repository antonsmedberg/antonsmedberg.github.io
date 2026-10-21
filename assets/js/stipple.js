// stipple.js — Fig. 0: the portrait as ink points.
//
// Points are placed by luminance and feature detail, sized by depth, and the
// shoulders dissolve into the paper. Everything is computed once from two
// 300×375 images (the photograph for luminance, the baked depth map for
// depth, detail and the silhouette), then drawn as a single path. There is
// no render loop: the figure is redrawn only on resize or a theme change.
//
// The grid and the random seed are fixed, so the drawing is the same artefact
// on every visit — a figure, not an effect.

const COLS = 260;
const ROWS = 325;
const SEED = 7;

// mulberry32 — small, fast, deterministic.
export function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

// Reads both images into pixel arrays at the depth map's resolution.
export async function sample(photoURL, depthURL) {
  const [photo, depth] = await Promise.all([loadImage(photoURL), loadImage(depthURL)]);
  const W = depth.naturalWidth;
  const H = depth.naturalHeight;
  const scratch = document.createElement('canvas');
  scratch.width = W;
  scratch.height = H;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });

  ctx.drawImage(photo, 0, 0, W, H);
  const p = ctx.getImageData(0, 0, W, H).data;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(depth, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;

  return { W, H, p, d };
}

// Returns a flat array [x, y, radius, ...] with x, y in 0..1 of a 4:5 box and
// radius in grid cells, sorted top to bottom so a partial draw is a reveal.
export function computeDots({ W, H, p, d }, cols = COLS, rows = ROWS, seed = SEED) {
  const random = rng(seed);
  const out = [];

  // Last row that still holds the figure: the fade is measured from there.
  let last = H - 1;
  while (last > 0) {
    let any = false;
    for (let x = 0; x < W; x += 2) {
      if (d[(last * W + x) * 4 + 3] > 127) { any = true; break; }
    }
    if (any) break;
    last--;
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const sx = Math.floor(((i + 0.5) / cols) * W);
      const sy = Math.floor(((j + 0.5) / rows) * H);
      const k = (sy * W + sx) * 4;
      if (d[k + 3] < 128) continue; // outside the silhouette

      const lum = (0.2126 * p[k] + 0.7152 * p[k + 1] + 0.0722 * p[k + 2]) / 255;
      const depth = d[k] / 255;
      const detail = d[k + 1] / 255;
      const fade = Math.min(1, Math.max(0, (last - sy) / (H * 0.085)));

      // Dark and structured areas earn more, larger points; a probability
      // cap keeps the eye sockets and hair from printing solid.
      const w = Math.min(1, Math.pow(1 - lum, 1.7) * 0.92 + detail * 0.45);
      const prob = Math.min(0.74, w * 0.92 + 0.012) * fade;
      const radius = (0.23 + 0.42 * w) * (0.84 + 0.32 * depth);

      // Always draw the same number of randoms per cell so the artefact is
      // independent of which cells are kept.
      const r1 = random();
      const r2 = random();
      const r3 = random();
      if (r1 < prob) {
        out.push((i + 0.5 + (r2 - 0.5) * 0.8) / cols, (j + 0.5 + (r3 - 0.5) * 0.8) / rows, radius);
      }
    }
  }

  return out;
}

// Draws dots (as returned by computeDots) into a canvas, fitting a 4:5 box
// inside it. progress 0..1 reveals the figure from the top down.
export function paintDots(canvas, dots, ink, progress = 1, cols = COLS) {
  const ctx = canvas.getContext('2d');
  const cw = canvas.width;
  const ch = canvas.height;
  const fitW = Math.min(cw, (ch * 4) / 5);
  const fitH = (fitW * 5) / 4;
  const ox = (cw - fitW) / 2;
  const oy = ch - fitH; // bottom-aligned, like the photograph
  const cell = fitW / cols;

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = ink;
  ctx.beginPath();
  for (let n = 0; n < dots.length; n += 3) {
    if (dots[n + 1] > progress) break;
    const x = ox + dots[n] * fitW;
    const y = oy + dots[n + 1] * fitH;
    const radius = dots[n + 2] * cell;
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, 6.283185307);
  }
  ctx.fill();
}

// Sizes the canvas to its CSS box at the device pixel ratio (capped at 2).
export function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return true;
}

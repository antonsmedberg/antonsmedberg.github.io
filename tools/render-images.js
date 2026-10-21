#!/usr/bin/env node
// render-images.js — the three raster images the site ships, rendered by
// Chromium from the SVG mark and the OG template so they use the same
// drawing, the same fonts and the same stipple as the pages.
//
//   assets/img/favicon-32.png        favicon.svg at 32×32 (paper tile, rounded)
//   assets/img/apple-touch-icon.png  the same drawing on a full-bleed paper
//                                    square, 180×180, no rounding (iOS masks it)
//   assets/img/og-image.png          tools/og.html at 1200×630, ≤ 120 KB
//
// Run from the repo root:
//   NODE_PATH=/opt/node-tools/node_modules node tools/render-images.js
//
// The script serves the repository on a local port itself, so the template's
// module import and image loads are same-origin. Needs Playwright with
// Chromium, and python3 with Pillow for the PNG pass at the end.

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'assets', 'img');
const OG_LIMIT = 120 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function serve(root) {
  const server = http.createServer((req, res) => {
    const file = path.join(root, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

// An HTML page holding the favicon drawing at `size` px. `square` drops the
// rounded corners so the paper fills the bitmap.
function iconPage(svg, size, square) {
  const drawing = (square ? svg.replace(/ rx="[^"]*"/, '') : svg)
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${drawing}</body></html>`;
}

async function renderIcon(browser, html, size, out, transparent) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}

async function renderOG(browser, origin, out) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => failed.push(e.message));
  await page.goto(`${origin}/tools/og.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  const count = await page.evaluate(() => document.documentElement.dataset.ready);
  const faces = await page.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`));
  if (failed.length) throw new Error(`og.html: ${failed.join(', ')}`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await page.close();
  return { count, faces };
}

// Pillow re-encodes each PNG with its optimiser; the OG image is reduced to a
// palette only if it is still over the limit after that.
function optimise(files, ogPath) {
  const script = `
import sys
from PIL import Image
limit = int(sys.argv[1]); og = sys.argv[2]
for p in sys.argv[3:]:
    im = Image.open(p)
    if p.endswith('apple-touch-icon.png'):
        im = im.convert('RGB')
    im.save(p, optimize=True)
    import os
    if p == og and os.path.getsize(p) > limit:
        for colors in (256, 128, 64):
            Image.open(p).convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(p, optimize=True)
            if os.path.getsize(p) <= limit:
                break
`;
  const r = spawnSync('python3', ['-c', script, String(OG_LIMIT), ogPath, ...files], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Pillow pass failed');
}

async function main() {
  const svg = fs.readFileSync(path.join(IMG, 'favicon.svg'), 'utf8');
  const favicon = path.join(IMG, 'favicon-32.png');
  const touch = path.join(IMG, 'apple-touch-icon.png');
  const og = path.join(IMG, 'og-image.png');

  const { server, origin } = await serve(ROOT);
  const browser = await chromium.launch();
  try {
    await renderIcon(browser, iconPage(svg, 32, false), 32, favicon, true);
    await renderIcon(browser, iconPage(svg, 180, true), 180, touch, false);
    const { count, faces } = await renderOG(browser, origin, og);
    console.log(`og-image: ${count} stipple points; fonts: ${faces.join(', ')}`);
  } finally {
    await browser.close();
    server.close();
  }

  optimise([favicon, touch, og], og);
  for (const file of [favicon, touch, og]) {
    const bytes = fs.statSync(file).size;
    const flag = file === og && bytes > OG_LIMIT ? '  OVER LIMIT' : '';
    console.log(`${path.relative(ROOT, file)}  ${bytes} B${flag}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

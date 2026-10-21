#!/usr/bin/env node
// Prints the CV pages to the two A4 PDFs in assets/cv/.
//
//   python3 tools/build-cv.py
//   NODE_PATH=/opt/node-tools/node_modules node tools/build-cv-pdf.js
//
// Uses the dev server at http://127.0.0.1:8787 when one answers; otherwise
// starts `python3 -m http.server` on its own port for the run. Fails if a
// PDF has more than one page or weighs more than 120 KB.

const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEV_SERVER = 'http://127.0.0.1:8787';
const OWN_PORT = 8797;
const MAX_BYTES = 120 * 1024;
const PAGES = [
  { url: '/cv/', out: 'assets/cv/Anton-Smedberg-CV.pdf' },
  { url: '/sv/cv/', out: 'assets/cv/Anton-Smedberg-CV-SV.pdf' },
];

const probe = (base) =>
  new Promise((resolve) => {
    const req = http.get(`${base}/cv/`, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function server() {
  if (await probe(DEV_SERVER)) return { base: DEV_SERVER, stop() {} };
  const base = `http://127.0.0.1:${OWN_PORT}`;
  const child = spawn('python3', ['-m', 'http.server', String(OWN_PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await probe(base)) return { base, stop: () => child.kill() };
    await sleep(100);
  }
  child.kill();
  throw new Error(`could not start a server on ${base}`);
}

(async () => {
  const srv = await server();
  const browser = await chromium.launch();
  const failures = [];
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: 'print' });
    for (const { url, out } of PAGES) {
      const file = path.join(ROOT, out);
      await page.goto(srv.base + url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({ path: file, format: 'A4', preferCSSPageSize: true, printBackground: false, tagged: true });
      const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
      const pages = Number((/^Pages:\s+(\d+)/m.exec(info) || [])[1]);
      const bytes = fs.statSync(file).size;
      console.log(`${out}: ${pages} page(s), ${(bytes / 1024).toFixed(1)} KB`);
      if (pages !== 1) failures.push(`${out} has ${pages} pages; the CV must fit one A4 page`);
      if (bytes > MAX_BYTES) failures.push(`${out} is ${bytes} bytes; the limit is ${MAX_BYTES}`);
    }
  } finally {
    await browser.close();
    srv.stop();
  }
  if (failures.length) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

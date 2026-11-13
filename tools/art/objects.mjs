// The ring of cubes on MetalVisualKit's tile, made the way the mascot was made in cubes: a list of parts (boxes of
// cells around an anchor), meshed by cube.mjs's buildMesh, rounded by its smooth and lit by its shaders, with only
// the palette swapped for its colours. objects.html draws it; build-objects.py turns the drawing into the file the page
// loads.

import { FINE_FS, FINE_VS, ROWS, SHADOW_FS, SHADOW_VS, buildMesh, program, smooth } from './cube.mjs';

const FINE = [0.5, 0.5, 0.5];
const TILT = 0.26; // Bit's camera: the sine of its downward pitch.
const TURN = 68; // Bit's heading for the ring: turned 22 degrees from facing the viewer, so a side shows.
const VOXEL = 9; // Sprite pixels per voxel at 216 px: about Bit's own voxel at the size the page shows it.
const SIZE = 216;
const FOOT = 196; // The sprite row it stands on.
const OVER = 4; // Drawn this many times larger, then scaled down, for clean edges.

// Its colours as Bit's palette has his: plain colours with their gloss, then the ones that light themselves.
const COLOURS = [
  ['silver', [0.78, 0.83, 0.9], 0.6],
  ['white', [0.95, 0.96, 0.98], 0.45],
  ['cube', [0.24, 0.5, 1], 0.6],
  ['ice', [0.55, 0.72, 1], 0.6],
  ['spark', [0.9, 0.95, 1], 0],
];
const LIT = COLOURS.findIndex((c) => c[2] === 0);
const C = Object.fromEntries(COLOURS.map((c, i) => [c[0], i]));

// Row-major rotations in degrees, as smed3d.js has them: about x (sideways lean), y (lean back) and z (turn).
const rot = (deg, i, j) => {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  const m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  m[i * 4] = c; m[j * 4] = c; m[i * 3 + j] = -s; m[j * 3 + i] = s;
  return m;
};
const rx = (d) => rot(d, 1, 2);
const ry = (d) => rot(d, 2, 0);
const rz = (d) => rot(d, 0, 1);
const mul = (a, b) => a.map((_, k) => [0, 1, 2].reduce((sum, j) => sum + a[k - (k % 3) + j] * b[j * 3 + (k % 3)], 0));

// A part: boxes [x0, y0, z0, x1, y1, z1, colour, r] of cells around anchor `a` (in voxels, x toward the viewer,
// y to its left, z up), half-voxel cells unless `s` says otherwise, turned by `R`. As in Bit, part 2 is where its
// own light comes from: his glass lights his arms, the ring's lit cube lights the cubes near it.
const part = (bone, a, boxes, { s = FINE, o = [0, 0, 0], R = rz(0), core = false, bevel } = {}) => ({ bone, a, o, boxes, s, R, core, bevel });

// MetalVisualKit, GPU particles: a bold ring of a dozen cubes in the icon's blues and white, each turned its own
// way, a few of them lit, standing in a pale cradle that reads on the night water as on the day sky.
function metalvisualkit() {
  const n = 12;
  const r = 6.1;
  const mid = 8.9;
  const cubes = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2 + 0.26;
    const h = Math.sin(k * 12.9898) * 43758.5453;
    const jit = h - Math.floor(h);
    const colour = k % 6 === 1 ? C.spark : k % 6 === 4 ? C.white : k % 2 ? C.ice : C.cube;
    const at = [(jit - 0.5) * 0.8, Math.cos(a) * r, mid + Math.sin(a) * r];
    const size = 0.84 + 0.14 * jit;
    return part('cube', at, [[-1, -1, -1, 1, 1, 1, colour]], { s: [size, size, size], R: mul(mul(rz(jit * 90), rx(k * 37)), ry(k * 23)), bevel: 0.16 });
  });
  const lamp = cubes.splice(cubes.findIndex((p) => p.boxes[0][6] === C.spark), 1)[0];
  return {
    glow: [0.3, 0.45, 1],
    shadow: [[0, 0, 4, 0.4]],
    parts: [part('base', [0, 0, 0], [[-4, -5, 0, 4, 5, 3, C.silver, 3]], { core: true }), cubes.shift(), lamp, ...cubes],
  };
}

export const OBJECTS = { metalvisualkit };

// The palette and gloss swapped into Bit's shaders; colours from LIT on light themselves.
function shaders() {
  const vec = (c) => `vec3(${c.map((v) => v.toFixed(3)).join(',')})`;
  const swap = (src, re, to) => {
    if (!re.test(src)) throw new Error(`Bit's shader has changed: ${re}`);
    return src.replace(re, to);
  };
  let vs = swap(FINE_VS, /const vec3 PAL\[\d+\]=vec3\[\d+\]\([^;]*\);/, `const vec3 PAL[${COLOURS.length}]=vec3[${COLOURS.length}](${COLOURS.map((c) => vec(c[1])).join(',')});`);
  vs = swap(vs, /const float GLOSS\[\d+\]=float\[\d+\]\([^;]*\);/, `const float GLOSS[${COLOURS.length}]=float[${COLOURS.length}](${COLOURS.map((c) => c[2].toFixed(2)).join(',')});`);
  vs = swap(vs, /vK=c==\d+\?2\.:c>=\d+\?1\.:0\.;/, `vK=c>=${LIT}?1.:0.;`);
  return [vs, FINE_FS];
}

// The light Bit stands in on Home at noon, as the city gives it to him, with the sun pulled round to light the
// front as smed3d.js pulls it. (A set in his night light read no better on the night scene, and the ring of dark
// blue cubes read worse, so one set serves both.)
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const LIGHT = { sun: unit([-0.798 * 0.5, 0.35, 0.6]), key: [0.998, 0.93, 0.831], sky: [0.556, 0.756, 0.925], ambient: [0.418, 0.521, 0.671] };

// The rows smed3d.js gives a part: its turn and scale, then the toy's turn toward the viewer, then its anchor.
function rows(parts) {
  const cs = Math.cos((TURN * Math.PI) / 180);
  const sn = Math.sin((TURN * Math.PI) / 180);
  // The shaders hold ROWS rows of parts; a toy has fewer.
  const out = new Float32Array(ROWS * 12);
  parts.forEach((p, pi) => {
    const m = p.R.map((v, k) => v * p.s[k % 3]);
    const r0 = [0, 1, 2].map((k) => cs * m[k] + sn * m[3 + k]);
    const r1 = [0, 1, 2].map((k) => m[6 + k]);
    const r2 = [0, 1, 2].map((k) => sn * m[k] - cs * m[3 + k]);
    const w = [cs * p.a[0] + sn * p.a[1], p.a[2], sn * p.a[0] - cs * p.a[1]];
    [r0, r1, r2].forEach((r, i) => out.set([...r, w[i]], pi * 12 + i * 4));
  });
  return out;
}

// Draws one toy into `canvas` (SIZE * OVER square), standing on FOOT and centred, and returns where its solid
// pixels reach, in sprite pixels.
export async function draw(canvas, name) {
  const toy = OBJECTS[name]();
  const n = SIZE * OVER;
  Object.assign(canvas, { width: n, height: n });
  const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  const [vs, fs] = shaders();
  const figure = await program(gl, vs, fs);
  const shadow = await program(gl, SHADOW_VS, SHADOW_FS);
  const mesh = await buildMesh(toy.parts);
  const smoothed = await smooth(mesh, toy.parts);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
  [[3, 0], [2, 3], [4, 5], [4, 9], [1, 13]].forEach(([size, offset], i) => {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.BYTE, false, 16, offset);
  });
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, smoothed, gl.STATIC_DRAW);
  [5, 6].forEach((at, i) => {
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 3, gl.BYTE, i === 1, 8, i * 3);
  });
  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const R = rows(toy.parts);
  const scale = VOXEL * OVER;

  const paint = (dx, dy, withShadow) => {
    const view = [scale, n / 2 + dx, (SIZE - FOOT) * OVER + dy, TILT];
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (withShadow) {
      gl.useProgram(shadow.p);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      const blobs = new Float32Array(16);
      toy.shadow.forEach((b, i) => blobs.set(b, i * 4));
      gl.uniform4fv(shadow.u.uS, blobs);
      gl.uniform4fv(shadow.u.uView, view);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    gl.useProgram(figure.p);
    const u = figure.u;
    gl.uniform4fv(u.uB, R);
    gl.uniform4fv(u.uView, view);
    gl.uniform2f(u.uRes, n, n);
    gl.uniform1f(u.uOn, 1);
    gl.uniform3fv(u.uSun, LIGHT.sun);
    gl.uniform3fv(u.uKey, LIGHT.key);
    gl.uniform3fv(u.uAmb, LIGHT.ambient);
    gl.uniform3fv(u.uSky, LIGHT.sky);
    // As Bit's screen by day: a little of its light on what is near it, and the lit colours at full strength.
    gl.uniform4f(u.uGlow, ...toy.glow.map((v) => v * 0.3), 0.75);
    gl.uniform4f(u.uNew, 1, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 16);
  };

  // Where the figure's solid pixels reach, measured with no shadow under it.
  const reach = () => {
    const px = new Uint8Array(n * n * 4);
    gl.readPixels(0, 0, n, n, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let [x0, x1, y0, y1] = [n, -1, n, -1];
    for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
      if (px[(y * n + x) * 4 + 3] < 128) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { left: x0, right: x1 + 1, bottom: y0, top: y1 + 1 };
  };
  paint(0, 0, false);
  const r = reach();
  const dx = n / 2 - (r.left + r.right) / 2;
  const dy = (SIZE - FOOT) * OVER - r.bottom;
  paint(dx, dy, false);
  const fit = reach();
  paint(dx, dy, true);
  return { name, left: fit.left / OVER, right: fit.right / OVER, top: SIZE - fit.top / OVER, foot: SIZE - fit.bottom / OVER };
}

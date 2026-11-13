// The mascot: a small lamplighter in a yellow oilskin and sou'wester who rows a wooden eka, much too small for him,
// on the water of Home, his lantern on a pole at the bow. Each part is a smooth shape on a joint tree, meshed once
// and drawn as pixel art; smed3d-fine.js adds finer light, his reflection and the ripples round him.

const { PI, abs, asin, atan2, ceil, cos, exp, floor, hypot, max, min, round, sin, sqrt } = Math;
const VOX = 2.2; // CSS pixels per voxel; his head and hat are 13 voxels, the boat 48 long.
const VIEW_W = 150;
const VIEW_H = 112;
const GROUND = 32; // CSS pixels of view under the waterline, for the oars and the rings on the water.
const BOX_W = 124;
const BOX_H = 56; // His box, which takes taps, stands on the waterline.
const REACH = 60; // CSS pixels the boat and its lantern reach to each side of its middle.
const TILT = 0.36; // Sine of the camera's downward pitch.
const ART = 4 / 3; // CSS pixels per art pixel, about: each is a whole number of device pixels, 4 at DPR 3.
const FPS = 15; // Poses drawn a second, like a sprite's frames.
const HIP = 4.8; // His hips' height on legs; in the boat they rest on the thwart, SEAT over the water.
const SEAT = 2.4; // The thwart's top, SEATX along the boat: a little aft of its middle.
const SEATX = -6;
const NECK = 9; // Where his chest turns on his hips.
const LOCK = [-8.6, 5.9, 6]; // The left oarlock; the right is its mirror.
const OAR = 11; // From the lock to the middle of the blade.
const STROKE = 0.9; // Strokes a second.
const DRIVE = 0.42; // The share of a stroke the blades are in the water.
const THRUST = 220; // CSS px/s² at the height of a push.
const DRAG = 1.3; // The water's hold on the boat, per second.
const DOTS = 10; // Splash and drip pixels.
const RAD = PI / 180;

/* ------------------------------------------------------------------- Model */

// Colour ramps, dark to light, darks toward red-violet and lights toward warm yellow: oilskin (never green or grey),
// navy, cream, skin, tomato rubber, chestnut hair, iron, brass, glass, lit glass.
const RAMPS = [
  [[0.42, 0.18, 0.12], [0.78, 0.38, 0.1], [0.96, 0.64, 0.12], [1, 0.83, 0.22], [1, 0.96, 0.62]],
  [[0.07, 0.07, 0.17], [0.12, 0.14, 0.32], [0.2, 0.25, 0.52], [0.33, 0.42, 0.7], [0.55, 0.66, 0.88]],
  [[0.5, 0.4, 0.4], [0.78, 0.68, 0.6], [0.95, 0.89, 0.79], [1, 0.97, 0.9], [1, 1, 0.97]],
  [[0.55, 0.27, 0.25], [0.85, 0.5, 0.44], [0.99, 0.73, 0.6], [1, 0.86, 0.74], [1, 0.95, 0.88]],
  [[0.3, 0.06, 0.12], [0.58, 0.1, 0.17], [0.86, 0.22, 0.18], [0.98, 0.42, 0.28], [1, 0.74, 0.6]],
  [[0.2, 0.08, 0.09], [0.38, 0.17, 0.12], [0.6, 0.33, 0.18], [0.78, 0.5, 0.27], [0.9, 0.68, 0.42]],
  [[0.06, 0.06, 0.12], [0.16, 0.16, 0.24], [0.3, 0.3, 0.4], [0.5, 0.52, 0.6], [0.75, 0.78, 0.84]],
  [[0.36, 0.18, 0.08], [0.64, 0.38, 0.12], [0.92, 0.68, 0.26], [1, 0.88, 0.5], [1, 0.98, 0.8]],
  [[0.45, 0.36, 0.3], [0.66, 0.55, 0.45], [0.84, 0.74, 0.6], [0.95, 0.88, 0.74], [1, 0.98, 0.9]],
  [[1, 0.55, 0.18], [1, 0.72, 0.3], [1, 0.86, 0.5], [1, 0.96, 0.75], [1, 1, 0.92]],
];
// Materials: a ramp, a step it is shifted by, and whether it takes a highlight. FS paints some of them.
const MATS = [[0, 0, 1], [0, -1, 0], [3, 0, 0], [4, 0, 1], [1, 0, 1], [5, 0, 0], [6, 0, 1], [7, 1, 1], [8, 0, 1], [3, 0, 0], [0, 0, 1], [0, 0, 1], [1, 0, 0], [5, 1, 0], [5, 1, 0], [6, 2, 1], [2, 2, 0]];
const [OIL, SEAM, SKIN, RED, NAVY, HAIR, IRON, BRASS, GLASS, FACE, COAT, CROWN, COLLAR, HULL, WOOD, FISH, SPRAY] = MATS.keys();
const GLOW = [1, 0.64, 0.28]; // His lantern's light.

// Joints at rest in voxels: x forward, y to his left, z up, 0 at the waterline under his middle; his own as if he
// stood on the water, the rig sits him down in the boat.
const PIVOT = { boat: [0, 0, 0], pelvis: [0, 0, 5.6], body: [0, 0, NECK], pole: [22.4, 0, 8.4], lantern: [26.2, 0, 15.1], fish: [0, 0, 0] };
const HEAD = [0.3, 0, 16.65, 5.25, 5.9, 5.3]; // Centre and radii: a little wider than tall.

// A part: a smooth piece of distance d and a material, meshed from lo to hi on a grid of h voxels round anchor a.
const PARTS = [];
const piece = (bone, a, lo, hi, d, mat, h) => PARTS.push({ bone, a, s: [1, 1, 1], net: { lo, hi, d, mat, h } });
const ell = (p, c, r) => {
  const q = [0, 1, 2].map((i) => (p[i] - c[i]) / r[i]);
  const k = hypot(...q);
  return k < 1e-6 ? -min(...r) : ((k - 1) * k) / hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
};
const smin = (a, b, k) => { const h = max(0, min(1, 0.5 + (0.5 * (b - a)) / k)); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
const cap = (p, a, b, r) => {
  const ab = [0, 1, 2].map((i) => b[i] - a[i]);
  const t = max(0, min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t) - r;
};
// A rounded ring round the z axis through c (radius R, section 2w by 2t), and a tube from z0 to z1.
const ring = (p, c, R, w, t, r) => {
  const q = [abs(hypot(p[0] - c[0], p[1] - c[1]) - R) - w + r, abs(p[2] - c[2]) - t + r];
  return hypot(max(q[0], 0), max(q[1], 0)) + min(max(q[0], q[1]), 0) - r;
};
const tube = (p, c, R, z0, z1, r) => {
  const q = [hypot(p[0] - c[0], p[1] - c[1]) - R + r, max(z0 - p[2], p[2] - z1) + r];
  return hypot(max(q[0], 0), max(q[1], 0)) + min(max(q[0], q[1]), 0) - r;
};
const side = (f, s) => (p) => f([p[0], s * p[1], p[2]]);
const H = HEAD;
const head = (p) => ell(p, H, H.slice(3));

// The coat: a small bell, its hem flaring a little, and a stand-up collar.
const BELL = [5, 11.3]; // Hem and shoulder heights.
const bellR = (z) => {
  const u = max(0, min(1, (BELL[1] - z) / (BELL[1] - BELL[0])));
  return 3.05 + 1.3 * u ** 1.5 + 0.28 * max(0, min(1, (z - BELL[0] - 1.3) / -1.3)) ** 2;
};
const coat = (p) => smax(smax((hypot(p[0] * 1.12, p[1]) - bellR(p[2])) * 0.9, BELL[0] - p[2], 0.5), p[2] - BELL[1] - 0.6, 1.4);
piece('pelvis', [0, 0, 0], [-5.4, -5.4, BELL[0] - 0.4], [5.4, 5.4, BELL[1] + 1.8], coat, COAT, 0.65);
piece('body', [0, 0, 12.2], [-3.6, -3.6, 10.8], [3.6, 3.6, 13.6], (p) => ring(p, [0.1, 0, 12.2], 2.6, 0.45, 0.78, 0.36), COLLAR, 0.44);

// The head, its face painted on, and rounded chestnut tufts under the brim: a fringe, over each ear and behind.
piece('body', H.slice(0, 3), [H[0] - 5.5, -6.1, H[2] - 5.5], [H[0] + 5.5, 6.1, H[2] + 5.5], head, FACE, 0.65);
const hair = (p) => {
  let d = 9;
  for (const y of [-2.5, 0, 2.5]) d = smin(d, ell(p, [H[0] + 3.85, y, 19.7], [1.25, 1.75, 1]), 1.1);
  for (const s of [-1, 1]) d = smin(d, ell(p, [H[0] + 0.9, s * 5.3, 17.9], [1.65, 1, 1.55]), 1.2);
  return smin(d, smax(ell(p, [H[0] - 1.3, 0, 17], [4.9, 5.85, 5]), p[0] - H[0] - 0.4, 0.9), 1.3);
};
piece('body', [H[0], 0, 18], [H[0] - 6.4, -6.6, H[2] - 4.6], [H[0] + 5.4, 6.6, H[2] + 6], hair, HAIR, 0.65);

// The sou'wester: a soft crown; a short front brim turned up like a gutter, its darker lining toward us, so the
// face keeps the light; a back brim twice as deep that droops.
const DOME = [H[0] - 0.5, 0, 21.5, 4.7, 5.15, 3.0];
piece('body', DOME.slice(0, 3), [DOME[0] - 5, -5.4, 19.2], [DOME[0] + 5, 5.4, 24.7], (p) => smax(ell(p, DOME, DOME.slice(3)), 19.6 - p[2], 0.6), CROWN, 0.6);
const brim = (p) => {
  const x = p[0] - (H[0] - 0.4);
  const r = hypot(x, p[1]) || 1;
  const fwd = x / r;
  const out = max(0, r - 4.7);
  const z = 19.85 + 0.95 * max(0, fwd) ** 1.5 * out - 0.85 * max(0, -fwd) * out - 0.3 * (1 - abs(fwd)) * out;
  return smax(smax(abs(p[2] - z) - 0.36, r - 6.25 - 1.6 * (1 - max(0, fwd)) + 0.1 * max(0, fwd), 0.25), 4.3 - r, 0.3);
};
// How far a point is from where the lining starts (the brim's front, past a cone round his middle).
const lining = (p) => 0.45 * hypot(p[0] - H[0] + 0.4, p[1]) - (p[0] - H[0] + 0.4);
piece('body', [H[0] - 0.4, 0, 19.7], [H[0] - 8.6, -8, 16], [H[0] + 5.6, 8, 21.2], (p) => smax(brim(p), -lining(p), 0.05), OIL, 0.55);
piece('body', [H[0] + 5.6, 0, 20.8], [H[0] + 1, -7, 19], [H[0] + 7.1, 7, 22.8], (p) => smax(brim(p), lining(p), 0.05), SEAM, 0.49);

// Sleeves of their own with a shaded cuff, and round tomato mittens with a thumb.
const SHOULDER = [0.15, 2.95, 10.85];
const CUFF = [0.2, 3.25, 8.7];
const HAND = [0.3, 3.35, 7.5];
for (const [i, s] of [[1, 1], [0, -1]]) {
  PIVOT[`arm${i}`] = [SHOULDER[0], s * SHOULDER[1], SHOULDER[2]];
  PIVOT[`fore${i}`] = [CUFF[0], s * CUFF[1], CUFF[2]];
  piece(`arm${i}`, [SHOULDER[0], s * SHOULDER[1], SHOULDER[2]], [-1.4, s * 3.1 - 1.4, 7.6], [1.4, s * 3.1 + 1.4, 12.1], side((p) => cap(p, SHOULDER, CUFF, 1.08), s), OIL, 0.49);
  piece(`fore${i}`, [CUFF[0], s * CUFF[1], CUFF[2]], [-1.5, s * 3.3 - 1.5, 7], [1.5, s * 3.3 + 1.5, 9.9], side((p) => smin(cap(p, CUFF, [0.25, 3.3, 8.4], 1), ring(p, [0.25, 3.3, 8.25], 0.55, 0.62, 0.22, 0.2), 0.3), s), NAVY, 0.42);
  piece(`fore${i}`, [CUFF[0], s * CUFF[1], CUFF[2]], [-1.2, s * 3.35 - 1.5, 6.2], [1.7, s * 3.35 + 1.5, 8.8], side((p) => smin(ell(p, HAND, [0.98, 0.95, 1.05]), ell(p, [1.05, 2.85, 7.7], [0.42, 0.42, 0.5]), 0.25), s), RED, 0.39);
}

// The storm lantern: an iron base and three guard rods round pale glass that is lit after dark, a brass cap and a
// ring. Its glass gives his light.
const L = PIVOT.lantern;
const [lx, ly, lz] = L;
const LC = [lx, ly, lz - 4.8];
piece('lantern', LC, [lx - 1.5, ly - 1.5, lz - 6.5], [lx + 1.5, ly + 1.5, lz - 3], (p) => tube(p, L, 1.3, lz - 6.35, lz - 3.2, 0.45), GLASS, 0.36);
PARTS.at(-1).light = true;
piece('lantern', L, [lx - 1.9, ly - 1.9, lz - 7.3], [lx + 1.9, ly + 1.9, lz - 5.9], (p) => tube(p, L, 1.7, lz - 7.1, lz - 6.15, 0.2), IRON, 0.31);
for (let a = PI / 4; a < 7; a += PI / 2) {
  const c = [lx + 1.42 * cos(a), ly + 1.42 * sin(a)];
  piece('lantern', L, [c[0] - 0.4, c[1] - 0.4, lz - 6.5], [c[0] + 0.4, c[1] + 0.4, lz - 3.1], (p) => cap(p, [c[0], c[1], lz - 6.3], [c[0], c[1], lz - 3.3], 0.17), IRON, 0.19);
}
piece('lantern', L, [lx - 1.85, ly - 1.85, lz - 4], [lx + 1.85, ly + 1.85, lz - 1.8], (p) => smin(tube(p, L, 1.6, lz - 3.4, lz - 2.95, 0.15), ell(p, [lx, ly, lz - 2.95], [1.2, 1.2, 0.9]), 0.3), BRASS, 0.29);
piece('lantern', L, [lx - 1, ly - 0.35, lz - 2.3], [lx + 1, ly + 0.35, lz - 0.1], (p) => max(abs(hypot(p[0] - lx, p[2] - lz + 1.2) - 0.72) - 0.15, abs(p[1] - ly) - 0.15), BRASS, 0.17);

// The eka, the stage he rows on: about twice as long as he is wide at the shoulders, a curved sheer that rises to
// the bow, a flat transom, a half-round section deepening to its keel and one plank thick; inside it darker wood.
// A thwart a little aft of the middle, tholes for the oars, and a pole curving up from the stem for the lantern.
// Its hull is the boat's first part: fine.js finds it so.
const beam = (x) => (x > -4 ? 6 * sqrt(max(0, 1 - ((x + 4) / 28) ** 2)) : 6 - 2 * ((x + 4) / 20) ** 2);
const sheer = (x) => 5.6 + 0.0045 * (x + 4) ** 2;
const hull = (p) => {
  const S = sheer(p[0]);
  const B = max(beam(p[0]), 0.05);
  const D = S + 1.2 - 2.5 * max(0, (p[0] - 8) / 16) ** 2;
  const o = max((hypot(p[1] / B, (S - p[2]) / D) - 1) * min(B, D) * 0.6, p[2] - S, -p[0] - 24);
  return max(o, -o - 0.5);
};
piece('boat', [0, 0, 0], [-24.6, -6.6, -1.8], [24.6, 6.6, 9.6], hull, HULL, 0.8);
piece('boat', [SEATX, 0, SEAT], [SEATX - 1.2, -6.2, SEAT - 0.8], [SEATX + 1.2, 6.2, SEAT + 0.8], (p) => cap(p, [SEATX, -5.2, SEAT - 0.4], [SEATX, 5.2, SEAT - 0.4], 0.5), WOOD, 0.5);
piece('boat', [LOCK[0], 0, LOCK[2]], [LOCK[0] - 0.6, -6.6, LOCK[2] - 0.8], [LOCK[0] + 0.6, 6.6, LOCK[2] + 1.3], (p) => cap([p[0], abs(p[1]), p[2]], [LOCK[0], LOCK[1], LOCK[2] - 0.5], [LOCK[0], LOCK[1], LOCK[2] + 0.9], 0.28), IRON, 0.3);
piece('pole', PIVOT.pole, [21.6, -0.7, 7.8], [27.3, 0.7, 16], (p) => min(cap(p, PIVOT.pole, [23.6, 0, 14], 0.32), cap(p, [23.6, 0, 14], [26.2, 0, 15.3], 0.3)), WOOD, 0.3);
// The oars, at rest straight out from their locks: a round loom and a flat blade.
for (const [i, s] of [[1, 1], [0, -1]]) {
  PIVOT[`oar${i}`] = [LOCK[0], s * LOCK[1], LOCK[2]];
  piece(`oar${i}`, PIVOT[`oar${i}`], [LOCK[0] - 1.4, s * 10 - 9.4, LOCK[2] - 0.6], [LOCK[0] + 1.4, s * 10 + 9.4, LOCK[2] + 0.6], side((p) => smin(cap(p, [LOCK[0], 1.2, LOCK[2]], [LOCK[0], LOCK[1] + OAR - 1.4, LOCK[2]], 0.3), ell(p, [LOCK[0], LOCK[1] + OAR, LOCK[2]], [0.95, 1.9, 0.16]), 0.3), s), WOOD, 0.3);
}
// A fish, for when one jumps.
piece('fish', [0, 0, 0], [-4.4, -1.4, -1.9], [3.6, 1.4, 1.9], (p) => smin(ell(p, [0.4, 0, 0], [2.7, 0.75, 1.2]), ell(p, [-2.9, 0, 0], [0.75, 0.2, 1.2]), 0.5), FISH, 0.32);
for (let k = 0; k < DOTS; k += 1) piece(`dot${k}`, [0, 0, 0], [-0.7, -0.7, -0.7], [0.7, 0.7, 0.7], (p) => hypot(...p) - 0.5, SPRAY, 0.4);

// A turn for the page: the scheduler's yield, else a message to self (no 4 ms timer floor).
const pause = () => globalThis.scheduler?.yield?.() ?? new Promise((done) => { const c = new MessageChannel(); c.port1.onmessage = () => done(c.port1.close()); c.port2.postMessage(0); });

// Surface nets: sample each piece's distance on its grid (along a column, a sample far from the surface vouches for
// the next few), put a vertex in each cell the surface crosses (the mean of its edge crossings, stepped onto the
// surface along the gradient) and join the four cells round each crossed edge in a quad turned outward. Normals are
// the gradient. A vertex: position from its anchor, normal, part, material. The page gets a turn every 7 ms.
const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
async function buildMesh(parts) {
  let slice = performance.now();
  const turn = async () => { if (performance.now() - slice > 7) { await pause(); slice = performance.now(); } };
  const verts = [];
  const index = [];
  const T = [[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]];
  for (const [pi, p] of parts.entries()) {
    const { d, mat, h } = p.net;
    const lo = p.net.lo.map((v) => v - h);
    const [nx, ny, nz] = [0, 1, 2].map((i) => ceil((p.net.hi[i] - lo[i]) / h) + 2);
    const f = new Float32Array(nx * ny * nz);
    const q = [0, 0, 0];
    for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) {
      await turn();
      q[0] = lo[0] + i * h;
      q[1] = lo[1] + j * h;
      for (let k = 0, at = (i * ny + j) * nz; k < nz;) {
        q[2] = lo[2] + k * h;
        const v = d(q);
        f[at + k] = v;
        k += 1;
        for (let skip = floor((abs(v) * 0.6) / h) - 1; skip > 0 && k < nz; skip -= 1) f[at + k++] = v;
      }
    }
    // Cell corners c are bits (x, y, z); EDGES lists the twelve corner pairs.
    const corner = (c) => (c & 1) * ny * nz + ((c >> 1) & 1) * nz + ((c >> 2) & 1);
    const cell = new Int32Array(nx * ny * nz).fill(-1);
    for (let i = 0; i < nx - 1; i += 1) for (let j = 0; j < ny - 1; j += 1) {
      await turn();
      for (let k = 0; k < nz - 1; k += 1) {
        const at = (i * ny + j) * nz + k;
        let mask = 0;
        for (let c = 0; c < 8; c += 1) if (f[at + corner(c)] < 0) mask |= 1 << c;
        if (mask === 0 || mask === 255) continue;
        const v = [0, 0, 0];
        let e = 0;
        for (let x = 0; x < 24; x += 2) {
          const [a, b] = [EDGES[x], EDGES[x + 1]];
          if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
          const t = f[at + corner(a)] / (f[at + corner(a)] - f[at + corner(b)]);
          v[0] += lo[0] + (i + (a & 1) + ((b & 1) - (a & 1)) * t) * h;
          v[1] += lo[1] + (j + ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t) * h;
          v[2] += lo[2] + (k + ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t) * h;
          e += 1;
        }
        for (let b = 0; b < 3; b += 1) v[b] /= e;
        const g = [0, 0, 0];
        for (const s of T) {
          const w = d([v[0] + s[0] * h * 0.5, v[1] + s[1] * h * 0.5, v[2] + s[2] * h * 0.5]);
          for (let b = 0; b < 3; b += 1) g[b] += s[b] * w;
        }
        const l = hypot(...g) || 1;
        const step = max(-h, min(h, (d(v) * 2 * h) / l)) / l;
        cell[at] = verts.length / 8;
        verts.push(v[0] - step * g[0] - p.a[0], v[1] - step * g[1] - p.a[1], v[2] - step * g[2] - p.a[2], g[0] / l, g[1] / l, g[2] / l, pi, mat);
      }
    }
    // A quad round each crossed grid edge: the four cells sharing it, back along the other two axes.
    const stride = [ny * nz, nz, 1];
    const size = [nx, ny, nz];
    for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) {
      await turn();
      for (let k = 0; k < nz; k += 1) {
        const at = (i * ny + j) * nz + k;
        const g = [i, j, k];
        const v0 = f[at];
        for (let a = 0; a < 3; a += 1) {
          const [u, w] = [(a + 1) % 3, (a + 2) % 3];
          if (g[a] > size[a] - 2 || g[u] < 1 || g[w] < 1 || g[u] > size[u] - 2 || g[w] > size[w] - 2) continue;
          if (v0 < 0 === f[at + stride[a]] < 0) continue;
          const su = stride[u];
          const sw = stride[w];
          const quad = [cell[at - su - sw], cell[at - sw], cell[at], cell[at - su]];
          if (v0 >= 0) quad.reverse();
          index.push(quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]);
        }
      }
    }
  }
  return { v: new Float32Array(verts), i: new (verts.length / 8 > 65535 ? Uint32Array : Uint16Array)(index) };
}

/* ----------------------------------------------------------------- Shaders */

const LIGHT = PARTS.findIndex((p) => p.light) * 3; // The rows of the part his light comes from.
const vec = (c) => `vec3(${c.map((v) => v.toFixed(2))})`;

// Part 0, his middle, lands on a whole art pixel, so his pixels never crawl; uHull draws his outline (back faces).
const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aM;
uniform vec4 uB[${PARTS.length * 3}],uView,uNew; uniform vec2 uRes; uniform float uHull;
out vec3 vN,vP,vW; flat out int vM;
void main(){
  int b=int(aM.x)*3;
  vec4 p=vec4(aP,1.);
  vec3 w=vec3(dot(uB[b],p),dot(uB[b+1],p),dot(uB[b+2],p));
  vN=vec3(dot(uB[b].xyz,aN),dot(uB[b+1].xyz,aN),dot(uB[b+2].xyz,aN));
  vP=aP; vW=w; vM=int(aM.y+.5);
  float ca=sqrt(1.-uView.w*uView.w);
  vec2 s=vec2(uB[0].w,uB[1].w*ca-uB[2].w*uView.w)*uView.x+uView.yz;
  gl_Position=vec4((vec2(w.x,w.y*ca-w.z*uView.w)*uView.x+uView.yz+floor(s+.5)-s)*2./uRes-1.,-(w.y*uView.w+w.z*ca)*.02,1.);
  if(uHull>0.){ gl_Position.xy+=normalize(vec2(vN.x,vN.y*ca-vN.z*uView.w)+1e-5)*2./uRes; gl_Position.z+=.004; }
}`;

// Pixel light: a step of each material's ramp for the light reaching it, never a blend, then paint: his face under
// the brim's shadow (it stops above his eyes), his clothes' details, the hull's planks, stripe and rail. Nothing
// under the water is drawn. After dark, darks go navy; skin stays warm.
const FS = `#version 300 es
precision highp float;
in vec3 vN,vP,vW; flat in int vM;
uniform vec3 uSun; uniform vec4 uNew,uView,uFace,uFace2,uFace3; uniform float uHull;
out vec4 o;
const vec3 R[${RAMPS.length * 5}]=vec3[${RAMPS.length * 5}](${RAMPS.flat().map(vec)}), V=vec3(0.,.26,.966);
const int MR[${MATS.length}]=int[${MATS.length}](${MATS.map((m) => m[0])}), MO[${MATS.length}]=int[${MATS.length}](${MATS.map((m) => m[1])}), MG[${MATS.length}]=int[${MATS.length}](${MATS.map((m) => m[2])});
vec3 rc(int r,int i){ return R[r*5+clamp(i,0,4)]; }
float ell(vec2 p,vec2 c,vec2 r){ vec2 e=(p-c)/r; return (length(e)-1.)*min(r.x,r.y); }
// A step up or down (di), another ramp (dr) or a colour of its own (c, where c.a is 1); returns the eyes' glint.
float paint(int m,vec3 p,inout int di,inout int dr,inout vec4 c){
  if(m==${COAT}){
    if(p.x<0.) return 0.;
    vec2 q=p.yz;
    if(q.y<${BELL[0] + 0.45}) di=1;
    for(int s=0;s<2;s++){ vec2 k=vec2(s==0?-2.25:2.25,6.4); float f=ell(q,k,vec2(.95,.36)); if(f<0.) di=f>-.14&&q.y<k.y?-2:-1; }
    if(abs(q.x-1.09)<.12&&q.y>${BELL[0] + 0.3}) di=-2;
    for(int k=0;k<3;k++){ float d=length(q-vec2(.47,10.-float(k)*1.4)); if(d<.36){ dr=1; di=d<.16&&q.x<.47?1:-1; } }
    return 0.;
  }
  if(m==${CROWN}){ if(p.z>-.45&&p.z<.25){ dr=1; di=0; } else if(abs(p.y)<.22&&p.z>.2) di=1; return 0.; }
  if(m==${GLASS}){ if(uNew.y>.2&&length(vec2(p.y*1.7,p.z+.1))<.8) di=2; else if(abs(p.y)<.45&&p.z<-.9){ dr=6; di=-1; } return 0.; }
  if(m==${COLLAR}&&abs(p.z+.05)<.24){ dr=2; di=1; }
  // Inside the hull, darker wood; outside, varnished planks with three seams, a cream top strake, a red rail, and a
  // dark line where it meets the water.
  if(m==${HULL}){ float x=p.x+4., S=5.6+.0045*x*x, B=max(x>0.?6.*sqrt(max(0.,1.-x*x/784.)):6.-x*x/200.,.05), d=S-p.z;
    if(length(vec2(abs(p.y)/B,d/(S+1.2)))<.93&&p.x>-23.6) di=-1; else if(d<.6) dr=4; else if(d<1.7) dr=2; else if(abs(fract((d-1.7)/1.5+.5)-.5)<.12&&d<6.3) di=-1;
    if(p.z<.6) di=-2; }
  if(m==${FISH}){ if(p.z<-.15) di=1; if(length(p.xz-vec2(.85,.08))<.13) c=vec4(.1,.1,.16,1.); }
  if(m!=${FACE}) return 0.;
  vec3 n=normalize(p);
  if(n.x<-.1) return 0.;
  vec2 uv=n.yz/(1.+n.x), g=uFace3.xy;
  if(uv.y>.19) di=-1;
  for(int i=0;i<2;i++){ float s=i==0?-1.:1.;
    if(uFace2.w>.3&&ell(uv,vec2(s*.33,-.17),vec2(.085,.045))<0.) c=vec4(1.,.6,.6,1.); }
  float glint=0.;
  for(int i=0;i<2;i++){ float s=i==0?-1.:1.;
    float lid=i==0?uFace.x:uFace.y;
    vec2 ctr=vec2(s*.205,-.04)+g, r=vec2(.098,.142)*(1.+.14*uFace.w);
    if(lid>.22&&uFace.z<.5){
      vec2 rr=vec2(r.x,r.y*clamp(lid,.22,1.25)), cc=ctr-vec2(0.,r.y-rr.y);
      float d=max(ell(uv,cc,rr),uv.y-(cc.y+rr.y*(1.-.5*uFace3.z))-uFace3.z*.8*s*(cc.x-uv.x));
      if(d<0.){
        vec2 e=(uv-cc)/rr;
        c=vec4(e.y<-.45&&length(e+vec2(0.,.15))<.8?vec3(.42,.27,.3):vec3(.14,.09,.15),1.);
        glint=max(step(length(e-vec2(-.36,.4)),.36),step(length(e-vec2(.4,-.42)),.16));
      }
    } else {
      // Closed: an upward arc.
      float x=(uv.x-ctr.x)/r.x, y=ctr.y-r.y*.15+r.y*.42*(1.-x*x);
      if(abs(uv.y-y)<r.y*.17&&abs(x)<1.) c=vec4(.14,.09,.15,1.);
    }
  }
  // The mouth, between and just under the eyes: a dash, a small smile, open, or round.
  vec2 mo=vec2(0.,-.21)+g*.5;
  float x=(uv.x-mo.x)/(.055+.03*uFace2.x), y=mo.y+.07*uFace2.x*(x*x-1.);
  bool k=abs(uv.y-y)<.022&&abs(x)<1.&&uFace2.z<.5;
  if(uFace2.y>.05) k=k||(ell(uv,mo-vec2(0.,.025*uFace2.y),vec2(.055,.04*uFace2.y))<0.&&uv.y<mo.y+.01);
  if(uFace2.z>.05) k=k||ell(uv,mo-vec2(0.,.01),vec2(.035,.045)*uFace2.z)<0.;
  if(k) c=vec4(.55,.16,.18,1.);
  return glint;
}
// A step of the ramp for this much light (0 to 1), painted, lifted by highlight and glow, graded for the night.
vec3 colour(int m,vec3 p,float light,float shine,float glow,out float glint){
  int di=0, dr=-1;
  vec4 c=vec4(0.);
  glint=paint(m,p,di,dr,c);
  if(c.a>.5) return c.rgb;
  int r=dr<0?MR[m]:dr, i=light<.18?0:light<.45?1:light<.76?2:3;
  if(MG[m]==1&&shine>.6&&dr<0) i=4;
  bool skin=m==${SKIN}||m==${FACE};
  float night=uNew.y*(1.-step(.5,glow));
  if(night>.5&&!skin) i-=1;
  i+=MO[m]+di+int(glow*2.);
  if(skin) i=max(i,night>.5?2:1);
  if(m==${GLASS}&&uNew.y>.2){ r=${RAMPS.length - 1}; i=int(uNew.y*2.)+int(light)+di; }
  vec3 col=rc(r,i);
  if(night>.5&&!skin&&i<=1) col=mix(col,rc(1,i),.45);
  return col;
}
// The outline: the darkest steps of each material's ramp, navy after dark.
vec3 edge(float w){ return uNew.y>.5?rc(1,0):rc(MR[vM],w>.6?1:0); }
void main(){
  if(vW.y<0.) discard;
  vec3 n=normalize(vN);
  float w=clamp((dot(n,uSun)+.3)/1.3,0.,1.), glint;
  if(uHull>0.){ o=vec4(edge(w),1.); return; }
  vec3 col=colour(vM,vP,w*.85+.15*max(n.y,0.),pow(max(dot(n,normalize(uSun+V)),0.),40.),0.,glint);
  o=vec4(mix(col,vec3(1.),glint),1.);
}`;

// Asked early, a link's outcome holds the page.
async function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  const par = gl.getExtension('KHR_parallel_shader_compile');
  while (par && !gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR)) await new Promise(requestAnimationFrame);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const name = gl.getActiveUniform(p, i).name.replace('[0]', '');
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

/* --------------------------------------------------------------------- Math */

const clamp = (v, a, b) => min(b, max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Row-major 3x3 rotations, degrees.
const rot = (deg, i, j) => {
  const c = cos(deg * RAD);
  const s = sin(deg * RAD);
  const m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  m[i * 4] = c; m[j * 4] = c; m[i * 3 + j] = -s; m[j * 3 + i] = s;
  return m;
};
const rx = (d) => rot(d, 1, 2);
const ry = (d) => rot(d, 2, 0);
const rz = (d) => rot(d, 0, 1);
const mul = (a, ...rest) => rest.reduce((m, b) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) o[r * 3 + c] = m[r * 3] * b[c] + m[r * 3 + 1] * b[3 + c] + m[r * 3 + 2] * b[6 + c];
  return o;
}, a);
const tf = (m, o, x, y, z) => [o[0] + m[0] * x + m[1] * y + m[2] * z, o[1] + m[3] * x + m[4] * y + m[5] * z, o[2] + m[6] * x + m[7] * y + m[8] * z];
const ONE = [1, 1, 1];
const SAME = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// A seeded sequence in (0, 1) (Park and Miller).
const lcg = (seed) => () => (seed = (seed * 48271) % 2147483647) / 2147483647;

/* --------------------------------------------------------------------- Face */

// The face is numbers, not frames: an expression is goals for the eyes (look, how open, squint, worry), the mouth
// (a dash, a smile, open or round) and the cheeks; springs carry one into the next.
const FK = ['lx', 'ly', 'ol', 'or', 'sq', 'mw', 'mo', 'oo', 'blush', 'wo'];
const [LX, LY, OL, OR, SQ, MW, MO, OO, BLUSH, WO] = FK.map((_, i) => i);
const face = (o) => {
  const d = { ol: 1, or: 1, mw: 1, blush: 0.55, ...o };
  return Float32Array.from(FK, (k) => d[k] || 0);
};
const FACES = {
  smile: face({}),
  blank: face({ mw: 0.6, blush: 0.45 }),
  grin: face({ sq: 0.5, mw: 1.25, mo: 0.6, blush: 1 }),
  wink: face({ ol: 0.12, mw: 1.2, mo: 0.4, blush: 1 }),
  surprise: face({ ol: 1.25, or: 1.25, mw: 0, oo: 1, blush: 0.2 }),
  think: face({ lx: 1.2, ly: -1, ol: 0.85, or: 0.85, mw: 0.7, blush: 0.3 }),
  laugh: face({ sq: 0.85, mw: 1.35, mo: 1, blush: 1 }),
  sleepy: face({ ol: 0.35, or: 0.35, mw: 0.7, blush: 0.5 }),
  asleep: face({ ol: 0.06, or: 0.06, mw: 0.5, blush: 0.4 }),
  yawn: face({ ol: 0.08, or: 0.08, mw: 0, oo: 1.4, blush: 0.5 }),
  love: face({ sq: 0.7, mw: 1.2, mo: 0.4, blush: 1.4 }),
  dizzy: face({ ol: 0.6, or: 0.3, mw: 0.6, mo: 0.3, blush: 0.2, wo: 0.6 }),
  boot: face({ ol: 0.06, or: 0.06, mw: 0.4, blush: 0 }),
};

/* -------------------------------------------------------------------- Poses */

// Arm degrees in pairs (right, left): swing forward, raise sideways, reach inward, bend the elbow. Then his body:
// how far he sinks on the thwart, his chest's pitch, tilt and twist, the lantern pole's lift and the boat's roll.
const KEYS = ['swing', 'raise', 'inw', 'elbow'];
const SOLO = ['drop', 'bpitch', 'tilt', 'twist', 'pole', 'roll'];
const N = KEYS.length * 2 + SOLO.length;
const [SWING, RAISE, INW, ELBOW, DROP, BPITCH, BTILT, TWIST, POLE, ROLL] = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13];
const TURN = N; // After the pose: the boat's heading and his head's turn.

function pose(o) {
  const p = new Float32Array(N);
  const d = { swing: [26, 26], raise: [22, 22], inw: [10, 10], elbow: [74, 74], bpitch: -3, ...o };
  KEYS.forEach((k, i) => { p[i * 2] = d[k][0]; p[i * 2 + 1] = d[k][1]; });
  SOLO.forEach((k, i) => { p[KEYS.length * 2 + i] = d[k] || 0; });
  return p;
}

const P = {
  // Oars resting on the water, his hands on their handles in his lap.
  rest: pose({ swing: [40, 40], raise: [24, 24], elbow: [60, 60] }),
  // A stroke, pulled facing the stern: from the catch, leaning forward with his arms long, to the finish, leaning
  // back with the handles at his chest.
  catch: pose({ swing: [80, 80], raise: [16, 16], elbow: [12, 12], inw: [12, 12], bpitch: 18 }),
  finish: pose({ swing: [24, 24], raise: [36, 36], elbow: [118, 118], inw: [-4, -4], bpitch: -14 }),
  // He waves the near oar over his head (the rig lifts it). The other beats use his left arm, the near one while the
  // bow points right, mirrored when it points left.
  wave: pose({ bpitch: -8, swing: [96, 96], raise: [30, 30], elbow: [48, 48] }),
  // Down fast, the boat still rocking.
  plop: pose({ drop: 0.5, bpitch: 8, raise: [34, 34], elbow: [40, 44] }),
  // The lantern pole up, a hand at the brim to shade his eyes.
  look: pose({ bpitch: -8, twist: -16, pole: 42, swing: [50, 52], raise: [24, 64], elbow: [56, 104], inw: [0, -6] }),
  brim: pose({ bpitch: 14, tilt: 6, swing: [26, 52], raise: [22, 64], elbow: [74, 104], inw: [10, -6] }),
  startle: pose({ drop: -0.3, bpitch: -13, raise: [72, 64], elbow: [36, 30] }),
  yawn: pose({ bpitch: -15, swing: [26, 78], raise: [22, 20], elbow: [74, 128], inw: [10, 34] }),
  doze: pose({ drop: 0.3, bpitch: 15, tilt: 13 }),
};

// Beats: seconds, pose, face, degrees turned toward the viewer, spring rate, then when and into what pose and face
// the beat changes. The page's cues are mapped onto them.
const ACTS = {
  wave: [2.6, 'wave', 'grin', -18, 3.4, 1.7, 'plop', 'laugh'],
  look: [3.4, 'look', 'think', -18, 3, 2.6, 'rest', 'grin'],
  fish: [2.8, 'rest', 'smile', -18, 4, 0.95, 'startle', 'surprise'],
  brim: [2.4, 'brim', 'smile', -18, 3.4, 1.5, 'rest', 'wink'],
  yawn: [3, 'yawn', 'yawn', -18, 2.2, 1.8, 'doze', 'sleepy'],
  laugh: [2, 'rest', 'laugh', -18, 4],
};
const CUES = { dance: 'wave', think: 'look', surprise: 'fish', grin: 'laugh', wink: 'laugh', love: 'wave' };

// Rate and ring per channel: chest leads, arms and forearms trail with a soft overshoot.
const RATE = new Float32Array(N + 2).fill(1);
const DAMP = new Float32Array(N + 2).fill(0.82);
for (let i = SWING; i < DROP; i += 1) { RATE[i] = i < ELBOW ? 0.8 : 0.7; DAMP[i] = 0.6; }
for (const i of [BPITCH, BTILT, TWIST]) { RATE[i] = 1.05; DAMP[i] = 0.62; }
RATE[TURN] = 0.5;
RATE[TURN + 1] = 1.2;

/* -------------------------------------------------------------------- Mount */

export { FS, GLOW, KEYS, LIGHT, PARTS, SOLO, VS, pause, program };

const DAY = { sun: [0.45, 0.72, 0.52], sunColor: [1, 0.95, 0.85] };

export async function mountSmed3D(el, { light, seed = 7 } = {}) {
  // He is drawn in art pixels and scaled up whole, so the canvas is in art pixels, its edges on device pixels.
  const dpr = devicePixelRatio || 1;
  const art = ceil(dpr * ART - 0.01);
  const res = dpr / art;
  const W = ceil(VIEW_W * res);
  const H = ceil(VIEW_H * res);
  const G = round(GROUND * res);
  const left = round((BOX_W * dpr - W * art) / 2);
  const OX = (BOX_W * dpr / 2 - left) / art;
  // Sized first: a context's viewport is its canvas.
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const gl = canvas.getContext('webgl2', { powerPreference: 'low-power', antialias: false });
  if (!gl) return null;

  const mesh = await buildMesh(PARTS);
  await pause();
  let figure;
  let shadow; // The water round him, once fine.js is in.
  const build = async () => {
    figure = await program(gl, VS, FS);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, mesh.v, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.i, gl.STATIC_DRAW);
    [[3, 0], [3, 12], [2, 24]].forEach(([size, offset], i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, 32, offset);
    });
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  };
  try {
    await build();
  } catch {
    return null;
  }

  Object.assign(canvas.style, {
    position: 'absolute', left: `${left / dpr}px`, bottom: `${-G / res}px`,
    width: `${W / res}px`, height: `${H / res}px`, pointerEvents: 'none', imageRendering: 'pixelated',
  });
  Object.assign(el.style, { width: `${BOX_W}px`, height: `${BOX_H}px`, background: 'none' });
  el.append(canvas);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lines = JSON.parse(el.dataset.lines || '[]');
  const say = el.querySelector('.smed__say');
  const rng = lcg(seed);
  const rand = (a, b) => a + rng() * (b - a);

  let state = 'drift';
  let act = 'wave';
  let mood = 'smile';
  let st = 0; // Seconds in this state.
  let time = 0;
  let last = 0;
  let raf = 0;
  let visible = true;
  let x = 40;
  let v = 0; // His speed along the lane, CSS px/s.
  let dir = 1;
  let phase = 0; // The stroke: 0 the catch, DRIVE the finish.
  let surge = 0; // How hard the blades push now, 0 to 1.
  let blade = 0; // Where the blades are, over or under the water (voxels).
  let asleep = false;
  let lastInput = 0;
  let calm = 'smile'; // His resting face.
  let blink = 0;
  let twice = false;
  let lid = 1;
  let lung;
  let gaze = [0, 0];
  let nod; // His head's pitch toward his gaze, eased.
  let pointer = null;
  let sayTimer = 0;
  let taps = 0;
  let encore = null; // Asked of him while busy, done when he next drifts.
  let sun = DAY.sun;
  let night = 0;
  let squash;
  let squashV;
  let roll = 0;
  let pitch = 0;
  let cs;
  let sn;
  let run = null; // The crossing under way: where he is and how far into his stroke, every 1/60 s, and its animation.
  let bob = 0;

  const [cur, vel, goal, aim] = [0, 1, 2, 3].map(() => new Float32Array(N + 2));
  const out = new Float32Array(N);
  const row = new Float32Array(N);
  const [fc, fv, fg] = [0, 1, 2].map(() => new Float32Array(FK.length));
  const rows = new Float32Array(PARTS.length * 12);
  const trails = [{}, {}];
  const yaw = [0.3, 0.3]; // Each oar's sweep, held while his hands are off it.
  const dots = Array.from({ length: DOTS }, () => ({}));
  let nextDot = 0;

  // Layout is read only on a resize or as he comes into view, never in a frame: the lane's width and where his
  // box stands with no translate.
  let laneW = innerWidth;
  let home = [0, 0];
  const measure = (r = el.getBoundingClientRect()) => { laneW = el.offsetParent?.clientWidth || innerWidth; home = [r.left - x, r.top]; };
  // At rest his box stands on a whole device pixel, so the pixels stay crisp.
  const place = () => { el.style.translate = `${round(x * dpr) / dpr}px`; };
  // His box's offset along the lane, the boat and its lantern clear of the window's sides.
  const fit = (to) => {
    const lo = REACH - BOX_W / 2 + 12;
    return clamp(to, lo, max(lo, laneW - BOX_W / 2 - REACH - 12));
  };
  const set = (name) => { state = name; st = 0; };
  const perform = (name, text) => { act = name; set('act'); speak(text); };
  const rest = () => {
    const next = encore;
    encore = null;
    if (next) next();
    else set('drift');
  };
  function speak(text) {
    if (!say || !text) return;
    say.textContent = text;
    // On the lane's right half his words go on his left, so they stay on the screen.
    el.classList.toggle('is-right', x > (laneW - BOX_W) / 2);
    el.classList.add('is-saying');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => el.classList.remove('is-saying'), 1800);
  }
  const puff = (n, at, up) => {
    for (let k = 0; k < n; k += 1) {
      const d = dots[nextDot];
      nextDot = (nextDot + 1) % DOTS;
      d.p = [at[0] + rand(-0.6, 0.6), at[1], at[2] + rand(-0.6, 0.6)];
      d.v = [rand(-4, 4), up + rand(0, 6), rand(-3, 3)];
      d.life = rand(0.3, 0.5);
      d.size = rand(0.4, 0.7);
    }
  };
  // Rows across to the other half of the lane. The whole crossing is worked out at once, every 1/60 s: a turn first
  // if the bow points the other way, then strokes while the glide would fall short, each push a surge, then the
  // glide, never past the lane's end. His box rides it as one animation on the compositor, at the display's rate;
  // his poses inside follow it at FPS a second. When he is not crossing his box stands on a whole device pixel.
  const travel = (to) => {
    to = fit(to);
    if (abs(to - x) < 20) return;
    const d = to > x ? 1 : -1;
    const turn = d === dir ? 0 : 66;
    dir = d;
    const xs = [];
    const ph = [];
    let [px, pv, pp, more] = [x, 0, 0, true];
    for (let k = 0; k < 1800 && (k < turn || more || pp || pv > 4); k += 1) {
      if (k >= turn) {
        more = (to - px) * d > pv / DRAG + 3;
        if (more || pp) { pp += STROKE / 60; if (pp >= 1) pp = more ? pp - 1 : 0; }
        pv += (THRUST * (more && pp < DRIVE ? sin((PI * pp) / DRIVE) : 0) - DRAG * pv) / 60;
        px = d > 0 ? min(px + pv / 60, fit(1e4)) : max(px - pv / 60, fit(-1e4));
      }
      xs.push(px);
      ph.push(pp);
    }
    run?.a.cancel();
    const a = el.animate(xs.filter((_, k) => k % 2 === 0).map((v) => ({ translate: `${v}px` })), { duration: ((xs.length - 1) * 1000) / 60, fill: 'forwards' });
    run = { xs, ph, a };
    set('row');
  };
  const stroll = () => { const a = fit(-1e4); const b = fit(1e4); travel(x < (a + b) / 2 ? rand((a + b) / 2, b) : rand(a, (a + b) / 2)); };
  // fine.js steers him by `live` (idle and beats), `stroll`, `fish` (where a jumping fish is), `lamp` and `water`
  // (the rings it draws). Until it is in he drifts, breathes and blinks.
  const me = { el, out, rand, perform, stroll, puff, blinkAt: 0.35, lamp: 0, blades: [[0, 0, 0], [0, 0, 0]], hull: [0, 0, 0] };

  // Where each state wants body and face, and how stiff the springs are.
  function direct(dt) {
    let want = P.rest;
    let hz = 2.6;
    let look = -18; // Degrees the boat lies turned from side-on toward the viewer: its bow a little away.
    mood = calm;
    const quiet = time - lastInput;
    switch (state) {
      case 'drift':
        // Left alone long enough he nods off where he floats.
        if (quiet > (night > 0.6 ? 18 : 40)) asleep = true;
        want = asleep ? P.doze : P.rest; hz = asleep ? 1.4 : 2.6;
        mood = asleep ? 'asleep' : quiet > 20 ? 'sleepy' : calm;
        break;
      case 'row': {
        // Where the crossing's animation is now: his place and his stroke, read from what was worked out.
        const n = run.xs.length - 1;
        const k = min(n, floor(((run.a.currentTime || 0) * 60) / 1000));
        const was = phase;
        x = run.xs[k];
        v = k ? abs(x - run.xs[k - 1]) * 60 : 0;
        phase = run.ph[k];
        if (phase < was && phase) { puff(3, me.blades[0], 10); puff(3, me.blades[1], 10); }
        surge = phase < DRIVE ? sin((PI * phase) / DRIVE) : 0;
        // The push, from the catch to the finish, then the hands come back over the water.
        const e = phase < DRIVE ? ease(phase / DRIVE) : 1 - ease((phase - DRIVE) / (1 - DRIVE));
        for (let i = 0; i < N; i += 1) row[i] = mix(P.catch[i], P.finish[i], e);
        want = phase ? row : P.rest; hz = 5;
        if (k === n) {
          run.a.cancel();
          run = null;
          v = 0;
          place();
          rest();
        }
        break;
      }
      case 'act': {
        const a = ACTS[act];
        const late = st > (a[5] || 99);
        want = P[late ? a[6] : a[1]]; mood = late ? a[7] : a[2]; look = a[3]; hz = a[4];
        if (dir < 0) { for (let i = 0; i < N; i += 1) row[i] = (i === BTILT || i === TWIST ? -1 : 1) * want[i ^ (i < DROP ? 1 : 0)]; want = row; }
        if (late && st - dt <= a[5]) squashV += 2.4;
        if (st > a[0]) rest();
        break;
      }
    }
    if (state !== 'row') surge = 0;
    goal.set(want);
    // Drifting, the boat swings slowly about.
    goal[TURN] = 90 - dir * (90 - look) + (state === 'drift' ? 8 * sin(time * 0.21) : 0);
    return hz;
  }

  // Head and eyes: a recent pointer, else a glance, else the viewer.
  function watch() {
    const face = cur[TURN] + 90; // From the viewer to where his chest faces, the stern.
    // Rowing he mostly looks where his chest faces; at rest he turns to the viewer.
    let turn = clamp((face - 360 * round(face / 360)) * (state === 'row' ? 0.3 : 0.8), -50, 50);
    let pitch = 0;
    gaze = [0, 0];
    if (asleep) turn = 0;
    else if (pointer && time - pointer.at < 3) {
      const g = [(pointer.x - home[0] - x - BOX_W / 2) / 72, (home[1] + 20 - pointer.y) / 72, 1.4];
      const w = face + 90 - atan2(g[2], g[0]) / RAD;
      turn = clamp(w - 360 * round(w / 360), -58, 58);
      pitch = clamp((-asin(g[1] / len(g)) / RAD) * 0.5, -16, 14);
      gaze = [clamp(g[0] * 2.4, -2.6, 2.6), clamp(-g[1] * 2, -2, 1)];
    } else if (me.glance && time < me.glance.until && state === 'drift') {
      turn += me.glance.turn;
      pitch = me.glance.pitch;
      gaze = [...me.glance.gaze];
    }
    goal[TURN + 1] = clamp(turn, -58, 58);
    // His eyes get there first; his head follows.
    gaze[0] = clamp(gaze[0] + (goal[TURN + 1] - cur[TURN + 1]) * 0.07, -2.6, 2.6);
    return pitch;
  }

  function spring(hz, dt) {
    const w = 2 * PI * hz;
    // Long steps blow the stiff springs up.
    const n = max(2, ceil(dt * max(hz * 15, 60)));
    const h = dt / n;
    for (let k = 0; k < n; k += 1) {
      for (let i = 0; i < cur.length; i += 1) {
        const f = w * RATE[i];
        // Goals are eased toward: no move starts at full pull; a slower channel follows later.
        aim[i] += (goal[i] - aim[i]) * (1 - exp(-0.7 * f * h));
        vel[i] += (-f * f * (cur[i] - aim[i]) - 2 * DAMP[i] * f * vel[i]) * h;
        cur[i] += vel[i] * h;
      }
      for (let i = 0; i < fc.length; i += 1) {
        const q = i < 2 ? 40 : 24; // Eyes dart; the face eases between expressions.
        fv[i] += (-q * q * (fc[i] - fg[i]) - 1.6 * q * fv[i]) * h;
        fc[i] += fv[i] * h;
      }
    }
  }

  // A point trailing `to` on a soft spring; returns how far, nearing `max` but never jamming.
  const trail = (s, to, stiff, damp, max, dt) => {
    s.p = s.p || [...to];
    const n = ceil(dt * 120);
    for (let k = 0; k < n; k += 1) for (let a = 0; a < 3; a += 1) {
      s.v[a] += (-stiff * (s.p[a] - to[a]) - damp * s.v[a]) * (dt / n);
      s.p[a] = to[a] + max * Math.tanh((s.p[a] + s.v[a] * (dt / n) - to[a]) / max);
    }
    return sub(s.p, to);
  };

  // Kinematics in the boat's frame, turned to its heading: the boat on the swell, he on its thwart, each oar
  // turned in its lock toward his hand, the lantern hanging from its pole.
  function rig(c, headTurn, headPitch, breath, dt) {
    const B = {};
    const at = (b, name, q = PIVOT[name]) => { const p = PIVOT[b.name]; return tf(b.m, b.o, q[0] - p[0], q[1] - p[1], q[2] - p[2]); };
    const put = (name, m, o, s) => (B[name] = { name, m, o, s });
    const kid = (b, name, m) => put(name, mul(b.m, m), at(b, name));
    const wide = 1 / sqrt(squash);
    const world = (p) => [(cs * p[0] + sn * p[1]) * wide, p[2] * squash + bob, (sn * p[0] - cs * p[1]) * wide];
    const frame = (m) => [...[0, 1, 2].map((k) => (cs * m[k] + sn * m[3 + k]) * wide), ...[0, 1, 2].map((k) => m[6 + k] * squash), ...[0, 1, 2].map((k) => (sn * m[k] - cs * m[3 + k]) * wide)];
    const into = (m, v) => [0, 1, 2].map((a) => m[a] * v[0] + m[3 + a] * v[1] + m[6 + a] * v[2]);
    const far = (p) => [p[0] + x / VOX, p[1], p[2]];
    const own = frame(SAME);

    const boat = put('boat', mul(ry(pitch), rx(roll + c[ROLL])), [0, 0, 0]);
    // He sits on the thwart facing the stern, as one rows.
    const pel = put('pelvis', mul(boat.m, rz(180)), tf(boat.m, boat.o, SEATX, 0, SEAT + PIVOT.pelvis[2] - HIP - c[DROP]));
    // His big head trails the boat and rocks back when it stops.
    const lag = into(own, trail(trails[0], far(world(tf(pel.m, pel.o, 0, 0, 11))), 240, 10, 1.6, dt));
    const body = put('body', mul(pel.m, rz(headTurn + c[TWIST]), ry(c[BPITCH] + headPitch + lag[0] * 7), rx(c[BTILT] - lag[1] * 7)), at(pel, 'body'), [1, 1 + 0.02 * breath, 1 + 0.05 * breath]);
    const hands = [0, 1].map((i) => {
      const s = i ? 1 : -1;
      const arm = kid(body, `arm${i}`, mul(rz(-s * c[INW + i]), rx(s * (c[RAISE + i] - lag[1] * s * 9)), ry(-c[SWING + i] - lag[0] * 12)));
      return at(kid(arm, `fore${i}`, ry(-c[ELBOW + i])), `fore${i}`, [HAND[0], s * HAND[1], HAND[2]]);
    });
    // Facing the stern, his right hand holds the oar on the boat's left.
    for (let i = 0; i < 2; i += 1) {
      const s = i ? 1 : -1;
      const lock = at(boat, `oar${i}`);
      const h = into(boat.m, sub(hands[1 - i], lock));
      if (state !== 'act') yaw[i] = atan2(-h[0], -s * h[1]);
      // His arms are too short to show past his head, so he waves the near oar high instead, blade in the air.
      const flag = state === 'act' && act === 'wave' && st > 0.3 && st < 2 && i === (dir > 0 ? 0 : 1);
      if (flag) yaw[i] = 0.3 + 0.9 * sin(st * 5.5);
      const dip = flag ? -58 + 12 * sin(st * 11) : asin(clamp((LOCK[2] - blade) / OAR, -1, 1)) / RAD;
      const m = put(`oar${i}`, mul(boat.m, rz((-s * yaw[i]) / RAD), rx(-s * dip)), lock).m;
      me.blades[i] = far(world(tf(m, lock, 0, s * OAR, 0)));
    }
    const pole = kid(boat, 'pole', ry(-c[POLE]));
    // The lantern hangs from its pole and swings behind every move of the boat.
    const hang = at(pole, 'lantern');
    const swing = into(own, trail(trails[1], far(world(hang)), 160, 6, 1.4, dt));
    put('lantern', mul(ry(swing[0] * 26), rx(-swing[1] * 26)), hang);
    const f = me.fish;
    put('fish', f ? mul(boat.m, rz(f.yaw), ry(f.pitch)) : SAME, f ? tf(boat.m, boat.o, ...f.at) : [0, 0, -9], f ? ONE : [0, 0, 0]);
    me.hull = far(world(boat.o));

    dots.forEach((d, k) => {
      if (d.life > 0) {
        d.life -= dt;
        d.v[1] -= 70 * dt;
        for (let a = 0; a < 3; a += 1) d.p[a] += d.v[a] * dt;
        if (d.p[1] < 0) d.life = 0; // Into the water.
      }
      const s = d.life > 0 ? d.size * min(1, d.life * 5) : 0;
      B[`dot${k}`] = { v: [[s, 0, 0], [0, s, 0], [0, 0, s]], o: [d.p[0] - x / VOX, d.p[1], d.p[2]] };
    });

    // Finish in the view: x along the lane, y up, z toward the viewer.
    PARTS.forEach((p, pi) => {
      const b = B[p.bone];
      let m;
      let w = b.o;
      if (b.v) m = SAME.map((_, k) => b.v[k % 3][floor(k / 3)] * p.s[k % 3]);
      else {
        const g = b.s || ONE;
        const pv = PIVOT[p.bone];
        w = world(tf(b.m, b.o, (p.a[0] - pv[0]) * g[0], (p.a[1] - pv[1]) * g[1], (p.a[2] - pv[2]) * g[2]));
        m = frame(b.m.map((v, k) => v * g[k % 3] * p.s[k % 3]));
      }
      for (let r = 0; r < 3; r += 1) rows.set([m[r * 3], m[r * 3 + 1], m[r * 3 + 2], w[r]], pi * 12 + r * 4);
    });
  }

  function draw(dt) {
    cs = cos(cur[TURN] * RAD);
    sn = sin(cur[TURN] * RAD);
    const hz = direct(dt);
    nod += (watch() - nod) * (1 - exp(-dt * 8));
    fg.set(FACES[mood]);
    fg[LX] += gaze[0];
    fg[LY] += gaze[1];
    spring(hz, dt);
    out.set(cur.subarray(0, N));

    const l = (light && light()) || DAY;
    calm = me.live?.(state === 'act' ? act : state, st, time, asleep, time - lastInput, l) || 'smile';

    // A breath rests after the way out; pace and depth drift; sleep slows and deepens it.
    const drowse = clamp(1 - max(fc[OL], fc[OR]), 0, 1);
    lung += dt * (1.8 + 0.3 * sin(time * 0.37) - 0.55 * drowse);
    const breath = (0.5 - 0.5 * cos(lung - 0.5 * sin(lung))) * (0.85 + 0.15 * sin(time * 0.23) + 0.6 * drowse);
    out[DROP] += 0.2 * (1 - breath);

    // A blink shuts fast and opens slower; now and then a second follows.
    if (time > me.blinkAt) { blink = 0.13; twice = !twice && rng() < 0.2; me.blinkAt = time + (twice ? 0.3 : rand(2.4, 6.5)); }
    blink -= dt;
    lid += ((blink > 0 ? 0.1 : 1) - lid) * (1 - exp(-dt * (blink > 0 ? 32 : 11)));

    for (let k = 0, n = ceil(dt * 240); k < n; k += 1) {
      squashV += (-800 * (squash - 1) - 26 * squashV) * (dt / n);
      squash = clamp(squash + squashV * (dt / n), 0.8, 1.2);
    }
    // The swell: a bob of two art pixels, which the snap of his middle steps by whole pixels while the water stays
    // put, and a roll of a few degrees; each push lifts the bow, and the blades go in for the push and come out over
    // the water for the way back.
    bob = (0.42 * sin(time * 1.3) + 0.16 * sin(time * 2.9 + 1)) * 1.4;
    roll = 2.5 * sin(time * 0.9 + 1);
    pitch = 1.5 * sin(time * 1.1) - 4 * surge;
    blade += ((state === 'row' && phase ? (phase < DRIVE ? -0.5 : 1) : 0.35) - blade) * (1 - exp(-dt * 14));

    night = l.night || 0;
    const s = l.sun || DAY.sun;
    sun = unit([s[0] * 0.5, max(s[1], 0.35), max(s[2], 0.6)]); // The sun's side, pulled round to light his face.
    rig(out, cur[TURN + 1], nod, breath, dt);
    // Not drawn from a value that is not sane: he starts over.
    if (![rows, fc].every((a) => a.every((n) => abs(n) < 1e4))) return settle(P.rest, -18);
    Object.assign(me, { v: v * dir, phase, x: x / VOX, near: dir > 0 ? 1 : 0 });

    const view = [VOX * res, OX, G, TILT];
    const fine = [ease(clamp((time - fineAt) / 0.5, 0, 1)), night, time % 100, me.lamp];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (shadow) {
      gl.useProgram(shadow.p);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      for (const [k, a] of [['uS', me.water], ['uView', view], ['uNew', fine], ['uB', rows]]) gl.uniform4fv(shadow.u[k], a);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    gl.useProgram(figure.p);
    const u = figure.u;
    gl.uniform4fv(u.uB, rows);
    gl.uniform4fv(u.uView, view);
    gl.uniform2f(u.uRes, W, H);
    // The face: lids with the blink, squint, wide eyes; smile (a dash at 0), open, round, blush; gaze, worry.
    gl.uniform4f(u.uFace, clamp(fc[OL] * lid, 0, 1.3), clamp(fc[OR] * lid, 0, 1.3), fc[SQ], max(0, fc[OL] - 1) * 4);
    gl.uniform4f(u.uFace2, clamp((fc[MW] - 0.6) / 0.75, 0, 1), clamp(fc[MO], 0, 1), clamp(fc[OO], 0, 1), clamp(fc[BLUSH], 0, 1));
    gl.uniform4f(u.uFace3, fc[LX] * 0.012, -fc[LY] * 0.012, clamp(fc[WO], 0, 1), 0);
    gl.uniform3fv(u.uSun, sun);
    gl.uniform4fv(u.uNew, fine);
    gl.enable(gl.CULL_FACE);
    for (const hull of [1, 0]) {
      gl.cullFace(hull ? gl.FRONT : gl.BACK);
      gl.uniform1f(u.uHull, hull);
      gl.drawElements(gl.TRIANGLES, mesh.i.length, mesh.i.BYTES_PER_ELEMENT === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.CULL_FACE);
  }

  // Start settled, or over: springs at goal.
  const settle = (p, look) => {
    goal.set(p);
    goal[TURN] = 90 - dir * (90 - look);
    const face = goal[TURN] + 90;
    goal[TURN + 1] = clamp((face - 360 * round(face / 360)) * 0.8, -50, 50); // At rest his face is turned to the viewer.
    aim.set(goal);
    cur.set(goal);
    vel.fill(0);
    fv.fill(0);
    fc.set(FACES.smile);
    cs = cos(cur[TURN] * RAD);
    sn = sin(cur[TURN] * RAD);
    squashV = v = phase = surge = nod = lung = 0;
    squash = 1;
    trails.forEach((s) => { s.p = null; s.v = [0, 0, 0]; });
    dots.forEach((d) => { d.p = [0, 0, 0]; d.life = 0; });
    for (let k = 0; k < 90; k += 1) rig(p, cur[TURN + 1], 0, 0.5, 1 / 60);
  };

  const tick = (now) => {
    raf = visible ? requestAnimationFrame(tick) : 0;
    // A pose FPS times a second, and none while fine.js finds him still; between them there is nothing to do.
    if (now - last < 1000 / FPS - 4 || me.nap?.(now - last)) return;
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    st += dt;
    draw(dt);
  };
  const resume = () => {
    if (raf || reduce || !visible) return;
    raf = requestAnimationFrame((now) => { last = now; tick(now); });
  };

  const wake = () => {
    lastInput = time;
    if (!asleep) return;
    asleep = false;
    me.blinkAt = time + 0.25;
  };
  // A tap: a wave and hello, then his lines.
  const tap = () => {
    wake();
    const text = taps++ ? lines[floor(rng() * lines.length)] : el.dataset.hello;
    if (reduce || state === 'act') speak(text);
    else if (state === 'row') { speak(text); encore = () => perform('wave'); }
    else perform('wave', text);
  };
  let onScreen = true;
  let parked = false;
  // Off screen, under a window, in a hidden tab: no frames at all.
  const show = () => {
    visible = !document.hidden && onScreen && !parked;
    run?.a[visible ? 'play' : 'pause']();
    if (visible) resume();
    else { cancelAnimationFrame(raf); raf = 0; }
  };
  // Off screen, as when the pages carry Home away, he rests undrawn.
  const watcher = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) measure(entry.boundingClientRect); show(); });
  const lost = (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; };
  const restored = () => build().then(() => { later(); if (reduce) draw(0); else resume(); }, () => {});

  // Settling takes ms too: a turn first. From here to the return nothing waits, so no frame is drawn before he
  // has settled and the finer module, however soon it comes, finds his `api`.
  await pause();
  const hear = { passive: true, capture: true };
  const wires = [
    [el, 'click', tap], [window, 'pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY, at: time }; }, { passive: true }],
    [window, 'pointerdown', wake, hear], [window, 'keydown', wake, hear], [window, 'scroll', wake, hear],
    [document, 'visibilitychange', show], [window, 'resize', () => { measure(); if (!run) { x = fit(x); place(); } }], [canvas, 'webglcontextlost', lost], [canvas, 'webglcontextrestored', restored],
  ];
  for (const [to, ...wire] of wires) to.addEventListener(...wire);
  watcher.observe(el);

  // The finer look comes after the page's load, outside the first view, dithered in.
  let fineAt = 1e9;
  const later = () => import('./smed3d-fine.js').then((m) => m.fine(gl, me, mesh)).then((set) => {
    ({ figure, shadow } = set);
    fineAt = time || -1;
    if (reduce) draw(0);
  }).catch(() => {});
  if (document.readyState === 'complete') later();
  else addEventListener('load', later, { once: true });

  measure();
  x = fit(x);
  settle(P.rest, -18);
  if (reduce) {
    place();
    draw(0);
  } else {
    // He rows in from the lane's left end, then waves hello.
    x = -BOX_W * 0.6;
    place();
    travel(rand(fit(0), fit(1e4)));
    encore = () => perform('wave', el.dataset.hello);
    resume();
  }

  return me.api = {
    // main.js: under an open window he is away.
    park(on) { parked = on; show(); },
    play(to) {
      if (reduce) return;
      if (to === 'sleep') { lastInput = -99; return; }
      const a = CUES[to] || to;
      if (!ACTS[a]) return;
      wake();
      if (state === 'drift') perform(a);
      else encore = () => perform(a);
    },
  };
}

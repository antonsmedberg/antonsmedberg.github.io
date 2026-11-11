// A small 3D Malmö in chunky pixels, drawn once per view and hour; each frame adds what moves, slides its planes and
// lays sky, water and weather round it at the screen's grain.

const FPS = 24;
const NEAR = 4;
const FAR = 16000;
const BUDGET = 4; // Milliseconds of our own work per frame before the grain steps coarser.
const GROUND = 2.4;
const REACH = 90; // A plane this many metres off slides half as far as one at the lens.

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
// WCAG relative luminance.
const lum = (c) => [0.2126, 0.7152, 0.0722].reduce((s, k, i) => s + k * (c[i] <= 0.04045 ? c[i] / 12.92 : ((c[i] + 0.055) / 1.055) ** 2.4), 0);
const toHex = (c) => `#${c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;

/* ------------------------------------------------------------------ Colour */

// Palettes in OKLCH, blended in OKLab, keeping lightness steps.
const lab = ([L, C, h]) => [L, C * Math.cos(rad(h)), C * Math.sin(rad(h))];
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// OKLab to sRGB; out of gamut loses chroma, not hue.
function labRgb([L, a, b]) {
  for (let k = 1; ; k *= 0.9) {
    const l = (L + 0.3963377774 * a * k + 0.2158037573 * b * k) ** 3;
    const m = (L - 0.1055613458 * a * k - 0.0638541728 * b * k) ** 3;
    const s = (L - 0.0894841775 * a * k - 1.291485548 * b * k) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (k < 0.05 || rgb.every((c) => c > -0.002 && c < 1.002)) return rgb.map((c) => gamma(clamp(c, 0, 1)));
  }
}

// Colours per moment of the day.
const P = {
  night: { sky: [[0.13, 0.05, 268], [0.19, 0.07, 266], [0.27, 0.08, 262], [0.37, 0.075, 255]], sun: [0.93, 0.03, 250], cloud: [[0.36, 0.07, 258], [0.25, 0.075, 260]], sea: [[0.26, 0.08, 262], [0.14, 0.06, 268]], amb: [0.36, 0.08, 266], key: [0.6, 0.09, 262], accent: [0.8, 0.12, 75], star: 1 },
  dawn: { sky: [[0.25, 0.09, 268], [0.34, 0.12, 288], [0.45, 0.14, 340], [0.53, 0.14, 35]], sun: [0.94, 0.08, 85], cloud: [[0.83, 0.1, 28], [0.6, 0.11, 320]], sea: [[0.62, 0.09, 305], [0.36, 0.09, 280]], amb: [0.55, 0.08, 288], key: [0.87, 0.1, 55], accent: [0.74, 0.15, 30], star: 0.12 },
  day: { sky: [[0.74, 0.11, 249], [0.79, 0.09, 243], [0.86, 0.06, 232], [0.94, 0.03, 212]], sun: [0.97, 0.05, 100], cloud: [[0.985, 0.012, 95], [0.7, 0.045, 262]], sea: [[0.58, 0.085, 228], [0.47, 0.08, 220]], amb: [0.66, 0.07, 256], key: [0.97, 0.06, 88], accent: [0.62, 0.19, 258], star: 0 },
  // A low sun, October to February: paler air, warm key, blue shade.
  low: { sky: [[0.74, 0.1, 251], [0.79, 0.08, 245], [0.86, 0.055, 236], [0.93, 0.045, 78]], sun: [0.97, 0.07, 90], cloud: [[0.965, 0.035, 80], [0.62, 0.05, 275]], sea: [[0.56, 0.06, 222], [0.45, 0.065, 214]], amb: [0.6, 0.065, 258], key: [0.95, 0.095, 76], accent: [0.62, 0.19, 258], star: 0 },
  gold: { sky: [[0.73, 0.08, 266], [0.78, 0.085, 292], [0.85, 0.095, 48], [0.92, 0.1, 78]], sun: [0.96, 0.09, 95], cloud: [[0.93, 0.07, 75], [0.7, 0.08, 10]], sea: [[0.73, 0.09, 50], [0.42, 0.11, 272]], amb: [0.6, 0.07, 280], key: [0.89, 0.11, 70], accent: [0.76, 0.15, 60], star: 0 },
  dusk: { sky: [[0.24, 0.1, 274], [0.33, 0.13, 292], [0.44, 0.155, 348], [0.52, 0.155, 40]], sun: [0.84, 0.13, 55], cloud: [[0.65, 0.15, 5], [0.42, 0.12, 310]], sea: [[0.46, 0.11, 320], [0.25, 0.09, 278]], amb: [0.47, 0.09, 292], key: [0.77, 0.13, 45], accent: [0.72, 0.17, 30], star: 0.3 },
};
for (const p of Object.values(P)) {
  for (const [k, v] of Object.entries(p)) if (Array.isArray(v)) p[k] = Array.isArray(v[0]) ? v.map(lab) : lab(v);
}

// Built once: the dial asks every frame while dragged.
const MALMO = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', month: 'numeric', day: 'numeric', timeZoneName: 'shortOffset' });

function malmoNow(date) {
  const parts = MALMO.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const offset = parseInt(get('timeZoneName').replace('GMT', ''), 10) || 0;
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = (Date.UTC(date.getUTCFullYear(), Number(get('month')) - 1, Number(get('day'))) - start) / 86400000 + 1;
  return { hour: Number(get('hour')) + Number(get('minute')) / 60, offset, doy };
}

const LAT = rad(55.6);
// Spencer's series, as the page's almanac: declination and the equation of time (h).
const spencer = (doy) => {
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  const w = (a, b, c, d, e = 0, f = 0) => a * Math.cos(g) + b * Math.sin(g) + c * Math.cos(2 * g) + d * Math.sin(2 * g) + e * Math.cos(3 * g) + f * Math.sin(3 * g);
  return [0.006918 + w(-0.399912, 0.070257, -0.006758, 0.000907, -0.002697, 0.00148), 0.000287 + w(0.0071358, -0.12253, -0.055829, -0.15604)];
};
const solarNoon = (offset, doy) => 12 + offset - 13 / 15 - spencer(doy)[1];

// Rise and set of the disc's top with refraction: its centre 0.833 degrees down.
function sunTimes(doy, offset) {
  const d = spencer(doy)[0];
  const half = (Math.acos(clamp((-0.01454 - Math.sin(LAT) * Math.sin(d)) / (Math.cos(LAT) * Math.cos(d)), -1, 1)) * 12) / Math.PI;
  const noon = solarNoon(offset, doy);
  return [noon - half, noon + half];
}

// Sine of the real sun's height; its bearing is composed.
function sunHeight(hour, doy, offset) {
  const decl = spencer(doy)[0];
  const h = rad(((((hour - solarNoon(offset, doy) + 12) % 24) + 24) % 24 - 12) * 15);
  return Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(h);
}

// Share of the synodic month since the new moon of 6 January 2000: 0 new, 0.5 full.
const moonPhase = (date) => ((((date / 86400000 - 10962.76) / 29.530588853) % 1) + 1) % 1;

// `low` leans day toward the low-sun day: 0 summer, 1 midwinter.
function palette(hour, rise, set, low) {
  const keys = [[rise - 1.4, 'night'], [rise - 0.45, 'dawn'], [rise + 0.35, 'gold'], [rise + 1.3, 'day'], [set - 1.3, 'day'], [set - 0.35, 'gold'], [set + 0.45, 'dusk'], [set + 1.4, 'night']];
  let a = keys[keys.length - 1];
  let b = keys[0];
  let t = 0;
  if (hour >= keys[0][0] && hour < keys[keys.length - 1][0]) {
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (hour >= keys[i][0] && hour < keys[i + 1][0]) {
        a = keys[i];
        b = keys[i + 1];
        t = (hour - a[0]) / (b[0] - a[0] || 1);
        break;
      }
    }
  }
  const blend = (u, v) => (typeof u === 'number' ? u + (v - u) * low : Array.isArray(u[0]) ? u.map((c, i) => mix3(c, v[i], low)) : mix3(u, v, low));
  const day = Object.fromEntries(Object.keys(P.day).map((k) => [k, blend(P.day[k], P.low[k])]));
  const from = a[1] === 'day' ? day : P[a[1]];
  const to = b[1] === 'day' ? day : P[b[1]];
  const c = (k) => labRgb(mix3(from[k], to[k], t));
  const c2 = (k, i) => labRgb(mix3(from[k][i], to[k][i], t));
  return {
    sky: [0, 1, 2, 3].map((i) => c2('sky', i)),
    cloud: [c2('cloud', 0), c2('cloud', 1)],
    sea: [c2('sea', 0), c2('sea', 1)],
    sun: c('sun'), amb: c('amb'), key: c('key'), accent: c('accent'),
    star: from.star + (to.star - from.star) * t,
  };
}

// Rooms lit: on through the evening, most dark after eleven, some before sunrise.
function windowsAt(hour, rise, set) {
  const h = hour < rise + 1 ? hour + 24 : hour;
  const keys = [[set - 0.7, 0], [set + 1.6, 0.62], [22.5, 0.62], [25.5, 0.14], [rise + 22, 0.12], [rise + 23.2, 0.3], [rise + 24.6, 0]];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const [a, va] = keys[i];
    const [b, vb] = keys[i + 1];
    if (h >= a && h < b) return va + (vb - va) * smooth((h - a) / (b - a));
  }
  return 0;
}

function rngFrom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ---------------------------------------------------------------- Geometry */

const K = { plain: 0, torso: 1, glass: 2, block: 3, truss: 4, road: 5, light: 6, leaf: 7, office: 8, deck: 9, train: 11, pool: 12, balcony: 13 };
const FLOATS = 14; // position, normal, colour, (u, v, kind), (openness to the sky, seed)
const UP = [0, 1, 0];
const BELOW = [0, -100, 0];
const ZERO = [0, 0, 0, 0];
const FREE = [1, 1]; // Fully open to the sky at both edges of a wall.
const FOOT = [0, 1]; // Standing on the ground: dark at the foot, open at the top.
const PLAIN = () => K.plain;
const WHITE = hex('#f2f1ea');
const WARM = hex('#ffd9a0');
const RED = hex('#ff4034');
const IRON = hex('#3b4048');
const PAVING = hex('#c0b8a6');

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const circle = (x, z, r, n, a0 = 0) => Array.from({ length: n }, (_, j) => [x + Math.cos(a0 + (j / n) * 6.2832) * r, z + Math.sin(a0 + (j / n) * 6.2832) * r]);

// Vertices in a growing typed array: movers make no garbage.
class Buf {
  constructor(size) {
    this.a = new Float32Array(size);
    this.n = 0;
  }

  put(p, n, c, u, v, kind, ao, seed) {
    if (this.n + FLOATS > this.a.length) {
      const grown = new Float32Array(this.a.length * 2);
      grown.set(this.a);
      this.a = grown;
    }
    const a = this.a;
    let i = this.n;
    a[i++] = p[0]; a[i++] = p[1]; a[i++] = p[2];
    a[i++] = n[0]; a[i++] = n[1]; a[i++] = n[2];
    a[i++] = c[0]; a[i++] = c[1]; a[i++] = c[2];
    a[i++] = u; a[i++] = v; a[i++] = kind; a[i++] = ao; a[i++] = seed;
    this.n = i;
  }
}

class Mesh {
  constructor(size) {
    this.t = new Buf(size);
    this.l = new Buf(size >> 3);
    this.seed = 0;
    this.ao = FREE;
    this.fix = null;
  }

  // A quad facing away from `inside`; `ao`: openness along a-b, c-d.
  quad(a, b, c, d, col, kind = K.plain, uv = ZERO, inside = null, ao = FREE) {
    let n = norm(cross(sub(b, a), sub(d, a)));
    if (inside && dot(n, sub(a, inside)) < 0) n = [-n[0], -n[1], -n[2]];
    const [u0, v0, u1, v1] = this.fix || uv;
    const t = this.t;
    const s = this.seed;
    t.put(a, n, col, u0, v0, kind, ao[0], s); t.put(b, n, col, u1, v0, kind, ao[0], s); t.put(c, n, col, u1, v1, kind, ao[1], s);
    t.put(a, n, col, u0, v0, kind, ao[0], s); t.put(c, n, col, u1, v1, kind, ao[1], s); t.put(d, n, col, u0, v1, kind, ao[1], s);
  }

  tri(a, b, c, col, toward = UP) {
    let n = norm(cross(sub(b, a), sub(c, a)));
    if (dot(n, toward) < 0) n = [-n[0], -n[1], -n[2]];
    for (const p of [a, b, c]) this.t.put(p, n, col, 0, 0, K.plain, 1, 0);
  }

  // A flat polygon from a ring.
  cap(ring, y, col, kind = K.plain, n = UP) {
    const [u, v] = this.fix || ZERO;
    for (let i = 1; i < ring.length - 1; i += 1) {
      for (const p of [ring[0], ring[i], ring[i + 1]]) this.t.put([p[0], y, p[1]], n, col, u, v, kind, 1, this.seed);
    }
  }

  // A rounded mass of leaves, flat-toned.
  lobe(x, y, z, r, tall, col) {
    const N = 7;
    const row = (lat) => Array.from({ length: N }, (_, i) => {
      const a = (i / N) * 6.2832 + lat;
      const k = Math.cos(lat) * r;
      return [x + Math.cos(a) * k, y + Math.sin(lat) * r * tall, z + Math.sin(a) * k];
    });
    const rows = [[[x, y - r * tall * 0.8, z]], row(-0.45), row(0.4), [[x, y + r * tall, z]]];
    const open = [0.2, 0.5, 1, 1];
    const put = (j, i) => {
      const p = rows[j][i % rows[j].length];
      this.t.put(p, norm([p[0] - x, (p[1] - y) / tall, p[2] - z]), col, 0, 0, K.leaf, open[j], this.seed);
    };
    for (let i = 0; i < N; i += 1) {
      put(0, 0); put(1, i); put(1, i + 1);
      put(1, i); put(1, i + 1); put(2, i + 1);
      put(1, i); put(2, i + 1); put(2, i);
      put(2, i); put(2, i + 1); put(3, 0);
    }
  }

  // A soft dark patch on ground of colour `col`.
  blot(x, y, z, r, col) {
    const ring = circle(x, z, r, 8);
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % 8];
      this.t.put([x, y, z], UP, col, 0, 0, K.plain, 0, 0);
      this.t.put([a[0], y, a[1]], UP, col, 0, 0, K.plain, 1, 0);
      this.t.put([b[0], y, b[1]], UP, col, 0, 0, K.plain, 1, 0);
    });
  }

  // A street lamp and its pool of light.
  lamp(x, y, z, tall, ground) {
    this.line([x, y, z], [x, y + tall, z], IRON);
    this.light(x, y + tall, z, 1.2, WARM, 0, 1);
    const r = tall * 1.9;
    this.quad([x - r, y + 0.32, z - r], [x + r, y + 0.32, z - r], [x + r, y + 0.32, z + r], [x - r, y + 0.32, z + r], ground, K.pool, [-1, -1, 1, 1], BELOW);
  }

  // Wall between equal rings: u round, v up unless given.
  wall(r0, y0, r1, y1, col, kindFor = PLAIN, v = [y0, y1]) {
    let u = 0;
    const mid = [r0.reduce((s, p) => s + p[0], 0) / r0.length, (y0 + y1) / 2, r0.reduce((s, p) => s + p[1], 0) / r0.length];
    for (let i = 0; i < r0.length; i += 1) {
      const j = (i + 1) % r0.length;
      const len = Math.hypot(r0[j][0] - r0[i][0], r0[j][1] - r0[i][1]);
      this.quad([r0[i][0], y0, r0[i][1]], [r0[j][0], y0, r0[j][1]], [r1[j][0], y1, r1[j][1]], [r1[i][0], y1, r1[i][1]], col, kindFor(i), [u, v[0], u + len, v[1]], mid, this.ao);
      u += len;
    }
  }

  box(x, y, z, w, h, d, col, { yaw = 0, kind = K.plain, roof = null, v } = {}) {
    const ring = Mesh.rect(x, z, w, d, yaw);
    this.wall(ring, y, ring, y + h, col, () => kind, v);
    this.cap(ring, y + h, roof || col);
    return ring;
  }

  // A tapered post to y1; one top side near zero makes a pitched roof.
  post(x, y0, z, w0, d0, y1, w1, d1, col, yaw = 0) {
    const top = Mesh.rect(x, z, w1, d1, yaw);
    this.wall(Mesh.rect(x, z, w0, d0, yaw), y0, top, y1, col);
    this.cap(top, y1, col);
  }

  line(a, b, col) {
    this.l.put(a, UP, col, 0, 0, K.plain, 1, 0);
    this.l.put(b, UP, col, 0, 0, K.plain, 1, 0);
  }

  // A glowing cube, `day` and `night` strong.
  light(x, y, z, s, col, day, night) {
    this.fix = [day, night, day, night];
    this.box(x, y, z, s, s, s, col, { kind: K.light });
    this.fix = null;
  }

  // Ground round a footprint, darker at the wall.
  apron(ring, y, col, r = 6) {
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const out = ring.map(([x, z]) => {
      const l = Math.hypot(x - cx, z - cz) || 1;
      return [x + ((x - cx) / l) * r * 1.4, z + ((z - cz) / l) * r * 1.4];
    });
    for (let i = 0; i < ring.length; i += 1) {
      const j = (i + 1) % ring.length;
      this.quad([ring[i][0], y, ring[i][1]], [ring[j][0], y, ring[j][1]], [out[j][0], y, out[j][1]], [out[i][0], y, out[i][1]], col, K.plain, ZERO, BELOW, FOOT);
    }
  }

  static rect(x, z, w, d, yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [x + a * c - b * s, z + a * s + b * c]);
  }
}

// 190 m: nine five-floor blocks on a pentagon turning 90 degrees, the spine outside.
function buildTorso(m) {
  const H = TOWER;
  const BLOCKS = 9;
  const crown = 6;
  const h = (H - crown) / BLOCKS;
  const band = 1.7;
  const floor = (h - band) / 5;
  const white = hex('#ece9df');
  const dark = hex('#2a2f3a');
  const steel = hex('#f7f7f1');
  const angle = (y) => rad(-42 + (90 * y) / H);
  const plan = [[-14, -15], [11, -15], [22, 0], [11, 15], [-14, 15]];
  const chamfered = [];
  plan.forEach((p, i) => {
    const prev = plan[(i + plan.length - 1) % plan.length];
    const next = plan[(i + 1) % plan.length];
    const toward = (q, by) => {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return [p[0] + ((q[0] - p[0]) * by) / l, p[1] + ((q[1] - p[1]) * by) / l];
    };
    chamfered.push(toward(prev, 2.2), toward(next, 2.2));
  });
  // Walls 0 and 2 meet at the point, glazed side.
  const kindFor = (i) => (i === 3 || i === 5 ? K.glass : i % 2 === 1 ? K.torso : K.plain);
  const ringAt = (y, scale = 1) => {
    const a = angle(y);
    const c = Math.cos(a);
    const s = Math.sin(a);
    return chamfered.map(([x, z]) => [(x * c - z * s) * scale, (x * s + z * c) * scale]);
  };
  // The tower's outline faces.
  const skin = [];
  const cover = (r0, y0, r1, y1) => r0.forEach((a, i) => {
    const j = (i + 1) % r0.length;
    skin.push(a[0], y0, a[1], r0[j][0], y0, r0[j][1], r1[j][0], y1, r1[j][1], r1[i][0], y1, r1[i][1]);
  });
  m.seed = 0.37;
  m.apron(ringAt(0), GROUND + 0.2, hex('#b5ae9f'), 9);
  for (let k = 0; k < BLOCKS; k += 1) {
    const y0 = k * h;
    cover(ringAt(y0, 0.93), y0, ringAt(y0 + band, 0.93), y0 + band);
    cover(ringAt(y0 + band), y0 + band, ringAt(y0 + h), y0 + h);
    // The recess between blocks lies in shade.
    m.ao = [0.25, 0.25];
    m.wall(ringAt(y0, 0.93), y0, ringAt(y0 + band, 0.93), y0 + band, dark);
    // The block's underside, seen from the quay.
    m.cap(ringAt(y0 + band), y0 + band, dark, K.plain, [0, -1, 0]);
    for (let i = 0; i < 5; i += 1) {
      const a = y0 + band + floor * i;
      m.ao = k === 0 && i === 0 ? FOOT : i === 0 ? [0.55, 1] : FREE;
      m.wall(ringAt(a), a, ringAt(a + floor), a + floor, white, kindFor, [(k * 5 + i) * floor, (k * 5 + i + 1) * floor]);
    }
    m.cap(ringAt(y0 + h), y0 + h, dark);
  }
  m.ao = FREE;
  const top = H - crown;
  m.wall(ringAt(top, 0.74), top, ringAt(top + 2.5, 0.74), top + 2.5, white);
  m.cap(ringAt(top + 2.5, 0.74), top + 2.5, dark);
  // A band round the top block: pale by day, lit after dark.
  m.fix = [0.04, 0.92, 0.04, 0.92];
  m.wall(ringAt(top - 1.5, 1.012), top - 1.5, ringAt(top - 0.2, 1.012), top - 0.2, WARM, () => K.light);
  m.fix = null;
  cover(ringAt(top, 0.74), top, ringAt(top + 2.5, 0.74), top + 2.5);
  for (let i = 0; i < 3; i += 1) {
    const r = (t) => Math.cos(t * Math.PI * 0.5) * 8;
    m.wall(circle(0, 0, r(i / 3), 10), top + 2.5 + (i / 3) * 4, circle(0, 0, r((i + 1) / 3), 10), top + 2.5 + ((i + 1) / 3) * 4, white);
    cover(circle(0, 0, r(i / 3), 10), top + 2.5 + (i / 3) * 4, circle(0, 0, r((i + 1) / 3), 10), top + 2.5 + ((i + 1) / 3) * 4);
  }
  // The spine, tied to each block.
  const spineAt = (y, r = 30) => {
    const a = angle(y);
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  const noseAt = (y) => spineAt(y, 21);
  const SEG = 36;
  for (let i = 0; i < SEG; i += 1) {
    const y0 = (H * i) / SEG;
    const y1 = (H * (i + 1)) / SEG;
    const p0 = spineAt(y0);
    const p1 = spineAt(y1);
    m.wall(Mesh.rect(p0[0], p0[2], 2.2, 2.2, 0), y0, Mesh.rect(p1[0], p1[2], 2.2, 2.2, 0), y1, steel);
    cover(Mesh.rect(p0[0], p0[2], 2.2, 2.2, 0), y0, Mesh.rect(p1[0], p1[2], 2.2, 2.2, 0), y1);
  }
  for (let k = 0; k < BLOCKS; k += 1) {
    const y0 = k * h;
    const y1 = y0 + h;
    m.line(spineAt(y1), noseAt(y0 + 1.8), steel);
    m.line(spineAt(y0 + h * 0.5), noseAt(y0 + h * 0.5), steel);
    m.line(spineAt(y1), noseAt(y1 - 1), steel);
  }
  return new Float32Array(skin);
}

// East of the beach the shore turns north; the bridge crosses open water.
const COAST = [[-7000, -260], [-2600, -60], [-900, 50], [-260, 96], [120, 112], [430, 92], [900, -30], [1080, -420], [1180, -1100], [1300, -3000], [1500, -9000], [7000, -9000]];
function coastZ(x) {
  for (let i = 0; i < COAST.length - 1; i += 1) {
    const [x0, z0] = COAST[i];
    const [x1, z1] = COAST[i + 1];
    if (x >= x0 && x <= x1) return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
  }
  return -3000;
}

// Straight shore pieces from x0 to x1, with distance walked.
function shore(x0, x1) {
  const xs = [x0, ...COAST.map((p) => p[0]).filter((x) => x > x0 && x < x1), x1];
  const out = [];
  let u = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const len = Math.hypot(xs[i + 1] - xs[i], coastZ(xs[i + 1]) - coastZ(xs[i]));
    out.push([xs[i], xs[i + 1], u, u + len]);
    u += len;
  }
  return out;
}

function buildLand(m) {
  const paving = hex('#b5ae9f');
  const stone = hex('#cfc6b4');
  const edge = hex('#7a6a60');
  const far = hex('#8b9a7a');
  const y = GROUND;
  for (let i = 0; i < COAST.length - 1; i += 1) {
    const [x0, z0] = COAST[i];
    const [x1, z1] = COAST[i + 1];
    m.quad([x0, y, z0 - 1700], [x1, y, z1 - 1700], [x1, y, -14000], [x0, y, -14000], far, K.plain, ZERO, BELOW);
    m.quad([x0, y, z0 - 26], [x1, y, z1 - 26], [x1, y, z1 - 1700], [x0, y, z0 - 1700], paving, K.plain, ZERO, BELOW);
    m.quad([x0, y, z0], [x1, y, z1], [x1, y, z1 - 26], [x0, y, z0 - 26], stone, K.plain, ZERO, BELOW);
    m.quad([x0, 0, z0], [x1, 0, z1], [x1, y, z1], [x0, y, z0], edge, K.plain, ZERO, [0, 0, -14000]);
  }
}

const PARKS = [[-350, -150, 160, 44], [120, 250, 180, 58], [-900, -640, 210, 70]]; // x from, x to, how far back, how near the shore

const QUAY = [-560, 215]; // The promenade runs between these; east of it the shore is a beach.

// Sundspromenaden: a lit timber deck down to the water.
function buildBoardwalk(m) {
  const wood = hex('#b39672');
  const riser = hex('#8a7257');
  const y = GROUND;
  for (const [xa, xb, ua, ub] of shore(...QUAY)) {
    const za = coastZ(xa);
    const zb = coastZ(xb);
    const strip = (o0, o1, h) => m.quad([xa, h, za + o0], [xb, h, zb + o0], [xb, h, zb + o1], [xa, h, za + o1], wood, K.deck, [ua, o0 + 6, ub, o1 + 6], BELOW);
    strip(-12, 0, y + 0.05);
    for (let k = 1; k <= 3; k += 1) {
      const o = (k - 1) * 2.4;
      const top = y - 0.6 * (k - 1);
      m.quad([xa, top - 0.6, za + o], [xb, top - 0.6, zb + o], [xb, top, zb + o], [xa, top, za + o], riser, K.plain, ZERO, [0, 0, -14000], [0.3, 1]);
      strip(o, o + 2.4, top - 0.6);
    }
    m.quad([xa, 0, za + 7.2], [xb, 0, zb + 7.2], [xb, 0.6, zb + 7.2], [xa, 0.6, za + 7.2], riser, K.plain, ZERO, [0, 0, -14000]);
    // The deck shader pools light every 38 m; lamps stand in them.
    for (let u = Math.ceil((ua - 19) / 38) * 38 + 19; u < ub; u += 38) {
      const x = xa + ((xb - xa) * (u - ua)) / (ub - ua);
      const z = coastZ(x) - 6;
      m.line([x, y, z], [x, y + 6, z], IRON);
      m.light(x, y + 6, z, 1.3, WARM, 0, 1);
      m.box(x + 3.4, y, z - 3, 2.4, 0.5, 0.7, riser);
    }
    // Bollards.
    for (let u = Math.ceil(ua / 9.5) * 9.5; u < ub; u += 9.5) {
      const x = xa + ((xb - xa) * (u - ua)) / (ub - ua);
      m.post(x, y, coastZ(x) - 0.8, 0.55, 0.55, y + 0.95, 0.38, 0.38, IRON);
    }
  }
}

function buildHarbour(m) {
  const rng = rngFrom(4177);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const roofs = ['#3a404e', '#4a4f5c', '#5a4a48', '#2f3540', '#8d9499', '#6f8a5c'].map(hex);
  const tiles = ['#a5543f', '#3a404e', '#7c4a3c'].map(hex);
  const fronts = ['#f0ece1', '#e6dcc8', '#dfe3e2', '#f2e6c4', '#d8d2c4'].map(hex);
  const walls = ['#ded0b4', '#ebe7dc', '#a55f49', '#c99e62', '#8f99a6', '#e6dcc8', '#b77a5e', '#7fb0a8', '#3c3f47', '#d9b24c', '#c4553f'].map(hex);
  const paving = PAVING;
  const near = (x, z, r, cx, cz) => Math.hypot(x - cx, z - cz) < r;
  const Y = GROUND;
  // House detail has its own sequence, so streets stay put.
  const extra = rngFrom(6607);
  // A seed's quarter picks the wall: render, brick, timber, or glazed balconies.
  const made = new Map([...[2, 3, 6, 10].map((i) => [walls[i], 1]), ...[4, 8].map((i) => [walls[i], 2])]);
  const taken = [[46, 34, 30], [-44, 8, 24]];
  const free = (x, z, r) => !near(x, z, 58 + r, 0, 10) && taken.every(([bx, bz, br]) => !near(x, z, br + r, bx, bz));

  // One Bo01 house, its roof unlike its neighbours'.
  const block = (x, z, w, d, floors, col, yaw, close) => {
    const h = floors * 3.1 + 0.7;
    const roof = pick(roofs);
    m.seed = ((made.get(col) || (floors % 2) * 3) + rng()) / 4;
    m.ao = FOOT;
    const ring = m.box(x, Y, z, w, h, d, col, { yaw, kind: K.block, roof });
    taken.push([x, z, Math.hypot(w, d) / 2]);
    if (close) m.apron(ring, Y + 0.2, paving);
    m.ao = FREE;
    const style = rng();
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    if (style < 0.28 && floors < 6) m.post(x, Y + h, z, w + 1, d + 1, Y + h + d * 0.3, w + 1, 0.3, pick(tiles), yaw);
    else if (style < 0.55) m.box(x + c * w * 0.18, Y + h, z + s * w * 0.18, w * 0.5, 3.1, d * 0.62, pick(fronts), { yaw, kind: K.block, roof });
    else if (style < 0.8) m.box(x, Y + h, z, w - 1.2, 0.9, d - 1.2, col, { yaw, roof });
    else m.box(x - c * w * 0.25, Y + h, z - s * w * 0.25, 5, 2.6, 5, hex('#8d9499'), { yaw });
    if (!close) return;
    // Balconies to the water.
    for (const t of [-0.27, 0.25]) {
      if (extra() < 0.62) m.box(x + c * w * t - s * (d / 2 + 0.7), Y + 3.1, z + s * w * t + c * (d / 2 + 0.7), 3.6 + extra() * 2.4, h - 3.8, 1.5, WHITE, { yaw, kind: K.balcony });
    }
    if (style < 0.55) return;
    // Flat roofs carry railed terraces or plant rooms.
    const top = Y + h + (style < 0.8 ? 0.9 : 0);
    if (extra() < 0.5) {
      const rail = Mesh.rect(x, z, w - 2, d - 2, yaw);
      rail.forEach((a, i) => m.line([a[0], top + 1.1, a[1]], [rail[(i + 1) % 4][0], top + 1.1, rail[(i + 1) % 4][1]], hex('#cfe0e6')));
      for (let i = 0; i < 3; i += 1) m.lobe(x + c * w * (extra() - 0.5) * 0.7, top + 0.9, z + s * w * (extra() - 0.5) * 0.7 + (extra() - 0.5) * d * 0.5, 1 + extra(), 0.9, hex('#4d6a48'));
    } else {
      m.box(x + c * w * 0.2, top, z + s * w * 0.2, 3.4, 1.7, 2.6, hex('#9aa0a4'), { yaw });
      m.line([x + c * w * 0.2, top + 1.7, z + s * w * 0.2], [x + c * w * 0.2, top + 4.6, z + s * w * 0.2], IRON);
    }
  };

  // Office and garage at the tower's foot.
  m.seed = 0.11;
  m.ao = FOOT;
  m.apron(m.box(46, 0, 34, 40, 25, 30, hex('#e4dfd2'), { kind: K.block, roof: roofs[1] }), Y + 0.2, paving);
  m.apron(m.box(-44, 0, 8, 26, 11, 34, hex('#e4dfd2'), { kind: K.block, roof: roofs[0] }), Y + 0.2, paving);
  const inPark = (x, off) => PARKS.some(([a, b, back, front]) => x > a - 16 && x < b + 16 && off < -front + 16 && off > -back - 16);
  for (let x = -2300; x < 1250; x += 40 + rng() * 34) {
    let row = 0;
    for (let off = -46 - rng() * 6; off > -1250; off -= 42 + rng() * 40) {
      const z = coastZ(x) + off;
      row += 1;
      if (near(x, z, 80, 0, 10) || inPark(x, off) || rng() < 0.16) continue;
      const tower = rng() < 0.035 && row > 2;
      const floors = tower ? 10 + Math.floor(rng() * 5) : (row === 1 ? 5 : 2) + Math.floor(rng() * 4) + Math.floor(-off * 0.003);
      const w = tower ? 18 : 18 + rng() * 26;
      const d = tower ? 18 : 14 + rng() * 15;
      block(x + rng() * 8, z, w, d, floors, row === 1 ? pick(fronts) : pick(walls), rad(rng() * 10 - 5), Math.abs(x) < 1100 && off > -600);
    }
  }
  // Central Malmö beyond, hazy.
  const hazy = hex('#a8afbd');
  for (let i = 0; i < 150; i += 1) {
    const x = -6000 + rng() * 11000;
    const z = coastZ(x) - 1900 - rng() * 3200;
    m.seed = rng();
    m.box(x, Y, z, 40 + rng() * 60, 20 + rng() * rng() * 46, 40 + rng() * 50, hazy, { kind: K.block });
  }
  m.ao = FREE;
  m.seed = 0;

  // Street lamps over their pools.
  for (let i = 0; i < 170; i += 1) {
    const x = -1000 + extra() * 2000;
    const z = coastZ(x) - 28 - extra() * 420;
    if (free(x, z, 4)) {
      m.lamp(x, Y, z, 5.5, paving);
      taken.push([x, z, 1]);
    }
  }
  // Two cranes: still being built.
  const crane = (x, z, tall, reach, yaw) => {
    const orange = hex('#e8863a');
    m.post(x, Y, z, 3, 3, tall, 2.4, 2.4, orange);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const tip = [x + c * reach, tall + 1.5, z + s * reach];
    const back = [x - c * reach * 0.3, tall + 1.5, z - s * reach * 0.3];
    const peak = [x, tall + 11, z];
    m.line(back, tip, orange);
    m.line([back[0], back[1] - 1, back[2]], [tip[0], tip[1] - 1, tip[2]], orange);
    m.line(peak, tip, orange);
    m.line(peak, back, orange);
    m.post(back[0], tall - 3, back[2], 4, 4, tall + 1, 4, 4, hex('#6a7078'));
    m.line([x + c * reach * 0.7, tall + 1, z + s * reach * 0.7], [x + c * reach * 0.7, tall - 26, z + s * reach * 0.7], hex('#2a2f3a'));
    m.light(peak[0], peak[1], peak[2], 1.6, RED, 0.2, 1);
  };
  crane(-290, -120, 48, 40, rad(12));
  crane(330, -210, 74, 50, rad(160));
  return free;
}

// The season: foliage, autumn turn (a beech hedge stays copper), new green.
function season(doy) {
  const ramp = (a, b) => smooth(clamp((doy - a) / (b - a), 0, 1));
  return { leaf: ramp(105, 140) * (1 - 0.92 * ramp(285, 330)), turn: doy < 110 ? 1 : ramp(250, 295), fresh: 1 - ramp(125, 170) };
}

// Autumn as one ramp, gold to rust; each tree its own step.
const AUTUMN = [[0.82, 0.145, 92], [0.74, 0.155, 70], [0.64, 0.155, 48], [0.54, 0.14, 30]].map((c) => labRgb(lab(c)));

// Per tree: min height, spread (m), trunk share, bark, leaf, autumn step, crowns (offset, height, radius), tallness.
const TREES = {
  lime: [11, 4, 0.26, '#4b4039', '#5f7d49', 0, [[0, 0.42, 0.27, 1.15], [0, 0.8, 0.17, 1.3]]],
  oak: [10, 3, 0.24, '#453c35', '#516f43', 2, [[-0.2, 0.4, 0.22, 0.85], [0.2, 0.46, 0.23, 0.85], [0, 0.74, 0.25, 0.8]]],
  maple: [9, 3, 0.26, '#4f433b', '#64823f', 3, [[0, 0.56, 0.3, 0.95], [0.22, 0.28, 0.16, 0.9]]],
  birch: [11, 4, 0.34, '#e6e2d8', '#7b9556', 0, [[0.05, 0.22, 0.12, 1.3], [-0.06, 0.56, 0.13, 1.3], [0.03, 0.88, 0.1, 1.4]]],
  poplar: [16, 5, 0.12, '#5a5148', '#58774a', 1, [[0, 0.5, 0.1, 4.2]]],
  pine: [11, 4, 0.4, '#8d5d43', '#35584a', 0, []],
};

// Trees as planted; `free`: no house there.
function buildPlanting(m, doy, free) {
  const rng = rngFrom(8123);
  // Seasonal detail has its own sequence, so no tree moves day to day.
  const fine = rngFrom(4409);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const S = season(doy);
  const Y = GROUND;
  const stone = hex('#cfc6b4');
  const grass = mix3(hex('#76935a'), hex('#6f8552'), S.turn);
  const fresh = hex('#a3b964');
  const shade = (c, by) => c.map((v) => v * (1 + (rng() - 0.5) * by));

  const tree = (x, z, kind, ground = PAVING, scale = 1) => {
    const [least, more, trunk, bark, green, turn, crown] = TREES[kind];
    const h = (least + rng() * more) * scale;
    const fork = Y + h * trunk;
    const top = Y + h;
    const a0 = rng() * 6.28;
    // Each tree drops leaves at its own pace.
    const kept = clamp(S.leaf + (rng() - 0.5) * 0.55, 0, 1);
    const leaf = shade(mix3(mix3(hex(green), fresh, S.fresh * 0.5), AUTUMN[(turn + (rng() < 0.3 ? 1 : 0)) % 4], clamp(S.turn + (rng() - 0.5) * 0.5, 0, 1)), 0.12);
    const wide = 0.25 + h * 0.02;
    m.blot(x, Y + 0.3, z, h * 0.2 + 1, ground);
    m.post(x, Y, z, wide, wide, fork + (top - fork) * 0.5, 0.12, 0.12, hex(bark));
    m.seed = rng();
    if (kind === 'pine') {
      // Three cone skirts.
      for (let i = 0; i < 3; i += 1) {
        const y0 = fork + (top - fork) * i * 0.3;
        m.wall(circle(x, z, h * (0.2 - 0.045 * i), 7, a0), y0, circle(x, z, 0.05, 7, a0), y0 + (top - fork) * 0.44, hex(green), () => K.leaf);
      }
      return;
    }
    if (kept > 0.34) {
      for (const [off, up, r, tall] of crown) m.lobe(x + Math.cos(a0) * off * h, fork + (top - fork) * up, z + Math.sin(a0) * off * h, r * h, tall, leaf);
      return;
    }
    // Bare: forked boughs, last leaves at the tips.
    const twig = mix3(hex(bark), hex('#8a7480'), 0.5);
    const lean = kind === 'poplar' ? 0.18 : kind === 'birch' ? 0.45 : 0.85;
    for (let i = -2; i <= 2; i += 1) {
      const b = i * 0.42 * lean;
      const l = (top - fork) * (1 - 0.12 * Math.abs(i));
      const a = a0 + (i & 1) * 1.57;
      const at = (ang, len) => [x + Math.cos(a) * Math.sin(ang) * len, fork + Math.cos(ang) * len, z + Math.sin(a) * Math.sin(ang) * len];
      const tip = at(b, l * 0.62);
      m.line([x, fork - h * 0.06, z], tip, hex(bark));
      for (const t of [-0.3, 0.26]) m.line(tip, at(b + t * lean, l), twig);
      if (fine() < kept * 2.2) m.lobe(...at(b + 0.26 * lean, l * 0.95), h * 0.055, 1, leaf);
    }
  };

  // A pollarded willow: short trunk, a burst of shoots.
  const willow = (x, z, ground) => {
    const top = Y + 2.5 + rng();
    const bark = hex('#5a4d41');
    const shoot = mix3(hex('#8f9a5c'), hex('#b0763a'), S.turn);
    m.blot(x, Y + 0.3, z, 3, ground);
    m.post(x, Y, z, 1.1, 1.1, top, 0.8, 0.8, bark);
    m.box(x, top - 0.2, z, 1.5, 0.9, 1.5, bark);
    for (let k = 0; k < 22; k += 1) {
      const a = rng() * 6.28;
      const l = 2.4 + rng() * 2.4;
      const lean = 0.08 + rng() * 0.3;
      m.line([x, top + 0.5, z], [x + Math.cos(a) * l * lean, top + 0.5 + l, z + Math.sin(a) * l * lean], shade(shoot, 0.2));
    }
    m.seed = rng();
    if (S.leaf > 0.25) m.lobe(x, top + 2.6, z, 2.9, 0.85, hex('#8a9a66'));
  };

  const hedge = (x0, z0, x1, z1, tall) => {
    m.ao = FOOT;
    m.seed = rng();
    m.box((x0 + x1) / 2, Y, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0), tall, 1.4, mix3(hex('#4d6a44'), AUTUMN[2], S.turn * 0.8), { yaw: Math.atan2(z1 - z0, x1 - x0), kind: K.leaf });
    m.ao = FREE;
  };

  const turf = (x0, z0, x1, z1, col) => {
    m.quad([x0, Y + 0.15, z0], [x1, Y + 0.15, z0], [x1, Y + 0.15, z1], [x0, Y + 0.15, z1], col, K.leaf, ZERO, BELOW);
  };

  for (const [a, b, back, front] of PARKS) {
    const z = coastZ((a + b) / 2);
    turf(a, z - back, b, z - front, grass);
    hedge(a, z - front, b, z - front, 1.3);
    // Clumps with lawn between.
    for (let g = 0; g < (b - a) / 26; g += 1) {
      const gx = a + 12 + rng() * (b - a - 24);
      const gz = z - front - 10 - rng() * (back - front - 20);
      const kind = pick(['lime', 'oak', 'birch', 'maple', 'pine']);
      for (let i = 0; i < 2 + rng() * 4; i += 1) tree(gx + (rng() - 0.5) * 22, gz + (rng() - 0.5) * 18, rng() < 0.7 ? kind : 'birch', grass);
      m.lobe(gx + 9, Y + 1, gz + 6, 1.6 + rng(), 0.8, hex('#4a6646'));
    }
  }
  // Along the water: avenue, grove, willows, hedge with birches, or quay.
  for (let x = -1500; x < 1400;) {
    const len = 60 + rng() * 80;
    const what = rng();
    const row = (xx, back) => [xx, coastZ(xx) - back];
    const plant = (xx, back, fn) => {
      const [px, pz] = row(xx, back);
      if (free(px, pz, 5)) fn(px, pz);
    };
    if (what < 0.3) {
      for (let t = x + 6; t < x + len - 6; t += 12.5) plant(t, 20.5, (px, pz) => tree(px, pz, 'lime', stone, 0.85));
    } else if (what < 0.56) {
      const kinds = [pick(['birch', 'oak', 'maple']), pick(['birch', 'pine', 'lime'])];
      for (let i = 0; i < 3 + rng() * 5; i += 1) plant(x + len * (0.15 + 0.7 * rng()), 16 + rng() * 9, (px, pz) => tree(px, pz, pick(kinds), stone));
    } else if (what < 0.7) {
      for (let t = x + 5; t < x + len - 5; t += 8.5) plant(t, 18.5, (px, pz) => willow(px, pz, stone));
    } else if (what < 0.86) {
      hedge(...row(x + 4, 24.5), ...row(x + len - 4, 24.5), 1.5);
      for (let i = 0; i < 3; i += 1) plant(x + len * (0.2 + 0.3 * i) + rng() * 8, 19, (px, pz) => tree(px, pz, 'birch', stone));
    } else if (rng() < 0.5) plant(x + len / 2, 20, (px, pz) => tree(px, pz, 'poplar', stone));
    x += len;
  }
  // Courtyard and street trees over the lower roofs.
  for (let i = 0; i < 230; i += 1) {
    const x = -1250 + rng() * 2500;
    const z = coastZ(x) - 40 - rng() * 520;
    const kind = pick(['lime', 'lime', 'maple', 'birch', 'oak']);
    if (free(x, z, 4.5)) tree(x, z, kind, PAVING, 0.8);
  }
  // Ribersborg: sand into the water, marram on it, reeds in the shallows.
  const sand = hex('#d9caa2');
  const reed = mix3(hex('#7d9550'), hex('#c4a35c'), S.turn);
  for (const [xa, xb] of [[-1500, QUAY[0]], [QUAY[1], 1080]]) {
    for (const [x0, x1] of shore(xa, xb)) {
      const z0 = coastZ(x0);
      const z1 = coastZ(x1);
      m.quad([x0, Y + 0.12, z0 - 26], [x1, Y + 0.12, z1 - 26], [x1, Y + 0.12, z1 - 9], [x0, Y + 0.12, z0 - 9], grass, K.leaf, ZERO, BELOW);
      m.quad([x0, Y + 0.12, z0 - 9], [x1, Y + 0.12, z1 - 9], [x1, Y + 0.12, z1], [x0, Y + 0.12, z0], sand, K.plain, ZERO, BELOW);
      m.quad([x0, Y + 0.12, z0], [x1, Y + 0.12, z1], [x1, -0.3, z1 + 11], [x0, -0.3, z0 + 11], sand, K.plain, ZERO, BELOW);
    }
    for (let x = xa + 2; x < xb - 2; x += 0.5 + rng() * 1.1) {
      // Reeds and marram in beds.
      const bed = Math.sin(x * 0.043) + Math.sin(x * 0.117 + 2);
      const z = coastZ(x);
      if (bed > 0.2) {
        const out = 10.5 + rng() * 7;
        m.line([x, 0, z + out], [x + (rng() - 0.5) * 0.8, 1.5 + rng() * 1.4, z + out], shade(reed, 0.3));
      } else if (bed < -0.5) {
        const back = 1 + rng() * 9;
        m.line([x, Y + 0.1, z - back], [x + (rng() - 0.5) * 0.7, Y + 0.6 + rng() * 0.6, z - back], shade(mix3(hex('#8ea06a'), hex('#bfae74'), S.turn), 0.3));
      }
    }
  }
  m.seed = 0;
}

// A small boat at rest: cuddy, mast, furled sail or open well.
function boat(m, x, z, yaw, L, B, hull, rigged) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (a, b) => [x + a * c - b * s, z + a * s + b * c];
  const ring = (k) => [[-0.5, -0.36], [-0.5, 0.36], [0.1, 0.5], [0.5, 0], [0.1, -0.5]].map(([a, b]) => at(a * L * (0.9 + 0.1 * k), b * B * k));
  const wood = hex('#b08a5e');
  m.ao = [0.5, 1];
  m.wall(ring(0.72), -0.2, ring(1), 0.8, hull);
  m.ao = FREE;
  m.wall(ring(1), 0.8, ring(1.03), 1, hex('#27344a'));
  m.cap(ring(1.03), 1, wood);
  if (rigged) {
    const [cx, cz] = at(L * 0.04, 0);
    m.seed = 0.3;
    m.box(cx, 1, cz, L * 0.36, 0.75, B * 0.62, WHITE, { yaw, kind: K.train, v: [0, 1], roof: hex('#dcd8cc') });
    const [mx, mz] = at(L * 0.16, 0);
    const [bx, bz] = at(-L * 0.36, 0);
    const [fx, fz] = at(L * 0.5, 0);
    const head = [mx, 1 + L * 1.3, mz];
    m.line([mx, 1, mz], head, hex('#c9c4b8'));
    m.line([mx, 2.5, mz], [bx, 2.5, bz], hex('#c9c4b8'));
    m.line(head, [fx, 1, fz], IRON);
    m.line(head, [bx, 1, bz], IRON);
    const [sx, sz] = at(-L * 0.1, 0);
    m.box(sx, 2.5, sz, L * 0.46, 0.45, 0.45, hex('#3f5f8e'), { yaw });
  } else {
    const [wx, wz] = at(-L * 0.08, 0);
    m.box(wx, 1, wz, L * 0.5, 0.1, B * 0.56, hex('#6f5a44'), { yaw });
    const [ox, oz] = at(-L * 0.52, 0);
    m.box(ox, 0.5, oz, 0.5, 1.1, 0.45, IRON, { yaw });
  }
}

// A buoy with a lantern.
function buoy(m, x, z, col) {
  m.wall(circle(x, z, 1.2, 6), -0.3, circle(x, z, 0.55, 6), 2.7, col);
  m.cap(circle(x, z, 0.55, 6), 2.7, col);
  m.line([x, 2.7, z], [x, 4, z], IRON);
  m.light(x, 4, z, 0.7, col, 0.1, 1);
}

// The harbour light west of the pier.
const LIGHT = [-250, 152];

// The bathing pier, from the tower's foot out left.
const PIER = [-22, 108, -121, 413];
const PIER_L = Math.hypot(PIER[2] - PIER[0], PIER[3] - PIER[1]);
// A point `s` m in from the head, `off` west of centre.
const pierAt = (s, off) => {
  const d = [(PIER[2] - PIER[0]) / PIER_L, (PIER[3] - PIER[1]) / PIER_L];
  return [PIER[2] - d[0] * s - d[1] * off, PIER[3] - d[1] * s + d[0] * off];
};
// Pier head: flagpole and height, two gull perches.
const FLAG = pierAt(-2, -4.4);
const FLAG_TOP = 6.4;
const PERCH = [pierAt(9, 1.8), pierAt(214, 1.8)];

// The pier, and boats to measure the far shore against.
function buildPier(m) {
  const L = PIER_L;
  const yaw = Math.atan2(PIER[3] - PIER[1], PIER[2] - PIER[0]);
  const at = pierAt;
  const wood = hex('#b39672');
  const side = hex('#7d6850');
  const pile = hex('#4d4038');
  const T = 1.5;
  const deck = (s0, s1, w) => {
    const [cx, cz] = at((s0 + s1) / 2, 0);
    m.box(cx, T - 0.45, cz, s1 - s0, 0.45, w * 2, side, { yaw });
    const [a, b, c, e] = [at(s0, -w), at(s1, -w), at(s1, w), at(s0, w)];
    m.quad([a[0], T + 0.03, a[1]], [b[0], T + 0.03, b[1]], [c[0], T + 0.03, c[1]], [e[0], T + 0.03, e[1]], wood, K.deck, [s0, -w, s1, w], BELOW);
    for (let t = s0 + 1; t < s1; t += 7.5) {
      for (const off of [-w + 0.3, w - 0.3]) {
        const [px, pz] = at(t, off);
        m.ao = [0.4, 0.8];
        m.post(px, -0.5, pz, 0.42, 0.42, T - 0.45, 0.42, 0.42, pile);
      }
    }
    m.ao = FREE;
  };
  deck(0, L, 1.9);
  deck(-9, 0, 5);
  // A rail down the west side, lamps down the east over the deck's pools.
  const [r0, r1] = [at(0, 1.8), at(L, 1.8)];
  for (const y of [T + 0.55, T + 1.05]) m.line([r0[0], y, r0[1]], [r1[0], y, r1[1]], IRON);
  for (let t = 0; t <= L; t += 3.8) {
    const [px, pz] = at(t, 1.8);
    m.line([px, T, pz], [px, T + 1.05, pz], IRON);
  }
  for (let t = 19; t < L; t += 38) {
    const [px, pz] = at(t, -1.6);
    m.line([px, T, pz], [px, T + 4.6, pz], IRON);
    m.light(px, T + 4.6, pz, 0.45, WARM, 0, 1);
  }
  // On the platform: bench, lifebuoy, bollards, ladder, light.
  const [bx, bz] = at(-4.5, 3.6);
  m.box(bx, T, bz, 3, 0.5, 0.7, side, { yaw });
  const [lx, lz] = at(-8.4, 3.8);
  m.line([lx, T, lz], [lx, T + 1.6, lz], IRON);
  m.box(lx, T + 1.1, lz, 0.6, 0.6, 0.2, hex('#e8542e'), { yaw });
  for (const t of [-1.5, -7.5]) {
    const [px, pz] = at(t, -4.6);
    m.post(px, T, pz, 0.5, 0.5, T + 0.7, 0.36, 0.36, IRON);
  }
  const [hx, hz] = at(-8.2, -4.2);
  m.post(hx, T, hz, 0.34, 0.34, T + 2.6, 0.22, 0.22, WHITE);
  m.light(hx, T + 2.6, hz, 0.36, hex('#48e07a'), 0.25, 1);
  m.line([FLAG[0], T, FLAG[1]], [FLAG[0], FLAG_TOP, FLAG[1]], WHITE);
  boat(m, ...at(-3.5, -7), yaw + Math.PI, 5.6, 2.1, hex('#3f6f6b'), false);
  boat(m, ...at(44, 5), yaw + Math.PI, 7.4, 2.6, WHITE, true);
  boat(m, ...at(96, -3.6), yaw, 5.2, 1.9, hex('#b8452f'), false);
  // West of the pier: a yacht and old timber dolphins.
  boat(m, -150, 300, rad(150), 9, 2.9, hex('#27344a'), true);
  for (let i = 0; i < 4; i += 1) m.post(-170 + i * 13, -0.5, 190 - i * 9, 0.7, 0.7, 2.6 - (i % 2) * 0.5, 0.55, 0.55, hex('#4d4038'));
  // By the bathhouse: a yacht, buoys.
  boat(m, 418, 384, rad(205), 8.6, 2.8, WHITE, true);
  for (let i = 0; i < 4; i += 1) m.box(398 - i * 15, -0.2, 366 + i * 5, 0.9, 0.8, 0.9, hex('#e9b93a'));
  // White, red band, red cap.
  const [ox, oz] = LIGHT;
  const red = hex('#c4412f');
  const round = (r) => circle(ox, oz, r, 8);
  m.box(ox, -0.5, (coastZ(ox) + oz) / 2, 6, 2.3, oz - coastZ(ox) + 9, hex('#9a958a'));
  m.ao = FOOT;
  m.wall(round(2.7), 1.8, round(2.2), 7, WHITE);
  m.ao = FREE;
  m.wall(round(2.2), 7, round(2), 9.6, red);
  m.wall(round(2), 9.6, round(1.8), 13, WHITE);
  m.box(ox, 13, oz, 5, 0.4, 5, IRON);
  m.light(ox, 13.4, oz, 1.7, WARM, 0.15, 1);
  m.wall(round(1.6), 15.1, round(0.1), 17, red);
  // Toward the bridge, the fairway's marks and fishing boats.
  for (const [cx, cz, yawDeg, far] of [[20, 480, 16, 190], [250, 640, 54, 170]]) {
    const f = [Math.sin(rad(yawDeg)), -Math.cos(rad(yawDeg))];
    const p = (ahead, right) => [cx + f[0] * ahead - f[1] * right, cz + f[1] * ahead + f[0] * right];
    buoy(m, ...p(far, -26), hex('#d2452f'));
    buoy(m, ...p(far + 110, 30), hex('#3f8a55'));
    boat(m, ...p(far + 50, 12), rad(yawDeg + 70), 7.5, 2.7, hex('#2f5f9e'), false);
  }
  m.seed = 0;
}

// Ribersborgs Kallbadhus, pale green on piles.
const BATH = [300, 262];
function buildKallbadhus(m) {
  const [X, Z] = BATH;
  const deck = hex('#ab9270');
  const pile = hex('#4d4038');
  const green = hex('#b9d6c0');
  const trim = hex('#f1efe4');
  const roof = hex('#4f6f6b');
  const root = coastZ(X) + 7;
  const span = Z - 26 - root;
  m.box(X, 1.7, root + span / 2, 4.4, 0.5, span, deck);
  for (let z = root + 6; z < Z - 26; z += 11) {
    m.line([X - 1.9, 0, z], [X - 1.9, 1.8, z], pile);
    m.line([X + 1.9, 0, z], [X + 1.9, 1.8, z], pile);
  }
  for (let z = root + 16; z < Z - 30; z += 33) {
    m.line([X + 2, 2.2, z], [X + 2, 6.4, z], pile);
    m.light(X + 2, 6.4, z, 0.9, WARM, 0, 1);
  }
  m.box(X, 1.5, Z, 66, 0.7, 50, deck);
  for (let x = -30; x <= 30; x += 12) {
    for (const z of [-24, 0, 24]) m.line([X + x, 0, Z + z], [X + x, 1.6, Z + z], pile);
  }
  // Wings, pavilion, corner towers.
  const wing = (dx, dz, w, d) => {
    m.seed = 0.5 + (dx + dz + 90) / 720;
    m.ao = FOOT;
    m.box(X + dx, 2.2, Z + dz, w, 4.2, d, green, { kind: K.block });
    m.ao = FREE;
    m.box(X + dx, 6.4, Z + dz, w + 0.8, 0.5, d + 0.8, trim);
    m.post(X + dx, 6.9, Z + dz, w + 1.4, d + 1.4, 9.3, Math.max(0.3, w - d), Math.max(0.3, d - w), roof);
  };
  wing(0, -19, 64, 9);
  wing(-28, 4, 8, 36);
  wing(28, 4, 8, 36);
  m.ao = FOOT;
  m.box(X, 2.2, Z - 19, 15, 7.4, 12, green, { kind: K.block });
  m.ao = FREE;
  m.post(X, 9.6, Z - 19, 17, 14, 14.5, 4, 0.3, roof);
  m.line([X, 14.5, Z - 19], [X, 21, Z - 19], trim);
  m.tri([X, 21, Z - 19], [X + 4.5, 20, Z - 19], [X, 19, Z - 19], hex('#3f6fae'), [0, 0, 1]);
  for (const [dx, dz] of [[-28, -19], [28, -19], [-28, 22], [28, 22]]) {
    m.box(X + dx, 6.4, Z + dz, 7, 2.6, 7, trim);
    m.post(X + dx, 9, Z + dz, 8.4, 8.4, 13, 0.3, 0.3, roof);
  }
  m.light(X, 10.4, Z - 12.6, 1, WARM, 0, 1);
}

// The skyline: Kronprinsen, Malmö Live, St Petri, Hyllie water tower.
function buildSkyline(m) {
  const Y = GROUND;
  m.ao = FOOT;
  // Kronprinsen, paling upward.
  m.seed = 0.08;
  m.box(-200, Y, -990, 104, 9, 56, hex('#cfc9bb'), { kind: K.block });
  ['#2f5f9e', '#3f73b2', '#5a8cc4', '#7aa6d4'].map(hex).forEach((c, i) => {
    m.box(-200, Y + i * 21, -1000, 62, 21, 17, c, { yaw: rad(6), kind: K.office });
    m.ao = FREE;
  });
  // Malmö Live.
  [[130, -842, 24, 85, 20, '#ddd3be'], [158, -820, 22, 54, 30, '#e6dfcf'], [102, -858, 22, 44, 26, '#d2c7b1']].forEach(([x, z, w, h, d, c], i) => {
    m.seed = 0.04 + i * 0.07;
    m.ao = FOOT;
    m.box(x, Y, z, w, h, d, hex(c), { kind: K.block, roof: hex('#8d9499') });
  });
  // St Petri, copper spire.
  m.box(-420, Y, -1700, 14, 52, 14, hex('#9a5a44'));
  m.ao = FREE;
  m.post(-420, Y + 52, -1700, 14, 14, Y + 98, 0.4, 0.4, hex('#6fae98'));
  // Hyllie water tower.
  const ring = (r) => circle(420, -2700, r, 12);
  const w = hex('#eeeae0');
  m.ao = FOOT;
  m.wall(ring(5), Y, ring(3.6), 42, w);
  m.ao = [0.35, 0.9];
  m.wall(ring(3.6), 42, ring(25), 53, w);
  m.ao = FREE;
  m.wall(ring(25), 53, ring(25), 57, w);
  m.wall(ring(25), 57, ring(4), 62, w);
  m.cap(ring(4), 62, w);
  m.light(420, 62, -2700, 2.4, RED, 0.2, 1);
}

// A point on the bridge, and the deck height.
const BR = { x: 1080, z: -420, d: [0.906, 0.423], n: [-0.423, 0.906], LEN: 3300, P0: 620, P1: 1110, W: 11.8, DEPTH: 10 };
BR.yaw = Math.atan2(BR.d[1], BR.d[0]);
const bridgeAt = (s, off = 0) => [BR.x + BR.d[0] * s + BR.n[0] * off, BR.z + BR.d[1] * s + BR.n[1] * off];
const deckY = (s) => {
  const mid = (BR.P0 + BR.P1) / 2;
  const half = (BR.P1 - BR.P0) / 2 + 150;
  if (s < mid - half) return 9 + 53 * smooth(clamp(s / (mid - half), 0, 1));
  if (s > mid + half) return 9 + 53 * smooth(clamp((BR.LEN - s) / (BR.LEN - mid - half), 0, 1));
  return 62 + 2.4 * (1 - ((s - mid) / half) ** 2);
};

// Road on top, railway below, harp stays from four towers.
function buildBridge(m) {
  const { n, LEN, P0, P1, W, DEPTH, yaw } = BR;
  const at = bridgeAt;
  const concrete = hex('#d8d6cc');
  const truss = hex('#7f8894');
  const road = hex('#4a4f58');
  const cable = hex('#eef0ee');
  const STEP = 40;
  for (let s = 0; s < LEN; s += STEP) {
    const a0 = at(s, W);
    const a1 = at(s + STEP, W);
    const b0 = at(s, -W);
    const b1 = at(s + STEP, -W);
    const y0 = deckY(s);
    const y1 = deckY(s + STEP);
    m.quad([a0[0], y0, a0[1]], [a1[0], y1, a1[1]], [b1[0], y1, b1[1]], [b0[0], y0, b0[1]], road, K.road, [s, -W, s + STEP, W], BELOW);
    const below = (y) => y - DEPTH;
    m.quad([a0[0], below(y0), a0[1]], [a1[0], below(y1), a1[1]], [a1[0], y1, a1[1]], [a0[0], y0, a0[1]], truss, K.truss, [s, 0, s + STEP, DEPTH], [(a0[0] + b0[0]) / 2, y0 - 5, (a0[1] + b0[1]) / 2]);
    m.quad([b0[0], below(y0), b0[1]], [b1[0], below(y1), b1[1]], [b1[0], y1, b1[1]], [b0[0], y0, b0[1]], truss, K.truss, [s, 0, s + STEP, DEPTH], [(a0[0] + b0[0]) / 2, y0 - 5, (a0[1] + b0[1]) / 2]);
    m.quad([a0[0], below(y0), a0[1]], [a1[0], below(y1), a1[1]], [b1[0], below(y1), b1[1]], [b0[0], below(y0), b0[1]], truss, K.plain, ZERO, [0, 400, 0]);
  }
  // Piers on the viaducts only.
  for (let s = 70; s < LEN; s += 140) {
    if (s > P0 - 250 && s < P1 + 250 && Math.abs(s - P0) > 30 && Math.abs(s - P1) > 30) continue;
    const [x, z] = at(s);
    m.post(x, 0, z, 8, 20, deckY(s) - DEPTH, 5, 16, concrete, yaw);
    m.box(x, 0, z, 16, 2.5, 30, hex('#b4b2a8'), { yaw });
  }
  // Two pairs of towers.
  const TOP = 204;
  [P0, P1].forEach((s) => {
    [W + 5.5, -W - 5.5].forEach((off) => {
      const [x, z] = at(s, off);
      m.ao = FOOT;
      m.post(x, 0, z, 16, 13, 62, 11, 8.5, concrete, yaw);
      m.ao = FREE;
      m.post(x, 62, z, 11, 8.5, TOP - 12, 7, 5, concrete, yaw);
      m.post(x, TOP - 12, z, 7, 5, TOP, 5.6, 4, concrete, yaw);
      m.light(x, TOP, z, 3, RED, 0.2, 1);
    });
    const [cx, cz] = at(s);
    m.box(cx, 44, cz, 12, 6, 2 * W + 18, concrete, { yaw });
    m.box(cx, 0, cz, 34, 7, 2 * W + 34, hex('#b4b2a8'), { yaw });
    // Harp stays at about 30 degrees.
    const COUNT = 9;
    for (let i = 0; i < COUNT; i += 1) {
      const h = 96 + ((TOP - 8 - 96) * i) / (COUNT - 1);
      const reach = (h - 62) / Math.tan(rad(30));
      [-1, 1].forEach((side) => {
        [W, -W].forEach((off) => {
          const [tx, tz] = at(s, off > 0 ? W + 5.5 : -W - 5.5);
          const s2 = s + side * reach;
          const [fx, fz] = at(s2, off);
          m.line([tx, h, tz], [fx, deckY(s2), fz], cable);
        });
      });
    }
  });
  // Peberholm.
  const sand = hex('#b9b184');
  const green = hex('#7f8f62');
  const LONG = 1900;
  const outline = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    outline.push([t * LONG, 18 + 240 * Math.sin(t ** 0.7 * Math.PI) ** 0.9]);
  }
  for (let i = 0; i < outline.length - 1; i += 1) {
    const [s0, h0] = outline[i];
    const [s1, h1] = outline[i + 1];
    const a0 = at(LEN - 40 + s0, h0);
    const a1 = at(LEN - 40 + s1, h1);
    const b0 = at(LEN - 40 + s0, -h0 * 0.86);
    const b1 = at(LEN - 40 + s1, -h1 * 0.86);
    m.quad([a0[0], 3, a0[1]], [a1[0], 3, a1[1]], [b1[0], 3, b1[1]], [b0[0], 3, b0[1]], i % 3 === 0 ? sand : green, K.plain, ZERO, BELOW);
    m.quad([a0[0], 0, a0[1]], [a1[0], 0, a1[1]], [a1[0], 3, a1[1]], [a0[0], 3, a0[1]], sand, K.plain, ZERO, [a0[0] + n[0] * -999, 0, a0[1] + n[1] * -999]);
    m.quad([b0[0], 0, b0[1]], [b1[0], 0, b1[1]], [b1[0], 3, b1[1]], [b0[0], 3, b0[1]], sand, K.plain, ZERO, [b0[0] + n[0] * 999, 0, b0[1] + n[1] * 999]);
    const r0 = at(LEN - 40 + s0, 10);
    const r1 = at(LEN - 40 + s1, 10);
    const q0 = at(LEN - 40 + s0, -10);
    const q1 = at(LEN - 40 + s1, -10);
    m.quad([r0[0], 3.2, r0[1]], [r1[0], 3.2, r1[1]], [q1[0], 3.2, q1[1]], [q0[0], 3.2, q0[1]], road, K.plain, ZERO, BELOW);
  }
  // Denmark, Copenhagen low on it.
  const rng = rngFrom(9311);
  const far = LEN + LONG + 1400;
  const c0 = at(far, 7000);
  const c1 = at(far, -7000);
  const c2 = at(far + 7000, -7000);
  const c3 = at(far + 7000, 7000);
  m.quad([c0[0], 3, c0[1]], [c1[0], 3, c1[1]], [c2[0], 3, c2[1]], [c3[0], 3, c3[1]], hex('#8f9c7a'), K.plain, ZERO, BELOW);
  m.quad([c0[0], 0, c0[1]], [c1[0], 0, c1[1]], [c1[0], 3, c1[1]], [c0[0], 3, c0[1]], hex('#8f9c7a'), K.plain, ZERO, [c2[0], 0, c2[1]]);
  for (let i = 0; i < 110; i += 1) {
    const [x, z] = at(far + 80 + rng() * 1800, -4200 + rng() * 8000);
    m.seed = rng();
    m.box(x, 3, z, 40 + rng() * 60, 16 + rng() * rng() * 80, 40 + rng() * 40, hex('#9aa2b2'), { yaw, kind: K.block });
  }
  m.seed = 0;
}

// Lillgrund's turbines; the blades are movers.
const HUB = 88;
const BLADE = 56;
const TURBINES = (() => {
  const r = rngFrom(271);
  return Array.from({ length: 12 }, (_, i) => [...bridgeAt([1500, 900, 1100][i >> 2] + (i & 3) * 380, [-520, -1000, -1500][i >> 2]), r() * 6.28]);
})();
function buildTurbines(m) {
  for (const [x, z] of TURBINES) {
    m.ao = FOOT;
    m.wall(circle(x, z, 2.6, 6), 0, circle(x, z, 1.5, 6), HUB, WHITE);
    m.ao = FREE;
    m.line([x, 0, z], [x, HUB, z], WHITE);
    m.box(x - 1, HUB - 1.6, z, 9, 3.4, 3.4, WHITE);
  }
}

/* ------------------------------------------------------------------ Movers */

const CARS = (() => {
  const r = rngFrom(733);
  const paint = ['#d8d8d4', '#2c3038', '#8e2f2a', '#3f5f8e', '#b9b9b2', '#e9e5d6', '#55606a'].map(hex);
  return Array.from({ length: 46 }, () => ({ s: r() * BR.LEN, dir: r() < 0.5 ? 1 : -1, lane: r() < 0.4 ? 2.6 : 6.6, v: 23 + r() * 9, col: paint[Math.floor(r() * paint.length)], long: r() < 0.16 }));
})();
// Sailboats: centre, radii, turn rate, phase, sail colour.
const BOATS = [[-150, 240, 50, 20, 0.05, 0.6, '#f6f1e2'], [130, 260, 80, 26, -0.04, 2, '#f6f1e2'], [360, 345, 110, 34, 0.035, 4, '#e2573f'], [700, 238, 160, 60, 0.02, 1, '#f6f1e2'], [1228, 114, 220, 80, -0.016, 3, '#f2c14e']];
const GULLS = (() => {
  const r = rngFrom(5521);
  const head = pierAt(150, 0);
  const span = bridgeAt(700, 150);
  const homes = [[head[0], 24, head[1]], [BATH[0], 22, BATH[1] + 20], [400, 30, 520], [span[0], 44, span[1]]];
  return homes.flatMap((home) => Array.from({ length: 6 }, () => ({ home, R: 12 + r() * 34, sp: (0.22 + r() * 0.3) * (r() < 0.5 ? 1 : -1), ph: r() * 6.28, up: r() * 14 - 4 })));
})();

// On the promenade: phase, m/s, metres from the edge, jacket; the fast two ride.
const PEOPLE = [[0.1, 5.2, 8.5, '#c4553f'], [0.62, 4.4, 9.8, '#3f73b2'], [0.3, 1.3, 4, '#e8e2d2'], [0.8, 1.1, 5.4, '#27344a']].map((p) => [...p.slice(0, 3), hex(p[3])]);
const SKIN = hex('#e3b596');
const FLAG_BLUE = hex('#1f5fa8');
const FLAG_GOLD = hex('#f2c230');

// A bird at p along dir, wings up `flap` radians; a gull by default.
function bird(m, p, dir, flap, s = 1, col = WHITE) {
  const nose = [p[0] + dir[0] * 0.5 * s, p[1], p[2] + dir[2] * 0.5 * s];
  const tail = [p[0] - dir[0] * 0.5 * s, p[1], p[2] - dir[2] * 0.5 * s];
  for (const side of [1, -1]) {
    const tip = [p[0] + dir[2] * side * 0.95 * s * Math.cos(flap), p[1] + 0.95 * s * Math.sin(flap), p[2] - dir[0] * side * 0.95 * s * Math.cos(flap)];
    m.tri(nose, tip, tail, col);
  }
}

// Occasional traffic, once the weather's module brings it.
let traffic = null;
export { bird, bridgeAt, BR, hex, norm, WHITE, RED, IRON, K, ZERO, BELOW };

// What moves at t seconds; `still` draws only the blades. `skein`: geese south-west 1, back -1, none 0.
function buildMovers(m, t, night, still, skein) {
  for (const [x, z, ph] of TURBINES) {
    for (let k = 0; k < 3; k += 1) {
      const a = ph + (still ? 0 : t * 1.05) + (k * 2 * Math.PI) / 3;
      m.line([x - 5.6, HUB, z], [x - 5.6, HUB + Math.sin(a) * BLADE, z + Math.cos(a) * BLADE], WHITE);
    }
  }
  if (still) return;
  const lamps = night > 0.2;
  const { LEN, DEPTH, yaw } = BR;

  // The train on the lower deck, three cars each way.
  const lap = LEN + 900;
  for (const [ph, off, dir, v] of [[0.3, 3.2, 1, 38], [0.8, -3.2, -1, 34]]) {
    const run = ((t * v + ph * lap) % lap) - 200;
    for (let c = 0; c < 3; c += 1) {
      const s = dir > 0 ? run - c * 27 : LEN - run + c * 27;
      if (s < 0 || s > LEN) continue;
      const [x, z] = bridgeAt(s, off);
      const y = deckY(s) - DEPTH + 0.8;
      m.box(x, y, z, 26, 4.4, 3.2, hex('#e4e6e2'), { yaw, kind: K.train, v: [0, 1], roof: hex('#8d9499') });
      if (c === 0) {
        const [hx, hz] = bridgeAt(s + dir * 13.4, off);
        m.light(hx, y + 1.2, hz, 1.3, WHITE, 0.6, 1);
      }
    }
  }
  // Traffic, lit after dark.
  for (const c of CARS) {
    const s = (((c.s + c.dir * c.v * t) % LEN) + LEN) % LEN;
    const len = c.long ? 13 : 4.6;
    const [x, z] = bridgeAt(s, c.dir * c.lane);
    const y = deckY(s) + 0.15;
    m.box(x, y, z, len, c.long ? 3.5 : 1.5, 2.1, c.col, { yaw });
    if (lamps) {
      const [fx, fz] = bridgeAt(s + c.dir * len * 0.5, c.dir * c.lane);
      const [bx, bz] = bridgeAt(s - c.dir * len * 0.5, c.dir * c.lane);
      m.light(fx, y + 0.4, fz, 1.1, WHITE, 0, 1);
      m.light(bx, y + 0.4, bz, 1, RED, 0, 0.9);
    }
  }
  // Sailboats.
  for (const [cx, cz, rx, rz, w, ph, sail] of BOATS) {
    const a = ph + t * w;
    const x = cx + Math.cos(a) * rx;
    const z = cz + Math.sin(a) * rz;
    const dir = norm([-Math.sin(a) * rx * Math.sign(w), 0, Math.cos(a) * rz * Math.sign(w)]);
    const y = 0.5 + 0.2 * Math.sin(t * 1.3 + ph);
    m.box(x, y - 0.5, z, 8.4, 1.4, 2.5, WHITE, { yaw: Math.atan2(dir[2], dir[0]) });
    const foot = [x + dir[0] * 0.6, y + 0.9, z + dir[2] * 0.6];
    const head = [foot[0], y + 12, foot[2]];
    const side = [dir[2], 0.2, -dir[0]];
    m.tri(foot, head, [x - dir[0] * 4, y + 1.6, z - dir[2] * 4], hex(sail), side);
    m.tri([foot[0], y + 10, foot[2]], [x + dir[0] * 4.3, y + 0.9, z + dir[2] * 4.3], [foot[0] + dir[0] * 0.4, y + 1.2, foot[2] + dir[2] * 0.4], hex(sail), side);
    m.line(foot, head, hex('#5d4a3c'));
    if (lamps) m.light(head[0], head[1], head[2], 0.7, WHITE, 0, 0.8);
  }
  // Gulls circling, flapping in bursts.
  for (const g of GULLS) {
    const a = g.ph + t * g.sp;
    const p = [g.home[0] + Math.cos(a) * g.R, g.home[1] + g.up + Math.sin(a * 1.7 + g.ph) * 4, g.home[2] + Math.sin(a) * g.R * 0.6];
    const dir = norm([-Math.sin(a) * Math.sign(g.sp), 0, Math.cos(a) * 0.6 * Math.sign(g.sp)]);
    bird(m, p, dir, Math.sin(t * 9 + g.ph * 5) * (Math.sin(t * 0.5 + g.ph) > 0.2 ? 0.75 : 0.12) + 0.15);
  }
  // The harbour light flashes.
  if (lamps) m.light(LIGHT[0], 13.2, LIGHT[1], 2.1, WHITE, 0, Math.max(0, Math.sin(t * 1.1)) ** 8);
  // Two gulls on the rail sometimes circle out and land again.
  PERCH.forEach(([x, z], i) => {
    const u = ((t / 17 + i * 0.43) % 1) * 2.6 - 1.6;
    if (u < 0) {
      m.box(x, 2.55, z, 0.52, 0.3, 0.26, WHITE);
      m.box(x + 0.22, 2.8, z, 0.17, 0.17, 0.17, WHITE);
      return;
    }
    const a = u * 2 * Math.PI;
    const R = 16 + i * 7;
    bird(m, [x + Math.sin(a) * R, 2.8 + (1 - Math.cos(a)) * 4, z + (1 - Math.cos(a)) * R * 0.5], norm([Math.cos(a), 0, Math.sin(a) * 0.5]), Math.sin(t * 9 + i) * 0.7 + 0.15);
  });
  // The flag, streaming in a west wind.
  for (let k = 0; k < 4; k += 1) {
    const at = (j) => [FLAG[0] + j * 0.5, FLAG_TOP - 0.03 * j * j, FLAG[1] + Math.sin(t * 3.4 - j * 1.3) * 0.09 * j];
    const [x0, y0, z0] = at(k);
    const [x1, y1, z1] = at(k + 1);
    [[0, 0.5], [0.5, 0.75], [0.75, 1.25]].forEach(([high, low], band) => {
      m.quad([x0, y0 - low, z0], [x1, y1 - low, z1], [x1, y1 - high, z1], [x0, y0 - high, z0], k === 1 || band === 1 ? FLAG_GOLD : FLAG_BLUE, K.plain, ZERO, [x0, y0, z0 - 50]);
    });
  }
  // Two cyclists and two walkers on the promenade.
  const span = QUAY[1] - QUAY[0] - 60;
  for (const [ph, v, off, col] of PEOPLE) {
    const u = (t * v + ph * span * 2) % (span * 2);
    const way = u < span ? 1 : -1;
    const x = QUAY[0] + 30 + (way > 0 ? u : span * 2 - u);
    const z = coastZ(x) - off;
    const turn = Math.atan2(coastZ(x + 1) - coastZ(x), 1);
    const y = GROUND + 0.05;
    const rides = v > 2;
    if (rides) m.box(x, y, z, 1.8, 0.7, 0.16, IRON, { yaw: turn });
    m.box(x, y + (rides ? 0.6 : 0), z, 0.5, rides ? 1 : 1.35 + 0.06 * Math.sin(t * 7 + ph * 9), 0.5, col, { yaw: turn });
    m.box(x + (rides ? way * 0.2 : 0), y + (rides ? 1.6 : 1.4), z, 0.32, 0.32, 0.32, SKIN, { yaw: turn });
    if (rides && lamps) m.light(x + way, y + 0.9, z, 0.3, WHITE, 0, 1);
  }
  // The crown's aviation light.
  if (lamps) m.light(0, 190.5, 0, 1.5, RED, 0, 0.6 + 0.4 * Math.sin(t * 2.2));
  traffic?.(m, t, lamps, skein);
}

/* ------------------------------------------------------------ Camera stops */

// One stop per page: position, heading in degrees, `wide` for landscape (a longer lens); east, tower to bridge.
const STOPS = [
  { pos: [-48, 8, 410], yaw: 0, wide: { pos: [-60, 12, 575], yaw: -4.7 } },
  { pos: [20, 8.5, 480], yaw: 16, wide: { pos: [-10, 12, 600], yaw: 16 } },
  { pos: [83, 9, 560], yaw: 34, wide: { pos: [40, 12, 625], yaw: 38 } },
  { pos: [250, 10, 640], yaw: 54, wide: { pos: [90, 12, 650], yaw: 60 } },
];
const LENS = [52, 30]; // Field of view in degrees, upright and wide.
const TOWER = 190;
const DARK = -0.11; // The sine of the sun's height at which the sky is dark enough for the moon's glow to take over.
const MOON = [0.62, 0.7, 0.95];
const BOUNCE = [0.12, 0.1, 0.09]; // What the lit ground throws back into the shade, a little warm.

// The path for a window `ui` covered below: cubic splines through the stops, the horizon above the cover, the lens
// wider if the tower lacks sky.
function pathFor(aspect, ui) {
  const w = smooth(clamp((aspect - 0.62) / 0.98, 0, 1));
  const n = STOPS.length;
  const knots = new Float64Array(n * 4);
  const bend = new Float64Array(n * 4);
  STOPS.forEach((s, i) => {
    for (let c = 0; c < 3; c += 1) knots[i * 4 + c] = s.pos[c] + (s.wide.pos[c] - s.pos[c]) * w;
    knots[i * 4 + 3] = rad(s.yaw + (s.wide.yaw - s.yaw) * w);
  });
  for (let c = 0; c < 4; c += 1) {
    const y = (i) => knots[i * 4 + c];
    const a = 6 * (y(0) - 2 * y(1) + y(2));
    const b = 6 * (y(1) - 2 * y(2) + y(3));
    bend[4 + c] = (4 * a - b) / 15;
    bend[8 + c] = (4 * b - a) / 15;
  }
  const horizon = clamp(1 - ui - 0.065, 0.5, 0.63 + 0.09 * w);
  const tan = Math.tan(rad(LENS[0] + (LENS[1] - LENS[0]) * w) / 2);
  const tall = TOWER / (2 * tan * Math.hypot(knots[0], knots[2]));
  return { knots, bend, shift: 1 - 2 * horizon, fl: Math.min(1, (horizon - 0.125) / tall) / tan };
}

const newView = () => ({ pos: [0, 0, 0], yaw: 0, fl: 1, shift: 0, f: [0, 0, -1], r: [1, 0, 0] });

// The camera at page `p`; `lean` shifts it a few metres.
function viewAt(path, p, lean, out) {
  const i = clamp(Math.floor(p), 0, STOPS.length - 2);
  const t = clamp(p - i, 0, 1);
  const u = 1 - t;
  const { knots, bend } = path;
  const a = (u * u * u - u) / 6;
  const b = (t * t * t - t) / 6;
  const k = i * 4;
  const yaw = knots[k + 3] * u + knots[k + 7] * t + a * bend[k + 3] + b * bend[k + 7];
  const side = lean[0] * 5;
  out.yaw = yaw;
  out.fl = path.fl;
  out.shift = path.shift;
  out.f[0] = Math.sin(yaw); out.f[2] = -Math.cos(yaw);
  out.r[0] = Math.cos(yaw); out.r[2] = Math.sin(yaw);
  out.pos[0] = knots[k] * u + knots[k + 4] * t + a * bend[k] + b * bend[k + 4] + out.r[0] * side;
  out.pos[1] = knots[k + 1] * u + knots[k + 5] * t + a * bend[k + 1] + b * bend[k + 5] - lean[1] * 1.5;
  out.pos[2] = knots[k + 2] * u + knots[k + 6] * t + a * bend[k + 2] + b * bend[k + 6] + out.r[2] * side;
  return out;
}

/* ----------------------------------------------------------------- Matrices */

const multiply = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3];
    }
  }
  return o;
};

// The camera looks level, the lens shift sets the horizon; projection times view into `o`.
function cameraMatrix(view, aspect, o) {
  const { f, r, pos, fl, shift } = view;
  const fp = f[0] * pos[0] + f[2] * pos[2];
  const A = (FAR + NEAR) / (NEAR - FAR);
  const sx = fl / aspect;
  o[0] = sx * r[0]; o[4] = 0; o[8] = sx * r[2]; o[12] = -sx * (r[0] * pos[0] + r[2] * pos[2]);
  o[1] = shift * f[0]; o[5] = fl; o[9] = shift * f[2]; o[13] = -fl * pos[1] - shift * fp;
  o[2] = -A * f[0]; o[6] = 0; o[10] = -A * f[2]; o[14] = A * fp + (2 * FAR * NEAR) / (NEAR - FAR);
  o[3] = f[0]; o[7] = 0; o[11] = f[2]; o[15] = -fp;
  return o;
}

function lightMatrix(sun, center, radius) {
  const eye = [center[0] + sun[0] * 3200, center[1] + sun[1] * 3200, center[2] + sun[2] * 3200];
  const f = norm(sub(center, eye));
  const r = norm(cross(f, Math.abs(f[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0]));
  const u = cross(r, f);
  const V = new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1]);
  const n = 10;
  const fa = 7000;
  const O = new Float32Array([1 / radius, 0, 0, 0, 0, 1 / radius, 0, 0, 0, 0, -2 / (fa - n), 0, 0, 0, -(fa + n) / (fa - n), 1]);
  return multiply(O, V);
}

/* ------------------------------------------------------------------ Shaders */

const SCENE_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in vec3 aF; layout(location=4) in vec2 aA;
uniform mat4 uVP; uniform float uMirror;
out vec3 vP; out vec3 vN; out vec3 vC; out vec3 vF; out vec2 vA;
void main(){ vP=aP; vN=aN; vC=aC; vF=aF; vA=aA; vec3 p=aP; p.y*=uMirror; gl_Position=uVP*vec4(p,1.); }`;

// Alpha tells the pixel: 0.25 a thin line, 0.5 a surface, up to 1 glowing.
const SCENE_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vP; in vec3 vN; in vec3 vC; in vec3 vF; in vec2 vA; out vec4 o;
uniform vec3 uSun,uKey,uAmb,uGnd,uBnc,uHorizon,uSkyC,uZen,uCam,uRim,uRimDir; uniform float uWin,uNight,uFog,uTag,uPix,uMirror,uSnow,uWet;
uniform sampler2DShadow uShadow; uniform mat4 uLight;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float tap(vec3 c,float x,float y){ return texture(uShadow,vec3(c.xy+vec2(x,y)*.0017,c.z)); }
float shadowAt(){
  vec4 q=uLight*vec4(vP+vN*.7,1.); vec3 c=q.xyz*.5+.5;
  if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.;
  c.z-=.00015;
  return (tap(c,-.94,-.34)+tap(c,.34,-.94)+tap(c,.94,.34)+tap(c,-.34,.94))*.25;
}
vec3 warm(float h){ return h<.34?vec3(1.,.76,.44):h<.58?vec3(1.,.88,.62):h<.76?vec3(1.,.66,.36):h<.9?vec3(.97,.93,.82):vec3(.68,.84,1.); }
// Windows keep to whole art pixels: the grid doubles when small.
float lodOf(float d,float h){ float c=h/(d*uPix); return c>2.2?1.:c>1.1?2.:c>.55?4.:0.; }
float flash=0.;
// A pane by day: the sky it faces, flashing the sun back.
vec3 glass(float hw,float sky){
  vec3 r=reflect(normalize(vP-uCam),normalize(vN+vec3(hw-.5,0.,fract(hw*7.)-.5)*.1));
  flash=smoothstep(.992,.999,dot(r,uSun))*(1.-uNight)*.4;
  return mix(vec3(.11,.14,.2),mix(uHorizon,uZen,clamp(r.y*1.7+.2,0.,1.)),sky);
}
void main(){
  // A mirrored airliner would be stray dots on the ripples.
  if(uMirror<0.&&vP.y>400.) discard;
  vec3 base=vC,lamp=vec3(1.,.8,.5),add=vec3(0.); float glow=0.,wrap=0.,tones=0.;
  float kind=floor(vF.z+.5),d=distance(vP,uCam),seed=vA.y,px=d*uPix;
  if(kind==1.||kind==2.||kind==3.){
    vec2 size=kind==1.?vec2(2.9,3.748):kind==2.?vec2(2.2,3.748):vec2(3.4,3.1);
    float lod=lodOf(d,size.y);
    if(lod>0.){
      vec2 cell=vec2(vF.x,kind==3.?vF.y-2.4:vF.y)/(size*lod),id=floor(cell),f=fract(cell);
      float hw=hash(id+seed*61.);
      // Material: 0 render, 1 brick, 2 timber, 3 glazed balconies.
      float mat=kind==3.?floor(seed*4.):-1.;
      bool shop=kind==3.&&id.y==0.&&lod==1.&&fract(seed*29.)>.4;
      bool rail=mat==3.&&id.y>0.&&f.y>.1&&f.y<.42&&mod(id.x+floor(seed*23.),3.)<1.;
      // The tower's windows run round each floor as a ribbon; a house's are single.
      bool pane=kind<3.?f.y>.3&&f.y<.76:shop?f.x>.07&&f.x<.93&&f.y>.1&&f.y<.8:mat==1.?f.x>.3&&f.x<.7&&f.y>.26&&f.y<.8:mat==2.?f.x>.34&&f.x<.66&&f.y>.2&&f.y<.84:f.x>.24&&f.x<.76&&f.y>.3&&f.y<.78;
      // Each block lightens upward, so the nine read.
      if(kind<3.) base*=(kind==2.?.92:1.)*(.93+.1*fract(vF.y/18.744))*(.94+.09*vP.y/190.);
      // The crown lights the top block.
      if(kind<3.) add=vec3(1.,.78,.5)*uNight*.3*smoothstep(160.,186.,vF.y);
      // Near windows get a pale frame and sill shade.
      if(!pane&&!rail&&!shop&&lod==1.&&px<.7&&kind!=2.&&mat!=1.&&mat!=2.&&f.x>.17&&f.x<.83&&f.y>.2&&f.y<.85) base*=f.y<.3?.88:1.04;
      if(f.y<.1) base*=kind<3.?.86:.9;
      if(mat==1.&&f.y>.8&&f.x>.3&&f.x<.7) base*=.86;
      if(mat==2.&&fract(vF.x/(.85*lod))<.24) base*=.95;
      if(shop&&f.y>.84) base*=.7;
      if(rail) base=mix(vec3(.88,.9,.9),glass(hw,.8),.55);
      else if(pane){
        // A pane keeps some wall colour, so a facade reads as one.
        base=kind<3.?mix(base,glass(.5,.6),kind==1.?.28:.52):mix(vC,glass(hw,.5+.12*hw),.5);
        // A room, one to three windows, lights at once.
        float rw=1.+floor(hash(vec2(id.y,seed*17.))*2.99);
        float room=floor((id.x+floor(seed*9.))/rw);
        float h=hash(vec2(room,id.y)+seed*31.);
        if(shop){ if(h<uNight*.7){ glow=.6; lamp=vec3(1.,.9,.7); } }
        else if(h<uWin&&(kind==3.||(f.x>.14&&f.x<.86))){ glow=.42+.58*hw; lamp=warm(fract(h*37.+hw)); }
        else if(kind==3.&&mod(id.x+floor(seed*40.),11.)==4.&&uNight>.3){ glow=.35; lamp=vec3(.76,.88,.7); }
      }
    } else {
      base=mix(base,uSkyC*.6,.22);
      if(hash(floor(vP.xz*.07)+floor(vP.y*.2)+seed)<uWin*.3) glow=.8;
    }
  } else if(kind==8.){
    float lod=lodOf(d,3.4);
    if(lod>0.){
      vec2 cell=vec2(vF.x/(2.6*lod),(vF.y-2.4)/(3.4*lod)),id=floor(cell),f=fract(cell);
      if(f.y>.36&&f.y<.82){
        if(f.x<.12) base*=.8; else {
          base=glass(hash(id),.6);
          float run=floor(id.x/(3.+floor(hash(vec2(id.y,seed))*4.)));
          if(hash(vec2(run,id.y)+seed*19.)<uWin*.9){ glow=.75; lamp=vec3(1.,.95,.8); }
        }
      }
    }
  } else if(kind==4.){
    float x=abs(fract(vF.x/20.)-.5)*2.,y=vF.y/10.;
    if(px<.9){ if(abs(x-y)<.17||y<.14||y>.86) base*=1.35; else discard; }
    // Far off the lattice is half a tone; whole in the coarser reflection.
    else { if(uMirror>0.&&y>.14&&y<.86&&mod(gl_FragCoord.x+gl_FragCoord.y,2.)<1.) discard; base*=.8; }
    if(y>.86&&fract(vF.x/40.)<.12) glow=uNight;
  } else if(kind==5.){
    if(px<.7&&abs(vF.y)<.5&&fract(vF.x/14.)<.5) base=vec3(.9);
    if(abs(abs(vF.y)-11.2)<.7) base=vec3(.72);
  } else if(kind==6.){
    lamp=vC; glow=mix(vF.x,vF.y,uNight);
    // A lantern off is dark glass.
    if(vF.x==0.) base*=.3;
  } else if(kind==7.){
    // Leaves wrap the light.
    wrap=.4; tones=3.;
  } else if(kind==9.){
    if(px<.45&&fract(vF.x/1.7)<.13) base*=.84;
    float r=length(vec2(mod(vF.x,38.)-19.,vF.y))/12.;
    if(r<1.) add=vec3(1.,.7,.36)*(1.-r)*(1.-r)*.6*uNight;
  } else if(kind==11.){
    if(vF.y>.45&&vF.y<.8&&fract(vF.x/2.2)>.22){ base=vec3(.15,.2,.28); glow=uNight*.9; lamp=vec3(1.,.93,.75); }
  } else if(kind==12.){
    // The ground under a lamp, thinning to its rim.
    float r=length(vF.xy);
    if(uNight<.05||hash(gl_FragCoord.xy)>(1.-r)*2.6) discard;
    add=vec3(1.,.7,.38)*(1.-r)*(1.-r)*.55*uNight;
  } else if(kind==13.){
    float lod=lodOf(d,3.1);
    if(lod>0.){
      float fl=(vF.y-2.4)/(3.1*lod),f=fract(fl);
      if(f<.1) base*=.9;
      else if(f<.44) base=mix(vec3(.88,.9,.9),glass(.5,.8),.6);
      else { base*=.46; float h=hash(vec2(floor(fl),seed*77.)); if(h<uWin*.8){ glow=.45; lamp=warm(fract(h*37.)); } }
    }
  }
  // Snow settles on what faces up, patchy first; wet ground darkens with a sheen.
  bool up=vN.y>.7&&kind!=6.&&kind!=12.;
  if(up) base=mix(base*(1.-.4*uWet),vec3(.92,.94,.98),smoothstep(.15,.45,uSnow*1.4-hash(floor(vP.xz*.3))*.4));
  // Level ground keeps more of a low sun, so long shadows read.
  float ndl=max(dot(vN,uSun)*(1.-wrap)+wrap,0.);
  if(tones>0.) ndl=floor(ndl*tones+.5)/tones;
  bool flat_=vN.y>.9;
  if(flat_) ndl=sqrt(ndl);
  // Shadow keeps a fifth of the key, corners two thirds of their sky; walls take light in three steps.
  float lit=ndl>0.?mix(.2,1.,shadowAt())*(flat_?.5+.5*ndl:ndl<.28?.6:ndl<.62?.82:1.):0.;
  float open=1.-pow(1.-vA.x,3.),occ=mix(.66,1.,open);
  // Shade is warmed by lit ground; a low sun glows on faces turned its way.
  vec3 col=base*(mix(uGnd,uAmb,vN.y*.4+.6)*occ*(1.25-.25*lit)+uKey*lit*mix(.7,1.,open)+(uRim*max(dot(vN,uRimDir),0.)+uBnc*(1.-lit)*(1.-abs(vN.y)))*occ)+add+uKey*flash*lit*1.3;
  col=mix(col,lamp,glow);
  if(up) col=mix(col,uSkyC,uWet*.2);
  // Haze lies low.
  float fog=1.-exp(-d*uFog*mix(.4,1.,exp(-max(vP.y,0.)*.012)));
  col=mix(col,uHorizon,fog*(1.-glow*.55));
  o=vec4(col,uTag>0.?uTag:.5+.5*glow*(1.-fog*.5));
}`;

const SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=3) in vec3 aF; uniform mat4 uLight;
out vec3 vF;
void main(){ vF=aF; gl_Position=uLight*vec4(aP,1.); }`;

const SHADOW_FS = `#version 300 es
precision highp float; in vec3 vF;
void main(){ if(floor(vF.z+.5)==12.) discard; }`;

const FULL_VS = `#version 300 es
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.-1.,0.,1.); }`;

// Night glow at quarter size, blurred across and down.
const GLOW_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex; uniform vec2 uInv,uDir;
void main(){
  vec2 uv=gl_FragCoord.xy*uInv; vec3 s=vec3(0.);
  if(uDir==vec2(0.)){
    for(int i=0;i<4;i++){ vec4 c=texture(uTex,uv+vec2(float(i&1)-.5,float(i>>1)-.5)*uInv*.5); s+=c.rgb*max(c.a*2.-1.,0.); }
    s*=.25;
  } else {
    s=texture(uTex,uv).rgb*.227;
    s+=(texture(uTex,uv+uDir*1.385).rgb+texture(uTex,uv-uDir*1.385).rgb)*.316;
    s+=(texture(uTex,uv+uDir*3.231).rgb+texture(uTex,uv-uDir*3.231).rgb)*.07;
  }
  o=vec4(s,1.);
}`;

// Shared by the passes reading the picture; cloud shadows drift by day.
const COMMON = `const float NEAR=${NEAR}.; const float FAR=${FAR}.; const float REACH=${REACH}.;
const vec3 LUM=vec3(.2126,.7152,.0722);
float hash(vec2 p){ vec3 q=fract(p.xyx*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float lin(float z){ return NEAR*FAR/(FAR-z*(FAR-NEAR)); }
float shade(vec2 xz){
  vec2 q=(xz-2.*uDrift)*.0011+vec2(uT*.011,uT*.004)+uSeed;
  return smoothstep(.5,.68,noise(q)*.65+noise(q*2.3+3.7)*.35+uCover.x*.12)*.2*uDay*(1.-uWx.x*uWx.x);
}`;

// The city at the art pixel's grain, slid and outlined: colour and cover, then its reflection or the tower's flag.
const CITY_FS = (fringe) => `#version 300 es
precision highp float;
layout(location=0) out vec4 o; layout(location=1) out vec4 o2;
uniform sampler2D uScene,uRefl; uniform highp sampler2D uDepth;
uniform vec2 uRes,uSeed,uSway,uCover,uDrift; uniform vec3 uCam,uR,uU,uF,uSunDir,uHaze,uLowC,uRimC,uForeC; uniform vec4 uFore,uWx,uWind; uniform float uFl,uAspect,uShift,uT,uNight,uDay,uSS,uForeA,uBase;
${COMMON}
// 1 where the scene k pixels up is water.
float wet(ivec2 ij,vec2 ndc,int k){
  ivec2 q=(ij+ivec2(0,k))*int(uSS);
  if(texelFetch(uScene,q,0).a<.3) return 0.;
  vec2 n=ndc+vec2(0.,2.*float(k)/uRes.y);
  vec3 r=normalize(uF+uR*n.x*uAspect/uFl+uU*(n.y-uShift)/uFl);
  return step(uCam.y+r.y*lin(texelFetch(uDepth,q,0).r)/dot(r,uF),.9);
}
// How far a pixel's plane slides, 0 to 1: by depth, open water by distance, sky none.
float slide(vec2 p){
  ivec2 q=clamp(ivec2(p*uSS),ivec2(0),ivec2(uRes*uSS)-1);
  if(texelFetch(uScene,q,0).a>.05) return REACH/(REACH+lin(texelFetch(uDepth,q,0).r));
  float b=(p.y/uRes.y*2.-1.-uShift)/uFl;
  return b<-.001?REACH/(REACH-uCam.y/b):0.;
}
${fringe || ''}
void main(){
  // Plane parallax: each pixel takes the nearest thing slid onto it, else the farthest.
  vec2 px=gl_FragCoord.xy,src=px;
  float n=min(ceil(max(abs(uSway.x),abs(uSway.y))*uSS),16.);
  if(n>0.){
    float here=slide(px),far=here; vec2 back=px; bool hit=false;
    for(float k=n;k>0.;k--){
      vec2 p=px-uSway*(k/n); float w=slide(p);
      if(w>=(k-.5)/n){ src=p; hit=true; break; }
      if(w<far){ far=w; back=p; }
    }
    if(!hit&&here>1.5/n) src=back;
  }
  ivec2 ij=ivec2(src);
  vec2 ndc=src/uRes*2.-1.;
  vec3 ray=normalize(uF+uR*ndc.x*uAspect/uFl+uU*(ndc.y-uShift)/uFl);
  // Drawn finer, an art pixel is the mean of what it covers.
  int ss=int(uSS); ivec2 m=ivec2(uRes)*ss-1,first=ivec2(floor(src*uSS-.5*uSS+.01)),at=first; vec3 sum=vec3(0.); float cover=0.,kind=0.;
  for(int i=0;i<ss*ss;i++){
    ivec2 q=clamp(first+ivec2(i%ss,i/ss),ivec2(0),m); vec4 s=texelFetch(uScene,q,0);
    if(s.a>.05){ float w=s.a<.3?1.7:1.; sum+=s.rgb*w; cover+=w; if(s.a>kind){ kind=s.a; at=q; } }
  }
  float full=float(ss*ss),cv=min(cover/full,1.),tw=0.;
  vec3 g=vec3(0.); o2=vec4(0.);
  if(cv<1.&&ray.y<-.0008){
    // The city in the water, broken by ripples, still at walls and hulls; near water only sky.
    float t=-uCam.y/ray.y; vec3 p=uCam+ray*t;
    float touch=max(wet(ij,ndc,1),.5*wet(ij,ndc,2))*smoothstep(1200.,400.,t);
    vec2 w=p.xz*vec2(.012,.085)/(1.+t*.0026);
    float swell=noise(p.xz*vec2(.0035,.011)+vec2(uT*.05,uT*.02));
    float n1=noise(w+vec2(uT*.34,uT*.12)),n2=noise(w*2.3-vec2(uT*.28,-uT*.2));
    float rip=(n1+n2-1.)*(.3+.8*swell)*uWind.z;
    vec2 off=vec2(rip*(1.2+7./(1.+t*.02)),rip*(1.4+16./(1.+t*.014)))*(.8-.6*touch);
    ivec2 e=ivec2(uRes)-1;
    vec4 r=texelFetch(uRefl,clamp(ij+ivec2(off),ivec2(0),e),0);
    float mk=step(.05,r.a)*smoothstep(40.,220.,t);
    o2=vec4(r.rgb*mk,mk);
    if(uNight>.05){
      // Lamps drag trembling columns toward the eye where the city covers nothing.
      for(int k=1;k<8;k++){ vec4 l=texelFetch(uRefl,clamp(ij+ivec2(int(off.x*.6+sin(uT*2.3+float(k)*1.7+p.z*.07)*.8),k*k+int(off.y*.3)),ivec2(0),e),0); g+=l.rgb*max(l.a*2.-1.,0.)*(1.-float(k)/8.5); }
      g*=.55*(.6+rip)*uNight;
    }
    if(touch>0.&&noise(p.xz*vec2(1.1,.5)+vec2(uT*.5,0.))>.9-touch*.5) o2=mix(o2,vec4(.85),.5);
  }
  if(cover>0.){
    vec3 c=sum/cover;
    float z=lin(texelFetch(uDepth,at,0).r);
    if(kind>.4&&kind<.56){
      float limit=z*.02+1.5; vec2 jump=vec2(0.);
      for(int i=0;i<4;i++){
        ivec2 d=i==0?ivec2(1,0):i==1?ivec2(-1,0):i==2?ivec2(0,1):ivec2(0,-1);
        if(lin(texelFetch(uDepth,clamp(at+d*ss,ivec2(0),m),0).r)-z>limit) jump+=vec2(d);
      }
      // Outlines: a lit rim toward sun or moon, shade elsewhere, fading with distance.
      vec2 way=normalize(vec2(dot(uSunDir,uR),dot(uSunDir,uU))+1e-4); float f=exp(-z*.0007);
      if(jump!=vec2(0.)){
        float lit=max(dot(normalize(jump),way),0.);
        c=mix(c*mix(vec3(1.),vec3(.72,.74,.84),f*(1.-lit)),min(c+uRimC,1.),lit*f);
      } else if(lin(texelFetch(uDepth,clamp(at+ivec2(round(way*2.))*ss,ivec2(0),m),0).r)-z>limit) c=min(c+uRimC*.4*f,1.);
    }
    // Cloud shadows lie on ground and low roofs.
    vec3 p=uCam+ray*(z/dot(ray,uF));
    if(kind<.7) c*=1.-shade(p.xz)*(1.-smoothstep(25.,70.,p.y));
    tw=step(length(p.xz),40.)*step(4.,p.y)*step(p.y,200.);
    // Depth in planes, as on a backdrop: each step back takes more of the horizon's colour; lamps keep theirs.
    float air=smoothstep(120.,260.,z)*.08+smoothstep(520.,660.,z)*.2+smoothstep(1250.,1450.,z)*.2+smoothstep(2300.,3200.,z)*.16;
    c=mix(c,mix(vec3(dot(c,LUM)),uHaze,.75),air*(kind<.56?1.:.25));
    // Fog takes the far skyline first, a lamp last; low cloud swallows the tower's top.
    c=mix(c,uHaze,uWx.w*(1.-exp(-z*.0025))*(kind<.56?1.:.5));
    c=mix(c,uLowC,smoothstep(uBase-30.,uBase+30.,p.y)*(kind<.56?.94:.6));
    g=c;
  }
  ${fringe ? 'over(g,cv,px);' : ''}
  o=vec4(g,cv);
  if(ray.y>=0.) o2.r=tw;
}`;

// Shared at the screen's grain: inputs, the clear sky, the sun's light.
const HEAD = `precision highp float;
out vec4 o;
uniform sampler2D uCity,uWater,uGlow,uHalo,uSteer;
uniform vec2 uRes,uScale,uSeed,uSway,uCover,uDrift,uLine,uSide,uFlash; uniform vec3 uCam,uR,uU,uF,uSunDir,uSunCol,uDisc,uMoonDir,uMoonCol,uMoonL,uGlitDir,uGlitCol,uSky[4],uCloud[2],uSea[2];
uniform vec4 uWx,uWind; uniform float uFl,uAspect,uShift,uT,uStar,uNight,uDay,uLow,uHd,uDot,uGlowAmt,uStat,uIn,uSunUp,uMoonUp,uQ;
${COMMON}
float ppr;
vec2 zw; // How far a pixel lies in each of the page's zones, feathered beyond the line.
// The sky's four colours, horizon up, joined by a curve.
vec3 gradient(float t){
  t=clamp(t,0.,.9999)*3.; int i=int(t); float f=t-float(i);
  vec3 a=uSky[min(4-i,3)],b=uSky[3-i],c=uSky[2-i],d=uSky[max(1-i,0)];
  return b+.5*f*(c-a+f*(2.*a-5.*b+4.*c-d+f*(3.*(b-c)+d-a)));
}
float hg(float c,float g){ return (1.-g*g)/pow(1.+g*g-2.*g*c,1.5); }
vec3 ray(vec2 px){ vec2 n=px/uRes*2.-1.; return normalize(uF+uR*n.x*uAspect/uFl+uU*(n.y-uShift)/uFl); }
// The clear sky, deepest away from the sun; a low sun burns amber on its side, gold to rose, the pink belt opposite.
vec3 sky(vec3 r){
  float e=max(r.y,0.),cs=dot(r,uSunDir),tw=max(dot(normalize(r.xz+1e-5),normalize(uSunDir.xz)),0.),b=uLow*(1.-tw)*(1.-uWx.x);
  vec3 c=gradient(pow(e/.62,.8));
  c*=1.-.05*uDay*smoothstep(.9,.2,cs);
  c=mix(c,uSky[2]*vec3(1.1,.9,1.02),b*smoothstep(.015,.07,e)*smoothstep(.26,.1,e)*.5);
  c=mix(c,uSky[0],b*smoothstep(.05,0.,e)*.3);
  c=mix(c,uSky[3],exp(-e*16.)*(.35+.3*uCover.y)*uDay);
  c=mix(c,vec3(1.,.56,.24),uLow*pow(tw,3.)*exp(-e*5.)*.5);
  c+=vec3(.95,.58,.3)*uNight*exp(-e*12.)*(.05+.09*max(-r.z,0.));
  float k=min(hg(cs,.75)*(.004+.012*uLow),.8); c=mix(c,mix(mix(uSunCol,vec3(1.,.62,.3),uLow),vec3(1.,.93,.8),k),k);
  return c+uMoonCol*hg(dot(r,uMoonDir),.9)*.002*(1.-c);
}`;

// The picture at the screen's grain round the pixel city; `wx` brings clouds and weather.
const HD_FS = (wx) => `#version 300 es
${HEAD}
// Stars by magnitude, some coloured, twinkling more low down, lost in the towns' glow.
vec3 stars(vec3 r){
  vec2 sp=vec2(atan(r.x,-r.z),asin(r.y))*190.,id=floor(sp); float h=hash(id);
  if(h<.93) return vec3(0.);
  float m=fract(h*13.7); m*=m*m;
  vec2 f=(fract(sp)-.5-(vec2(fract(h*71.),fract(h*37.))-.5)*.5)*ppr/190./uDot;
  float tw=1.+(.15+.6*exp(-r.y*9.))*sin(uT*(2.+fract(h*91.)*5.)+h*600.)*sin(uT*1.3+h*90.);
  vec3 k=fract(h*29.)<.7?vec3(1.):mix(vec3(.72,.82,1.),vec3(1.,.78,.55),fract(h*53.));
  return k*(.14+1.2*m)*tw*exp(-dot(f,f)*(2.2-1.2*m))*uStar*smoothstep(.01,.14,r.y);
}
${wx || `vec3 clouds(vec3 r,vec3 c,float f){return c;}
vec4 facet(vec3 p,float f,float a){return vec4(0,1,0,0);}
vec3 glints(vec3 r,vec4 f,vec3 p,float a,float b){return vec3(0.);}
float veil(vec3 d){return 1.;}
vec3 rings(vec3 c,vec3 p,float t){return c;}
vec3 weather(vec3 c,vec2 p,vec3 r,float a,inout float v){return c;}`}
ivec2 spot(vec3 d){ return ivec2(clamp((vec2(dot(d,uR)*uFl/uAspect,d.y*uFl)/dot(d,uF)+vec2(0.,uShift))*.5+.5,0.,.999)*uRes/uHd); }
// A disc's screen frame, in radii.
#ifndef SKY
vec2 disc(vec3 r,vec3 d,float s,float flat_){ vec3 x=normalize(cross(d,vec3(0,1,0))); return vec2(dot(r-d,x),dot(r-d,cross(x,d))/flat_)/s; }
// Until the module's: the moon in its phase, seas, earthshine, glow.
vec3 moon(vec3 r,vec3 c,inout float valid){
  if(uMoonUp<=0.||dot(r,uMoonDir)<.998) return c;
  vec2 q=disc(r,uMoonDir,.0095,1.); float l=length(q),aa=uDot/(ppr*.0095);
  if(l<3.5) valid=0.;
  c+=uMoonCol*(exp(-l*1.1)*.3+exp(-l*.25)*.08)*(1.-c);
  if(l>1.+aa) return c;
  vec3 n=vec3(q,sqrt(max(1.-l*l,0.)));
  float lit=max(smoothstep(-.03,.05,dot(n,uMoonL)),smoothstep(.9,.99,l)*smoothstep(.3,.8,dot(q/max(l,1e-4),normalize(uMoonL.xy+1e-4)))),sea=.9-.24*smoothstep(.42,.62,noise(q*2.1+vec2(4.,1.)))-.1*noise(q*7.+2.);
  vec3 face=mix(sky(r)+uMoonCol*.2+vec3(.012,.014,.024)*(1.-uMoonL.z),min(mix(vec3(1.,.86,.7),vec3(1.,.98,.94),uMoonUp)*sea*(1.05+.3*n.z),1.),lit);
  return mix(c,face,smoothstep(1.+aa,1.-aa,l)*uMoonUp*smoothstep(0.,.04,uMoonDir.y));
}
// Until the module's: a small white-hot sun, flattened and reddened low.
vec3 sun(vec3 r,vec3 c,inout float valid){
  if(uSunUp<=0.||dot(r,uSunDir)<.998) return c;
  vec2 q=disc(r,uSunDir,.0085,1.-.2*exp(-uSunDir.y*30.)); float l=length(q),aa=uDot/(ppr*.0085);
  if(l<4.) valid=0.;
  return mix(c,min(uDisc*(1.1+.15*sqrt(max(1.-l*l,0.))),1.),smoothstep(1.+aa,1.-aa,l)*uSunUp);
}
// Glare from the share of the sun the city leaves clear.
vec3 glare(vec3 r){
  float a=length(r-uSunDir)/.0085;
  if(uSunUp<=0.||a>60.) return vec3(0.);
  float v=0.,o=.6*ppr*.0085/uHd; ivec2 s=spot(uSunDir),m=ivec2(uRes/uHd)-1;
  for(int i=0;i<5;i++) v+=texelFetch(uCity,clamp(s+ivec2(vec2(i==1?o:i==2?-o:0.,i==3?o:i==4?-o:0.)),ivec2(0),m),0).a;
  return mix(vec3(1.),mix(uSunCol,mix(vec3(1.,.82,.48),vec3(1.,.6,.26),smoothstep(3.,12.,a)),uLow),smoothstep(1.,1.2,a))*(1.-v*.2)*(exp(-max(a-1.,0.)*1.6)*.3+exp(-a*.2)*(.12+.45*uLow)+exp(-a*.06)*(.05+.3*uLow))*uSunUp*veil(uSunDir);
}
#endif
// The water mirrors sky and city over the sea's colour; under light ink near water hushes its glints, not lamps.
vec3 water(vec3 r,vec4 wi,vec4 ci){
  float t=-uCam.y/r.y,fp=t/(ppr*max(-r.y,.004)),A=.05+.12*min(uWind.z,1.8),hush=1.-max(zw.x*(1.-uSide.x),pow(zw.y,4.)*(1.-uSide.y));
  vec3 p=uCam+r*t; vec4 f=facet(p,fp,A); vec3 rr=reflect(r,f.xyz); rr.y=max(rr.y,.004);
  // Facets tip toward the eye; by day the sea still mirrors a share of the sky.
  float fr=.02+.98*pow(1.-max(dot(-r,f.xyz),.04+.2*A),5.); fr+=(1.-fr)*(.08+.44*uDay);
  vec3 m=clouds(rr,sky(rr),0.)*(1.-wi.a)+wi.rgb,c=mix(mix(uSea[0],uSea[1],clamp(-r.y*6.,0.,1.)),m,fr)+glints(r,f,p,fp,fr)*hush;
  c=rings(c*(1.-shade(p.xz)*.7),p,t);
  c=mix(c,uSky[3],(1.-exp(-t*.00022))*(.3+.5*uDay)*(.7+.5*uCover.y));
  c=mix(c,uSky[3],uWx.w*(1.-exp(-t*.003)));
  return c+(ci.a>0.?vec3(0.):ci.rgb);
}
vec3 lin3(vec3 c){ return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c)); }
// The palette sets the side; under the words a residual per row does at most a tenth.
vec3 steer(vec3 x,float y){
  vec4 s=texture(uSteer,vec2(.5,y/uRes.y));
  for(int i=0;i<2;i++){
    vec2 q=i==0?s.xy:s.zw;
    x=mix(x,mix(x*max(q.x*q.x,.9),min(x*(1.+min(.35-.35*q.y,.1)),1.),uSide[i]),zw[i]);
  }
  return x;
}
void main(){
  vec2 px=gl_FragCoord.xy*uScale; ppr=uFl*uRes.y*.5;
  // The foot's steer ramps in from the horizon, as the sea deepening.
  zw=vec2(smoothstep(uLine.x-.18*uRes.y,uLine.x,px.y),smoothstep(uLine.y+max((uShift*.5+.5)*uRes.y-uLine.y,.03*uRes.y),uLine.y,px.y)); zw.y*=zw.y;
  ivec2 ij=ivec2(px/uHd);
  vec3 r=ray(px),col;
  vec4 ci=texelFetch(uCity,ij,0),wi=texelFetch(uWater,ij,0);
  float valid=1.;
  if(r.y<0.) col=water(r,wi,ci);
  else{
    col=sky(r);
    if(uStat==0.&&uStar>0.) col+=stars(r);
    col=clouds(r,sun(r,moon(r,col,valid),valid),1.);
    col=mix(col,uSky[3],uWx.w*(.6+.35*smoothstep(.4,0.,r.y)));
  }
  col=mix(col,ci.rgb,ci.a);
  if(uGlowAmt>0.){ vec2 uv=px/uRes; col+=(texture(uGlow,uv).rgb+texture(uHalo,uv).rgb*.8)*uGlowAmt*(1.-col*.6); }
  col+=glare(r)*(1.-col)*(1.-.6*ci.a);
  // The city, its foreground and their mirror: own exposure, unmeasured.
  if(r.y<0.&&dot(ci.rgb,LUM)>.01||ci.a>.5) valid=0.;
  zw*=1.-ci.a;
  col=weather(col,px,r,ci.a,valid);
  // One palette per hour: shade leans to the sky, light to the sun.
  float l=dot(col,LUM); vec3 tone=mix(uSky[1],uSunCol+uMoonCol,smoothstep(.15,.85,l));
  col=lin3(clamp(mix(col,l*min(tone/max(dot(tone,LUM),.08),2.),.12),0.,1.));
  if(uStat>0.){ o=vec4(sqrt(dot(col,LUM)),valid,0.,1.); return; }
  col=steer(col,px.y);
  // Back to sRGB with half a step of grain.
  col=mix(col*12.92,1.055*pow(col,vec3(1./2.4))-.055,step(.0031308,col));
  o=vec4(col+(fract(52.9829189*fract(dot(px,vec2(.06711056,.00583715))))-.5)/255.,1.);
}`;

/* -------------------------------------------------------------------- Mount */

// Compiled and linked without waiting; `linked` checks.
function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  return { p };
}

function linked(gl, prog) {
  const { p } = prog;
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getAttachedShaders(p).map((s) => gl.getShaderInfoLog(s)).join('') + gl.getProgramInfoLog(p));
  prog.u = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const name = gl.getActiveUniform(p, i).name.replace('[0]', '');
    prog.u[name] = gl.getUniformLocation(p, name);
  }
  return prog;
}

function texture(gl, w, h, internal, format, type, filter = gl.NEAREST) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}

// A target: a colour and a depth or second colour.
function target(gl, w, h, depth = true, two = false) {
  const color = texture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  const t = { fb, color, depth: null, w, h };
  if (depth) {
    t.depth = texture(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t.depth, 0);
  }
  if (two) {
    t.depth = texture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, t.depth, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  }
  return t;
}

function vertexArray(gl, data, usage) {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  if (data) gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  [3, 3, 3, 3, 2].forEach((size, i) => {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, FLOATS * 4, i * 12);
  });
  return { vao, buffer };
}

export function mountCity(canvas, { at, front } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  if (!gl) return null;

  // Building runs a part per task.
  const mesh = new Mesh(1 << 22);
  let skin = null; // The tower's faces, four corners each, for cutting its outline out of a frame.
  let triCount = 0;
  let lineCount = 0;
  let fixed = null;
  let free = null;
  let scene = null;
  let shadow = null;
  let cityP = null;
  let hdP = null;
  let glowP = null;
  let ready = false;
  const parts = [
    () => { skin = buildTorso(mesh); buildLand(mesh); buildBoardwalk(mesh); },
    () => { free = buildHarbour(mesh); },
    () => buildPlanting(mesh, malmoNow(at ? at() : new Date()).doy, free),
    () => { buildPier(mesh); buildKallbadhus(mesh); buildSkyline(mesh); },
    () => { buildBridge(mesh); buildTurbines(mesh); },
    () => {
      triCount = mesh.t.n / FLOATS;
      lineCount = mesh.l.n / FLOATS;
      const data = new Float32Array(mesh.t.n + mesh.l.n);
      data.set(mesh.t.a.subarray(0, mesh.t.n), 0);
      data.set(mesh.l.a.subarray(0, mesh.l.n), mesh.t.n);
      fixed = vertexArray(gl, data, gl.STATIC_DRAW);
    },
    () => { scene = linked(gl, program(gl, SCENE_VS, SCENE_FS)); shadow = linked(gl, program(gl, SHADOW_VS, SHADOW_FS)); },
    () => { cityP = linked(gl, program(gl, FULL_VS, CITY_FS())); glowP = linked(gl, program(gl, FULL_VS, GLOW_FS)); },
    () => { hdP = linked(gl, program(gl, FULL_VS, HD_FS())); },
  ];

  const mov = new Mesh(1 << 17);
  const moving = vertexArray(gl, null);
  let movingSize = 0;
  let movedAt = -1;
  let movedStill = false;

  const SHADOW_SIZE = 2048;
  const shadowDepth = texture(gl, SHADOW_SIZE, SHADOW_SIZE, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const shadowFb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowDepth, 0);

  const box = canvas.parentElement;
  let W = 0;
  let H = 0;
  let px = 2;
  let hd = 1; // Screen pixels to an art pixel in the drawn picture.
  // The quality ladder: 0 city at twice its grain, 1 its own, 2 half the screen's, 3 art pixels, then larger ones.
  let rung = 0;
  let forced = null;
  let still = null; // The city without movers, right way up and mirrored: drawn only when the view or the light changes.
  let stillR = null;
  let main = null;
  let refl = null;
  let glowA = null;
  let glowB = null;
  let halo = null;
  let cityT = null; // The city and its reflection at the art pixel's grain.
  let statT = null; // A small copy of the picture to measure its light under the words.
  let resized = true;
  let dirtyView = true;
  let dirtyLight = true;
  let progress = 0;
  let path = null;
  let uiBottom = null;
  let ui = 0.3; // The share of the picture's height that the page covers at the bottom.
  let sunSpot = null;
  const discAt = [];
  let moonSpot = null;
  const view = newView();
  const level = newView(); // The view without the lean: the stops and the tower's box are measured in it.
  const vp = new Float32Array(16);
  const flat = new Float32Array(16);
  const lean = [0, 0];
  const leanTo = [0, 0];
  // Plane slide, -1 to 1, and speed.
  const sway = [0, 0, 0, 0];
  const reach = new Float32Array(2);
  let beat = 0;
  let stirred = -1e9;
  let fresh = false;
  let skein = 0;
  let hourOverride = null;
  let pal = null;
  let shade = null; // The key light's own view of the city, for the shadows.
  const key = [0, 1, 0];
  const glow = new Float32Array([0, 1, 0]); // Where the sun stands in the sky, and the moon.
  const moonDir = new Float32Array([0, 1, 0]);
  const moonLit = new Float32Array(3); // Toward the sun in the moon's own frame: across, up and toward us.
  let sunAt = 0.5; // How far the sun is along its arc, 0 at its rising and 1 at its setting, and the moon along its own.
  let moonAt = 0;
  let sunUp = true;
  let height = 1; // The sine of the sun's real height over Malmö.
  let power = 1;
  let night = 0;
  let lamp = 0; // Town lights, by night or dark key.
  let dk = 0; // How far in the dark key, 0 to 1.
  let palD = null; // The twilight a dark key paints by day.
  let win = 0;
  let low = 0; // How much the sun sits at the horizon, 0 to 1.
  let sunlit = 1; // How much of the sun's own glow is left in the sky: it fades out before the moon's takes over.
  let day = 0; // How much of the daylight there is, 0 to 1.
  let phase = 0;
  let fullness = 0;
  let weather = [0, 0, 0.5, 0.5];
  // Weather asked (null: the date's own) and in force: cloud, rain, snow, fog, wind x and z, thunder, own share.
  let asked = null;
  let windDir = 270;
  let uiTop = null;
  let wet = 0; // How wet the ground is, and how much snow lies, 0 to 1: both outlast the weather that brought them.
  let snowed = 0;
  // Per zone: ink side (1 dark, 0 light) and how far there, both from the key.
  const zones = [0, 1].map(() => ({ side: 1, at: -1 }));
  // Per row and zone: residual exposure and lift and their aims, in a texture.
  let rowsTo = null;
  let rowsAt = null;
  const steerTex = texture(gl, 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  const pbo = gl.createBuffer();
  let stat = null;
  let fence = null;
  let measured = false;
  let rich = null; // Clouds and weather, once their module has loaded and compiled; then how far they have come in.
  let cloudP = null;
  let richCity = null;
  let cloudT = null;
  let richIn = 0;
  const flash = [0, 0];
  const wx = new Float32Array(8);
  const wxTo = new Float32Array(8);
  const wu = new Float32Array(4); // What the shaders take: deck, rain, snow and fog, 0 to 1.
  const drift = new Float32Array(2);
  let deckDrawn = 0;
  let cost = 0;
  let listener = null;
  const info = { light: null, tint: null };
  // The hour's colours, flat for the shaders.
  const tone = {
    amb: new Float32Array(3), lit: new Float32Array(3), gnd: new Float32Array(3), bnc: new Float32Array(3), rim: new Float32Array(3), rimC: new Float32Array(3),
    fore: new Float32Array(3), low: new Float32Array(3), sky: new Float32Array(12), cloud: new Float32Array(6), sea: new Float32Array(6),
  };
  // Sun and moon: glows, disc, glitter colour and direction, how much shows.
  const sky = { sun: new Float32Array(3), moon: new Float32Array(3), disc: new Float32Array(3), glit: new Float32Array(3), glitDir: new Float32Array(3), sunUp: 0, moonUp: 0 };
  const frontCtx = front ? front.getContext('2d') : null;

  const covered = () => clamp((uiBottom ?? (box.clientWidth < 700 ? 260 : 120)) / Math.max(box.clientHeight, 1), 0, 0.5);

  // Sun and moon stand where the page draws them, clear of the skyline, or on the city's arcs.
  const aim = () => {
    viewAt(path, 0, ZERO, level);
    const arc = 0.5 - 0.5 * level.shift;
    for (const [spot, across, out, k] of [[sunSpot, sunAt, glow, 0], [moonSpot, moonAt, moonDir, 1]]) {
      const x = spot ? spot[0] / (W * px) : 0.1 + 0.8 * across;
      const y = spot ? spot[1] / (H * px) : arc - (arc - 0.29) * Math.sin(Math.PI * clamp(across, 0, 1)) ** 0.8;
      const a = ((2 * x - 1) * W) / (H * level.fl);
      const b = (1 - 2 * y - level.shift) / level.fl;
      const l = Math.hypot(1, a, b);
      out[0] = (level.f[0] + level.r[0] * a) / l;
      const c = Math.max(b, W < H ? 0.075 : 0.04);
      out[1] = c / l;
      discAt[k] = { x: x * W * px, y: ((1 - c * level.fl - level.shift) / 2) * H * px, f: (level.fl * H * px) / 2 };
      out[2] = (level.f[2] + level.r[2] * a) / l;
    }
    const across = norm(cross(moonDir, UP));
    const d = sub(glow, moonDir);
    const t = 2 * Math.PI * phase;
    const s = Math.abs(Math.sin(t)) / (Math.hypot(dot(d, across), dot(d, cross(across, moonDir))) || 1);
    moonLit.set([dot(d, across) * s, dot(d, cross(across, moonDir)) * s, -Math.cos(t)]);
  };

  const fit = () => {
    resized = false;
    const dpr = devicePixelRatio || 1;
    // Art pixels are whole device and picture pixels.
    let device = (dpr >= 2.5 ? 2 : dpr >= 1.5 ? 2 : 1) + Math.max(rung - 3, 0);
    while ((box.clientWidth * dpr * box.clientHeight * dpr) / (device * device) > 1.4e6) device += 1;
    const nW = Math.max(40, Math.ceil((box.clientWidth * dpr) / device));
    const nH = Math.max(40, Math.ceil((box.clientHeight * dpr) / device));
    const ss = rung < 1 && nW * nH < 6e5 ? 2 : 1;
    const grain = rung > 2 ? 1 : rung > 1 ? Math.ceil(device / 2) : device;
    ui = covered();
    path = pathFor(nW / nH, ui);
    dirtyView = true;
    if (nW === W && nH === H && px === device / dpr && still.w === W * ss && hd === grain) {
      aim();
      return;
    }
    W = nW;
    H = nH;
    px = device / dpr;
    hd = grain;
    canvas.width = W * hd;
    canvas.height = H * hd;
    // Whole art pixels cover the box, overhanging by under one.
    for (const layer of front ? [canvas, front] : [canvas]) {
      layer.style.width = `${W * px}px`;
      layer.style.height = `${H * px}px`;
    }
    for (const t of [still, stillR, main, refl, glowA, glowB, halo, cityT, statT, cloudT]) {
      if (t) {
        gl.deleteTexture(t.color);
        gl.deleteTexture(t.depth);
        gl.deleteFramebuffer(t.fb);
      }
    }
    still = target(gl, W * ss, H * ss);
    stillR = target(gl, W, H);
    main = target(gl, W * ss, H * ss);
    refl = target(gl, W, H);
    glowA = target(gl, Math.ceil(W / 4), Math.ceil(H / 4), false);
    glowB = target(gl, Math.ceil(W / 4), Math.ceil(H / 4), false);
    halo = target(gl, Math.ceil(W / 4), Math.ceil(H / 4), false);
    cityT = target(gl, W, H, false, true);
    // Soft clouds need a third of a million pixels, fewer down the ladder.
    const cs = Math.max(1, Math.sqrt((W * H * hd * hd) / (rung > 1 ? 1.5e5 : 3e5)));
    cloudT = target(gl, Math.ceil((W * hd) / cs), Math.ceil((H * hd) / cs), false);
    // Some two hundred pixels across.
    const sw = Math.round(Math.min(256, (320 * W) / H));
    statT = target(gl, sw, Math.round((sw * H) / W), false);
    stat = new Uint8Array(sw * statT.h * 4);
    rowsTo = new Float32Array(statT.h * 4).fill(1);
    rowsAt = rowsTo.slice();
    gl.bindTexture(gl.TEXTURE_2D, steerTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, statT.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    // A copy usage, not a read one: Chrome then keeps no shadow copy to warn about, and the fence still says when.
    gl.bufferData(gl.PIXEL_PACK_BUFFER, stat.length, gl.STREAM_COPY);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    fence = null;
    measured = false;
    if (front) {
      front.width = W * hd;
      front.height = H * hd;
    }
    aim();
  };

  const clock = () => {
    const now = at ? at() : new Date();
    const c = malmoNow(now);
    if (hourOverride !== null) c.hour = hourOverride;
    [c.rise, c.set] = sunTimes(c.doy, c.offset);
    c.moon = moonPhase(now);
    return c;
  };

  const updateClock = () => {
    const c = clock();
    // The noon sun sets how wintry the day is.
    const w = clamp((0.62 - Math.cos(LAT - spencer(c.doy)[0])) / 0.4, 0, 1);
    pal = palette(c.hour, c.rise, c.set, w);
    palD = palette(c.set + 1.4, c.rise, c.set, w);
    height = sunHeight(c.hour, c.doy, c.offset);
    phase = c.moon;
    night = smooth(clamp((0.03 - height) / 0.15, 0, 1));
    win = windowsAt(c.hour, c.rise, c.set);
    low = clamp(1 - Math.abs(height - 0.02) / 0.3, 0, 1);
    day = smooth(clamp(height * 6, 0, 1));
    fullness = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    sunlit = smooth(clamp((height - DARK) / 0.08, 0, 1));
    // Sun by day, moon by night.
    sunUp = c.hour >= c.rise && c.hour < c.set;
    moonAt = ((((c.hour - c.set) % 24) + 24) % 24) / (24 - c.set + c.rise);
    sunAt = sunUp ? (c.hour - c.rise) / (c.set - c.rise) : moonAt < 0.5 ? 1 : 0;
    // The light: upper left, drifting right through the day at the sun's height (or a moon's).
    const tall = Math.max(height, 0.05) * (1 - night) + 0.45 * night;
    const flatness = Math.sqrt(1 - tall * tall);
    const turn = rad(-60 + 42 * (sunUp ? sunAt : 1 - moonAt));
    key[0] = Math.sin(turn) * flatness;
    key[1] = tall;
    key[2] = Math.cos(turn) * flatness;
    power = 0.24 + 0.3 * fullness + (0.76 - 0.3 * fullness) * smooth(clamp((height + 0.1) / 0.15, 0, 1));
    // Unless the page gives weather, the date places the clouds and haze.
    const rng = rngFrom(Math.round(c.doy) * 7919 + 11);
    weather = [rng() * 40, rng() * 40, 0.35 + 0.5 * rng(), rng()];
    skein = c.doy > 250 && c.doy < 335 ? 1 : c.doy > 60 && c.doy < 130 ? -1 : 0;
    info.hour = c.hour;
    aimWeather();
    toneUp();
    aim();
    dirtyLight = true;
  };

  // One key per frame: storms dark; overcast, rain, snow, fog bright 6 degrees up, the rest with the sun up (0.3 of
  // hysteresis). A change eases 1.2 s, town lights too.
  const keyUp = () => {
    const w = wxTo;
    const side = +(w[6] < 0.3 && height > (w[0] > 0.8 || w[1] > 0.3 || w[2] > 0.1 || w[3] > 0.4 ? 0.105 : 0) + 0.005 - 0.01 * zones[0].side);
    for (const z of zones) {
      z.side = side;
      if (z.at < 0 || reduce.matches) z.at = side;
    }
  };
  const mixP = (a, b, t) => (typeof a === 'number' ? a + (b - a) * t : Array.isArray(a) ? a.map((v, i) => mixP(v, b[i], t)) : Object.fromEntries(Object.keys(a).map((k) => [k, mixP(a[k], b[k], t)])));

  // The hour's colours under the weather: overcast flattens, rain and thunder darken, fog and cloud veil sun and moon.
  const toneUp = () => {
    keyUp();
    dk = 1 - smooth(zones[0].at);
    lamp = Math.max(night, dk * (0.6 + 0.4 * night));
    const dd = dk * (1 - night);
    const p = mixP(pal, palD, dk);
    wu[0] = clamp((wx[0] - 0.15) / 0.85, 0, 1) * (1 - wx[7]);
    wu[1] = Math.min(Math.sqrt(Math.max(wx[1] - 0.03, 0) / 6), 1);
    wu[2] = Math.min(Math.sqrt(Math.max(wx[2] - 0.03, 0) / 2), 1);
    wu[3] = Math.max(wx[3], Math.min(wx[1] * 0.06, 0.3), Math.min(wx[2] * 0.3, 0.5));
    const deck = wu[0] * wu[0];
    const fog = wu[3];
    const dim = (1 - 0.6 * deck) * (1 - 0.5 * fog);
    const veil = (1 - 0.8 * deck) * (1 - 0.85 * fog);
    const dark = (0.08 * deck + 0.22 * wu[1] * deck + 0.18 * wx[6]) * (1 - night);
    const red = smooth(clamp((height + 0.02) / 0.16, 0, 1));
    sky.sunUp = smooth(clamp((height + 0.012) / 0.024, 0, 1)) * veil * (1 - dk);
    sky.moonUp = smooth(clamp(-height / 0.05, 0, 1)) * veil;
    for (let i = 0; i < 3; i += 1) {
      // A low sun's sky colours walls turned away.
      tone.amb[i] = (p.amb[i] * 0.56 + p.sky[1][i] * low * 0.2) * (1 + 0.25 * deck);
      tone.lit[i] = p.key[i] * power * 0.74 * (1 - 0.45 * deck) * (1 - 0.7 * dk);
      // Ground bounce: ambient warmed by the key.
      tone.gnd[i] = (tone.amb[i] + (tone.lit[i] - tone.amb[i]) * 0.3) * 0.8;
      tone.bnc[i] = tone.lit[i] * BOUNCE[i];
      tone.rim[i] = p.sun[i] * low * sunlit * 0.5 * (1 - deck);
      tone.rimC[i] = p.key[i] * power * 0.55 * (1 - 0.5 * deck);
      tone.fore[i] = (p.sky[0][i] + (p.amb[i] - p.sky[0][i]) * 0.3) * 0.42;
      // The sun's glow fades as it sinks or the key darkens; the moon's is cooler, fainter when thin.
      sky.sun[i] = p.sun[i] * sunlit * dim * (1 - dk);
      sky.moon[i] = MOON[i] * (0.3 + 0.5 * fullness) * smooth(clamp((DARK - height) / 0.08, 0, 1)) * dim;
      sky.disc[i] = [1, 0.9, 0.74][i] + [0, 0.09, 0.22][i] * red;
      // Overcast and fog keep three quarters of the colour, leaning to the high sky; a storm to blue-violet.
      const G = Math.max(deck, fog);
      const grey = (c, k) => (c[i] + (p.sky[1][i] - c[i]) * 0.5 * G * k + (0.2 * c[0] + 0.7 * c[1] + 0.1 * c[2] - c[i]) * 0.25 * G) * (1 - dark) * (1 - 0.5 * wx[6]) + [0.12, 0.13, 0.28][i] * wx[6] * (1 - 0.4 * night);
      for (let k = 0; k < 4; k += 1) tone.sky[k * 3 + i] = grey(p.sky[k], k > 1);
      for (let k = 0; k < 2; k += 1) {
        tone.cloud[k * 3 + i] = grey(p.cloud[k], 0.8);
        tone.sea[k * 3 + i] = grey(p.sea[k], 0);
      }
    }
    // The key is painted: sky and sea 0.38 up or 0.09 down, cloud tops apart from bellies; slate by day, never neon.
    for (let o = 0; o < 24; o += 3) {
      const c = o < 12 ? tone.sky.subarray(o) : o < 18 ? tone.cloud.subarray(o - 12) : tone.sea.subarray(o - 18);
      const m = (c[0] + c[1] + c[2]) / 3;
      for (let i = 0; i < 3; i += 1) c[i] += (m * [0.9, 0.98, 1.16][i] - c[i]) * 0.6 * dd;
      const y = Math.max(lum(c), 1e-4);
      const f = ((Math.max(y, o === 12 ? 0.5 : o === 15 ? 0.4 : 0.38) * (1 - dk) + Math.min(y, o === 12 ? 0.06 : o === 15 ? 0.04 : 0.09) * dk) / y) ** 0.45;
      for (let i = 0; i < 3; i += 1) c[i] = Math.min(1, c[i] * f);
      const n = (c[0] + c[1] + c[2]) / 3;
      for (let i = 0; i < 3; i += 1) c[i] += (n - c[i]) * clamp((f - 1.15) * 0.8, 0, 0.6);
    }
    for (let i = 0; i < 3; i += 1) {
      tone.low[i] = (tone.cloud[3 + i] + tone.sky[9 + i]) / 2;
      // The water throws back sun or moon.
      sky.glit[i] = height > 0 ? sky.disc[i] * sky.sunUp : sky.moon[i] * 1.6 * sky.moonUp;
    }
    // The path of light keeps near the horizon.
    const by = height > 0 ? glow : moonDir;
    const l = Math.hypot(by[0], Math.min(by[1], 0.08), by[2]);
    sky.glitDir.set([by[0] / l, Math.min(by[1], 0.08) / l, by[2] / l]);
    info.light = { sun: [...key], sunColor: p.key.map((v) => v * power * (1 - 0.6 * deck)), skyColor: p.sky[1], ambient: p.amb, hour: info.hour, night };
    info.tint = { top: toHex(p.sky[0]), horizon: toHex(p.sky[3]), accent: toHex(p.accent) };
  };

  // Where the weather goes.
  const aimWeather = () => {
    const a = asked || { cloud: (weather[2] * 0.22 + 0.2) / 0.7, wind: 0 };
    const d = rad(windDir);
    wxTo.set([a.cloud, a.rain || 0, a.snow || 0, a.fog || 0, -Math.sin(d) * a.wind, Math.cos(d) * a.wind, a.thunder || 0, asked ? 0 : 1]);
    if (!info.light) wx.set(wxTo);
  };

  const drawGeometry = (set, tris, lines, firstLine, mirror) => {
    const u = scene.u;
    gl.bindVertexArray(set.vao);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform1f(u.uMirror, mirror);
    gl.uniform1f(u.uTag, 0);
    gl.drawArrays(gl.TRIANGLES, 0, tris);
    if (lines) {
      gl.uniform1f(u.uTag, 0.25);
      gl.drawArrays(gl.LINES, firstLine, lines);
    }
  };

  // Shadows are cast once per change of light, over all the shore.
  const renderShadow = () => {
    shade = lightMatrix(key, [150, 40, 0], 860);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFb);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shadow.p);
    gl.uniformMatrix4fv(shadow.u.uLight, false, shade);
    gl.bindVertexArray(fixed.vao);
    // The offset grows with slope against self-shadowing at a low sun.
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(3, 6);
    gl.drawArrays(gl.TRIANGLES, 0, triCount);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.DEPTH_TEST);
  };

  const drawStill = (t, mirror) => {
    gl.viewport(0, 0, t.w, t.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawGeometry(fixed, triCount, lineCount, triCount, mirror);
  };

  const renderStill = () => {
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(scene.p);
    const flatGlow = Math.hypot(glow[0], glow[2]) * 1.007;
    put(scene.u, {
      uSun: key, uKey: tone.lit, uAmb: tone.amb, uGnd: tone.gnd, uBnc: tone.bnc, uRim: tone.rim, uRimDir: [glow[0] / flatGlow, 0.12, glow[2] / flatGlow],
      uZen: tone.sky.subarray(3, 6), uSkyC: tone.sky.subarray(6, 9), uHorizon: tone.sky.subarray(9), uCam: view.pos, uWin: Math.max(win, dk * (0.22 + 0.4 * night), 0.1 * wu[1]), uNight: lamp,
      uFog: (0.00021 + 0.00012 * day) * (0.75 + 0.6 * weather[3]), uPix: 2 / (view.fl * H), uSnow: snowed, uWet: wet,
    });
    gl.uniformMatrix4fv(scene.u.uLight, false, shade);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, shadowDepth);
    gl.uniform1i(scene.u.uShadow, 4);
    gl.clearColor(0, 0, 0, 0);
    drawStill(still, 1);
    drawStill(stillR, -1);
    gl.disable(gl.DEPTH_TEST);
  };

  const overlay = (from, to, mirror, tris) => {
    gl.viewport(0, 0, to.w, to.h);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.fb);
    gl.blitFramebuffer(0, 0, to.w, to.h, 0, 0, to.w, to.h, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb);
    drawGeometry(moving, tris, mov.l.n / FLOATS, tris, mirror);
  };

  // The kept city with the movers over it and its reflection, at most at the idle pace.
  const drawMovers = (seconds, rest) => {
    if (movedAt < 0 || rest !== movedStill || Math.abs(seconds - movedAt) > 1 / FPS - 0.004) {
      movedAt = seconds;
      movedStill = rest;
      mov.t.n = 0;
      mov.l.n = 0;
      buildMovers(mov, seconds, lamp, rest, skein);
      gl.bindBuffer(gl.ARRAY_BUFFER, moving.buffer);
      if (mov.t.n + mov.l.n > movingSize) {
        movingSize = (mov.t.n + mov.l.n) * 2;
        gl.bufferData(gl.ARRAY_BUFFER, movingSize * 4, gl.DYNAMIC_DRAW);
      }
      // A length of zero means the whole rest, so empty parts are skipped.
      if (mov.t.n) gl.bufferSubData(gl.ARRAY_BUFFER, 0, mov.t.a, 0, mov.t.n);
      if (mov.l.n) gl.bufferSubData(gl.ARRAY_BUFFER, mov.t.n * 4, mov.l.a, 0, mov.l.n);
    }
    const tris = mov.t.n / FLOATS;
    gl.useProgram(scene.p);
    gl.enable(gl.DEPTH_TEST);
    overlay(still, main, 1, tris);
    overlay(stillR, refl, -1, tris);
    gl.disable(gl.DEPTH_TEST);
  };

  const bind = (u, unit, tex, name) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u[name], unit);
  };

  const blur = (to, from, dx, dy) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb);
    gl.uniform2f(glowP.u.uDir, dx, dy);
    bind(glowP.u, 0, from.color, 'uTex');
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const blurGlow = () => {
    gl.useProgram(glowP.p);
    gl.viewport(0, 0, glowA.w, glowA.h);
    gl.uniform2f(glowP.u.uInv, 1 / glowA.w, 1 / glowA.h);
    blur(glowA, main, 0, 0);
    blur(glowB, glowA, 1 / glowA.w, 0);
    blur(glowA, glowB, 0, 1 / glowA.h);
    blur(glowB, glowA, 3 / glowA.w, 0);
    blur(halo, glowB, 0, 3 / glowA.h);
  };

  // Uniforms from an object: number float, array vector, longer vec3s.
  const put = (u, o) => {
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'number') gl.uniform1f(u[k], v);
      else gl[`uniform${v.length > 4 ? 3 : v.length}fv`](u[k], v);
    }
  };
  // A pass over a target; textures on units from 5, clear of the shadow's.
  const pass = (prog, t, w, h, o, tex) => {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, w, h);
    put(prog.u, o);
    tex.forEach(([name, x], i) => bind(prog.u, i + 5, x, name));
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Every pass takes camera, hour, weather; ripples follow the wind.
  const shared = (seconds) => ({
    uSeed: [weather[0], weather[1]], uCam: view.pos, uR: view.r, uU: UP, uF: view.f, uFl: view.fl, uAspect: W / H, uShift: view.shift, uT: seconds,
    uNight: lamp, uDay: day * (1 - dk), uCover: [(wx[0] * 0.7 - 0.2) / 0.22, weather[3]], uWx: wu, uDrift: drift, uSunDir: glow,
    uWind: [wx[4], wx[5], wx[7] * 0.6 + (1 - wx[7]) * Math.min(0.06 + 0.13 * Math.hypot(wx[4], wx[5]), 1.8), reduce.matches ? 0 : wx[6]],
  });

  // The fringe goes with the nearest stop, leaving twice as fast; cloud lowers in overcast and rain, to the tower's
  // top in fog and storm.
  const cityPass = (seconds) => {
    const stop = clamp(Math.round(progress), 0, STOPS.length - 1);
    pass(richCity || cityP, cityT, W, H, {
      ...shared(seconds), uRes: [W, H], uSway: reach, uSS: main.w / W,
      uFore: [reach[0] * 2.4 - (progress - stop) * 2 * W, reach[1] * 2.4, ui * 100, stop], uForeA: 0.96 * richIn * (1 - smooth(clamp(Math.abs(progress - stop) * 4, 0, 1))),
      uForeC: tone.fore, uRimC: tone.rimC, uHaze: tone.sky.subarray(9), uLowC: tone.low,
      uBase: 2600 - 2450 * clamp(Math.max(0.75 * wu[0] * wu[0] + 0.25 * wu[1], wu[3], wx[6]), 0, 1),
    }, [['uScene', main.color], ['uRefl', refl.color], ['uDepth', main.depth]]);
  };

  // The page's lines in picture pixels from the foot; else the top third and foot quarter.
  const edges = (judging) => {
    const k = hd / px;
    const tall = H * hd;
    return [uiTop === null ? (judging ? tall * 0.66 : 1e6) : tall - uiTop * k, uiBottom ? uiBottom * k : judging ? tall * 0.25 : -1e6];
  };

  // Or a smaller `t`: the copy to measure, or clouds.
  const hdPass = (seconds, t, prog = rich || hdP) => {
    const cw = W * hd;
    const ch = H * hd;
    pass(prog, t, t ? t.w : cw, t ? t.h : ch, {
      ...shared(seconds), uRes: [cw, ch], uScale: [t ? cw / t.w : 1, t ? ch / t.h : 1], uSway: [reach[0] * hd, reach[1] * hd],
      uHd: hd, uDot: hd / px, uStat: +(t === statT), uIn: richIn, uQ: +(rung > 1), uLine: edges(false), uSide: zones.map((z) => smooth(z.at)),
      uStar: pal.star * (1 - wu[0] * wu[0]) * (1 - wu[3]), uGlowAmt: lamp * 2.2 * (1 + 0.6 * wu[3]), uLow: low * sunlit * (1 - dk) * (1 - 0.5 * wu[0] * wu[0]),
      uSky: tone.sky, uCloud: tone.cloud, uSea: tone.sea, uSunCol: sky.sun, uMoonCol: sky.moon, uDisc: sky.disc, uMoonDir: moonDir, uMoonL: moonLit,
      uGlitDir: sky.glitDir, uGlitCol: sky.glit, uSunUp: sky.sunUp, uMoonUp: sky.moonUp, uFlash: flash,
    }, [['uCity', cityT.color], ['uWater', cityT.depth], ['uGlow', glowA.color], ['uHalo', halo.color], ['uSteer', steerTex], ['uClouds', t === cloudT ? null : cloudT.color]]);
  };

  // Each row's extremes (unread in a flash) set the residual per zone, spread to neighbours.
  const judge = () => {
    const [top, foot] = edges(true);
    const { w, h } = statT;
    const need = new Float32Array(h * 4).fill(1);
    const rows = [[], []];
    for (let j = 0; j < h; j += 1) {
      let a = 1;
      let b = 0;
      for (let i = j * w * 4; i < (j + 1) * w * 4; i += 4) {
        if (stat[i + 1] > 127) {
          a = Math.min(a, (stat[i] / 255) ** 2);
          b = Math.max(b, (stat[i] / 255) ** 2);
        }
      }
      const y = ((j + 0.5) * H * hd) / h;
      [y > top, y < foot].forEach((inside, z) => {
        if (!inside || !rows[z].push(j) || a > b) return;
        need[j * 4 + z * 2] = Math.sqrt(Math.min(1, 0.1 / Math.max(b, 1e-4)));
        need[j * 4 + z * 2 + 1] = 1 - clamp((0.34 / Math.max(a, 1e-3) - 1) / 0.35, 0, 1);
      });
    }
    // Beyond its zone a row takes the nearest zone row's need.
    for (let c = 0; c < 4; c += 1) {
      const z = rows[c >> 1];
      const at = (j) => need[clamp(j, z[0] ?? 0, z[z.length - 1] ?? h - 1) * 4 + c];
      const least = Array.from({ length: h + 24 }, (_, j) => Math.min(...Array.from({ length: 25 }, (_, d) => at(j - d))));
      for (let j = 0; j < h; j += 1) rowsTo[j * 4 + c] = least.slice(j, j + 25).reduce((m, v) => m + v, 0) / 25;
    }
    if (!measured || reduce.matches) rowsAt.set(rowsTo);
    measured = true;
  };

  // Read back once the GPU is done; no frame waits.
  const measure = (seconds, now) => {
    hdPass(seconds, statT);
    if (now) {
      gl.readPixels(0, 0, statT.w, statT.h, gl.RGBA, gl.UNSIGNED_BYTE, stat);
      judge();
      return;
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.readPixels(0, 0, statT.w, statT.h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  };
  const collect = () => {
    if (!fence || gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) return;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, stat);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteSync(fence);
    fence = null;
    judge();
  };

  // The tower again on the front layer, so what the page sets between passes behind it.
  const corners = new Float32Array(8);
  const paintFront = () => {
    if (!front) return;
    const cw = W * hd;
    const ch = H * hd;
    frontCtx.clearRect(0, 0, cw, ch);
    if (progress >= 0.8) return;
    // The outline slides with the tower.
    const by = REACH / (REACH + view.f[0] * -view.pos[0] + view.f[2] * -view.pos[2]);
    const dx = Math.round(reach[0] * by) * hd;
    const dy = -Math.round(reach[1] * by) * hd;
    frontCtx.save();
    frontCtx.beginPath();
    for (let q = 0; q < skin.length; q += 12) {
      let cx = 0;
      let cy = 0;
      let behind = false;
      for (let k = 0; k < 4; k += 1) {
        const x = skin[q + k * 3];
        const y = skin[q + k * 3 + 1];
        const z = skin[q + k * 3 + 2];
        const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
        if (w <= 0) behind = true;
        corners[k * 2] = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w * 0.5 + 0.5) * cw + dx;
        corners[k * 2 + 1] = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w * 0.5) * ch + dy;
        cx += corners[k * 2] / 4;
        cy += corners[k * 2 + 1] / 4;
      }
      if (behind) continue;
      // Faces wound alike make one shape, let out most of a pixel.
      const turn = (corners[2] - corners[0]) * (corners[5] - corners[1]) - (corners[3] - corners[1]) * (corners[4] - corners[0]) < 0 ? -1 : 1;
      for (let k = 0; k < 4; k += 1) {
        const j = turn > 0 ? k : 3 - k;
        const ex = corners[j * 2] - cx;
        const ey = corners[j * 2 + 1] - cy;
        const l = (0.8 * hd) / (Math.hypot(ex, ey) || 1);
        if (k) frontCtx.lineTo(corners[j * 2] + ex * l, corners[j * 2 + 1] + ey * l);
        else frontCtx.moveTo(corners[j * 2] + ex * l, corners[j * 2 + 1] + ey * l);
      }
      frontCtx.closePath();
    }
    frontCtx.clip();
    frontCtx.drawImage(canvas, 0, 0);
    frontCtx.restore();
  };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const frame = (now) => {
    if (!ready) return;
    const began = performance.now();
    if (resized) fit();
    const dt = clamp((now - beat) / 1000, 0, 0.1);
    const s = now / 1000;
    beat = now;
    collect();
    // Weather eases in the sky's order: rain, snow and thunder wait for cloud, which stays till they stop.
    const calm = reduce.matches;
    const k = calm ? 1 : 1 - Math.exp(-dt * 1.6);
    const come = wxTo[0] > 0.02 ? sstep(0.6, 0.95, wx[0] / wxTo[0]) : 1;
    let moved = 0;
    for (let i = 0; i < 8; i += 1) {
      const to = i === 1 || i === 2 || i === 6 ? wxTo[i] * come : i ? wxTo[i] : wx[1] + wx[2] > 0.05 ? Math.max(wxTo[0], wx[0]) : wxTo[0];
      moved += Math.abs(to - wx[i]);
      wx[i] += (to - wx[i]) * k;
    }
    wet = calm ? +(wx[1] > 0.1) : clamp(wet + (wx[1] > 0.1 ? dt / 4 : -dt / 40), 0, 1);
    snowed = calm ? +(wx[2] > 0.1) : clamp(snowed + (wx[2] > 0.1 ? dt * 0.06 * Math.min(wx[2], 3) : -dt / 60), 0, 1);
    drift[0] += wx[4] * dt;
    drift[1] += wx[5] * dt;
    // A side changes in one eased move.
    const keying = zones[0].at !== zones[0].side;
    for (const z of zones) z.at = calm ? z.side : clamp(z.at + Math.sign(z.side - z.at) * (dt / 1.2), 0, 1);
    if (moved > 1e-4 || keying) toneUp();
    // Deck, fog, wet, snow and the key relight the city in steps.
    const drawn = wu[0] + wu[3] + snowed + wet + dk;
    const settling = moved > 1e-4 || keying || (wet > 0 && wet < 1) || (snowed > 0 && snowed < 1);
    if (Math.abs(drawn - deckDrawn) > (settling ? 0.05 : 0)) dirtyView = true;
    // Needs tighten fast, let go slowly.
    for (let i = 0; i < rowsAt.length; i += 1) rowsAt[i] += (rowsTo[i] - rowsAt[i]) * (calm ? 1 : 1 - Math.exp(-dt * (rowsTo[i] < rowsAt[i] ? 20 : 3)));
    gl.bindTexture(gl.TEXTURE_2D, steerTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, statT.h, gl.RGBA, gl.UNSIGNED_BYTE, Uint8Array.from(rowsAt, (v) => v * 255 + 0.5));
    richIn = rich ? (calm ? 1 : Math.min(1, richIn + dt / 0.6)) : 0;
    if (sky.thunder) sky.thunder(flash, s, calm ? 0 : wx[6]);
    viewAt(path, progress, lean, view);
    cameraMatrix(view, W / H, vp);
    if (dirtyLight) renderShadow();
    if (dirtyView || dirtyLight) {
      renderStill();
      deckDrawn = drawn;
    }
    dirtyView = false;
    dirtyLight = false;
    // A critically damped spring, stepped exactly.
    for (let i = 0; i < 2; i += 1) {
      const goal = leanTo[i] + (i ? 0.4 * Math.sin(s * 0.17 + 0.6) : 0.5 * Math.sin(s * 0.23) + 0.25 * Math.sin(s * 0.61 + 1.3));
      const d = sway[i] - goal;
      const k = (sway[i + 2] + 6 * d) * dt;
      const e = Math.exp(-6 * dt);
      sway[i] = goal + (d + k) * e;
      sway[i + 2] = (sway[i + 2] - 6 * k) * e;
    }
    if (reduce.matches) sway.fill(0);
    reach[0] = -sway[0] * W * 0.024;
    reach[1] = sway[1] * H * 0.007;
    drawMovers(s, calm);
    if (lamp > 0) blurGlow();
    cityPass(s);
    if (cloudP) hdPass(s, cloudT, cloudP);
    if (!measured || calm) measure(s, true);
    hdPass(s, null);
    if (!fence && !calm && flash[0] < 0.01) measure(s, false);
    paintFront();
    cost += (performance.now() - began - cost) * 0.1;
    if (listener) listener();
  };

  fit();
  updateClock();

  let raf = 0;
  let visible = true;
  let paused = false;
  let lastDraw = -1e9;
  let ranAt = -1;
  let lastClock = performance.now();
  // Over budget, step down the ladder.
  let lag = 0;
  let frames = -24;
  const stir = () => { fresh = true; };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    ranAt = now;
    const gap = now - lastDraw;
    // While anything moves, and a moment after, every frame is drawn; at rest the city keeps its beat.
    if (fresh) stirred = now;
    fresh = false;
    const busy = now - stirred < 300 || Math.hypot(sway[2], sway[3]) > 0.3;
    if (!busy && gap < 1000 / FPS - 2) return;
    lastDraw = now;
    if (now - lastClock > 30000 && hourOverride === null) {
      lastClock = now;
      updateClock();
    }
    frame(now);
    frames += 1;
    // Late against 25 fps moving, 15 at rest.
    if (frames > 0) lag += Math.min(gap, 250) / (busy ? 40 : (1000 / FPS) * 1.6);
    if (frames >= 48) {
      if ((cost > BUDGET || lag > frames) && forced === null && rung < 5) {
        rung += 1;
        fit();
      }
      lag = 0;
      frames = -24;
    }
  };
  const run = () => {
    cancelAnimationFrame(raf);
    if (!ready || !visible || paused || document.hidden) return;
    lastDraw = -1e9;
    lag = 0;
    frames = -24;
    if (reduce.matches) requestAnimationFrame(() => frame(0));
    else raf = requestAnimationFrame(loop);
  };
  const again = () => { if (reduce.matches) requestAnimationFrame(() => frame(0)); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(canvas);
  document.addEventListener('visibilitychange', run);
  reduce.addEventListener('change', run);
  // The box is measured on change, never mid-frame.
  const resize = () => { resized = true; again(); };
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(box);
  const build = () => {
    parts.shift()();
    if (parts.length) setTimeout(build);
    else {
      ready = true;
      // The glow's passes run once now, not when the first lamp lights.
      blurGlow();
      run();
      // Half a second after page and city are up, so its compile meets no first frame.
      const soon = () => setTimeout(later, 500);
      if (document.readyState === 'complete') soon();
      else addEventListener('load', soon, { once: true });
    }
  };
  setTimeout(build);

  // Clouds, weather and the fringe: a module after load, compiled beside the city, eased in.
  const later = () => import('./city-sky.js').then(({ WX, CLOUDS, FRINGE, thunder, ...more }) => {
    traffic = more.traffic;
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const all = [HD_FS(WX), `#version 300 es\n${HEAD}${CLOUDS}`, CITY_FS(FRINGE)].map((fs) => program(gl, FULL_VS, fs));
    const poll = () => {
      if (ext && !all.every((x) => gl.getProgramParameter(x.p, ext.COMPLETION_STATUS_KHR))) {
        setTimeout(poll, 50);
        return;
      }
      [rich, cloudP, richCity] = all.map((x) => linked(gl, x));
      sky.thunder = thunder;
      stir();
      again();
    };
    setTimeout(poll, ext ? 0 : 1500);
  }, () => { /* Offline: the clear sky stays. */ });

  return {
    canvas,
    get px() { return px; },
    get W() { return W; },
    get H() { return H; },
    get sky() {
      const { hour, rise, set } = clock();
      if (hour < rise - 0.8 || hour > set + 0.8) return 'night';
      if (hour < rise + 1) return 'dawn';
      if (hour > set - 1) return 'dusk';
      return 'day';
    },
    // The disc drawn now in setSun's CSS pixels, { x, y, r }: sun, else moon, else null.
    get sunPx() {
      const k = sky.sunUp > 0.25 ? 0 : sky.moonUp > 0.25 ? 1 : -1;
      return k < 0 ? null : { x: discAt[k].x, y: discAt[k].y, r: Math.max((0.0085 + 0.001 * k + (0.003 + 0.0045 * k) * richIn) * discAt[k].f, 13 * k * richIn) };
    },
    get nextSun() {
      const { hour, rise, set } = clock();
      const kind = hour >= rise && hour < set ? 'set' : 'rise';
      const value = kind === 'set' ? set : rise;
      const h = Math.floor(value);
      const m = Math.floor((value - h) * 60);
      return { kind, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
    },
    // The moon: 0 new, 0.5 full.
    get phase() { return phase; },
    get light() { return info.light; },
    // The camera's heading at the stop, radians.
    get yaw() { return viewAt(path, progress, ZERO, level).yaw; },
    get tint() { return info.tint; },
    get stats() { return { frameMs: cost, px, tris: triCount / 3 }; },
    // How far the planes have slid, -1 to 1.
    get drift() { return { x: sway[0], y: sway[1] }; },
    // An hour 0-24 replaces the clock; null restores.
    setHour(h) {
      hourOverride = h === null || h === undefined ? null : ((Number(h) % 24) + 24) % 24;
      updateClock();
      stir();
      again();
    },
    // The tower's box in CSS pixels; empty when behind.
    towerRect() {
      const m = cameraMatrix(viewAt(path, progress, ZERO, level), W / H, flat);
      let [x0, x1, y0, y1] = [1e9, -1e9, 1e9, -1e9];
      for (let y = 0; y <= 196; y += 28) {
        // Body and spine.
        const a = rad(-42 + (90 * y) / TOWER);
        for (const [x, z] of [...circle(0, 0, 23, 8), [Math.cos(a) * 31, Math.sin(a) * 31]]) {
          const w = m[3] * x + m[7] * y + m[11] * z + m[15];
          if (w <= 0) return { x: 0, y: 0, w: 0, h: 0 };
          const sx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
          const sy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
          [x0, x1, y0, y1] = [Math.min(x0, sx), Math.max(x1, sx), Math.min(y0, sy), Math.max(y1, sy)];
        }
      }
      const cw = canvas.clientWidth / 2;
      const ch = canvas.clientHeight / 2;
      return { x: (x0 + 1) * cw, y: (1 - y1) * ch, w: (x1 - x0) * cw, h: (y1 - y0) * ch };
    },
    onFrame(fn) { listener = fn; },
    // Stop while the city is covered.
    setPaused(on) {
      if (on === paused) return;
      paused = on;
      run();
    },
    // Lean the camera, -1 to 1; near planes slide farthest.
    setLean(x, y) {
      leanTo[0] = clamp(x, -1, 1);
      leanTo[1] = clamp(y, -1, 1);
      const nx = Math.round(x * 50) / 50;
      const ny = Math.round(y * 50) / 50;
      if (nx === lean[0] && ny === lean[1]) return;
      lean[0] = nx;
      lean[1] = ny;
      dirtyView = true;
      stir();
    },
    setProgress(p) {
      if (p === progress) return;
      progress = p;
      dirtyView = true;
      stir();
      again();
      // A page moving this from its own frame after the city's would lead by one: the city then goes last.
      if (raf && document.timeline && Math.abs(document.timeline.currentTime - ranAt) < 1 && performance.now() - ranAt < 6) {
        queueMicrotask(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(loop);
        });
      }
    },
    // CSS pixels the page covers below; the horizon goes above. Null guesses.
    setUiBottom(pixels) {
      uiBottom = pixels === null || pixels === undefined ? null : Math.max(0, Number(pixels));
      resize();
    },
    // CSS pixels from the top to the foot of the page's top words, held to `ink.top`. Null lets go.
    setUiTop(pixels) {
      uiTop = Number.isFinite(pixels) ? Math.max(0, pixels) : null;
      stir();
      again();
    },
    // Weather, or null for the date's own; fields left out keep their value: cloud 0-1, rain, snow mm/h, fog 0-1,
    // wind m/s from windDir, thunder 0-1.
    setWeather(w) {
      asked = w && typeof w === 'object' ? asked || { cloud: wxTo[0], wind: 0 } : null;
      for (const [k, top] of [['cloud', 1], ['rain', 100], ['snow', 50], ['fog', 1], ['wind', 60], ['thunder', 1], ['windDir', 1e9]]) {
        if (asked && Number.isFinite(w[k])) asked[k] = clamp(w[k], k === 'windDir' ? -top : 0, top);
      }
      windDir = (((asked?.windDir ?? windDir) % 360) + 360) % 360;
      aimWeather();
      stir();
      again();
    },
    get weather() {
      return { cloud: wx[0], rain: wx[1], snow: wx[2], fog: wx[3], wind: Math.hypot(wx[4], wx[5]), windDir, thunder: wx[6] };
    },
    // Ink per zone: 'light' where WCAG luminance is at most 0.12, 'dark' at least 0.32, leaving out the tower, stars,
    // discs, rain, snow, lightning.
    get ink() {
      const k = zones[0].at < 0.5 ? 'light' : 'dark';
      return { top: k, bottom: k };
    },
    // WCAG luminance in a CSS-pixel box as drawn: 2nd and 98th percentile.
    lumIn(x, y, w, h) {
      const k = hd / px;
      const x0 = clamp(Math.round(x * k), 0, W * hd - 1);
      const y0 = clamp(Math.round(y * k), 0, H * hd - 1);
      const pw = clamp(Math.round(w * k), 1, W * hd - x0);
      const ph = clamp(Math.round(h * k), 1, H * hd - y0);
      const a = new Uint8Array(pw * ph * 4);
      const count = new Uint32Array(1024);
      const t = Array.from({ length: 256 }, (_, i) => lum([i / 255, 0, 0]) / 0.2126);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(x0, H * hd - y0 - ph, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, a);
      for (let i = 0; i < a.length; i += 4) count[Math.min(1023, Math.floor((0.2126 * t[a[i]] + 0.7152 * t[a[i + 1]] + 0.0722 * t[a[i + 2]]) * 1024))] += 1;
      const at = (q) => {
        for (let i = 0, n = 0; i < 1024; i += 1) if ((n += count[i]) > q * pw * ph) return (i + 0.5) / 1024;
        return 1;
      };
      return { lo: at(0.02), hi: at(0.98) };
    },
    // The ladder's step; a number holds it (for tests), null frees it.
    get quality() { return rung; },
    setQuality(n) {
      forced = Number.isFinite(n) ? clamp(Math.round(n), 0, 6) : null;
      rung = forced ?? 0;
      resize();
    },
    // Where the page draws sun or moon, CSS pixels; `day` says whose (default the sun's by day). Null: the city's
    // arc.
    setSun(x, y, day = sunUp) {
      const spot = x === null || x === undefined ? null : [Number(x), Number(y)];
      if (day) sunSpot = spot; else moonSpot = spot;
      aim();
      stir();
      again();
    },
  };
}

/**
 * depth-field.js
 * A point lattice rendered with perspective projection, coloured along a depth
 * ramp (near = amber, far = teal) and swept by a periodic scan plane — the same
 * idea as an ARKit LiDAR capture, drawn with plain Canvas 2D.
 *
 * No dependencies. Pauses off-screen and when the tab is hidden.
 * Renders a single static frame when the visitor prefers reduced motion.
 */

const RAMP = [
  { t: 0.00, c: [78, 201, 192] },  // far   — teal
  { t: 0.55, c: [108, 124, 232] }, // mid   — indigo
  { t: 1.00, c: [255, 180, 84] },  // near  — amber
];

function sampleRamp(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMP.length; i++) {
    const a = RAMP[i - 1];
    const b = RAMP[i];
    if (x <= b.t) {
      const k = (x - a.t) / (b.t - a.t);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * k),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * k),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * k),
      ];
    }
  }
  return RAMP[RAMP.length - 1].c;
}

/* Cheap deterministic value noise — enough relief for a terrain-like field. */
function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
}

export function mountDepthField(canvas) {
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLS = 92;
  const ROWS = 36;
  const SPAN_X = 13;      // world width
  const DEPTH_NEAR = 1.6; // world units from camera
  const DEPTH_FAR = 15;
  const FOCAL = 1.05;

  let w = 0, h = 0, dpr = 1;
  let raf = 0;
  let running = false;
  let t0 = performance.now();
  let pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(now) {
    const time = (now - t0) / 1000;
    const drift = reduced ? 0 : time * 0.34;

    // Scan plane sweeps from far to near every ~7s.
    const sweep = reduced ? -1 : (time % 7) / 7;
    const scanZ = DEPTH_FAR - sweep * (DEPTH_FAR - DEPTH_NEAR);

    ctx.clearRect(0, 0, w, h);

    // Ease the pointer parallax so it never snaps.
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    const cx = w * 0.66 + pointer.x * 26;
    const cy = h * 0.5 + pointer.y * 16;
    const scale = Math.min(w * 0.78, 1150);

    for (let r = 0; r < ROWS; r++) {
      // Rows are laid out with a slight non-linearity so the far field densifies.
      const rowT = r / (ROWS - 1);
      let z = DEPTH_NEAR + Math.pow(rowT, 1.35) * (DEPTH_FAR - DEPTH_NEAR);
      z = DEPTH_NEAR + ((z - DEPTH_NEAR + drift) % (DEPTH_FAR - DEPTH_NEAR));

      for (let c = 0; c < COLS; c++) {
        const colT = c / (COLS - 1);
        const x = (colT - 0.5) * SPAN_X;

        const relief = noise(x * 0.42 + 11, z * 0.34 - drift * 0.5);
        const y = (relief - 0.5) * 1.55 + pointer.y * 0.32;

        const invZ = FOCAL / z;
        const sx = cx + x * invZ * scale * 0.5;
        const sy = cy + y * invZ * scale * 0.5;

        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

        const depthT = 1 - (z - DEPTH_NEAR) / (DEPTH_FAR - DEPTH_NEAR);
        const [rr, gg, bb] = sampleRamp(depthT);

        // Proximity to the scan plane briefly lifts a band of points.
        const dScan = Math.abs(z - scanZ);
        const lift = sweep < 0 ? 0 : Math.max(0, 1 - dScan / 0.75);

        const size = Math.max(1, invZ * 2.6 + lift * 1.5);
        const alpha = Math.min(0.95, (0.2 + depthT * 0.5) + lift * 0.55);

        ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha.toFixed(3)})`;
        ctx.fillRect(sx, sy, size, size);
      }
    }
  }

  function frame(now) {
    draw(now);
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  const ro = new ResizeObserver(() => { resize(); draw(performance.now()); });
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    entries[0].isIntersecting ? start() : stop();
  }, { threshold: 0.02 });
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  resize();
  draw(performance.now());
  if (!reduced) start();
}

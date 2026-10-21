// depth-cloud.js — Fig. 0, third state: the portrait as a depth cloud.
//
// Raw WebGL, no library. Imported by main.js the first time someone asks for
// it, so the page costs no GPU time until then. A 320×400 lattice of points
// reads the same depth map as the stipple: R is depth, G is feature detail,
// B is distance from the silhouette, A is the mask. Points are culled where
// the face is smooth and kept where it has structure, sized by depth, and
// coloured by a depth ramp modulated with the photograph's luminance so the
// eyes and lips keep their contrast. One reveal sweep, then the loop stops;
// pointer movement over the stage requests single frames.

const COLUMNS = 320;
const ROWS = 400;

// Depth ramp, deep indigo → magenta → amber. Under 1.0 because light adds up.
const FAR = [0.26, 0.14, 0.62];
const MID = [0.86, 0.24, 0.56];
const NEAR = [1.0, 0.74, 0.36];
const STAGE = [0.078, 0.071, 0.063]; // #141210

const VERT = `
attribute vec2 aUv;
attribute float aSeed;
uniform sampler2D uDepth;
uniform sampler2D uPhoto;
uniform vec2 uPointer;
uniform vec2 uFit;
uniform float uReveal;
uniform float uPointScale;
varying float vAlpha;
varying float vDepth;
varying float vSoft;
varying float vDetail;
varying vec3 vAlbedo;

void main() {
  vec4 sampled = texture2D(uDepth, aUv);
  float depth = sampled.r;
  float detail = sampled.g;
  float rim = sampled.b;
  float mask = sampled.a;

  // Local depth gradient: a steep change is an edge or a turning surface.
  vec2 step0 = vec2(0.0045, 0.0);
  vec2 step1 = vec2(0.0, 0.0045);
  float gx = texture2D(uDepth, aUv + step0).r - texture2D(uDepth, aUv - step0).r;
  float gy = texture2D(uDepth, aUv + step1).r - texture2D(uDepth, aUv - step1).r;
  float slope = clamp(length(vec2(gx, gy)) * 9.0, 0.0, 1.0);

  vec2 pos = vec2(aUv.x - 0.5, 0.5 - aUv.y) * 2.0;
  float near = depth * depth;
  pos *= 1.0 + (depth - 0.45) * 0.09;

  // 2.5D: each point travels in proportion to its depth, so the head reads
  // as a volume rather than a sliding sticker.
  float z = (depth - 0.5) * 0.85;
  pos.x += sin(uPointer.x * 0.16) * z;
  pos.y += sin(-uPointer.y * 0.09) * z * 0.75;
  pos.x += uPointer.x * mix(0.002, 0.020, near);
  pos.y += uPointer.y * mix(0.001, 0.011, near);

  // The reveal sweeps left to right; points settle in from the left.
  float delay = aUv.x * 0.55;
  float local = smoothstep(delay, delay + 0.38, uReveal);
  pos.x -= (1.0 - local) * mix(0.16, 0.04, aUv.x);

  gl_Position = vec4(pos * uFit, 0.0, 1.0);

  // Feature-aware culling: keep nearly every point where the face has
  // structure, most of them nowhere else. The CPU repeats this rule to
  // print the honest kept count.
  float keep = step(mix(0.42, 0.0, detail), aSeed);

  float far = 1.0 - near;
  float size = mix(0.85, 1.85, near) + far * 0.55;
  size *= mix(1.2, 0.42, detail);
  size *= mix(1.0, 0.8, slope);
  size *= mix(0.75, 1.0, rim);
  gl_PointSize = size * uPointScale * (0.7 + aSeed * 0.34) * local * keep;

  vAlbedo = texture2D(uPhoto, aUv).rgb;
  vSoft = far;
  vDetail = max(detail, slope * 0.75);
  vDepth = depth;
  vAlpha = mask * local * keep * (0.58 + aSeed * 0.46) * mix(0.42, 1.0, detail) * mix(0.5, 1.0, near);
}
`;

const FRAG = `
precision mediump float;
uniform vec3 uFar;
uniform vec3 uMid;
uniform vec3 uNear;
varying float vAlpha;
varying float vDepth;
varying float vSoft;
varying float vDetail;
varying vec3 vAlbedo;

void main() {
  vec2 offset = gl_PointCoord - 0.5;
  float dist = length(offset);
  if (dist > 0.5) discard;

  // A hot core plus a wide halo; neighbouring halos sum into bloom.
  float core = 1.0 - smoothstep(0.0, mix(0.11, 0.24, vSoft), dist);
  float halo = 1.0 - smoothstep(0.0, 0.5, dist);
  float shape = core * 0.95 + halo * halo * 0.22;

  vec3 colour = vDepth < 0.62
    ? mix(uFar, uMid, vDepth / 0.62)
    : mix(uMid, uNear, pow((vDepth - 0.62) / 0.38, 1.6));

  float luma = dot(vAlbedo, vec3(0.2126, 0.7152, 0.0722));
  colour *= 0.62 + luma * 0.95;
  colour += vAlbedo * (0.20 + vDetail * 0.55);
  colour = mix(colour, colour * 1.75 + vec3(0.26, 0.10, 0.22), vDetail);

  float a = vAlpha * shape;
  gl_FragColor = vec4(colour * a * 1.3, a);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

// Builds the lattice once. Returns the attribute arrays and the sampling
// positions the CPU count needs.
function lattice() {
  const uvs = new Float32Array(COLUMNS * ROWS * 2);
  const seeds = new Float32Array(COLUMNS * ROWS);
  let i = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLUMNS; x++) {
      const stagger = (y * 0.6180339887) % 1;
      const jx = (hash(x, y) - 0.5) * 0.85 + stagger;
      const jy = (hash(y, x) - 0.5) * 0.85;
      uvs[i * 2] = (x + jx) / (COLUMNS - 1);
      uvs[i * 2 + 1] = (y + jy) / (ROWS - 1);
      seeds[i] = hash(x * 1.7, y * 2.3);
      i++;
    }
  }
  return { uvs, seeds };
}

// The same rule as the vertex shader, run once on the CPU so the caption
// can print how many of the lattice points the map actually keeps.
function countKept(depthImage, uvs, seeds) {
  const W = depthImage.naturalWidth;
  const H = depthImage.naturalHeight;
  const scratch = document.createElement('canvas');
  scratch.width = W;
  scratch.height = H;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(depthImage, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  let kept = 0;
  for (let i = 0; i < seeds.length; i++) {
    const u = Math.min(1, Math.max(0, uvs[i * 2]));
    const v = Math.min(1, Math.max(0, uvs[i * 2 + 1]));
    const k = (Math.min(H - 1, Math.round(v * (H - 1))) * W + Math.min(W - 1, Math.round(u * (W - 1)))) * 4;
    if (d[k + 3] < 128) continue;
    const detail = d[k + 1] / 255;
    if (seeds[i] >= 0.42 * (1 - detail)) kept++;
  }
  return kept;
}

export function mount(stage, { depthURL, photoURL, reduceMotion = false, onCount, onLost } = {}) {
  const canvas = stage.querySelector('canvas');
  if (!canvas) return null;

  const options = { alpha: false, antialias: false, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: false };
  const gl = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const { uvs, seeds } = lattice();

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  const aUv = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

  const seedBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  const aSeed = gl.getAttribLocation(program, 'aSeed');
  gl.enableVertexAttribArray(aSeed);
  gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(program, name);
  const uPointer = u('uPointer');
  const uFit = u('uFit');
  const uReveal = u('uReveal');
  const uPointScale = u('uPointScale');
  gl.uniform3fv(u('uFar'), FAR);
  gl.uniform3fv(u('uMid'), MID);
  gl.uniform3fv(u('uNear'), NEAR);
  gl.uniform1i(u('uDepth'), 0);
  gl.uniform1i(u('uPhoto'), 1);

  // Additive: overlapping points accumulate into bloom. Valid because the
  // stage behind them is near-black.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(STAGE[0], STAGE[1], STAGE[2], 1);

  const makeTexture = (unit) => {
    const texture = gl.createTexture();
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  };
  const depthTexture = makeTexture(gl.TEXTURE0);
  const photoTexture = makeTexture(gl.TEXTURE1);

  let ready = false;
  let alive = true;
  let paused = false;
  let frame = 0;
  let revealStart = 0;
  let reveal = reduceMotion ? 1 : 0;
  let targetX = 0;
  let targetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  const request = () => {
    if (!frame && alive && ready && !paused) frame = requestAnimationFrame(draw);
  };

  function draw(now) {
    frame = 0;
    if (!alive || !ready || paused) return;

    if (reveal < 1) {
      if (!revealStart) revealStart = now;
      const t = Math.min(1, (now - revealStart) / 1150);
      reveal = 1 - Math.pow(1 - t, 3);
    }

    // Critically damped follow: the cloud lags the cursor slightly.
    pointerX += (targetX - pointerX) * 0.08;
    pointerY += (targetY - pointerY) * 0.08;

    gl.uniform2f(uPointer, pointerX, -pointerY);
    gl.uniform1f(uReveal, reveal);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, COLUMNS * ROWS);

    const settling = Math.abs(targetX - pointerX) > 0.001 || Math.abs(targetY - pointerY) > 0.001;
    if (reveal < 1 || settling) request();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    // The map is 4:5; fit it inside whatever the canvas is.
    const fitW = Math.min(w, (h * 4) / 5);
    const fitH = (fitW * 5) / 4;
    gl.uniform2f(uFit, fitW / w, fitH / h);
    // Point size tracks resolution so density looks the same at every size.
    gl.uniform1f(uPointScale, Math.max(1.5, Math.pow(h / 620, 0.55) * 2.6 * Math.min(dpr, 1.6)));
    request();
  }

  const setPointer = (event) => {
    const rect = stage.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
    targetX = Math.sign(nx) * Math.pow(Math.abs(nx), 1.35);
    targetY = Math.sign(ny) * Math.pow(Math.abs(ny), 1.35);
    request();
  };
  const resetPointer = () => { targetX = 0; targetY = 0; request(); };

  const finePointer = !reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    stage.addEventListener('pointermove', setPointer, { passive: true });
    stage.addEventListener('pointerleave', resetPointer, { passive: true });
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const onContextLost = (event) => {
    event.preventDefault();
    alive = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  Promise.all([loadImage(depthURL), photoURL ? loadImage(photoURL) : Promise.resolve(null)])
    .then(([depthImage, photoImage]) => {
      if (!alive) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, depthTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthImage);
      if (photoImage) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, photoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photoImage);
      }
      onCount?.(countKept(depthImage, uvs, seeds), COLUMNS * ROWS);
      ready = true;
      resize();
    })
    .catch(() => onLost?.());

  return {
    rescan() {
      if (reduceMotion) { request(); return; }
      reveal = 0;
      revealStart = 0;
      request();
    },
    pause() {
      paused = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
    resume() {
      paused = false;
      request();
    },
    destroy() {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (finePointer) {
        stage.removeEventListener('pointermove', setPointer);
        stage.removeEventListener('pointerleave', resetPointer);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

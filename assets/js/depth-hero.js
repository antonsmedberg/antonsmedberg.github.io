// depth-hero.js — 2.5D point-cloud reconstruction of the portrait.
//
// Rewritten off three.js: the previous version pulled 1.3 MB of library to
// draw one point sprite pass. This is ~9 KB of raw WebGL doing the same job
// with alpha blending (additive blending was washing out against the light
// background), full-face coverage, and depth-dependent parallax.

const canvas = document.querySelector('[data-depth-canvas]');
const stage = canvas?.closest('[data-depth-stage]');
const model = canvas?.closest('.identity-model');

const DEPTH_MAP = '/assets/img/portrait-depth.png';

// Depth ramp — the same three stops as the CSS tokens.
// Emissive ramp for additive blending on the dark stage: deep electric blue
// in the background, cyan through the mid volume, warm amber on the surfaces
// closest to camera. Values stay under 1.0 because additive light accumulates.
// Magma ramp: deep indigo in the background, magenta through the mid volume,
// amber and pale gold on the surfaces nearest camera.
const FAR = [0.26, 0.14, 0.62];
const MID = [0.86, 0.24, 0.56];
const NEAR = [1.00, 0.74, 0.36];

const VERT = `
attribute vec2 aUv;
attribute float aSeed;

uniform sampler2D uDepth;
uniform sampler2D uPhoto;
uniform vec2 uPointer;
uniform float uTime;
uniform float uReveal;
uniform float uSeam;
uniform float uScroll;
uniform float uPointScale;

varying float vAlpha;
varying float vDepth;
varying float vSoft;
varying float vGlow;
varying float vDetail;
varying vec3 vAlbedo;

void main() {
  vec4 sampled = texture2D(uDepth, aUv);
  float depth = sampled.r;
  float detail = sampled.g;   // eyelids, lips, nostril, jaw
  float rim = sampled.b;      // 0 on the silhouette
  float mask = sampled.a;

  // Clip space directly: the canvas and the depth map share a 4:5 box.
  vec2 pos = vec2(aUv.x - 0.5, 0.5 - aUv.y) * 2.0;

  // Fake perspective — near points push outward from centre.
  float near = depth * depth;
  pos *= 1.0 + (depth - 0.45) * 0.09;

  // True 2.5D: rotate the cloud around its vertical and horizontal axes.
  // Each point's travel is proportional to its depth, so the head reads as
  // a volume rather than a sliding sticker.
  float z = (depth - 0.5) * 0.85;
  float ay = uPointer.x * 0.16;
  float ax = -uPointer.y * 0.09;
  pos.x += sin(ay) * z;
  pos.y += sin(ax) * z * 0.75;
  pos.x += uPointer.x * mix(0.002, 0.020, near);
  pos.y += uPointer.y * mix(0.001, 0.011, near);

  // Scroll parallax — a slow vertical drift as the hero leaves the viewport.
  pos.y += uScroll * mix(0.02, 0.10, near);

  // The seam: point cloud on the left, photograph on the right.
  float visible = 1.0 - smoothstep(uSeam - 0.18, uSeam + 0.12, aUv.x);
  float edgeIn = smoothstep(0.0, 0.12, aUv.x);

  // Reveal sweep on first paint — points settle in from the left.
  float delay = aUv.x * 0.55;
  float local = smoothstep(delay, delay + 0.38, uReveal);
  pos.x -= (1.0 - local) * mix(0.16, 0.04, aUv.x);

  gl_Position = vec4(pos, 0.0, 1.0);

  // Feature-aware sampling. A uniform grid spends as many points on a flat
  // cheek as on an eyelid, which is why the eye used to dissolve. Cull most
  // points in smooth areas and keep nearly all of them where the face has
  // structure — same total count, distributed by information instead.
  float keep = step(mix(0.58, 0.0, detail), aSeed);

  // Depth of field: far points swell and soften, near points stay tight.
  float far = 1.0 - near;
  float size = mix(0.85, 1.85, near) + far * 0.55;

  // Detailed structures resolve with fine points; smooth skin can afford
  // coarser ones, which also keeps the cheek from reading as flat noise.
  size *= mix(1.35, 0.5, detail);
  size *= mix(0.75, 1.0, rim);

  gl_PointSize = size * uPointScale * (0.7 + aSeed * 0.34) * local * keep;

  // Reconstruction glow: points nearest the seam burn slightly warmer, and a
  // slow wave climbs the cloud so it always looks like a live capture.
  float seamGlow = smoothstep(0.10, 0.0, uSeam - aUv.x) * visible;
  float wave = 1.0 - smoothstep(0.0, 0.30, abs((1.0 - aUv.y) - fract(uTime * 0.055) * 1.35));
  vGlow = seamGlow * 0.18 + wave * 0.10;

  // Real colour from the photograph. A synthetic ramp cannot know that an
  // iris is dark against bright sclera, which is exactly the contrast that
  // makes an eye read at this point density.
  vAlbedo = texture2D(uPhoto, aUv).rgb;

  vSoft = far;
  vDetail = detail;
  vDepth = depth;
  vAlpha = mask * visible * edgeIn * local * keep
         * (0.42 + aSeed * 0.38)
         * mix(0.38, 1.0, detail)
         * mix(0.5, 1.0, near);
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
varying float vGlow;
varying float vDetail;
varying vec3 vAlbedo;

void main() {
  vec2 offset = gl_PointCoord - 0.5;
  float dist = length(offset);
  if (dist > 0.5) discard;

  // Two-part sprite: a hot core plus a wide halo. Under additive blending the
  // halos of neighbouring points sum into bloom, so the bright structures
  // glow without a separate post-process pass.
  float core = 1.0 - smoothstep(0.0, mix(0.16, 0.30, vSoft), dist);
  float halo = 1.0 - smoothstep(0.0, 0.5, dist);
  float shape = core * 0.85 + halo * halo * 0.35;

  // Amber is held back for the true foreground so it reads as depth cue
  // rather than a stray highlight across the hairline.
  vec3 colour = vDepth < 0.62
    ? mix(uFar, uMid, vDepth / 0.62)
    : mix(uMid, uNear, pow((vDepth - 0.62) / 0.38, 1.6));

  // Structure burns brighter than skin, so eyes, lips and jaw read as the
  // scanner locking on rather than as denser noise.
  // Modulate the emissive ramp by photographic luminance, then fold a little
  // true colour back in. Keeps the scan reading as light rather than as a
  // washed-out photo, while pupils, lips and brows keep their real contrast.
  float luma = dot(vAlbedo, vec3(0.2126, 0.7152, 0.0722));
  colour *= 0.62 + luma * 0.95;
  colour += vAlbedo * (0.20 + vDetail * 0.55);

  colour = mix(colour, colour * 1.75 + vec3(0.26, 0.10, 0.22), vDetail);
  colour += vGlow * vec3(1.0, 0.78, 0.46) * 0.5;

  // Premultiplied: emit light, and carry enough alpha that the compositor
  // keeps it. Both channels are additive, so overlap blooms.
  float a = vAlpha * shape * (1.0 + vGlow * 0.3);
  gl_FragColor = vec4(colour * a, a * 0.85);
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

function build(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  return program;
}

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function start() {
  const gl =
    canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true }) ||
    canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });

  if (!gl) return false;

  const program = build(gl);
  if (!program) return false;

  const dense = !matchMedia('(max-width: 700px)').matches;
  const columns = dense ? 260 : 132;
  const rows = Math.round(columns * 1.25);

  const uvs = new Float32Array(columns * rows * 2);
  const seeds = new Float32Array(columns * rows);

  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const jx = (hash(x, y) - 0.5) * 0.7;
      const jy = (hash(y, x) - 0.5) * 0.7;
      uvs[i * 2] = (x + jx) / (columns - 1);
      uvs[i * 2 + 1] = (y + jy) / (rows - 1);
      seeds[i] = hash(x * 1.7, y * 2.3);
      i++;
    }
  }

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

  const seedBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

  gl.useProgram(program);

  const aUv = gl.getAttribLocation(program, 'aUv');
  const aSeed = gl.getAttribLocation(program, 'aSeed');

  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
  gl.enableVertexAttribArray(aSeed);
  gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(program, name);
  const uPointer = u('uPointer');
  const uTime = u('uTime');
  const uReveal = u('uReveal');
  const uSeam = u('uSeam');
  const uScroll = u('uScroll');
  const uPointScale = u('uPointScale');

  gl.uniform3fv(u('uFar'), FAR);
  gl.uniform3fv(u('uMid'), MID);
  gl.uniform3fv(u('uNear'), NEAR);

  // Additive: overlapping points accumulate into natural bloom, which is what
  // sells the LiDAR look. Only valid because the stage behind is near-black.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.disable(gl.DEPTH_TEST);

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(u('uDepth'), 0);
  gl.uniform1i(u('uPhoto'), 1);

  // The portrait is already in cache from the <img>, so this costs no request.
  const photo = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, photo);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const photoImg = new Image();
  photoImg.decoding = 'async';
  photoImg.onload = () => {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, photo);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photoImg);
    request();
  };
  photoImg.src = '/assets/img/portrait.png';
  gl.activeTexture(gl.TEXTURE0);

  let onscreen = true;
  let ready = false;
  let frame = 0;
  let dpr = 1;
  let started = 0;

  let targetX = 0;
  let targetY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let scroll = 0;

  const request = () => {
    if (!frame && onscreen && ready) frame = requestAnimationFrame(draw);
  };

  function draw(now) {
    frame = 0;
    if (!onscreen || !ready) return;

    if (!started) started = now;
    const elapsed = (now - started) / 1000;

    // Ease the pointer so the cloud lags the cursor slightly.
    pointerX += (targetX - pointerX) * 0.07;
    pointerY += (targetY - pointerY) * 0.07;

    const linear = Math.min(1, elapsed / 1.15);
    const reveal = 1 - Math.pow(1 - linear, 3);

    // The seam sweeps right during the reveal, then settles at the mask edge.
    const seam = 0.12 + reveal * 0.50;

    gl.uniform2f(uPointer, pointerX, -pointerY);
    gl.uniform1f(uTime, elapsed);
    gl.uniform1f(uReveal, reveal);
    gl.uniform1f(uSeam, seam);
    gl.uniform1f(uScroll, scroll);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, columns * rows);

    const settling =
      Math.abs(targetX - pointerX) > 0.0015 || Math.abs(targetY - pointerY) > 0.0015;

    // Render only while something is actually changing. Pointer and scroll
    // events schedule their own frames, so idle costs zero GPU time.
    if (reveal < 1 || settling) request();
  }

  function resize() {
    const rect = (model || canvas).getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }

    // Point size tracks resolution so density looks the same at every size.
    gl.uniform1f(uPointScale, (h / 620) * 2.6);
    request();
  }

  const image = new Image();
  image.decoding = 'async';

  image.onload = () => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    ready = true;
    resize();
  };

  image.onerror = () => {
    stage?.setAttribute('data-depth', 'off');
    canvas.hidden = true;
  };

  image.src = DEPTH_MAP;

  /* Interaction */

  const setPointer = (event) => {
    const rect = stage.getBoundingClientRect();
    targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));

    stage.style.setProperty('--px', targetX.toFixed(3));
    stage.style.setProperty('--py', targetY.toFixed(3));
    request();
  };

  const resetPointer = () => {
    targetX = 0;
    targetY = 0;
    stage.style.setProperty('--px', '0');
    stage.style.setProperty('--py', '0');
    request();
  };

  stage.addEventListener('pointermove', setPointer, { passive: true });
  stage.addEventListener('pointerleave', resetPointer, { passive: true });

  let scrollQueued = false;
  addEventListener(
    'scroll',
    () => {
      if (scrollQueued) return;
      scrollQueued = true;

      requestAnimationFrame(() => {
        scrollQueued = false;
        const rect = stage.getBoundingClientRect();
        scroll = Math.max(0, Math.min(1, -rect.top / (rect.height || 1)));
        stage.style.setProperty('--sy', scroll.toFixed(3));
        request();
      });
    },
    { passive: true }
  );

  new ResizeObserver(resize).observe(model || canvas);

  new IntersectionObserver(
    ([entry]) => {
      onscreen = entry.isIntersecting;
      if (onscreen) {
        request();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { rootMargin: '120px' }
  ).observe(stage);

  gl.canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    onscreen = false;
  });

  return true;
}

if (canvas && stage) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !start()) {
    stage.setAttribute('data-depth', 'off');
    canvas.hidden = true;
  }
}

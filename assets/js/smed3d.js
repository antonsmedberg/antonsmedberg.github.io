// Bit in 3D: a small retro computer on two legs who lives on the glass bar. Each body part is
// a voxel model, the round ones in half-size cells, rigid on a joint tree, meshed once with
// baked shade and lit by the city's sun; smed3d-fine.js rounds and relights him after load.
// His face is a 20 x 15 pixel display, never blank: even typing, his eyes stay above the code.

const VOX = 3.3; // CSS pixels per voxel; he stands 23 voxels tall, 28 with his antenna.
const VIEW_W = 180;
const VIEW_H = 198;
const GROUND = 26; // CSS pixels of view below his feet, for the shadow and dangling legs.
const BOX_W = 64;
const BOX_H = 126; // Tall enough that the speech bubble clears his antenna.
const WALK = 46;
const RUN = 170;
const ROLL_DIST = 84;
const REACH = 58; // CSS pixels he spans each side of his middle at most.
const TILT = 0.26; // Sine of the camera's downward pitch.
const UPPER = 2.6;
const LOWER = 2.6;
const LEG = UPPER + LOWER - 0.05;
const HIP = 6; // Height of the hip joints when he stands tall.
const ANKLE = 1.5;
const NECK = 9; // Where the monitor turns on its stand.
const SEAT = 5.2; // How far the stand drops to sit on the bar.
const FW = 20; // The display, in its own pixels.
const FH = 15;
const LINKS = 8; // Segments of the cable tail.
const SEG = 1.7;
const WALL = 11; // Voxels a link may stray from his middle.
const DOTS = 10; // Dust pixels.
const RAD = Math.PI / 180;

/* ------------------------------------------------------------------- Model */

const PALETTE = [
  [1, 0.93, 0.8], [0.88, 0.76, 0.64], [0.56, 0.48, 0.52], [1, 0.45, 0.4], [1, 0.98, 0.94], [0.31, 0.32, 0.8],
  [1, 0.76, 0.28], [0.1, 0.1, 0.24], [0.85, 0.74, 0.64], [0.1, 0.4, 0.74], [0.55, 1, 0.82], [1, 0.72, 0.3], [0, 0, 0],
];
const [CREAM, SHADE, TRIM, CORAL, SOLE, INDIGO, AMBER, DARK, BEZEL, BLUE, MINT, LAMP, SCREEN] = PALETTE.keys();
const PAINT = 100; // Added to a colour: recolour the cells already there, add none.
const FINE = [0.5, 0.5, 0.5]; // Half-size cells, for the parts that are rounded.

// Rest position of each joint, in voxels: x forward, y to his left, z up, origin under his middle.
const PIVOT = { pelvis: [0, 0, 7], body: [0, 0, NECK], ant: [-1, 3, 22.5], tip: [-1, 3, 26.5] };
const LEGS = [[0, -3, HIP], [0, 3, HIP]]; // Right, left.

// A part is boxes [x0, y0, z0, x1, y1, z1, colour, r] of whole cells around an anchor; `o` shifts
// the grid by half cells, `s` scales it, colour -1 carves, `r` rounds the box's corners as seen
// from the front. `core` parts shade each other.
const PARTS = [];
const part = (bone, a, o, boxes, s = [1, 1, 1], core = false) => PARTS.push({ bone, a, o, boxes, s, core });
const pair = (bone, a, boxes) => {
  PIVOT[`${bone}1`] = a;
  PIVOT[`${bone}0`] = [a[0], -a[1], a[2]];
  part(`${bone}1`, a, [0, 0, 0], boxes, FINE);
  part(`${bone}0`, PIVOT[`${bone}0`], [0, 0, 0], boxes.map((b) => [b[0], -b[4], b[2], b[3], -b[1], b[5], b[6], b[7]]), FINE);
};
const tube = (z0, z1) => [[-2, -1, z0, 2, 1, z1, INDIGO], [-1, -2, z0, 1, 2, z1, INDIGO]];

// The base he stands on is his hips: a keyboard with a low front lip. Its neck runs up inside
// the monitor so a tilt never opens a gap.
part('pelvis', PIVOT.pelvis, [0, 0, 0], [
  [-6, -10, -2, 11, 10, 2, SHADE, 2], [7, -10, 0, 11, 10, 2, -1], [-6, -10, -2, 11, 10, -1, TRIM + PAINT],
  ...[-7, -4, -1, 2, 5].map((y) => [8, y, -1, 10, y + 2, 0, TRIM + PAINT]), [-4, -4, 2, 4, 4, 8, TRIM],
], FINE, true);
// The monitor is head and body in one: a round-cornered shell that steps down to the tube
// behind, a darker bezel set into its face, the screen set into that, vents, a floppy slot
// and a flag sticker from home.
part('body', PIVOT.body, [0, 0, 0], [
  [-8, -16, 0, 9, 16, 28, CREAM, 8], [9, -15, 1, 10, 15, 27, CREAM, 7], [-8, -16, 0, 10, 16, 2, SHADE + PAINT],
  [-12, -12, 3, -8, 12, 25, SHADE, 6], [-15, -9, 6, -12, 9, 22, SHADE, 4], [-15, -5, 10, -14, 5, 18, TRIM + PAINT],
  [9, -14, 4, 10, 14, 26, -1, 4], [8, -14, 4, 9, 14, 26, BEZEL + PAINT], [8, -12, 6, 9, 12, 24, -1, 2], [7, -12, 6, 8, 12, 24, DARK + PAINT],
  ...[-5, -2, 1].map((x) => [x, -7, 27, x + 1, 7, 28, SHADE + PAINT]), [9, -11, 2, 10, -4, 3, DARK + PAINT],
  [-5, -16, 14, 2, -15, 19, BLUE + PAINT], [-5, -16, 16, 2, -15, 17, AMBER + PAINT], [-3, -16, 14, -2, -15, 19, AMBER + PAINT],
], FINE, true);
// How much of the screen's light the bezel catches: all inside the recess, fading outward.
PARTS[1].glow = (q) => (q[0] < 3.9 ? 0 : clamp(1 - Math.hypot(Math.max(Math.abs(q[1]) - 6, 0), Math.max(Math.abs(q[2] - 7.5) - 4.5, 0)) / 2.6, 0, 1) ** 2);
part('body', [4.04, 0, 16.5], [0, -0.5, -0.5], [[-1, 0, 0, 0, 1, 1, SCREEN]], [0.1, 12, 9]);
part('body', [5, 5.5, 10], [0, -0.5, 0], [[-1, 0, 0, 1, 1, 1, MINT]], [0.15, 0.9, 0.7]);
// The antenna is a coiled spring with a lamp on its end.
part('ant', PIVOT.ant, [0, 0, 0], [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k % 2 - 2, k % 2 - 2, k - 1, 2 - k % 2, 2 - k % 2, k, k % 2 ? DARK : TRIM]), [0.3, 0.3, 0.5]);
part('tip', PIVOT.tip, [0, 0, 0], [[-2, -2, -2, 2, 2, 2, LAMP, 1.5]], FINE);
// Arms bend at the elbow and end in mittens: a cuff, a round palm and a thumb.
pair('arm', [2, 8.6, 13.5], tube(-6, 2));
pair('fore', [2, 8.6, 10.5], [...tube(-3, 2), [-2, -3, -4, 2, 3, -3, SOLE], [-2, -3, -9, 2, 3, -4, CORAL, 2], [2, -1, -8, 4, 1, -5, CORAL]]);
// Legs: thin shanks inside wider thighs, a sock, and chunky sneakers with a white sole and toe.
LEGS.forEach((h, i) => {
  PIVOT[`upper${i}`] = h;
  PIVOT[`lower${i}`] = [0, h[1], HIP - UPPER];
  PIVOT[`foot${i}`] = [0, h[1], HIP - UPPER - LOWER];
  part(`upper${i}`, h, [0, 0, 0], [[-1, -1, -3, 1, 1, 1, INDIGO]], [1.1, 1.1, 1]);
  part(`lower${i}`, PIVOT[`lower${i}`], [0, 0, 0], [[-1, -1, -2, 1, 1, 1, INDIGO], [-1, -1, -2, 1, 1, -1, SOLE + PAINT]], [0.9, 0.9, 1]);
  part(`foot${i}`, PIVOT[`foot${i}`], [0, 0, 0], [
    [-4, -4, -3, 8, 4, -1, SOLE], [-4, -4, -1, 7, 4, 2, CORAL, 2], [5, -4, 0, 8, 4, 2, -1], [4, -4, -1, 8, 4, 0, SOLE + PAINT], [0, -4, 1, 2, 4, 2, SOLE + PAINT],
  ], FINE);
});
// The cable tail is a chain of short links ending in a plug.
for (let k = 0; k < LINKS; k += 1) part(`tail${k}`, [0, 0, 0], [0, -0.5, -0.5], [[0, 0, 0, 1, 1, 1, CORAL]], [SEG + 0.3, 0.8, 0.8]);
part('plug', [0, 0, 0], [0, -0.5, 0], [[0, -1, -1, 2, 2, 1, CREAM], [2, -1, 0, 4, 0, 1, AMBER], [2, 1, 0, 4, 2, 1, AMBER]], [0.7, 0.75, 0.75]);
for (let k = 0; k < DOTS; k += 1) part(`dot${k}`, [0, 0, 0], [-0.5, -0.5, -0.5], [[0, 0, 0, 1, 1, 1, [MINT, CREAM, CORAL][k % 3]]]);

// Cull hidden faces; bake corner occlusion, shade from overhead, open edges and the screen's glow.
function buildMesh() {
  for (const p of PARTS) {
    const lo = [0, 1, 2].map((i) => Math.min(...p.boxes.map((b) => b[i])));
    const hi = [0, 1, 2].map((i) => Math.max(...p.boxes.map((b) => b[i + 3])));
    const dim = hi.map((v, i) => v - lo[i]);
    const grid = new Int8Array(dim[0] * dim[1] * dim[2]);
    for (const b of p.boxes) {
      const r = b[7] || 0;
      const round = (v, i) => Math.max(Math.abs(v + 0.5 - (b[i] + b[i + 3]) / 2) - (b[i + 3] - b[i]) / 2 + r, 0);
      for (let x = b[0]; x < b[3]; x += 1) for (let y = b[1]; y < b[4]; y += 1) for (let z = b[2]; z < b[5]; z += 1) {
        if (Math.hypot(round(y, 1), round(z, 2)) > r) continue;
        const at = ((x - lo[0]) * dim[1] + y - lo[1]) * dim[2] + z - lo[2];
        if (b[6] < PAINT) grid[at] = b[6] + 1;
        else if (grid[at]) grid[at] = b[6] - PAINT + 1;
      }
    }
    Object.assign(p, { lo, hi, dim, grid });
    p.at = (c) => (c.every((v, i) => v >= lo[i] && v < hi[i]) ? grid[((c[0] - lo[0]) * dim[1] + c[1] - lo[1]) * dim[2] + c[2] - lo[2]] : 0);
  }
  const core = PARTS.filter((p) => p.core);
  const data = [];
  PARTS.forEach((p, pi) => {
    const filled = (c) => p.at(c) || (p.core && core.some((q) => q !== p && q.at(c.map((v, i) => Math.floor((p.a[i] + p.s[i] * (p.o[i] + v + 0.5) - q.a[i]) / q.s[i] - q.o[i])))));
    const step = (c, i, d) => { const n = [...c]; n[i] += d; return n; };
    for (let x = p.lo[0]; x < p.hi[0]; x += 1) for (let y = p.lo[1]; y < p.hi[1]; y += 1) for (let z = p.lo[2]; z < p.hi[2]; z += 1) {
      const cell = [x, y, z];
      const colour = p.at(cell) - 1;
      if (colour < 0) continue;
      for (let axis = 0; axis < 3; axis += 1) for (const d of [-1, 1]) {
        const out = step(cell, axis, d);
        if (p.at(out)) continue;
        const u = (axis + 1) % 3;
        const v = (axis + 2) % 3;
        let sky = 1;
        if (p.core) for (let k = 6; k > 0; k -= 1) if (filled(step(out, 2, k))) sky = 0.64 + 0.05 * k;
        const edges = [!p.at(step(cell, u, -1)), !p.at(step(cell, u, 1)), !p.at(step(cell, v, -1)), !p.at(step(cell, v, 1))];
        const quad = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([cu, cv]) => {
          const a = filled(step(out, u, cu ? 1 : -1)) ? 1 : 0;
          const b = filled(step(out, v, cv ? 1 : -1)) ? 1 : 0;
          const c = filled(step(step(out, u, cu ? 1 : -1), v, cv ? 1 : -1)) ? 1 : 0;
          const open = a && b ? 0 : 3 - a - b - c;
          const pos = [...cell];
          if (d > 0) pos[axis] += 1;
          pos[u] += cu;
          pos[v] += cv;
          const glow = p.glow ? Math.round(127 * p.glow(pos.map((q, i) => (q + p.o[i]) * p.s[i]))) : 0;
          return { open, bytes: [...pos.map((q, i) => (q + p.o[i]) * 2), cu, cv, pi, axis * 2 + (d > 0 ? 1 : 0), colour, Math.round(127 * (0.46 + 0.18 * open) * sky), ...edges, glow, 0, 0] };
        });
        // Split along the diagonal that keeps the shade smooth.
        const order = quad[0].open + quad[2].open >= quad[1].open + quad[3].open ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
        for (const i of order) data.push(...quad[i].bytes);
      }
    }
  });
  return new Int8Array(data);
}

/* ----------------------------------------------------------------- Shaders */

const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec2 aU; layout(location=2) in vec4 aM;
layout(location=3) in vec4 aE; layout(location=4) in float aG;
uniform vec4 uB[${PARTS.length * 3}],uView; uniform vec2 uRes;
out vec3 vC; out vec2 vU; out float vA,vG; flat out vec3 vN; flat out vec4 vE; flat out float vK;
const vec3 PAL[${PALETTE.length}]=vec3[${PALETTE.length}](${PALETTE.map((c) => `vec3(${c.map((v) => v.toFixed(2))})`)});
void main(){
  int b=int(aM.x)*3,f=int(aM.y),c=int(aM.z);
  vec4 p=vec4(aP*.5,1.);
  vec3 w=vec3(dot(uB[b],p),dot(uB[b+1],p),dot(uB[b+2],p)),n=vec3(0.);
  n[f>>1]=(f&1)==1?1.:-1.;
  vN=normalize(vec3(dot(uB[b].xyz,n),dot(uB[b+1].xyz,n),dot(uB[b+2].xyz,n)));
  vC=PAL[c]; vU=aU; vA=aM.w/127.; vG=aG/127.; vE=aE; vK=c==${SCREEN}?2.:c>=${MINT}?1.:0.;
  float ca=sqrt(1.-uView.w*uView.w);
  gl_Position=vec4((w.x*uView.x+uView.y)*2./uRes.x-1.,((w.y*ca-w.z*uView.w)*uView.x+uView.z)*2./uRes.y-1.,-(w.y*uView.w+w.z*ca)*.02,1.);
}`;

// Key, a cool fill from above, light on open edges and a rim; pale colours take only part of
// the light's hue, so cream stays cream. The screen lights itself: a dot per display pixel, a
// bloom, scanlines and a sheen. The power light and the lamp breathe.
const FS = `#version 300 es
precision highp float;
in vec3 vC; in vec2 vU; in float vA,vG; flat in vec3 vN; flat in vec4 vE; flat in float vK;
uniform vec3 uSun,uKey,uAmb,uSky; uniform vec4 uGlow; uniform float uOn; uniform sampler2D uFace;
out vec4 o;
const vec3 L=vec3(.3,.59,.11);
void main(){
  if(vK>1.5){
    vec2 uv=vec2(vU.x,1.-vU.y),g=uv*vec2(${FW}.,${FH}.),f=abs(fract(g)-.5),q=vU-.5,d=vec2(.035,.047);
    vec3 t=texelFetch(uFace,ivec2(min(g,vec2(${FW - 1}.,${FH - 1}.))),0).rgb;
    float w=fwidth(g.x),m=mix(1.-smoothstep(.42-w,.42+w,max(f.x,f.y)),.85,clamp(w*2.2-.3,0.,1.));
    t=t*(m+.2)+(texture(uFace,uv+d).rgb+texture(uFace,uv-d).rgb)*.24;
    vec3 ink=vec3(.6,1.,.85)*t.r+vec3(1.,.45,.55)*t.g+vec3(1.,.82,.36)*t.b;
    vec3 col=vec3(.08,.11,.36)*(.7+.3*(1.-dot(q,q)*2.2))*(.94+.06*sin(g.y*6.283))+ink;
    col=col*uOn+vec3(.02,.025,.06)+(uSky*.5+.3)*.2*smoothstep(.16,.5,q.y-q.x*.3+q.x*q.x);
    o=vec4(col,1.); return;
  }
  float nl=dot(vN,uSun),k=.5*smoothstep(-.14,.1,nl)+.5*smoothstep(.4,.62,nl);
  float d=min(min(mix(1.,vU.x,vE.x),mix(1.,1.-vU.x,vE.y)),min(mix(1.,vU.y,vE.z),mix(1.,1.-vU.y,vE.w)));
  float edge=1.-smoothstep(.03,.2,d),pale=.75*smoothstep(.45,.75,min(vC.r,min(vC.g,vC.b)));
  vec3 key=mix(uKey,vec3(dot(uKey,L)),pale),amb=mix(uAmb,vec3(max(dot(uAmb,L),.6)),pale),sky=mix(uSky,vec3(dot(uSky,L)),pale);
  vec3 col=vC*(amb*(.64+.28*vN.y)*vA+sky*.18*max(vN.y,0.)*vA+key*.44*k*mix(.6,1.,vA));
  col+=vC*(key*.6+sky*.25)*edge*(.2+.7*k);
  col+=vC*sky*.2*pow(1.-max(vN.z,0.),2.)*(.5+.5*vN.y);
  col*=mix(vec3(.94,.96,1.07),vec3(1.05,1.,.94),k);
  col+=uGlow.rgb*vG*(.3+.7*vC);
  if(vK>.5) col=vC*(.35+uGlow.w);
  o=vec4(col,1.);
}`;

const SHADOW_VS = `#version 300 es
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.-1.,.9,1.); }`;

// Contact shadow: soft blobs under his feet, body and plug, in ground coordinates.
const SHADOW_FS = `#version 300 es
precision highp float;
uniform vec4 uS[4],uView;
out vec4 o;
void main(){
  vec2 g=vec2((gl_FragCoord.x-uView.y)/uView.x,(uView.z-gl_FragCoord.y)/(uView.x*uView.w));
  float a=0.;
  for(int i=0;i<4;i++){ vec2 d=(g-uS[i].xy)/uS[i].z; d.y*=.6; a+=uS[i].w*exp(-dot(d,d)); }
  a=min(a,.55)*smoothstep(0.,uView.z*.5,gl_FragCoord.y);
  o=vec4(vec3(.02,.04,.13)*a,a);
}`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
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

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Row-major 3x3 rotations, degrees.
const rot = (deg, i, j) => {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
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

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------------------------------------------------- Face */

// The face is numbers, not frames: eyes, brows and mouth. An expression is a set of goals
// for them and springs carry one into the next.
const FK = ['lx', 'ly', 'ew', 'eh', 'ol', 'or', 'arc', 'ring', 'heart', 'spiral', 'brow', 'bl', 'br', 'mw', 'mc', 'mo', 'oo', 'orad', 'my', 'blush', 'dots', 'zz', 'code', 'boot', 'on'];
const [LX, LY, EW, EH, OL, OR, ARC, RING, HEART, SPIRAL, BROW, BL, BR, MW, MC, MO, OO, ORAD, MY, BLUSH, DOTS_ON, ZZ, CODE, BOOT, ON] = FK.map((_, i) => i);
const face = (o) => {
  const d = { ew: 2.5, eh: 3, ol: 1, or: 1, mw: 5, mc: 2, orad: 1.2, blush: 0.8, on: 1, ...o };
  return Float32Array.from(FK, (k) => d[k] || 0);
};
const FACES = {
  smile: face({}),
  grin: face({ mc: 3.4, mo: 1, blush: 1 }),
  wink: face({ ol: 0.1, mc: 3.4, mo: 1, blush: 1 }),
  surprise: face({ ring: 1, oo: 1, my: 0.5, blush: 0.2 }),
  think: face({ lx: 1, brow: 1, br: 1, dots: 1, blush: 0.3 }),
  laugh: face({ arc: 1, mc: 3.4, mo: 1, blush: 1 }),
  sleepy: face({ ol: 0.4, or: 0.4, mw: 3, mc: 1, blush: 0.4, on: 0.85 }),
  asleep: face({ ol: 0.1, or: 0.1, mw: 2, mc: 0, zz: 1, blush: 0.3, on: 0.5 }),
  yawn: face({ ol: 0.1, or: 0.1, oo: 1, orad: 2.2, blush: 0.5 }),
  love: face({ heart: 1, mw: 4, mc: 2.2, mo: 1, blush: 1 }),
  dizzy: face({ spiral: 1, mw: 4, mc: -1.2, my: 1.5, blush: 0.2 }),
  code: face({ code: 1, ly: -1, eh: 2 }),
  boot: face({ boot: 1, blush: 0 }),
};

const hash = (n) => { const s = Math.sin(n * 91.7) * 43758.5; return s - Math.floor(s); };
const cov = (d) => clamp(0.5 - d * 2.5, 0, 1); // Coverage of a display pixel at distance d from an edge.
// Rests on whole pixels and crosses between them quickly, so a curve stays one pixel sharp.
const snap = (v) => { const r = Math.round(v); return r + Math.sign(v - r) * Math.max(0, Math.abs(v - r) - 0.3) * 2.5; };
const ZED = [15, 4, 2, 15]; // The rows of a z, as bits.
const box = (x, y, hw, hh, r) => {
  const qx = Math.abs(x) - hw + r;
  const qy = Math.abs(y) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

// Paint the display: mint ink in red, coral in green, amber in blue; the shader colours them.
function paintFace(f, lid, t, prog, pix) {
  const show = 1 - clamp(f[BOOT], 0, 1);
  const plain = 1 - clamp(f[CODE], 0, 1); // Typing, the code takes the place of mouth and cheeks.
  const lines = Math.floor(t / 0.45);
  for (let j = 0; j < FH; j += 1) for (let i = 0; i < FW; i += 1) {
    const x0 = i + 0.5 - FW / 2;
    const y0 = j + 0.5;
    const px = x0 - snap(f[LX]);
    const py = y0 - snap(f[LY]);
    let r = 0;
    let g = 0;
    let b = 0;
    if (show > 0.01) {
      const special = clamp(f[ARC] + f[RING] + f[HEART] + f[SPIRAL], 0, 1);
      for (const s of [-1, 1]) {
        const hx = px - s * 5;
        const hy = py - 6.5;
        const ex = hx + s * 0.5;
        const ey = hy + 0.5;
        const hh = Math.max(f[EH] * f[s < 0 ? OL : OR] * lid, 0.5);
        const round = Math.hypot(hx, hy);
        // Lids close down onto the eye's bottom; one pixel stays dark for a glint.
        let eye = cov(box(ex, ey - f[EH] + hh, f[EW], hh, Math.min(2, hh)));
        eye -= cov(box(ex + 1, ey + 1.5, 0.5, 0.5, 0)) * clamp(hh - 2, 0, 1);
        const swirl = cov(round - 2.9) * (0.5 + 0.5 * Math.sin(Math.atan2(hy, hx) - round * 2.4 + t * 10)) + cov(round - 0.7);
        const kx = hx / 2.7;
        const ky = (0.6 - hy) / 2.7 + 0.08 * Math.sin(t * 7);
        r = Math.max(r, eye * (1 - special), f[ARC] * cov(Math.abs(hy + 1 - snap(0.3 * hx * hx)) - 0.5) * cov(Math.abs(hx) - 3), f[RING] * cov(Math.abs(round - 2.2) - 0.6), f[SPIRAL] * Math.min(swirl, 1));
        g = Math.max(g, f[HEART] * cov(((kx * kx + ky * ky - 1) ** 3 - kx * kx * ky ** 3) * 2));
        r = Math.max(r, f[BROW] * cov(box(hx, hy + f[EH] + 1.5 + f[s < 0 ? BL : BR], 2, 0.5, 0)));
      }
      // A smile is an arc two pixels thick; opening it fills up to a flat top, with a coral tongue.
      const mx = px + snap(f[LX] * 0.5);
      const my = py + snap(f[LY] * 0.5) - 10.5 - f[MY];
      const mw = Math.max(f[MW], 1);
      const arc = snap(f[MC] * (1 - (mx / (mw - 0.5)) ** 2));
      const inside = cov(Math.abs(mx) - mw);
      const open = clamp(f[MO], 0, 1);
      const fill = Math.min(cov(arc * (1 - open) - 0.5 - my), cov(my - arc - 0.5)) * inside * clamp(open * 4, 0, 1);
      const tongue = fill * cov(Math.abs(mx) - mw * 0.5) * cov(arc - 1.5 - my) * open;
      const mouth = (Math.max(cov(Math.abs(my - arc - 0.5) - 1) * inside, fill) - tongue) * (1 - f[OO]) * (1 - f[DOTS_ON]) * plain;
      r = Math.max(r, mouth, f[OO] * cov(Math.abs(Math.hypot(mx, my - 0.5) - f[ORAD]) - 0.55));
      g = Math.max(g, tongue * (1 - f[OO]) * plain, 0.8 * f[BLUSH] * plain * cov(box(Math.abs(px) - 8, py - 10, 1, 1, 0)));
      r *= show;
      g *= show;
      // Thinking dots hop in turn where the mouth was; sleeping lets two z drift up the glass.
      for (let k = -1; k < 2; k += 1) b = Math.max(b, show * f[DOTS_ON] * cov(box(mx - k * 3, my - 1 + snap(1.6 * Math.max(0, Math.sin(t * 6 - k * 1.2))), 1, 1, 0)));
      for (let k = 0; k < 2; k += 1) {
        const u = (t * 0.3 + k * 0.5) % 1;
        const zx = i - 11 - Math.floor(5 * u + Math.sin(u * 9 + k));
        const zy = j - 5 + Math.floor(6 * u);
        if (zx >= 0 && zx < 4 && zy >= 0 && zy < 4 && (ZED[zy] >> zx) & 1) r = Math.max(r, show * f[ZZ] * Math.sin(Math.PI * u));
      }
    }
    if (f[CODE] > 0.01 && j > 8 && j % 2) {
      // Three lines of code scroll under his eyes; the newest types out behind a cursor.
      const line = (j - 9) / 2 + lines;
      const c = i - 1 - Math.floor(hash(line) * 3) * 2;
      const typed = Math.min(Math.floor(4 + hash(line + 0.5) * 10), Math.floor((t - (line - 2) * 0.45) * 40));
      if (c >= 0 && c < typed && hash(line * 7 + (c >> 1)) > 0.22) { if (c < 3) b = f[CODE]; else r = f[CODE] * 0.9; }
      if (c === Math.max(typed, 0) && line === lines + 2 && Math.sin(t * 14) > -0.3) r = f[CODE];
    }
    if (f[BOOT] > 0.01) {
      const bar = box(x0, y0 - 8.5, 7, 1.5, 0);
      r = Math.max(r, f[BOOT] * Math.max(cov(Math.abs(bar + 0.5) - 0.5), cov(box(x0 + 5.5, y0 - 4.5, 1.5, 0.5, 0)) * (Math.sin(t * 12) > 0 ? 1 : 0)));
      b = Math.max(b, f[BOOT] * cov(box(x0 + 6 - 6 * prog, y0 - 8.5, 6 * prog, 0.5, 0)));
    }
    pix.set([r * 255, g * 255, b * 255, 255], (j * FW + i) * 4);
  }
}

/* -------------------------------------------------------------------- Poses */

// Arm angles in degrees, pairs (right, left): swing forward, raise sideways, reach inward,
// bend the elbow. Leg angles count off the ground only; on it `ik` hands the legs to the
// planted feet, `stag` voxels apart front to back. `tail` scales the cable's curl.
const KEYS = ['swing', 'raise', 'inw', 'elbow'];
const SOLO = ['drop', 'wide', 'stag', 'bpitch', 'tilt', 'twist', 'ik', 'hip', 'knee', 'kick', 'tail', 'wag'];
const N = KEYS.length * 2 + SOLO.length;
const [SWING, RAISE, INW, ELBOW, DROP, WIDE, STAG, BPITCH, BTILT, TWIST, IK, HIPS, KNEE, KICK, TAIL, WAG] = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const TURN = N; // After the pose: heading and head turn.

function pose(o) {
  const p = new Float32Array(N);
  const d = { swing: [0, 0], raise: [10, 10], inw: [0, 0], elbow: [26, 26], ik: 1, tail: 1, wag: 0.5, drop: 0.3, bpitch: -5, ...o };
  KEYS.forEach((k, i) => { p[i * 2] = d[k][0]; p[i * 2 + 1] = d[k][1]; });
  SOLO.forEach((k, i) => { p[KEYS.length * 2 + i] = d[k] || 0; });
  return p;
}

const P = {
  stand: pose({ wide: 0.3 }),
  rest: pose({ drop: 0.7, tilt: 4, bpitch: -3, stag: 0.7, wide: 0.6, raise: [8, 34], elbow: [16, 70] }),
  dash: pose({ drop: 0.9, bpitch: 15, swing: [-72, -72], raise: [16, 16], elbow: [4, 4], tail: 0.9, wag: 0 }),
  turn: pose({ drop: 1.4, bpitch: 3, wide: 0.5, raise: [26, 26], elbow: [40, 40] }),
  off: pose({ drop: 1.1, bpitch: 24, raise: [3, 3], elbow: [3, 3], tail: 0, wag: 0 }),
  wave: pose({ drop: 0.4, bpitch: -9, tilt: 7, raise: [12, 156], elbow: [18, 40], tail: 1.2, wag: 1.2 }),
  bow: pose({ drop: 1.2, bpitch: 32, swing: [-34, -34], raise: [22, 22], tail: 1.4 }),
  think: pose({ drop: 0.5, bpitch: -11, tilt: -8, stag: 0.8, swing: [0, 28], elbow: [86, 64], raise: [42, 0], inw: [-30, 45], tail: 0.7, wag: 0.1 }),
  type: pose({ drop: 0.7, bpitch: 9, elbow: [68, 68], inw: [22, 22], raise: [0, 0], wag: 0.2 }),
  polish: pose({ drop: 0.4, bpitch: -7, tilt: 5, swing: [0, 80], inw: [0, 48], elbow: [14, 30], raise: [16, 0] }),
  yawn: pose({ drop: 0.1, bpitch: -17, raise: [152, 150], elbow: [34, 58], tail: 0.5, wag: 0 }),
  love: pose({ drop: 0.6, bpitch: -7, swing: [62, 62], elbow: [128, 128], inw: [12, 12], tail: 1.3, wag: 1.5 }),
  startle: pose({ drop: 0, bpitch: -13, raise: [150, 150], elbow: [22, 22], wide: 0.8, tail: 1.5, wag: 0 }),
  proud: pose({ drop: 0.2, bpitch: -11, raise: [44, 44], elbow: [96, 96], inw: [-30, -30], tail: 1.3, wag: 1 }),
  woozy: pose({ drop: 1, wide: 1, raise: [28, 28], elbow: [20, 20], tail: 0.4, wag: 0.2 }),
  squat: pose({ drop: 2.3, bpitch: 8, wide: 0.8, raise: [36, 36], elbow: [32, 32], tail: 0.5 }),
  sit: pose({ ik: 0, drop: SEAT, hip: 86, knee: 82, bpitch: -7, raise: [24, 24], elbow: [8, 8], swing: [-12, -12], tail: 0.5, wag: 0.4 }),
  sleep: pose({ ik: 0, drop: SEAT, hip: 88, knee: 72, bpitch: 15, tilt: 13, raise: [5, 5], elbow: [4, 4], tail: 0, wag: 0 }),
  jump: pose({ ik: 0, hip: 34, knee: 64, raise: [154, 154], elbow: [12, 12], bpitch: -9, tail: 1.4 }),
  click: pose({ ik: 0, hip: 4, knee: 14, kick: 1, tilt: 12, raise: [24, 156], elbow: [12, 12], bpitch: -5, tail: 1.2 }),
  trip: pose({ drop: 1, bpitch: 22, wide: 0.2, stag: 1.6, raise: [50, 30], swing: [44, -30], tail: 1.5, wag: 0 }),
  spin: pose({ ik: 0, hip: 30, knee: 44, raise: [158, 158], elbow: [10, 10], bpitch: 0, tail: 0.3, wag: 0 }),
  hang: pose({ ik: 0, hip: 10, knee: 20, raise: [158, 158], elbow: [20, 20], bpitch: 4, tail: 0, wag: 0 }),
};

// Acts he can perform standing: seconds, pose, face, degrees turned toward the viewer and
// spring rate, then when and into what pose and face the act changes.
const ACTS = {
  wave: [1.9, 'wave', 'grin', 84, 3.4],
  bow: [1.7, 'bow', 'laugh', 84, 3, 1.05, 'stand', 'grin'],
  think: [3.7, 'think', 'think', 74, 3, 2.8, 'proud', 'grin'],
  type: [4.5, 'type', 'code', 80, 3.4, 3.7, 'proud', 'grin'],
  polish: [2.5, 'polish', 'laugh', 82, 3.4, 1.5, 'proud', 'wink'],
  yawn: [3, 'yawn', 'yawn', 78, 2.2, 1.8, 'rest', 'sleepy'],
  dance: [3.1, 'proud', 'laugh', 86, 5],
  laugh: [2, 'stand', 'laugh', 82, 4],
  love: [2.6, 'love', 'love', 84, 3],
  dizzy: [2.4, 'woozy', 'dizzy', 80, 3],
  surprise: [1.5, 'startle', 'surprise', 82, 7],
  wink: [1.4, 'proud', 'wink', 84, 3.4],
  grin: [1.6, 'proud', 'grin', 84, 3.4],
};
const LIFTS = [0, 0.5]; // When each foot lifts in the gait cycle.

// Rate and ring per channel: arms and the monitor's tilt trail and overshoot, the legs' handover never rings.
const RATE = new Float32Array(N + 2).fill(1);
const DAMP = new Float32Array(N + 2).fill(0.82);
for (let i = SWING; i < DROP; i += 1) { RATE[i] = 0.95; DAMP[i] = 0.5; }
for (const i of [BPITCH, BTILT, TWIST, TAIL]) { RATE[i] = 0.85; DAMP[i] = 0.55; }
RATE[IK] = 1.8; DAMP[IK] = 1;
RATE[TURN] = 0.75;
RATE[TURN + 1] = 1.4;

/* -------------------------------------------------------------------- Mount */

export { FS, PAINT, PARTS, SHADOW_FS, SHADOW_VS, VS, program };

const DAY = { sun: [0.45, 0.72, 0.52], sunColor: [1, 0.95, 0.85], skyColor: [0.43, 0.66, 0.95], ambient: [0.56, 0.66, 0.82], night: 0 };

export async function mountSmed3D(el, bar, { light, seed = 7 } = {}) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, depth: true, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const res = Math.min(devicePixelRatio || 1, 4); // Canvas pixels per CSS pixel.
  const W = Math.round(VIEW_W * res);
  const H = Math.round(VIEW_H * res);
  canvas.width = W;
  canvas.height = H;

  const mesh = buildMesh();
  // Meshing and compiling take milliseconds each: the page gets a turn between them.
  await (globalThis.scheduler?.yield?.() ?? new Promise((done) => { setTimeout(done); }));
  const pix = new Uint8Array(FW * FH * 4);
  let figure;
  let shadow;
  const build = () => {
    figure = program(gl, VS, FS);
    shadow = program(gl, SHADOW_VS, SHADOW_FS);
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
    [[3, 0], [2, 3], [4, 5], [4, 9], [1, 13]].forEach(([size, offset], i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.BYTE, false, 16, offset);
    });
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.viewport(0, 0, W, H);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  };
  try {
    build();
  } catch {
    return null;
  }

  Object.assign(canvas.style, {
    position: 'absolute', left: `${(BOX_W - VIEW_W) / 2}px`, bottom: `${-GROUND}px`,
    width: `${VIEW_W}px`, height: `${VIEW_H}px`, pointerEvents: 'none',
  });
  // Without `touch-action` a drag on him would scroll the page.
  Object.assign(el.style, { width: `${BOX_W}px`, height: `${BOX_H}px`, background: 'none', touchAction: 'none' });
  el.append(canvas);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lines = JSON.parse(el.dataset.lines || '[]');
  const say = el.querySelector('.smed__say');
  const rng = mulberry(seed);
  const rand = (a, b) => a + rng() * (b - a);
  const stats = { frameMs: 0 };

  let state = 'idle';
  let act = 'wave';
  let mood = 'smile';
  let st = 0; // Seconds in this state.
  let time = 0;
  let last = 0;
  let raf = 0;
  let visible = true;
  let x = 50;
  let vx = 0;
  let target = null;
  let pace = WALK;
  let dir = 1;
  let turnTo = 1;
  let lift = 0;
  let vy = 0;
  let air = false;
  let spin = 0; // Degrees he is turned in the view, about a point `spinH` voxels up.
  let spinV = 0;
  let spinH = 11;
  let phase = 0;
  let moving = 0;
  let running = 0;
  let hipTwist = 0;
  let asleep = false;
  let lastInput = 0;
  let actAt = 2.2;
  let blinkAt = 0.35;
  let blink = 0;
  let lid = 1;
  let glance = null;
  let perk = 0; // Until when a passing thought widens his smile.
  let microAt = 1;
  let gaze = [0, 0];
  let pointer = null;
  let hold = null; // The pointer that has picked him up, or is about to.
  let dragged = false;
  let handV = 0;
  let power = 1;
  let prog = 0;
  let sayTimer = 0;
  let encore = null; // An act asked for while busy, done when he next stands still.
  let sun = DAY.sun;
  let night = 0;
  let placed = null;
  let squash = 1;
  let squashV = 0;
  let bodyZ = PIVOT.pelvis[2];
  let bodyV = 0;
  let cs = 1;
  let sn = 0;

  const cur = new Float32Array(N + 2);
  const vel = new Float32Array(N + 2);
  const goal = new Float32Array(N + 2);
  const out = new Float32Array(N);
  const fc = Float32Array.from(FACES.smile);
  const fv = new Float32Array(FK.length);
  const fg = new Float32Array(FK.length);
  const rows = new Float32Array(PARTS.length * 12);
  const blobs = new Float32Array(16);
  const feet = LEGS.map(() => ({ x: 0, z: 0, h: 0, pitch: 0, step: null }));
  const legs = [[0, 0], [0, 0]]; // What each leg adds to the pose's hip and knee off the ground.
  const trails = [{ v: [0, 0, 0] }, { v: [0, 0, 0] }];
  const rope = Array.from({ length: LINKS + 1 }, () => ({}));
  const dots = Array.from({ length: DOTS }, () => ({ p: [0, 0, 0], v: [0, 0, 0], life: 0, size: 0 }));
  let nextDot = 0;

  const maxX = () => bar.clientWidth - BOX_W - 4;
  // Keep all of him, arms and cable too, on the bar and inside the viewport.
  const fit = (v) => {
    const left = bar.getBoundingClientRect().left + BOX_W / 2;
    const lo = Math.max(4, REACH - left);
    return clamp(v, lo, Math.max(lo, Math.min(maxX(), document.documentElement.clientWidth - left - REACH)));
  };
  const set = (name) => { state = name; st = 0; };
  const perform = (name, text) => { act = name; set('act'); speak(text); };
  const rest = () => {
    const next = encore;
    encore = null;
    if (next) perform(next);
    else {
      set('idle');
      actAt = Math.max(actAt, time + rand(2, 4)); // A breath between one act and the next.
    }
  };
  function speak(text) {
    if (!say || !text) return;
    say.textContent = text;
    el.classList.add('is-saying');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => el.classList.remove('is-saying'), 1800);
  }
  // Where a foot belongs on the bar for a stance offset in his own frame; `ahead` is along the
  // bar itself, since he walks half turned to the viewer.
  const home = (i, fx, wide, ahead = 0) => {
    const hy = (i ? 1 : -1) * (3 + wide);
    return [x / VOX + cs * fx + sn * hy + dir * ahead, sn * fx - cs * hy];
  };
  const puff = (n, at, push) => {
    for (let k = 0; k < n; k += 1) {
      const d = dots[nextDot];
      nextDot = (nextDot + 1) % DOTS;
      d.p = [at[0] + rand(-1, 1), at[1] + 0.4, at[2] + rand(-1, 1)];
      d.v = [push + rand(-9, 9), rand(8, 20), rand(-5, 5)];
      d.life = rand(0.3, 0.5);
      d.size = rand(0.45, 0.85);
    }
  };
  const thump = (hard, n) => { squashV -= hard; puff(n, [x / VOX, 0, 0], 0); };
  const go = () => {
    phase = 2 * Math.PI * 0.3; // Mid-stance on the right foot: the left lifts first.
    set('go');
  };
  const travel = (to, speed) => {
    encore = null;
    target = fit(to);
    pace = speed;
    asleep = false;
    lift = 0;
    vy = 0;
    turnTo = target >= x ? 1 : -1;
    if (turnTo !== dir) set('turn');
    else if (state !== 'go') go();
  };

  // Where each state wants body and face, and how stiff the springs are.
  function direct(dt) {
    let want = P.stand;
    let hz = 2.6;
    let look = 68; // Degrees turned from side-on toward the viewer.
    mood = 'smile';
    power = 1;
    const quiet = time - lastInput;
    const bedtime = night > 0.6 ? 16 : 26;
    switch (state) {
      case 'boot':
        want = st < 1.9 ? P.off : P.startle; hz = st < 1.9 ? 2 : 6; look = 84;
        mood = st < 1.9 ? 'boot' : 'surprise';
        power = st < 0.2 ? 0 : st < 0.62 ? (Math.sin(st * 90) > 0.2 ? 0.95 : 0.2) : 1;
        prog = ease(clamp((st - 0.7) / 1.05, 0, 1));
        if (st > 1.9 && st - dt <= 1.9) squashV += 3.2;
        if (st > 2.35) perform('wave', el.dataset.hello);
        break;
      case 'turn':
        // Anticipation: he sinks and his screen turns before his feet do.
        want = P.turn; hz = 5; look = 60;
        if (st > 0.2) { dir = turnTo; go(); }
        break;
      case 'go': {
        const d = target - x;
        const turned = Math.abs(cur[TURN] - goal[TURN]) < 60;
        vx += (Math.sign(d) * Math.min(turned ? pace : pace * 0.25, Math.abs(d) * 6 + 14) - vx) * (1 - Math.exp(-dt * 9));
        x += vx * dt;
        want = running > 0.5 ? P.dash : P.stand; look = 24; hz = 4;
        if (running > 0.5) mood = 'grin';
        if (Math.abs(target - x) < 1.5) {
          if (running > 0.4) thump(2.6, 3);
          target = null; vx = 0; rest();
        }
        break;
      }
      case 'act': {
        const a = ACTS[act];
        const late = st > (a[5] || 99);
        want = P[late ? a[6] : a[1]]; mood = late ? a[7] : a[2]; look = a[3]; hz = a[4];
        if ((late && st - dt <= a[5]) || (act === 'surprise' && st <= dt)) squashV += 2.4;
        if (st > a[0]) rest();
        break;
      }
      case 'sit':
        want = st < 0.3 ? P.squat : asleep ? P.sleep : P.sit; look = asleep ? 80 : 88; hz = asleep ? 1.4 : 3;
        mood = asleep ? 'asleep' : quiet > bedtime * 0.7 ? 'sleepy' : 'smile';
        if (st > 0.42 && st - dt <= 0.42) thump(2.4, 3);
        break;
      case 'jump':
        if (st < 0.1) { want = P.squat; hz = 9; break; }
        if (!air) { air = true; lift = 1; vy = 330; squashV += 3.4; }
        vy -= 1250 * dt;
        lift += vy * dt;
        want = vy > 110 ? P.jump : vy > -150 ? P.click : P.hang; hz = 7;
        mood = vy > 110 ? 'grin' : 'laugh';
        if (vy <= 0 && vy + 1250 * dt > 0) puff(3, [x / VOX, lift / VOX + 1, 1], 0);
        if (lift <= 0) { air = false; lift = 0; vy = 0; thump(4.2, 4); set('land'); }
        break;
      case 'land':
        want = P.squat; hz = 7; look = 80; mood = 'grin';
        if (st > 0.2) rest();
        break;
      case 'roll': {
        // He trips, goes right over like a box, lands seeing stars and shakes it off.
        look = 80; hz = 6;
        if (st < 0.28) { want = P.trip; mood = 'surprise'; hz = 9; }
        else if (st < 1) {
          const u = (st - 0.28) / 0.72;
          const turned = u * (2 - u) * 0.3 + u * 0.7;
          if (!air) { air = true; squashV += 3; }
          x = fit(x + (dir * ROLL_DIST * dt) / 0.72);
          spin = -dir * 360 * turned;
          spinH = 11;
          lift = 5 + 9 * Math.abs(Math.sin(spin * 2 * RAD));
          want = P.spin; mood = u < 0.3 ? 'surprise' : 'dizzy';
        } else {
          if (air) { air = false; lift = 0; spin = 0; thump(4.4, 5); }
          want = st < 2.3 ? P.woozy : P.stand; mood = st < 2.3 ? 'dizzy' : st < 2.75 ? 'laugh' : 'grin';
          if (st > 2.9) perform('grin', lines[Math.floor(rng() * lines.length)]);
        }
        break;
      }
      case 'held': {
        // He hangs from the pointer by his top and swings under it like a pendulum.
        const b = bar.getBoundingClientRect();
        const to = fit(pointer.x - b.left - BOX_W / 2);
        const was = vx;
        vx = ((to - x) * (1 - Math.exp(-dt * 16))) / Math.max(dt, 0.001);
        x += vx * dt;
        handV += ((vx - was) / Math.max(dt, 0.001) - handV) * (1 - Math.exp(-dt * 12));
        lift += (clamp(b.top - pointer.y - 70, 10, 62) - lift) * (1 - Math.exp(-dt * 14));
        spinH = 23;
        spinV += (-26 * spin * RAD - (handV / VOX / 14) * Math.cos(spin * RAD) - 2.6 * spinV) * dt;
        spin = clamp(spin + (spinV * dt) / RAD, -24, 24);
        want = P.hang; mood = 'surprise'; look = 82; hz = 5;
        break;
      }
      case 'drop':
        vy -= 1250 * dt;
        lift += vy * dt;
        x = fit(x + vx * dt);
        vx *= Math.exp(-dt * 3);
        spinV += (-140 * spin * RAD - 12 * spinV) * dt;
        spin = clamp(spin + (spinV * dt) / RAD, -24, 24);
        want = P.hang; mood = 'surprise'; look = 82; hz = 6;
        if (lift <= 0) {
          lift = 0;
          thump(clamp(-vy / 90, 1.5, 4.6), 4);
          if (vy < -170) vy *= -0.42;
          else { vy = 0; vx = 0; spin = 0; spinV = 0; air = false; perform('laugh'); }
        }
        break;
      default:
        if (time < perk) mood = 'grin';
        if (time > actAt) {
          actAt = time + rand(3, 6);
          const r = rng();
          if (quiet > (night > 0.6 ? 9 : 18)) set('sit');
          else if (r < 0.7) perform(['polish', 'think', 'dance', 'type', 'wink', 'yawn', 'wave'][Math.floor(r * 10)]);
          else travel(rand(0, maxX()), WALK);
        } else if (time > microAt) {
          // Between acts he stays alive in small ways: a glance aside, a wider smile, a second blink.
          microAt = time + rand(1.3, 2.8);
          const r = rng();
          const side = r < 0.25 ? -1 : 1;
          if (r < 0.5) glance = { turn: side * rand(14, 28), pitch: rand(-3, 7), gaze: [side * 2, 0.6], from: time, until: time + rand(0.7, 1.5) };
          else if (r < 0.8) perk = time + rand(0.9, 1.5);
          else blinkAt = time + 0.3;
        }
    }
    if (state === 'sit' && quiet > bedtime) asleep = true;
    goal.set(want);
    goal[TURN] = 90 - dir * (90 - look);
    return hz;
  }

  // Screen and eyes: a recent pointer, else a glance, else the viewer.
  function watch() {
    const heading = cur[TURN];
    let turn = clamp((heading - 90) * 0.8, -45, 45);
    let pitch = 0;
    gaze = [0, 0];
    const busy = asleep || air || state === 'boot' || state === 'roll';
    if (state === 'turn') turn = heading - (turnTo > 0 ? 0 : 180);
    else if (!busy && pointer && time - pointer.at < 3) {
      const b = el.getBoundingClientRect();
      const g = [(pointer.x - b.left - BOX_W / 2) / 72, (b.top + 70 - pointer.y) / 72, 1.4];
      turn = heading - Math.atan2(g[2], g[0]) / RAD;
      pitch = clamp(-Math.asin(g[1] / len(g)) / RAD * 0.5, -16, 14);
      gaze = [clamp(g[0] * 2.4, -2.6, 2.6), clamp(-g[1] * 2, -2, 1)];
    } else if (!busy && glance && time > glance.from && time < glance.until && state === 'idle') {
      turn += glance.turn;
      pitch = glance.pitch;
      gaze = glance.gaze;
    }
    goal[TURN + 1] = clamp(turn, -58, 58);
    return pitch;
  }

  function spring(hz, dt) {
    const w = 2 * Math.PI * hz;
    const h = dt / 2;
    for (let k = 0; k < 2; k += 1) {
      for (let i = 0; i < cur.length; i += 1) {
        const f = w * RATE[i];
        vel[i] += (-f * f * (cur[i] - goal[i]) - 2 * DAMP[i] * f * vel[i]) * h;
        cur[i] += vel[i] * h;
      }
      for (let i = 0; i < fc.length; i += 1) {
        fv[i] += (-1600 * (fc[i] - fg[i]) - 52 * fv[i]) * h;
        fc[i] += fv[i] * h;
      }
    }
  }

  // Feet stay where they were put. Moving lifts each in turn by the gait clock and sets it
  // down ahead; standing, a foot off its mark steps back to it.
  function plant(c, dt) {
    const cycle = mix(8, 14, running);
    const duty = mix(0.6, 0.38, running);
    let worst = 0.6;
    let mover = null;
    feet.forEach((f, i) => {
      let to = home(i, (i ? -1 : 1) * c[STAG], c[WIDE]);
      let u = -1;
      if (state === 'go') {
        const p = (phase / (2 * Math.PI) + LIFTS[i]) % 1;
        // Grounded, a foot keeps the spot the stride gave it; in the air it reaches ahead.
        to = home(i, 0, 0, cycle * (duty / 2 - Math.min(p, duty)));
        if (p >= duty) {
          u = (p - duty) / (1 - duty);
          to = home(i, 0, 0, cycle * (duty / 2 + (1 - u) * (1 - duty)));
          f.step = f.step || { x: f.x, z: f.z, from: u };
          f.step.u = u;
        }
      } else if (f.step) {
        f.step.u += dt / 0.16;
        u = f.step.u;
      } else if (!feet[1 - i].step) {
        const off = Math.hypot(f.x - to[0], f.z - to[1]);
        if (off > worst) { worst = off; mover = f; }
      }
      if (u < 0 || u >= 1) {
        if (f.step) {
          f.x = to[0]; f.z = to[1];
          if (running > 0.5) puff(1, [f.x, 0, f.z], -Math.sign(vx) * 12);
        }
        f.step = null;
        f.h = 0;
        f.pitch = 0;
      } else {
        const e0 = ease(Math.min(f.step.from, 0.95));
        const e = (ease(u) - e0) / (1 - e0);
        const arc = Math.sin(Math.PI * u);
        f.x = mix(f.step.x, to[0], e);
        f.z = mix(f.step.z, to[1], e);
        f.h = arc * (state === 'go' ? 1.1 + 0.9 * running : 0.8);
        f.pitch = arc * (state === 'go' ? 44 * (1 - u) - 24 * u : 0); // Toes trail, then lead.
      }
    });
    if (mover) mover.step = { x: mover.x, z: mover.z, from: 0, u: 0 };
  }

  // A point that follows `to` on a soft spring; returns how far it trails.
  const trail = (s, to, stiff, damp, max, dt) => {
    s.p = s.p || [...to];
    for (let a = 0; a < 3; a += 1) {
      s.v[a] += (-stiff * (s.p[a] - to[a]) - damp * s.v[a]) * dt;
      s.p[a] = to[a] + clamp(s.p[a] + s.v[a] * dt - to[a], -max, max);
    }
    return sub(s.p, to);
  };

  // Forward kinematics in his own frame, legs solved back from the planted feet, turned to his heading.
  function rig(c, headTurn, headPitch, breath, dt) {
    const ik = clamp(c[IK], 0, 1);
    const B = {};
    const at = (b, name, q = PIVOT[name]) => { const g = b.s || ONE; const p = PIVOT[b.name]; return tf(b.m, b.o, (q[0] - p[0]) * g[0], (q[1] - p[1]) * g[1], (q[2] - p[2]) * g[2]); };
    const put = (name, m, o, s) => (B[name] = { name, m, o, s });
    const kid = (b, name, m) => put(name, mul(b.m, m), at(b, name));
    const wide = 1 / Math.sqrt(squash);
    const sc = Math.cos(spin * RAD);
    const ss = Math.sin(spin * RAD);
    const world = (p) => {
      const wx = (cs * p[0] + sn * p[1]) * wide;
      const wy = p[2] * squash - spinH;
      return [wx * sc - wy * ss, wx * ss + wy * sc + spinH + lift / VOX, (sn * p[0] - cs * p[1]) * wide];
    };
    const frame = (m) => {
      const r0 = [0, 1, 2].map((k) => (cs * m[k] + sn * m[3 + k]) * wide);
      const r1 = [0, 1, 2].map((k) => m[6 + k] * squash);
      return [...r0.map((v, k) => v * sc - r1[k] * ss), ...r0.map((v, k) => v * ss + r1[k] * sc), ...[0, 1, 2].map((k) => (sn * m[k] - cs * m[3 + k]) * wide)];
    };
    const into = (m, v) => [0, 1, 2].map((a) => m[a] * v[0] + m[3 + a] * v[1] + m[6 + a] * v[2]);
    const far = (p) => [p[0] + x / VOX, p[1], p[2]];
    const own = frame(SAME);

    // The stand rides over the planted feet, never higher than the legs can reach.
    const reach = feet.map((f, i) => {
      const fx = f.x - x / VOX;
      const off = fx * fx + f.z * f.z - 2 * LEGS[i][1] * (sn * fx - cs * f.z) + 9;
      return f.step ? 99 : Math.sqrt(Math.max(LEG * LEG - off, 4)) + ANKLE + PIVOT.pelvis[2] - HIP;
    });
    const top = Math.min(PIVOT.pelvis[2] - c[DROP], ...(ik > 0.5 ? reach : []));
    bodyV += (-1900 * (bodyZ - top) - 70 * bodyV) * dt;
    bodyZ += bodyV * dt;
    const pel = put('pelvis', rz(hipTwist), [0, 0, bodyZ]);
    // The monitor is heavy: it trails the stand and rocks back when he stops.
    const lag = into(own, trail(trails[0], far(world([0, 0, bodyZ + 11])), 240, 10, 1.6, dt));
    const body = put('body', mul(pel.m, rz(headTurn + c[TWIST] - hipTwist), ry(c[BPITCH] + headPitch + lag[0] * 7), rx(c[BTILT] - lag[1] * 7)), at(pel, 'body'), [1, 1 + 0.02 * breath, 1 + 0.05 * breath]);
    // The antenna is a spring: it whips behind every move and wobbles to rest.
    const whip = into(frame(body.m), trail(trails[1], far(world(at(body, '', [-1, 3, 26]))), 300, 7, 2.2, dt));
    const sway = mul(ry(5 + whip[0] * 20), rx(-4 - whip[1] * 20));
    kid(kid(body, 'ant', sway), 'tip', sway);

    for (let i = 0; i < 2; i += 1) {
      const s = i ? 1 : -1;
      const arm = kid(body, `arm${i}`, mul(rz(-s * c[INW + i]), rx(s * (c[RAISE + i] - lag[1] * s * 9)), ry(-c[SWING + i] - lag[0] * 12)));
      kid(arm, `fore${i}`, ry(-c[ELBOW + i]));
    }

    // Legs: the pose's angles off the ground, else those that reach the planted foot.
    LEGS.forEach((h, i) => {
      const f = feet[i];
      if (ik < 0.05) {
        // Off the ground the feet keep to their marks, ready to land on them.
        [f.x, f.z] = home(i, 0, c[WIDE]);
        f.step = null;
      }
      const hipO = at(pel, `upper${i}`);
      const rel = [f.x - x / VOX, f.z];
      const t = sub([cs * rel[0] + sn * rel[1], sn * rel[0] - cs * rel[1], ANKLE + f.h], hipO);
      const down = Math.hypot(t[1], t[2]);
      const d = clamp(Math.hypot(t[0], down), 1.2, LEG);
      const fold = Math.PI - Math.acos(clamp((UPPER * UPPER + LOWER * LOWER - d * d) / (2 * UPPER * LOWER), -1, 1));
      const lean = Math.atan2(t[0], down) + Math.acos(clamp((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d), -1, 1));
      const side = rx(mix(c[KICK] * (i ? -12 : 52), Math.atan2(t[1], -t[2]) / RAD, ik));
      const upper = put(`upper${i}`, mul(side, ry(-mix(c[HIPS] + legs[i][0], lean / RAD, ik))), hipO);
      const lower = kid(upper, `lower${i}`, ry(mix(c[KNEE] + legs[i][1], fold / RAD, ik)));
      put(`foot${i}`, mul(side, ry(mix(22, f.pitch, ik))), at(lower, `foot${i}`));
    });

    // The cable is a rope pinned to his back and drawn toward a curl that wags, so it
    // trails a walk, swings when he is carried and lies down when he sleeps.
    const pull = 1 - Math.exp(-dt * 24 * clamp(c[TAIL], 0, 1));
    let q = [-7, -4, NECK + 3];
    rope.forEach((n, k) => {
      if (k) {
        // The curl leaves his back, sweeps out past his right side and stands up beside him.
        const yaw = Math.min(k * 35, 90) * RAD;
        const up = c[TAIL] * clamp(k * 26 - 52, -8, 85) * RAD;
        const wag = c[WAG] * Math.sin(time * 11 - k * 0.7) * k * 4 * RAD;
        q = [q[0] - SEG * Math.cos(up) * Math.cos(yaw), q[1] - SEG * Math.cos(up + wag) * Math.sin(yaw), q[2] + SEG * Math.sin(up + wag)];
      }
      const to = far(world(at(body, '', q)));
      if (!k || !n.p) { n.p = to; n.q = n.q || [...to]; return; }
      for (let a = 0; a < 3; a += 1) {
        const v = (n.p[a] - n.q[a]) * 0.9 ** (dt * 60);
        n.q[a] = n.p[a];
        n.p[a] += (dt > 0 ? v : 0) - (a === 1 ? 80 * dt * dt : 0);
        n.p[a] += (to[a] - n.p[a]) * pull;
      }
      // Each link keeps its length and his reach: at the limit it turns in depth.
      const prev = rope[k - 1].p;
      const d = unit(sub(n.p, prev));
      const dx = clamp(prev[0] + d[0] * SEG, x / VOX - WALL, x / VOX + WALL) - prev[0];
      const dy = Math.max(prev[1] + d[1] * SEG, 0.4) - prev[1];
      n.p = [prev[0] + dx, prev[1] + dy, prev[2] + (d[2] < 0 ? -1 : 1) * Math.sqrt(Math.max(SEG * SEG - dx * dx - dy * dy, 0))];
    });
    const along = (k) => {
      const d = unit(sub(rope[Math.min(k + 1, LINKS)].p, rope[Math.min(k, LINKS - 1)].p));
      const side = unit(cross(Math.abs(d[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0], d));
      return { v: [d, side, cross(d, side)], o: [rope[k].p[0] - x / VOX, rope[k].p[1], rope[k].p[2]] };
    };
    for (let k = 0; k < LINKS; k += 1) B[`tail${k}`] = along(k);
    B.plug = along(LINKS);

    dots.forEach((d, k) => {
      if (d.life > 0) {
        d.life -= dt;
        d.v[1] -= 70 * dt;
        for (let a = 0; a < 3; a += 1) d.p[a] += d.v[a] * dt;
        if (d.p[1] < 0.3 && d.v[1] < 0) { d.p[1] = 0.3; d.v[1] *= -0.4; }
      }
      const s = d.life > 0 ? d.size * Math.min(1, d.life * 5) : 0;
      B[`dot${k}`] = { v: [[s, 0, 0], [0, s, 0], [0, 0, s]], o: [d.p[0] - x / VOX, d.p[1], d.p[2]] };
    });

    // Finish in the view: x along the bar, y up, z toward the viewer.
    PARTS.forEach((p, pi) => {
      const b = B[p.bone];
      let m;
      let w = b.o;
      if (b.v) m = SAME.map((_, k) => b.v[k % 3][Math.floor(k / 3)] * p.s[k % 3]);
      else {
        const g = b.s || ONE;
        const pv = PIVOT[p.bone];
        w = world(tf(b.m, b.o, (p.a[0] - pv[0]) * g[0], (p.a[1] - pv[1]) * g[1], (p.a[2] - pv[2]) * g[2]));
        m = frame(b.m.map((v, k) => v * g[k % 3] * p.s[k % 3]));
      }
      for (let r = 0; r < 3; r += 1) rows.set([m[r * 3], m[r * 3 + 1], m[r * 3 + 2], w[r]], pi * 12 + r * 4);
    });

    // Shadows fade as feet, body and plug leave the ground.
    [world(B.foot0.o), world(B.foot1.o), world(pel.o), B.plug.o].forEach((w, i) => {
      const high = Math.abs(w[1]) - [1.4, 1.4, 7, 0.5][i];
      blobs.set([w[0] - sun[0] * w[1] * 0.2, w[2] - sun[2] * w[1] * 0.2, [3, 3, 7.5, 1.8][i] + high * 0.15, [0.3, 0.3, 0.44, 0.2][i] * clamp(1 - high / 12, 0, 1)], i * 4);
    });
  }

  function draw(dt) {
    cs = Math.cos(cur[TURN] * RAD);
    sn = Math.sin(cur[TURN] * RAD);
    const hz = direct(dt);
    const gazePitch = watch();
    fg.set(FACES[mood]);
    fg[LX] += gaze[0];
    fg[LY] += gaze[1];
    fg[ON] *= power;
    spring(hz, dt);
    if (state === 'boot') fc[ON] = fg[ON]; // A flicker is not a spring.

    // Gait: the clock runs with the ground covered, so steps match the distance.
    const speed = Math.abs(vx);
    moving += ((state === 'go' ? clamp(speed / 30, 0, 1) : 0) - moving) * (1 - Math.exp(-dt * 10));
    running += (clamp((speed - WALK) / (RUN - WALK), 0, 1) - running) * (1 - Math.exp(-dt * 6));
    phase += (2 * Math.PI * speed * dt) / VOX / mix(8, 14, running);
    out.set(cur.subarray(0, N));
    // A waddle: hips turn with each stride, the monitor rocks over the standing foot and
    // the arms swing against the legs.
    const stride = moving * Math.cos(phase);
    hipTwist = stride * (10 - 5 * running);
    out[BTILT] -= moving * (7 - 4 * running) * Math.cos(phase - 1.6 * Math.PI);
    out[BPITCH] += moving * 2.5 * Math.sin(2 * phase);
    out[SWING] -= stride * 34 * (1 - running);
    out[SWING + 1] += stride * 34 * (1 - running);
    out[DROP] -= moving * running * 0.6 * Math.cos(2 * phase - 0.7 * Math.PI);

    const doing = state === 'act' ? act : state;
    const beat = Math.sin(st * 8.4);
    legs.forEach((l) => l.fill(0));
    if (doing === 'wave') { out[RAISE + 1] += 6 * Math.sin(st * 15) * clamp(st * 3 - 0.5, 0, 1); out[ELBOW + 1] += 30 * Math.sin(st * 15 + 1); }
    else if (doing === 'polish' && st > 0.3 && st < 1.5) { out[INW + 1] += 20 * Math.sin(st * 17); out[SWING + 1] += 7 * Math.cos(st * 17); out[BTILT] += 2.5 * Math.sin(st * 17); }
    else if (doing === 'type' && st < 3.7) { out[ELBOW] += 13 * Math.sin(st * 27); out[ELBOW + 1] -= 13 * Math.sin(st * 27); out[BPITCH] += 2 * Math.sin(st * 6); }
    else if (doing === 'dance') { out[DROP] += 0.9 * Math.abs(beat); out[BTILT] += 11 * beat; out[TWIST] += 9 * Math.sin(st * 4.2); out[RAISE] += 16 * beat; out[RAISE + 1] -= 16 * beat; out[STAG] += 1.3 * Math.sin(st * 4.2); }
    else if (doing === 'laugh' || doing === 'bow') { out[DROP] += 0.55 * Math.abs(Math.sin(st * 16)); out[BPITCH] -= 3 * Math.abs(Math.sin(st * 16)); }
    else if (doing === 'love') out[BTILT] += 7 * Math.sin(st * 4.5);
    else if (doing === 'dizzy' || (state === 'roll' && st > 1 && st < 2.3)) { out[BTILT] += 13 * Math.sin(st * 5.5); out[BPITCH] += 7 * Math.cos(st * 5.5); out[STAG] += 1.2 * Math.sin(st * 5.5); }
    else if (state === 'roll' && st > 2.3 && st < 2.75) out[TWIST] += 20 * Math.sin(st * 42);
    else if (state === 'roll' || state === 'held' || state === 'drop') {
      const kick = (state === 'roll' ? 30 : 14) * Math.sin(time * 18);
      legs[0][0] = kick; legs[1][0] = -kick;
      out[RAISE] += 8 * Math.sin(time * 19); out[RAISE + 1] -= 8 * Math.sin(time * 19 + 1);
    } else if (state === 'sit' && !asleep) { legs[0][1] = 24 * Math.sin(time * 3.4); legs[1][1] = -24 * Math.sin(time * 3.4); }

    const period = asleep ? 5 : 3.2;
    const breath = (0.5 - 0.5 * Math.cos((2 * Math.PI * time) / period)) * (asleep ? 1.6 : 1);
    if (state === 'idle') { out[DROP] += 0.5 * (1 - breath); out[RAISE] += 3 * breath; out[RAISE + 1] += 3 * breath; }
    plant(out, dt);

    if (time > blinkAt) { blink = 0.13; blinkAt = time + rand(2.2, 5); }
    blink -= dt;
    lid += ((blink > 0 ? 0.1 : 1) - lid) * (1 - Math.exp(-dt * 40));

    squashV += (-800 * (squash - 1) - 26 * squashV) * dt;
    squash = clamp(squash + squashV * dt, 0.72, 1.25);

    const l = (light && light()) || DAY;
    night = l.night || 0;
    const s = l.sun || DAY.sun;
    sun = unit([s[0] * 0.5, Math.max(s[1], 0.35), Math.max(s[2], 0.6)]); // The sun's side, pulled round to light his face.
    rig(out, cur[TURN + 1], gazePitch, breath, dt);
    paintFace(fc, lid, state === 'boot' || state === 'act' ? st : time, prog, pix);

    // After dark his light is pulled toward white, or cream turns green and grey.
    const tint = (c, own) => { const g = (c[0] + c[1] + c[2]) / 3; return c.map((v) => mix(v, g * 1.04, 0.72 * night) * (1 + 0.9 * night) + own * night); };
    const lit = clamp(fc[ON], 0, 1);
    const glow = [0.85, 1, 0.88].map((v) => v * lit * (0.3 + 0.3 * night));
    const snapped = Math.round(x * res) / res;
    const view = [VOX * res, W / 2 + (x - snapped) * res, GROUND * res, TILT];
    const fine = [ease(clamp((time - fineAt) / 0.5, 0, 1)), night * lit];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shadow.p);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.uniform4fv(shadow.u.uS, blobs);
    gl.uniform4fv(shadow.u.uView, view);
    gl.uniform2fv(shadow.u.uNew, fine);
    gl.uniform4fv(shadow.u.uB, rows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.useProgram(figure.p);
    const u = figure.u;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FW, FH, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    gl.uniform4fv(u.uB, rows);
    gl.uniform4fv(u.uView, view);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uOn, clamp(fc[ON], 0, 1.2));
    gl.uniform3fv(u.uSun, sun);
    gl.uniform3fv(u.uKey, tint(l.sunColor || DAY.sunColor, 0));
    gl.uniform3fv(u.uAmb, tint(l.ambient || DAY.ambient, 0.14));
    gl.uniform3fv(u.uSky, tint(l.skyColor || DAY.skyColor, 0.1));
    gl.uniform4f(u.uGlow, ...glow, lit * (0.7 + 0.4 * breath));
    gl.uniform2fv(u.uNew, fine);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 16);
    if (snapped !== placed) el.style.transform = `translate(${snapped}px, 0)`;
    placed = snapped;
  }

  // Start settled: springs at their goals, feet on their marks, the cable at rest.
  const settle = (p, look) => {
    goal.set(p);
    goal[TURN] = 90 - dir * (90 - look);
    goal[TURN + 1] = clamp((goal[TURN] - 90) * 0.8, -45, 45);
    cur.set(goal);
    cs = Math.cos(cur[TURN] * RAD);
    sn = Math.sin(cur[TURN] * RAD);
    bodyZ = PIVOT.pelvis[2] - p[DROP];
    feet.forEach((f, i) => { [f.x, f.z] = home(i, (i ? -1 : 1) * p[STAG], p[WIDE]); });
    for (let k = 0; k < 90; k += 1) rig(p, cur[TURN + 1], 0, 0.5, 1 / 60);
  };

  const tick = (now) => {
    raf = 0;
    const began = performance.now();
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    time += dt;
    st += dt;
    draw(dt);
    stats.frameMs += (performance.now() - began - stats.frameMs) * 0.05;
    if (visible) raf = requestAnimationFrame(tick);
  };
  const resume = () => {
    if (raf || reduce || !visible) return;
    raf = requestAnimationFrame((now) => { last = now; tick(now); });
  };

  const wake = () => {
    lastInput = time;
    if (state !== 'sit') return;
    blinkAt = time + 0.25;
    set(asleep ? 'land' : 'idle');
    asleep = false;
  };
  const grounded = () => !air && state !== 'roll' && state !== 'jump' && state !== 'held' && state !== 'drop';
  const halt = () => { wake(); target = null; vx = 0; encore = null; };
  const track = (e) => {
    pointer = { x: e.clientX, y: e.clientY, at: time };
    // A short drag picks him up; a still press stays a tap.
    if (!hold || hold.live || e.pointerId !== hold.id || Math.hypot(e.clientX - hold.x, e.clientY - hold.y) < 7 || !grounded()) return;
    hold.live = true;
    halt();
    air = true;
    spinV = 0;
    handV = 0;
    squashV += 2.6;
    set('held');
  };
  const press = (e) => { track(e); wake(); };
  const grab = (e) => { dragged = false; if (!reduce) hold = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false }; };
  const release = () => {
    if (hold && hold.live) { dragged = true; vy = 0; set('drop'); }
    hold = null;
  };
  const roll = () => {
    if (dragged) { dragged = false; return; }
    if (reduce || !grounded()) return;
    halt();
    dir = x > maxX() / 2 ? -1 : 1;
    set('roll');
  };
  let onScreen = true;
  const show = () => {
    visible = !document.hidden && onScreen;
    if (visible) resume();
    else { cancelAnimationFrame(raf); raf = 0; release(); } // Parked mid-drag, the pointer's release never comes.
  };
  const watcher = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; show(); });
  const lost = (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; };
  const restored = () => { build(); later(); if (reduce) draw(0); else resume(); };

  const hear = { passive: true, capture: true };
  const wires = [
    [el, 'click', roll], [el, 'pointerdown', grab], [window, 'pointerup', release], [window, 'pointercancel', release],
    [window, 'pointermove', track, { passive: true }], [window, 'pointerdown', press, hear], [window, 'keydown', wake, hear],
    [window, 'scroll', wake, hear], [document, 'visibilitychange', show], [canvas, 'webglcontextlost', lost], [canvas, 'webglcontextrestored', restored],
  ];
  for (const [to, ...wire] of wires) to.addEventListener(...wire);
  watcher.observe(el);

  // The finer look comes after the page's load, outside the first view, and fades in.
  let fineAt = 1e9;
  const later = () => import('./smed3d-fine.js').then((m) => m.fine(gl, mesh)).then((set) => {
    ({ figure, shadow } = set);
    fineAt = time || -1;
    if (reduce) draw(0);
  }).catch(() => {});
  if (document.readyState === 'complete') later();
  else addEventListener('load', later, { once: true });

  x = fit(x);
  let first = false; // The first visit: he boots up before he says hello.
  if (reduce) {
    settle(P.rest, 76);
    draw(0);
  } else {
    try {
      first = !localStorage.getItem('smed-booted');
      localStorage.setItem('smed-booted', '1');
    } catch {
      first = false;
    }
    settle(first ? P.off : P.stand, 84);
    if (first) set('boot');
    else perform('wave', el.dataset.hello);
    resume();
  }

  return {
    stats,
    first,
    goTo(index) {
      if (reduce || !grounded()) return;
      wake();
      const tab = bar.querySelectorAll('a')[index];
      if (!tab) return;
      const t = tab.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      travel(t.left - b.left + t.width / 2 - BOX_W / 2, RUN);
    },
    hop() {
      if (reduce || !grounded()) return;
      halt();
      squashV -= 2.6;
      set('jump');
    },
    play(to) {
      if (reduce || !grounded()) return;
      wake();
      if (to === 'roll') roll();
      else if (to === 'hop') this.hop();
      else if (to === 'walk' || to === 'run') travel(x > maxX() / 2 ? 0 : maxX(), to === 'run' ? RUN : WALK);
      else if (to === 'turn') travel(x - dir * 40, WALK);
      else if (to === 'sleep' || to === 'sit') { halt(); set('sit'); if (to === 'sleep') lastInput = -99; }
      else if (to === 'idle' || to === 'boot') { halt(); asleep = false; set(to); }
      else if (ACTS[to]) {
        // An act never cuts short a run, the boot or another act: it waits its turn.
        if (state === 'idle' || state === 'land') { halt(); asleep = false; perform(to); }
        else encore = to;
      }
    },
  };
}

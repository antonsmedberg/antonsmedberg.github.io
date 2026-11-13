// The cube pipeline the mascot was drawn with until he became smooth, kept for the toys tools/art bakes: parts cut
// from boxes of cells (buildMesh), their edges rounded (smooth) and lit by the first-view and finer shaders, as
// they were when obj-metalvisualkit.webp was baked. objects.mjs swaps its own palette and gloss into them.

import { pause } from '../../assets/js/smed3d.js';

const { abs, floor, hypot, max, min, round } = Math;
const ROWS = 35; // Rows of parts the shaders hold: as many parts as the mascot had then; a toy has fewer.
const PALETTE = [
  [1, 0.93, 0.8], [0.88, 0.8, 0.7], [0.5, 0.47, 0.55], [0.93, 0.34, 0.3], [1, 0.98, 0.94], [0.16, 0.2, 0.62],
  [0.96, 0.8, 0.48], [0.06, 0.07, 0.2], [0.84, 0.77, 0.69], [0.1, 0.4, 0.74], [0.55, 1, 0.82], [1, 0.82, 0.45], [0, 0, 0],
];
const [CREAM, SHADE, TRIM, CORAL, SOLE, INDIGO, AMBER, DARK, BEZEL, BLUE, MINT, LAMP, SCREEN] = PALETTE.keys();
const PAINT = 100; // Added to a colour: recolour cells already there, add none.

// Cull hidden faces; bake corner occlusion, shade from overhead, open edges and the screen's glow,
// giving the page a turn every 8 ms.
async function buildMesh(parts) {
  let slice = performance.now();
  const turn = async () => { if (performance.now() - slice > 8) { await pause(); slice = performance.now(); } };
  for (const p of parts) {
    const lo = [0, 1, 2].map((i) => min(...p.boxes.map((b) => b[i])));
    const hi = [0, 1, 2].map((i) => max(...p.boxes.map((b) => b[i + 3])));
    const dim = hi.map((v, i) => v - lo[i]);
    const grid = new Int8Array(dim[0] * dim[1] * dim[2]);
    for (const b of p.boxes) {
      const r = b[7] || 0;
      const round = (v, i) => max(abs(v + 0.5 - (b[i] + b[i + 3]) / 2) - (b[i + 3] - b[i]) / 2 + r, 0);
      for (let x = b[0]; x < b[3]; x += 1) {
        await turn();
        for (let y = b[1]; y < b[4]; y += 1) for (let z = b[2]; z < b[5]; z += 1) {
          if (hypot(round(y, 1), round(z, 2)) > r) continue;
          const at = ((x - lo[0]) * dim[1] + y - lo[1]) * dim[2] + z - lo[2];
          if (b[6] < PAINT) grid[at] = b[6] + 1;
          else if (grid[at]) grid[at] = b[6] - PAINT + 1;
        }
      }
    }
    Object.assign(p, { lo, hi, dim, grid });
    p.at = (c) => (c.every((v, i) => v >= lo[i] && v < hi[i]) ? grid[((c[0] - lo[0]) * dim[1] + c[1] - lo[1]) * dim[2] + c[2] - lo[2]] : 0);
  }
  const core = parts.filter((p) => p.core);
  const data = [];
  for (const [pi, p] of parts.entries()) {
    const filled = (c) => p.at(c) || (p.core && core.some((q) => q !== p && q.at(c.map((v, i) => floor((p.a[i] + p.s[i] * (p.o[i] + v + 0.5) - q.a[i]) / q.s[i] - q.o[i])))));
    const step = (c, i, d) => { const n = [...c]; n[i] += d; return n; };
    for (let x = p.lo[0]; x < p.hi[0]; x += 1) for (let y = p.lo[1]; y < p.hi[1]; y += 1) for (let z = p.lo[2]; z < p.hi[2]; z += 1) {
      const cell = [x, y, z];
      const colour = p.at(cell) - 1;
      if (colour < 0) continue;
      await turn();
      for (let axis = 0; axis < 3; axis += 1) for (const d of [-1, 1]) {
        const out = step(cell, axis, d);
        if (p.at(out)) continue;
        const u = (axis + 1) % 3;
        const v = (axis + 2) % 3;
        let sky = 1;
        if (p.core) for (let k = 6; k > 0; k -= 1) if (filled(step(out, 2, k))) sky = 0.64 + 0.05 * k;
        // Numbers: all-integer arrays become bytes fast.
        const edges = [+!p.at(step(cell, u, -1)), +!p.at(step(cell, u, 1)), +!p.at(step(cell, v, -1)), +!p.at(step(cell, v, 1))];
        const quad = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([cu, cv]) => {
          const a = filled(step(out, u, cu ? 1 : -1)) ? 1 : 0;
          const b = filled(step(out, v, cv ? 1 : -1)) ? 1 : 0;
          const c = filled(step(step(out, u, cu ? 1 : -1), v, cv ? 1 : -1)) ? 1 : 0;
          const open = a && b ? 0 : 3 - a - b - c;
          const pos = [...cell];
          if (d > 0) pos[axis] += 1;
          pos[u] += cu;
          pos[v] += cv;
          const glow = p.glow ? round(127 * p.glow(pos.map((q, i) => (q + p.o[i]) * p.s[i]))) : 0;
          return { open, bytes: [...pos.map((q, i) => (q + p.o[i]) * 2), cu, cv, pi, axis * 2 + (d > 0 ? 1 : 0), colour, round(127 * (0.46 + 0.18 * open) * sky), ...edges, glow, 0, 0] };
        });
        // Split along the diagonal that keeps the shade smooth.
        const order = quad[0].open + quad[2].open >= quad[1].open + quad[3].open ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
        for (const i of order) data.push(...quad[i].bytes);
      }
    }
  }
  return new Int8Array(data);
}

const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec2 aU; layout(location=2) in vec4 aM;
layout(location=3) in vec4 aE; layout(location=4) in float aG;
uniform vec4 uB[${ROWS * 3}],uView; uniform vec2 uRes;
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

// Key, a cool fill from above, open edges lit and a rim; pale colours take part of the light's
// hue, so cream stays cream. The screen lights itself: soft round shapes with a glow, and a
// sheen. The power light and the lamp breathe.
const FS = `#version 300 es
precision highp float;
in vec3 vC; in vec2 vU; in float vA,vG; flat in vec3 vN; flat in vec4 vE; flat in float vK;
uniform vec3 uSun,uKey,uAmb,uSky; uniform vec4 uGlow; uniform float uOn; uniform sampler2D uFace;
out vec4 o;
const vec3 L=vec3(.3,.59,.11);
void main(){
  if(vK>1.5){
    vec2 uv=vec2(vU.x,1.-vU.y),q=vU-.5,d=vec2(.05,.067);
    vec3 t=smoothstep(.3,.6,texture(uFace,uv).rgb);
    t+=(texture(uFace,uv+d).rgb+texture(uFace,uv-d).rgb+texture(uFace,uv+vec2(d.x,-d.y)).rgb+texture(uFace,uv-vec2(d.x,-d.y)).rgb)*.1;
    vec3 ink=vec3(.6,.95,1.)*t.r+vec3(1.,.5,.62)*t.g+vec3(1.,.86,.5)*t.b;
    vec3 col=vec3(.07,.1,.33)*(.72+.38*(1.-dot(q,q)*2.2))+ink;
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

// Voxels of rounding on the edges the model leaves square; less on the coil, the cable's links and the dust, which
// are thin enough that a full bevel would part them, and on the soles, which read as soles only with an edge.
const BEVEL = { ant: 0.08, tail: 0.14, plug: 0.14, dot: 0.14, foot: 0.26 };
// Gloss by palette entry: the plastics shine, the soft and dark parts barely.
const GLOSS = [0.4, 0.3, 0.25, 0.35, 0.25, 0.35, 0.6, 0.2, 0.3, 0.4, 0.6, 0.7, 0];

// A part's shape as a distance from a point in its cells: its solid boxes less its carved ones, in the order
// smed3d.js fills them, each rounded as it is filled (corners seen from the front) and on every other edge by
// the bevel (its own `bevel`, if it has one).
function shape(p) {
  const e = (p.bevel ?? BEVEL[p.bone.replace(/\d+$/, '')] ?? 0.42) / Math.min(...p.s);
  const boxes = p.boxes.filter((b) => b[6] < PAINT).flatMap((b) => {
    const h = [0, 1, 2].map((i) => (b[i + 3] - b[i]) / 2);
    return [b[0] + h[0], b[1] + h[1], b[2] + h[2], ...h, Math.min(e, h[0] * 0.9), Math.min(Math.max(b[7] || 0, e), h[1], h[2]), b[6] < 0 ? -1 : 1];
  });
  return (x, y, z) => {
    let s = 1e9;
    for (let i = 0; i < boxes.length; i += 9) {
      const ex = boxes[i + 6];
      const r = boxes[i + 7];
      const qy = Math.abs(y - boxes[i + 1]) - boxes[i + 4] + r;
      const qz = Math.abs(z - boxes[i + 2]) - boxes[i + 5] + r;
      const wx = Math.abs(x - boxes[i]) - boxes[i + 3] + ex;
      const wy = Math.hypot(Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qy, qz), 0) - r + ex;
      const d = Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) + Math.min(Math.max(wx, wy), 0) - ex;
      s = boxes[i + 8] < 0 ? Math.max(s, -d) : Math.min(s, d);
    }
    return s;
  };
}

// Which way a distance grows at q, measured h cells to either side.
const grad = (sd, q, h) => {
  const g = [0, 1, 2].map((k) => {
    const a = [...q];
    const b = [...q];
    a[k] += h;
    b[k] -= h;
    return sd(...a) - sd(...b);
  });
  const l = Math.hypot(...g) || 1;
  return g.map((c) => c / l);
};

// Each vertex moves onto its part's shape, the same for every face that shares it, so no seam opens; one the
// shape cannot place within a cell keeps its voxel spot. A `flat` part keeps its voxel faces for its own shading.
// The work yields to the page every few milliseconds. Bit himself stays cut in cubes: tools/art rounds its toys.
async function smooth(mesh, parts) {
  const extra = new Int8Array((mesh.length / 16) * 8);
  const shapes = parts.map((p) => !p.flat && shape(p));
  const seen = new Map();
  let slice = performance.now();
  for (let v = 0; v < mesh.length / 16; v += 1) {
    const i = v * 16;
    const pi = mesh[i + 5];
    const key = ((pi * 256 + mesh[i] + 128) * 256 + mesh[i + 1] + 128) * 256 + mesh[i + 2] + 128;
    let out = seen.get(key);
    if (!out) {
      const p = parts[pi];
      const sd = shapes[pi];
      const q0 = [0, 1, 2].map((k) => mesh[i + k] / 2 - p.o[k]);
      out = [0, 0, 0, 0, 0, 0, 0, 0];
      if (sd) {
        let q = q0;
        for (let k = 0; k < 3; k += 1) {
          const s = sd(...q);
          const g = grad(sd, q, 0.05);
          q = q.map((c, j) => c - g[j] * s);
        }
        const d = q.map((c, k) => c - q0[k]);
        if (Math.hypot(...d) > 0.9 || Math.abs(sd(...q)) > 0.15) q = q0;
        // Normals go through the part's scale inverted twice: once here, once undone by its rows in the shader.
        const n = grad(sd, q, 0.35).map((c, k) => c / p.s[k] ** 2);
        const l = Math.hypot(...n) || 1;
        out = [...q.map((c, k) => Math.round((c - q0[k]) * 64)), ...n.map((c) => Math.round((c / l) * 127)), 0, 0];
      }
      seen.set(key, out);
      if (performance.now() - slice > 6) {
        await pause();
        slice = performance.now();
      }
    }
    extra.set(out, v * 8);
  }
  return extra;
}

// The screen's centre and facing come from its own part's rows, so the light it throws follows every turn.
const SCREEN_AT = 'vec3(uB[6].w,uB[7].w,uB[8].w)';
const SCREEN_N = 'normalize(vec3(uB[6].x,uB[7].x,uB[8].x))';
const VIEW = 'float ca=sqrt(1.-uView.w*uView.w);';

const FINE_VS = `${VS.replace('void main(){', 'void base(){')}
layout(location=5) in vec3 aD; layout(location=6) in vec3 aS;
uniform vec4 uNew;
out vec3 vS,vW; out float vL; flat out float vQ;
const float GLOSS[${GLOSS.length}]=float[${GLOSS.length}](${GLOSS.map((g) => g.toFixed(2))});
void main(){
  base();
  int b=int(aM.x)*3;
  vec4 p=vec4((aP+aD*uNew.x/32.)*.5,1.);
  vec3 w=vec3(dot(uB[b],p),dot(uB[b+1],p),dot(uB[b+2],p));
  vec3 s=vec3(dot(uB[b].xyz,aS),dot(uB[b+1].xyz,aS),dot(uB[b+2].xyz,aS));
  vS=dot(aS,aS)>.01?normalize(s):vN;
  vQ=GLOSS[int(aM.z)];
  vW=w;
  vec3 d=w-${SCREEN_AT};
  float r=max(length(d),1.);
  vL=max(dot(${SCREEN_N},d)/r,0.)*max(-dot(vS,d)/r,0.)/(1.+r*r*.02);
  ${VIEW}
  gl_Position=vec4((w.x*uView.x+uView.y)*2./uRes.x-1.,((w.y*ca-w.z*uView.w)*uView.x+uView.z)*2./uRes.y-1.,-(w.y*uView.w+w.z*ca)*.02,1.);
  // Behind the bar his cable, plug and dust are left out: they keep to the bar's top, where they would show.
  if(uNew.z>8.&&aM.x>15.5) gl_Position.z=2.;
}`;

// A broad key with a soft terminator, a fill from the sky above and from the viewer's side, gloss in the
// light's own colour, a rim of sky on the edges turned away, and on each cube's open edges a bevel that catches
// the key. Ambient occlusion deepens the creases.
// The glass gets a bezel's shadow along its top, a darker curve toward its corners and the sky's reflection.
// After dark his screen is the brightest thing about him: its light on the bezel and mittens counts for more.
// An event (`uNew.w`) brightens the lamp.
const FINE_FS = `${FS.replace('void main(){', 'void base(){')}
in vec3 vS,vW; in float vL; flat in float vQ;
uniform vec4 uNew,uView;
const vec3 V=vec3(0.,.26,.966);
void main(){
  if(uNew.z>0.&&gl_FragCoord.y<uView.z) discard;
  base();
  if(uNew.x<=0.) return;
  vec3 col=o.rgb;
  if(vK>1.5){
    vec2 q=vU-.5;
    float edge=max(abs(q.x)*1.04,abs(q.y)*1.3);
    col*=1.-.45*smoothstep(.36,.5,edge)-.3*smoothstep(.3,.5,q.y);
    col+=(uSky*.4+.12)*.22*smoothstep(-.05,.5,q.y+q.x*.25)*(1.-smoothstep(.42,.5,edge));
    vec2 r=abs(q-vec2(-.2,.39-q.x*q.x*.3))-vec2(.17,.012);
    col+=vec3(.85,.92,1.)*.32*(1.-smoothstep(-.01,.015,length(max(r,0.))+min(max(r.x,r.y),0.)-.012))*smoothstep(.0,-.3,q.x);
  } else if(vK<.5){
    vec3 n=vS/max(length(vS),1e-4);
    float nl=dot(n,uSun),k=smoothstep(-.3,.8,nl),ao=smoothstep(.3,1.,vA),nv=max(dot(n,V),0.);
    float pale=.75*smoothstep(.45,.75,min(vC.r,min(vC.g,vC.b)));
    vec3 key=mix(uKey,vec3(dot(uKey,L)),pale),amb=mix(uAmb,vec3(max(dot(uAmb,L),.6)),pale),sky=mix(uSky,vec3(dot(uSky,L)),pale);
    col=vC*(amb*(.46+.2*n.y)*mix(.55,1.,ao)+sky*.14*max(n.y,0.)*ao+key*.48*k*mix(.6,1.,ao)+sky*.07*nv)*(.9+.14*smoothstep(2.,26.,vW.y));
    vec3 h=normalize(uSun+V);
    float nh=max(dot(n,h),0.);
    col+=key*vQ*(.6*pow(nh,60.)+.06*pow(nh,4.))*k*ao;
    col+=(sky*.7+key*.3)*pow(1.-nv,3.)*(.42-.22*k)*mix(.5,1.,ao);
    float e=min(min(mix(1.,vU.x,vE.x),mix(1.,1.-vU.x,vE.y)),min(mix(1.,vU.y,vE.z),mix(1.,1.-vU.y,vE.w)));
    col+=vC*(key*.5+sky*.3)*(1.-smoothstep(.04,.24,e))*(.25+.6*k);
    col*=mix(vec3(.95,.97,1.05),vec3(1.04,1.,.95),k);
    col+=uGlow.rgb*(vG*(.3+.7*vC)+vL*1.2*(.25+.75*vC))*(1.+.7*uNew.y);
  } else col*=1.+uNew.w*step(.9,vC.r);
  o.rgb=mix(o.rgb,col,uNew.x);
}`;

// Over the first-view shadow: a tighter, darker core under each foot, and after dark the screen's light: a
// pool on the bar in front of him, a haze around the screen and a small one around the lamp, which an event
// also lights by day (`uNew.w`). No division here may reach zero: on Metal a NaN that reaches min() comes out
// as its other side, and fills the whole canvas.

export { FINE_FS, FINE_VS, ROWS, SHADOW_FS, SHADOW_VS, buildMesh, program, smooth };

// The contact shadow and the program linker, as the mascot had them when the toys were baked.
const SHADOW_VS = `#version 300 es
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.-1.,.9,1.); }`;

// Contact shadow: soft blobs under feet, body and plug, in ground coordinates.
const SHADOW_FS = `#version 300 es
precision highp float;
uniform vec4 uS[4],uView;
out vec4 o;
void main(){
  vec2 g=vec2((gl_FragCoord.x-uView.y)/uView.x,(uView.z-gl_FragCoord.y)/(uView.x*uView.w));
  float a=0.;
  for(int i=0;i<4;i++){ vec2 d=(g-uS[i].xy)/max(uS[i].z,.1); d.y*=.6; a+=uS[i].w*exp(-dot(d,d)); }
  a=min(a,.55)*smoothstep(0.,uView.z*.5,gl_FragCoord.y);
  o=vec4(vec3(.02,.04,.13)*a,a);
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

// Bit's finer look, which smed3d.js brings in after the page has loaded: his voxel steps drawn in onto the
// rounded shapes they were cut from, smooth normals with a soft bevel on every edge, a studio light (a broad
// key, a sky fill, gloss and a rim that lifts him off the city), the screen lighting his arms and the bar at
// night, a glass that curves, and a firmer contact shadow. It wraps his first-view shaders rather than
// replacing them, so at uNew.x = 0 he draws exactly as before and the hand-over is a fade, not a cut.

import { FS, PAINT, PARTS, SHADOW_FS, SHADOW_VS, VS, program } from './smed3d.js';

// Voxels of rounding on the edges the model leaves square; less on the coil, the cable's links and the dust, which
// are thin enough that a full bevel would part them, and on the soles, which read as soles only with an edge.
const BEVEL = { ant: 0.08, tail: 0.14, plug: 0.14, dot: 0.14, foot: 0.26 };
// Gloss by palette entry: the plastics shine, the soft and dark parts barely.
const GLOSS = [0.55, 0.4, 0.3, 0.45, 0.3, 0.5, 0.5, 0.2, 0.35, 0.5, 0.6, 0.6, 0];

// A part's shape as a distance from a point in its cells: its solid boxes less its carved ones, in the order
// smed3d.js fills them, each rounded as it is filled (corners seen from the front) and on every other edge by
// the bevel.
function shape(p) {
  const e = (BEVEL[p.bone.replace(/\d+$/, '')] ?? 0.42) / Math.min(...p.s);
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
// shape cannot place within a cell keeps its voxel spot. The glass (part 2) stays flat for its own shading. The
// work yields to the page every few milliseconds.
async function smooth(mesh) {
  const extra = new Int8Array((mesh.length / 16) * 8);
  const shapes = PARTS.map((p, pi) => pi !== 2 && shape(p));
  const seen = new Map();
  let slice = performance.now();
  for (let v = 0; v < mesh.length / 16; v += 1) {
    const i = v * 16;
    const pi = mesh[i + 5];
    const key = ((pi * 256 + mesh[i] + 128) * 256 + mesh[i + 1] + 128) * 256 + mesh[i + 2] + 128;
    let out = seen.get(key);
    if (!out) {
      const p = PARTS[pi];
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
        await (globalThis.scheduler?.yield?.() ?? new Promise((done) => { setTimeout(done); }));
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
uniform vec2 uNew;
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
}`;

// A broad key with a soft terminator, a fill from the sky above and from the viewer's side, gloss in the
// light's own colour, and a rim of sky on the edges turned away. Ambient occlusion deepens the creases.
// The glass gets a bezel's shadow along its top, a darker curve toward its corners and the sky's reflection.
const FINE_FS = `${FS.replace('void main(){', 'void base(){')}
in vec3 vS,vW; in float vL; flat in float vQ;
uniform vec2 uNew;
const vec3 V=vec3(0.,.26,.966);
void main(){
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
    vec3 n=normalize(vS);
    float nl=dot(n,uSun),k=smoothstep(-.3,.8,nl),ao=smoothstep(.3,1.,vA),nv=max(dot(n,V),0.);
    float pale=.75*smoothstep(.45,.75,min(vC.r,min(vC.g,vC.b)));
    vec3 key=mix(uKey,vec3(dot(uKey,L)),pale),amb=mix(uAmb,vec3(max(dot(uAmb,L),.6)),pale),sky=mix(uSky,vec3(dot(uSky,L)),pale);
    col=vC*(amb*(.46+.2*n.y)*mix(.55,1.,ao)+sky*.14*max(n.y,0.)*ao+key*.48*k*mix(.6,1.,ao)+sky*.07*nv)*(.9+.14*smoothstep(2.,26.,vW.y));
    vec3 h=normalize(uSun+V);
    float nh=max(dot(n,h),0.);
    col+=key*vQ*(.6*pow(nh,60.)+.06*pow(nh,4.))*k*ao;
    col+=(sky*.7+key*.3)*pow(1.-nv,3.)*(.42-.22*k)*mix(.5,1.,ao);
    col*=mix(vec3(.95,.97,1.05),vec3(1.04,1.,.95),k);
    col+=uGlow.rgb*(vG*(.3+.7*vC)+vL*1.2*(.25+.75*vC));
  }
  o.rgb=mix(o.rgb,col,uNew.x);
}`;

// Over the first-view shadow: a tighter, darker core under each foot, and after dark the screen's light: a
// pool on the bar in front of him, a haze around the screen and a small one around the lamp.
const FINE_SHADOW_FS = `${SHADOW_FS.replace('void main(){', 'void base(){')}
uniform vec2 uNew;
uniform vec4 uB[${PARTS.length * 3}];
vec2 onView(vec3 w){ ${VIEW} return vec2(w.x*uView.x+uView.y,(w.y*ca-w.z*uView.w)*uView.x+uView.z); }
void main(){
  base();
  if(uNew.x<=0.) return;
  vec2 g=vec2((gl_FragCoord.x-uView.y)/uView.x,(uView.z-gl_FragCoord.y)/(uView.x*uView.w));
  float a=0.;
  for(int i=0;i<2;i++){ vec2 d=(g-uS[i].xy)/(uS[i].z*.45); d.y*=.6; a+=uS[i].w*2.*exp(-dot(d,d)); }
  a=min(a,.5)*smoothstep(0.,uView.z*.5,gl_FragCoord.y)*uNew.x;
  o=vec4(o.rgb*(1.-a)+vec3(.02,.03,.1)*a,o.a+a*(1.-o.a));
  float on=uNew.x*uNew.y;
  if(on<=0.) return;
  vec3 sf=${SCREEN_N};
  vec2 pool=(g-uS[2].xy-normalize(sf.xz+.001)*5.)/vec2(7.,4.);
  vec2 halo=(gl_FragCoord.xy-onView(${SCREEN_AT}))/(uView.x*9.);
  vec2 lamp=(gl_FragCoord.xy-onView(vec3(uB[15].w,uB[16].w,uB[17].w)))/(uView.x*2.6);
  o.rgb+=on*(vec3(.45,1.,.8)*(.22*exp(-dot(pool,pool))*smoothstep(0.,uView.z,gl_FragCoord.y+uView.z*.3)+.1*(.4+.6*max(sf.z,0.))*exp(-dot(halo,halo)))+vec3(1.,.7,.3)*.1*exp(-dot(lamp,lamp)));
}`;

// The finer programs for smed3d.js's context, with the extra per-vertex data bound beside its mesh. A context
// that was lost and restored asks again; the smoothing is kept from the first time.
let smoothed = null;
export async function fine(gl, mesh) {
  smoothed ??= await smooth(mesh);
  const figure = program(gl, FINE_VS, FINE_FS);
  const shadow = program(gl, SHADOW_VS, FINE_SHADOW_FS);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, smoothed, gl.STATIC_DRAW);
  [5, 6].forEach((at, i) => {
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 3, gl.BYTE, i === 1, 8, i * 3);
  });
  return { figure, shadow };
}

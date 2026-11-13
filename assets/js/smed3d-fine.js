// Bit's finer look, which smed3d.js brings in after the page has loaded: the same cubes (his shape never changes
// as it lands), each open cube edge catching the light as a bevel, a studio light (a broad key, a sky fill, gloss
// and a rim that lifts him off the city), the screen lighting his arms and the bar at night, a glass that curves,
// and a firmer contact shadow. It wraps his first-view shaders rather than
// replacing them, so at uNew.x = 0 he draws exactly as before and the hand-over is a fade, not a cut.
// His finer motion lives here too, under Motion: what each act does on top of its pose, how he idles, and
// where on the bar he may sit.

import { FS, KEYS, PAINT, PARTS, SHADOW_FS, SHADOW_VS, SOLO, VS, pause, program } from './smed3d.js';

export { FINE_FS, FINE_VS, smooth };

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
const FINE_SHADOW_FS = `${SHADOW_FS.replace('void main(){', 'void base(){')}
uniform vec4 uNew;
uniform vec4 uB[${PARTS.length * 3}];
vec2 onView(vec3 w){ ${VIEW} return vec2(w.x*uView.x+uView.y,(w.y*ca-w.z*uView.w)*uView.x+uView.z); }
void main(){
  if(uNew.z>0.&&gl_FragCoord.y<uView.z) discard;
  base();
  float sunk=clamp(1.-uNew.z*.1,0.,1.);
  o*=sunk;
  if(uNew.x<=0.) return;
  vec2 g=vec2((gl_FragCoord.x-uView.y)/uView.x,(uView.z-gl_FragCoord.y)/(uView.x*uView.w));
  float a=0.;
  for(int i=0;i<2;i++){ vec2 d=(g-uS[i].xy)/(max(uS[i].z,.1)*.45); d.y*=.6; a+=uS[i].w*2.*exp(-dot(d,d)); }
  a=min(a,.5)*smoothstep(0.,uView.z*.5,gl_FragCoord.y)*uNew.x*sunk;
  o=vec4(o.rgb*(1.-a)+vec3(.02,.03,.1)*a,o.a+a*(1.-o.a));
  float on=uNew.x*uNew.y;
  if(on+uNew.w<=0.) return;
  vec3 sf=${SCREEN_N};
  vec2 pool=(g-uS[2].xy-sf.xz/max(length(sf.xz),.001)*5.)/vec2(7.,4.);
  vec2 halo=(gl_FragCoord.xy-onView(${SCREEN_AT}))/(uView.x*9.);
  vec2 lamp=(gl_FragCoord.xy-onView(vec3(uB[15].w,uB[16].w,uB[17].w)))/(uView.x*2.6);
  o.rgb+=on*(vec3(.45,1.,.8)*(.22*sunk*exp(-dot(pool,pool))*smoothstep(0.,uView.z,gl_FragCoord.y+uView.z*.3)+.1*(.4+.6*max(sf.z,0.))*exp(-dot(halo,halo))))+vec3(1.,.7,.3)*(.1*on+.3*uNew.w)*exp(-dot(lamp,lamp));
}`;

/* ------------------------------------------------------------------- Motion */

// What each act does on top of its pose, kept out of the first view. A beat swells and fades, so nothing
// starts or stops at full swing; the part that drives a move leads it and what hangs from that part trails
// by a fraction of the beat; a shake or a sway loses its force as it goes.
const channel = (name) => (KEYS.includes(name) ? KEYS.indexOf(name) * 2 : KEYS.length * 2 + SOLO.indexOf(name));
const [SWING, RAISE, INW, ELBOW, DROP, STAG, BPITCH, BTILT, TWIST] = ['swing', 'raise', 'inw', 'elbow', 'drop', 'stag', 'bpitch', 'tilt', 'twist'].map(channel);
const { sin, cos, exp } = Math;
const ease = (t) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
// 1 from a to b seconds, eased in and out over e.
const span = (t, a, b, e = 0.3) => ease((t - a) / e) * ease((b - t) / e);
const pulse = (a) => 0.5 - 0.5 * cos(a);

// Degrees and voxels added to the pose `o`, by act or state: st is the seconds into it, t his own clock, `legs`
// what each leg adds at hip and knee off the ground. Arm channels come in pairs, right then left.
const MOVES = {
  // The whole arm sweeps from the shoulder, the forearm a quarter beat behind it, the screen leaning against it.
  wave(o, st) {
    const e = span(st, 0.5, 1.95);
    const a = (st - 0.5) * 11;
    o[RAISE + 1] += 22 * e * sin(a);
    o[ELBOW + 1] += 16 * e * sin(a - 1.3);
    o[BTILT] -= 1.6 * e * sin(a - 0.5);
  },
  // Wiping the glass in small circles.
  polish(o, st) {
    const e = span(st, 0.35, 1.5, 0.25);
    o[INW + 1] += 18 * e * sin(st * 13);
    o[SWING + 1] += 6 * e * cos(st * 13);
    o[BTILT] += 2 * e * sin(st * 13 - 0.8);
  },
  // Typing comes in bursts, the hands drift along the keys and the screen nods along each line.
  type(o, st) {
    const e = span(st, 0.3, 3.7);
    const hit = 11 * e * (0.45 + 0.55 * sin(st * 2.9) ** 2);
    o[ELBOW] += hit * sin(st * 25);
    o[ELBOW + 1] -= hit * sin(st * 25 + 0.5);
    o[INW] += 3 * e * sin(st * 1.7);
    o[INW + 1] -= 3 * e * sin(st * 1.7);
    o[BPITCH] += 1.6 * e * sin(st * 2.9);
  },
  think(o, st) {
    o[BTILT] += 2.2 * span(st, 0.4, 2.8, 0.4) * sin(st * 1.9);
  },
  // A stretch: up on his toes, arms out long, back arched.
  yawn(o, st) {
    const e = span(st, 0.4, 1.8, 0.5);
    o[DROP] -= 0.35 * e;
    o[ELBOW] -= 14 * e;
    o[ELBOW + 1] -= 14 * e;
    o[BPITCH] -= 3 * e;
  },
  // The screen rocks on the beat, the arms a little behind it, the feet step on the half beat.
  dance(o, st) {
    const e = span(st, 0.1, 2.9, 0.4);
    const a = st * 8.4;
    o[DROP] += 0.8 * e * pulse(2 * a);
    o[BTILT] += 9 * e * sin(a);
    o[TWIST] += 8 * e * sin(a / 2);
    o[RAISE] += 14 * e * sin(a - 0.8);
    o[RAISE + 1] -= 14 * e * sin(a - 0.8);
    o[STAG] += 1.2 * e * sin(a / 2);
  },
  // Shoulders bounce and die down.
  laugh(o, st) {
    const e = span(st, 0, 1.9, 0.2) * exp(-st * 0.9);
    o[DROP] += 0.55 * e * pulse(st * 23);
    o[BPITCH] -= 3 * e * pulse(st * 23);
    o[RAISE] += 6 * e * pulse(st * 23 - 0.9);
    o[RAISE + 1] += 6 * e * pulse(st * 23 - 0.9);
  },
  love(o, st) {
    const e = span(st, 0.3, 2.4, 0.4);
    o[BTILT] += 6 * e * sin(st * 4.2);
    o[DROP] += 0.25 * e * pulse(st * 8.4);
  },
  // The tumble: he flails in the air, reels where he lands until he has his balance, and shakes it off.
  roll(o, st, t, legs) {
    flail(o, t, legs, 22 * span(st, 0.28, 1.04, 0.12));
    reel(o, st - 1, 14 * span(st, 1, 2.3, 0.14) * exp(1 - st));
    o[TWIST] += 15 * span(st, 2.3, 2.8, 0.14) * sin((st - 2.3) * 26);
  },
  // Picked up he kicks, then hangs.
  held(o, st, t, legs) { flail(o, t, legs, 4 + 12 * exp(-st * 1.6)); },
  drop(o, st, t, legs) { flail(o, t, legs, 12); },
};
const reel = (o, st, a) => {
  o[BTILT] += a * sin(st * 5.5);
  o[BPITCH] += 0.55 * a * sin(st * 5.5 + 1.3);
  o[STAG] += 0.09 * a * sin(st * 5.5);
};
const flail = (o, t, legs, a) => {
  legs[0][0] = a * sin(t * 13);
  legs[1][0] = -a * sin(t * 13);
  o[RAISE] += 0.4 * a * sin(t * 14);
  o[RAISE + 1] -= 0.4 * a * sin(t * 14 + 1);
};

const LEGS = 26; // CSS pixels his hanging legs and shoes span to each side of his middle where he sits.
const REACH = 26; // CSS pixels of the bar's face his canvas covers, below its top edge.
const SEATED = 0.8; // His scale where main.js sits him down, on every tab but Home (`.smed.is-seated`).
// Away from Home he does not sit on the bar but peeks over its edge from behind it, low and quiet: his lamp, both
// eyes whole and his mittens show, PEEK CSS px lower than he stands, the same on every tab, so the page only says
// when he may be up. Getting there or back, he ducks out of sight where he is in DOWN seconds,
// crosses under the bar and comes up at his place in UP seconds, the head a little past it: he never crosses the
// page. DEEP px down, not even his lamp shows.
const PEEK = 42;
const DOWN = 0.25;
const UP = 0.3;
const DEEP = 100;
const AIR = ['jump', 'roll', 'held', 'drop'];
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
// Still, he is drawn once in REST ms: enough for a breath and a blink, and the page keeps its frames.
const REST = 50;
// Peeking, he looks up and over the edge.
const OVER = { turn: 0, pitch: -5, gaze: [0, -3], until: Infinity };

// Bit's finer motion, for smed3d.js to call once a frame after its springs and before his feet are planted.
// It returns the face he rests in.
function life(me) {
  const { out, legs, rand } = me;
  const plain = new Float32Array(out.length);
  let born = null;
  let was = 0;
  let dangle = 0; // How freely his legs swing where he sits: it ebbs away as he falls asleep.
  let calm = 0; // 1 while he stands idle, eased, so what idling adds never cuts in or out.
  let rested = false;
  let actAt = 0;
  let microAt = 0;
  let perkUntil = 0;
  let sign = 0;
  let sighAt = -9;
  let late = false;
  let tired = 0; // 1 late at night, eased: he hangs a little.
  let stretched = false;
  let now = 0;
  let doing0 = 'idle';
  let dip = 0; // CSS px he rests below the bar's edge: 0 on his feet, PEEK peeking.
  let go = null; // A dive under way: where to, how low he ends, when it began, from what depth, if he crossed, and
  // until when he waits under it undrawn.
  let wait = null; // A dive asked for while he is in the air.
  let spot = null; // Where his last dive set him down, as his box's offset along the bar.
  let hold = 0; // 1 while his mittens hold the bar's edge, eased.
  let lampAt = -9;
  let lookAt = 0;
  let lastY = null;
  let parked = false;
  let low = null; // Where he goes back to when the page lets him up again: [to, end].
  let stirUntil = 0; // Until when he is drawn every frame.
  let doing1 = '';
  let glance1 = null;
  const before = new Float32Array(out.length);
  const box = parseFloat(me.el.style.height) || 126;
  const tall = () => { me.el.style.height = `${Math.max(box + 1.6 * Math.min(me.dy, 0), 0)}px`; }; // The page takes taps on the rest.
  const here = () => parseFloat(me.el.style.translate) || 0;
  me.home = () => !!me.bar.querySelector('a')?.hasAttribute('aria-current');
  // Down out of sight where he is, across under the bar and up at `to`, settling `end` px below its edge. Asked
  // again on the way, he goes down from where he is and on to the new place; `again` ducks him where he already is.
  const dive = (to, end, again) => {
    if (low) { low = [to, end]; return; } // Down for the page, he only learns where to come up.
    if (!again && (go ? go.to === to && go.end === end : spot === to && dip === end)) return;
    if (AIR.includes(doing0)) { wait = [to, end]; return; }
    lampAt = now;
    if (REDUCE.matches) {
      go = null;
      spot = to;
      dip = me.dy = end;
      tall();
      me.to(to);
      return;
    }
    if (!go) me.to();
    // His eyes go first.
    const side = Math.sign(to - here());
    me.glance = { turn: 18 * side, pitch: 4, gaze: [2.4 * side, 0.6], until: now + 0.3 };
    go = { to, end, at: now - (me.dy <= -DEEP ? DOWN : 0), from: me.dy, moved: false, down: DOWN };
  };
  // On a bar with no seat for him, a rail, he peeks where he is, kept on it.
  me.peek = () => dive(me.seat(here()) ?? Math.max(4, Math.min(here(), me.bar.clientWidth - me.el.offsetWidth - 4)), -PEEK);
  me.rise = (to) => dive(to, 0);
  me.duck = () => go || !dip || dive(spot, dip, true);
  me.under = () => !!(go || dip);
  // While the page reads under a folded bar he is down out of sight, not drawn at all; then back where he was.
  // The bar narrows past him within a tenth of a second, so he drops in 60 ms; he comes up only once it is wide
  // again, a third of a second after it starts to open. Already out of sight, he waits that out undrawn, on the
  // page's clock (`hold`): his own only runs while he is drawn, and its first step after the wait is 0.05 s.
  me.sink = (on) => {
    if (!on === !low) return;
    const back = low ?? [go ? go.to : spot ?? here(), go ? go.end : dip];
    const gone = !go && me.dy <= -DEEP;
    low = null;
    if (on) dive(here(), -DEEP, true);
    else dive(...back, true);
    if (go) Object.assign(go, on ? { down: 0.06 } : gone ? { at: now + 0.05 - DOWN, hold: performance.now() + 250 } : { at: now + 0.3 - DOWN });
    low = on ? back : null;
  };
  // What smed3d.js may leave undrawn: everything while he is down for the page, else, while he is still, all
  // but a frame in REST ms. Anything that moves him draws him every frame for a while.
  me.nap = (ms) => (go ? performance.now() < go.hold : dip <= -DEEP || (now >= stirUntil && ms < REST));
  me.stir = (s = 0.6) => { stirUntil = Math.max(stirUntil, now + s); };
  // A turned phone or a resized window moves his place: he goes under and comes up at the new one.
  addEventListener('resize', () => { if ((low ? low[1] : go ? go.end : dip) < 0) me.peek(); });
  // A look at what was just touched, a tab or a toy, before anything else happens: screen and eyes go to it.
  me.look = (target) => {
    const t = target.getBoundingClientRect();
    const b = me.el.getBoundingClientRect();
    const g = [(t.left + t.width / 2 - b.left - b.width / 2) / 72, (b.bottom - 56 - t.top - t.height / 2) / 72, 1.4];
    const turn = Math.max(-40, Math.min(40, (Math.atan2(g[0], g[2]) * 180) / Math.PI));
    const pitch = Math.max(-16, Math.min(14, (-Math.asin(g[1] / Math.hypot(...g)) * 90) / Math.PI));
    me.glance = { turn, pitch, gaze: [Math.max(-2.6, Math.min(2.6, g[0] * 2.4)), Math.max(-2, Math.min(1, -g[1] * 2))], until: now + 0.9 };
    me.stir(1.2);
  };
  // Now and then his eyes follow the page as it scrolls under him.
  me.scrolled = (e) => {
    const y = e.target.scrollTop ?? scrollY;
    const d = Math.sign(y - (lastY ?? y));
    lastY = y;
    if (!d || go || !dip || now < lookAt) return;
    lookAt = now + rand(5, 10);
    me.glance = { turn: 0, pitch: -3 * d, gaze: [rand(-0.6, 0.6), -1.2 * d - 1], until: now + rand(0.6, 1) };
  };
  // Where his weight rests: the screen's tilt and twist and how far one foot stands ahead, each eased twice.
  const lean = [0, 0, 0];
  const leanVia = [0, 0, 0];
  const leanTo = [0, 0, 0];

  // A seat is where his legs can hang down the bar's face without covering what a tab draws: over the gap between
  // two tabs, with LEGS px to each side of his middle clear of every icon and label within his reach. On Home it is
  // the seat nearest x; on the other tabs, where the page sits him down smaller, the gap before the last tab, or the
  // free gap nearest it. The answer is his box's offset along the bar, or null where no gap is free, as on the bar
  // on its end.
  me.seat = (x) => {
    const b = me.bar.getBoundingClientRect();
    const as = [...me.bar.querySelectorAll('a')];
    const home = as[0]?.hasAttribute('aria-current');
    const k = home ? 1 : SEATED;
    const tabs = as.map((a) => a.getBoundingClientRect());
    const drawn = [...me.bar.querySelectorAll('a *')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.top - b.top < REACH * k);
    let best = null;
    for (let i = 1; i < tabs.length; i += 1) {
      const mid = (tabs[i - 1].right + tabs[i].left) / 2;
      const to = mid - b.left - me.el.offsetWidth / 2;
      const free = drawn.every((r) => r.left > mid + LEGS * k || r.right < mid - LEGS * k);
      if (free && (best === null || !home || Math.abs(to - x) < Math.abs(best - x))) best = to;
    }
    return best;
  };

  // Standing idle is mostly rest. Every few seconds one small sign of life: his eyes go somewhere, with or
  // without the screen; a thought widens his smile; his weight shifts; he takes a deeper breath. Two or three
  // times a minute an act or a stroll, and left alone long enough he sits down.
  // He keeps the scene's hours: late at night (23 to 5) he is drowsy and his act is a yawn, and the first thing
  // he does on a morning visit (5 to 9, once it is light) is stretch, unless a yawn was asked of him first.
  // Under a dull sky by day, when the sun he is lit by has lost more than half its light, the glance that turns
  // his screen goes up to the weather.
  const idle = (fresh, t, quiet, light, under) => {
    const hour = light.hour ?? 12;
    late = hour >= 23 || hour < 5;
    const day = !(light.night > 0.5);
    const stretch = day && !stretched && hour >= 5 && hour < 9;
    const [r0, g0, b0] = light.sunColor;
    const dull = day && 0.3 * r0 + 0.59 * g0 + 0.11 * b0 < 0.5;
    if (fresh) {
      actAt = Math.max(actAt, t + (stretch ? rand(2, 4) : rand(8, 14)));
      microAt = Math.max(microAt, t + rand(1.2, 2.4));
    }
    if (under) actAt = Math.max(actAt, t + 8); // Behind the bar he keeps to small signs: no act, no stroll, no seat.
    else if (quiet > (light.night > 0.6 ? 12 : 24)) me.sit();
    else if (t > actAt) {
      actAt = t + rand(16, 30);
      const r = rand(0, 1);
      if (late || stretch) me.perform('yawn');
      else if (r < 0.75) me.perform(['polish', 'think', 'wink'][Math.floor(r * 4)]);
      else me.stroll();
    } else if (t > microAt) {
      microAt = t + rand(2.4, 6);
      sign = (sign + 1 + Math.floor(rand(0, 4))) % 5; // Never the same sign of life twice running.
      const side = rand(0, 1) < 0.3 ? -1 : 1;
      if (sign === 0) me.glance = { turn: 0, pitch: 0, gaze: [side * 2.2, rand(-0.8, 0.8)], until: t + rand(0.7, 1.4) };
      else if (sign === 1) {
        me.glance = dull
          ? { turn: side * rand(4, 10), pitch: -11, gaze: [side * 0.6, -1.6], until: t + rand(1.4, 2.2) }
          : { turn: side * rand(12, 24), pitch: rand(-3, 6), gaze: [side * 1.4, 0.5], until: t + rand(1, 2) };
        if (rand(0, 1) < 0.6) me.blinkAt = t + 0.06; // A turn of the head often takes a blink with it.
      } else if (sign === 2) perkUntil = t + rand(1, 1.8);
      else if (sign === 3) leanTo.splice(0, 3, rand(-3, 3), rand(-6, 6), rand(-1, 1));
      else sighAt = t;
    }
  };

  return (doing, st, t, asleep, quiet, light) => {
    born ??= t;
    const dt = t - was;
    was = t;
    now = t;
    doing0 = doing;
    if (wait && !AIR.includes(doing)) { const w = wait; wait = null; dive(...w); }
    if (go) {
      const s = t - go.at;
      if (s < go.down) me.dy = go.from + (-DEEP - go.from) * ease(Math.max(s, 0) / go.down);
      else {
        if (!go.moved) {
          go.moved = true;
          spot = go.to;
          me.to(go.to);
        }
        const v = Math.min((s - go.down) / UP, 1) - 1;
        me.dy = -DEEP + (go.end + DEEP) * (1 + 2.7 * v ** 3 + 1.7 * v * v);
        // Sent down for the page, he is there once he is across: nothing more to draw.
        if (v >= 0 || go.end <= -DEEP) {
          dip = go.end;
          go = null;
        }
      }
      tall();
    }
    if (dip < 0 && !go && !(now < (me.glance?.until ?? 0))) me.glance = OVER;
    // When a window over the page closes, he is back with his lamp aglow.
    if (parked !== me.el.classList.contains('is-parked')) {
      parked = !parked;
      if (!parked) lampAt = t + 0.2;
    }
    me.lamp = 0.7 * sin(Math.PI * Math.min(1, Math.max(0, t - lampAt) / 0.8)) ** 2;
    const resting = doing === 'idle';
    if (resting) idle(!rested, t, quiet, light, go || dip);
    rested = resting;
    if (doing === 'yawn') stretched = true;
    plain.set(out);
    MOVES[doing]?.(out, st, t, legs);

    calm += ((resting ? 1 : 0) - calm) * (1 - exp(-dt * 5));
    const a = 1 - exp(-dt * 3);
    for (let i = 0; i < 3; i += 1) {
      leanVia[i] += (leanTo[i] - leanVia[i]) * a;
      lean[i] += (leanVia[i] - lean[i]) * a;
    }
    tired += ((late ? 1 : 0) - tired) * (1 - exp(-dt * 1.2));
    const sigh = calm * sin(Math.PI * Math.min(1, (t - sighAt) / 2.4)) ** 2;
    out[BTILT] += lean[0] * calm;
    out[TWIST] += lean[1] * calm;
    out[STAG] += lean[2] * calm;
    out[DROP] += 0.5 * tired * calm - 0.3 * sigh;
    out[BPITCH] += 5 * tired * calm - 2 * sigh;
    out[RAISE] += 5 * sigh - 4 * tired * calm;
    out[RAISE + 1] += 5 * sigh - 4 * tired * calm;

    // Peeking, his mittens hold the bar's edge in front of him.
    hold += (((go ? go.end && t - go.at > go.down : dip) ? 1 : 0) - hold) * (1 - exp(-dt * 10));
    out[SWING] += 92 * hold;
    out[SWING + 1] += 92 * hold;
    out[ELBOW] += 26 * hold;
    out[ELBOW + 1] += 26 * hold;
    out[RAISE] -= 4 * hold;
    out[RAISE + 1] -= 4 * hold;

    dangle += ((doing === 'sit' && !asleep ? 1 : 0) - dangle) * (1 - exp(-dt * 1.5));
    legs[0][1] += dangle * (15 + 7 * sin(t * 0.31)) * sin(t * 3.1);
    legs[1][1] -= dangle * (15 + 7 * sin(t * 0.31)) * sin(t * 3.4 + 0.5);

    // Loaded in the middle of an act, all of this comes in with the finer look instead of at full swing.
    const k = ease((t - born) / 0.5);
    if (k < 1) for (let i = 0; i < out.length; i += 1) out[i] = plain[i] + (out[i] - plain[i]) * k;
    // Anything of his moving, a new state or look, a dive, the lamp, swinging legs: every frame for a while.
    let moved = 0;
    for (let i = 0; i < out.length; i += 1) moved = Math.max(moved, Math.abs(out[i] - before[i]));
    before.set(out);
    if (moved > dt * 6 || doing !== doing1 || me.glance !== glance1 || go || me.lamp > 0.01 || dangle > 0.01 || k < 1 || !['idle', 'sit'].includes(doing)) me.stir();
    doing1 = doing;
    glance1 = me.glance;
    // Sent to sleep, he is drowsy on the way to his seat: nothing else leaves him this long untouched and afoot.
    return late || quiet > 90 ? 'sleepy' : resting && t < perkUntil ? 'grin' : 'smile';
  };
}

// The finer programs for smed3d.js's context and his finer motion from the moment this file is in. His cubes stay
// as they are: the shaders' rounding inputs are left unbound and read as zero. A context that was lost and
// restored asks again; the motion is kept from the first time.
let wrapped = false;
export async function fine(gl, me) {
  me.live ??= life(me);
  if (!wrapped) {
    wrapped = true;
    // Away from Home he peeks where the page would seat him. While he is under the bar's edge, a tab sends him
    // under it to the tab, a tap only ducks him, and nothing else lifts him out: no hop, no seat, no drag.
    const api = me.api;
    const { goTo, hop, play } = api;
    api.goTo = (i) => {
      me.stir();
      if (!me.under()) return goTo.call(api, i);
      const t = me.bar.querySelectorAll('a')[i]?.getBoundingClientRect();
      if (t) me.rise(t.left - me.bar.getBoundingClientRect().left + t.width / 2 - me.el.offsetWidth / 2);
    };
    api.hop = () => me.stir() || me.under() || hop.call(api);
    api.play = (to) => {
      me.stir();
      if ((to === 'sit' || to === 'sleep') && !me.home()) return me.peek();
      if (to === 'roll') return me.under() ? me.duck() : play.call(api, to);
      if (!me.under() || !['hop', 'sit', 'sleep', 'boot'].includes(to)) play.call(api, to);
    };
    for (const [type, f] of [['click', () => me.duck()], ['pointerdown', () => {}]]) {
      me.el.addEventListener(type, (e) => { if (me.under()) { e.stopImmediatePropagation(); f(); } }, true);
    }
    addEventListener('scroll', (e) => me.scrolled(e), { passive: true, capture: true });
    // Any input may move him: drawn every frame for a while. A touched tab or toy draws his eyes at once.
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'scroll']) addEventListener(type, () => me.stir(), { passive: true, capture: true });
    addEventListener('pointerdown', (e) => {
      const a = e.target.closest?.('a');
      if (a && (me.bar.contains(a) || a.classList.contains('app'))) me.look(a);
    }, { passive: true, capture: true });
    // The page asks him down out of sight while the bar is folded for reading (main.js: smed?.duck?.(on)).
    api.duck = (on) => me.sink(on);
    // Loaded after the page had already seated him, he goes to his place behind the bar now.
    if (me.el.classList.contains('is-seated')) me.peek();
  }
  // Until both are linked he goes on in his first-view look.
  const [figure, shadow] = await Promise.all([program(gl, FINE_VS, FINE_FS), program(gl, SHADOW_VS, FINE_SHADOW_FS)]);
  me.stir(1); // The finer look fades in over half a second.
  return { figure, shadow };
}

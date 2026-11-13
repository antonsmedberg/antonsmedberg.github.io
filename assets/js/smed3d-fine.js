// The mascot's finer look and motion, which smed3d.js brings in after the page has loaded: on the same mesh (his
// shape never changes as it lands), finer pixel light (occlusion baked per vertex, a rim off the sky, his
// lantern's glow), the water he sits in (rings, a wake, splashes and the lantern's streak after dark), and
// what each beat does on top of its pose. It wraps his first-view shaders rather than replacing them, so at
// uNew.x = 0 he draws exactly as before and the hand-over is a dither, not a cut.

import { FS, GLOW, KEYS, LIGHT, PARTS, SOLO, VS, pause, program } from './smed3d.js';


// How shut in each vertex is: the whole figure's distance along its normal against what it would be with nothing
// near, at five steps, the nearer counting more. Worked out once, at rest, a few milliseconds at a time.
async function occlusion(mesh) {
  const nets = PARTS.filter((p) => !/^(dot|fish)/.test(p.bone));
  const near = (q) => {
    let d = 9;
    for (const { net } of nets) {
      if (q.some((v, i) => v < net.lo[i] - 1 || v > net.hi[i] + 1)) continue;
      d = Math.min(d, net.d(q));
    }
    return d;
  };
  const out = new Float32Array(mesh.v.length / 8);
  let slice = performance.now();
  for (let i = 0; i < out.length; i += 1) {
    const v = mesh.v.subarray(i * 8, i * 8 + 8);
    const a = PARTS[v[6]].a;
    let occ = 0;
    let w = 1;
    for (let s = 1; s <= 5; s += 1) {
      const t = 0.2 + 0.42 * s;
      occ += (w * Math.max(0, t - near([0, 1, 2].map((k) => v[k] + a[k] + v[3 + k] * t)))) / t;
      w *= 0.5;
    }
    out[i] = Math.min(1, 0.9 * occ);
    if (performance.now() - slice > 6) {
      await pause();
      slice = performance.now();
    }
  }
  return out;
}


const LIGHT_AT = `vec3(uB[${LIGHT}].w,uB[${LIGHT + 1}].w,uB[${LIGHT + 2}].w)`;
const HULL = PARTS.findIndex((p) => p.bone === 'boat') * 3; // The hull's rows.
const GLOW_RGB = `vec3(${GLOW.map((v) => v.toFixed(2))})`;
const BAYER = 'const int B[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);';

const FINE_VS = `${VS.replace('void main(){', 'void base(){')}
layout(location=3) in float aO;
out float vO; flat out vec3 vL;
void main(){
  base();
  vO=aO;
  vL=${LIGHT_AT};
}`;

// The finer pixel light over the first view's ramp and paint: a step down where the baked occlusion shuts him in,
// a step up on the shadow side's rim against the sky, and his lantern's glow, which lifts what faces it a step or
// two. The first look gives way to this one pixel by pixel, by a 4x4 ordered dither.
const FINE_FS = `${FS.replace('void main(){', 'void base(){')}
in float vO; flat in vec3 vL;
${BAYER}
void main(){
  vec4 first=vec4(0.);
  if(uNew.x<1.){ base(); first=o; }
  if(vW.y<0.) discard;
  ivec2 q=ivec2(gl_FragCoord.xy)&3;
  float b=(float(B[q.y*4+q.x])+.5)/16.;
  vec3 n=normalize(vN);
  float w=clamp((dot(n,uSun)+.3)/1.3,0.,1.), glint;
  vec3 col;
  if(uHull>0.) col=edge(w);
  else {
    float light=w*.85+.15*max(n.y,0.)-.45*vO;
    if(dot(n,V)<.38&&w<.45&&n.y>-.2) light+=.3;
    vec3 Lp=vL-vW;
    float r=max(length(Lp),.01), glow=(uNew.y+.5*uNew.w)*1.5*clamp((dot(n,Lp/r)+.6)/1.6,0.,1.)/(1.+r*r*.04);
    col=colour(vM,vP,light,pow(max(dot(n,normalize(uSun+V)),0.),40.),glow,glint);
    col=mix(col,vec3(1.),glint);
  }
  o=b<uNew.x?vec4(col,1.):first;
}`;

const WATER_VS = `#version 300 es
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.-1.,.9,1.); }`;

// The water round him, light and quiet, in flat pixels: rings spreading from the oars, the fish and the hull
// (uS[0..2]: where on the water, age, strength), a short V of wake from the stern while he moves (uS[3].x), and
// after dark a short broken column of warm dashes on the water under his lantern.
const WATER_FS = `#version 300 es
precision highp float;
uniform vec4 uS[4],uView,uNew,uB[${PARTS.length * 3}];
out vec4 o;
void main(){
  float ca=sqrt(1.-uView.w*uView.w), k=uView.x;
  // The water under this pixel, in voxels from his middle: x along the lane, z toward the viewer.
  vec2 g=vec2((gl_FragCoord.x-uView.y)/k,(uView.z-gl_FragCoord.y)/(k*uView.w));
  float a=0.;
  for(int i=0;i<3;i++){ vec4 r=uS[i]; if(r.w>0.) a=max(a,step(abs(length(g+vec2(uS[3].y,0.)-r.xy)-.8-r.z*2.4),.3)*r.w*(1.-r.z/1.6)); }
  vec3 t=vec3(uB[${HULL}].w,uB[${HULL + 1}].w,uB[${HULL + 2}].w), d=vec3(g.x,0.,g.y)-t;
  vec3 f=vec3(uB[${HULL}].x,uB[${HULL + 1}].x,uB[${HULL + 2}].x);
  vec2 h=vec2(dot(f,d),dot(vec3(uB[${HULL}].y,uB[${HULL + 1}].y,uB[${HULL + 2}].y),d));
  float back=-h.x-24.;
  if(back>0.&&back<14.&&abs(abs(h.y)-2.5-back*.45)<.4) a=max(a,uS[3].x*(1.-back/14.));
  a=a>.3?.4:0.;
  vec3 c=mix(vec3(.94,.97,1.),vec3(.5,.6,.82),uNew.y);
  vec3 lw=${LIGHT_AT};
  float lx=lw.x*k+uView.y, ly=-lw.z*uView.w*k+uView.z, dy=ly-gl_FragCoord.y;
  if(uNew.y>.3&&dy>1.&&dy<27.&&mod(floor(dy),5.)<2.&&abs(gl_FragCoord.x-lx-floor(sin(floor(dy/5.)*2.1+uNew.z*3.)+.5))<2.-dy/18.){
    c=${GLOW_RGB}; a=uNew.y>.6&&dy<14.?.7:.45;
  }
  o=vec4(c*a,a);
}`;

/* ------------------------------------------------------------------- Motion */

// What each beat does on top of its pose, kept out of the first view. A beat swells and fades, so nothing starts
// or stops at full swing; the part that drives a move leads it and what hangs from that part trails by a fraction
// of the beat; a shake or a sway loses its force as it goes.
const channel = (name) => (KEYS.includes(name) ? KEYS.indexOf(name) * 2 : KEYS.length * 2 + SOLO.indexOf(name));
const [SWING, RAISE, ELBOW, DROP, BPITCH, BTILT, TWIST, POLE, ROLL] = ['swing', 'raise', 'elbow', 'drop', 'bpitch', 'tilt', 'twist', 'pole', 'roll'].map(channel);
const { sin, cos, exp, max, min, abs, floor } = Math;
const ease = (t) => { const u = min(1, max(0, t)); return u * u * (3 - 2 * u); };
// 1 from a to b seconds, eased in and out over e.
const span = (t, a, b, e = 0.3) => ease((t - a) / e) * ease((b - t) / e);
const pulse = (a) => 0.5 - 0.5 * cos(a);

// Degrees and voxels added to the pose `o`, by beat or state: st is the seconds into it; `ring` sets a ring on the
// water.
const MOVES = {
  // He waves the oar to and fro with both hands, his chest leaning into it; the boat wobbles under him until he
  // sits down.
  wave(o, st, me) {
    const e = span(st, 0.5, 1.95);
    const a = (st - 0.5) * 11;
    for (const i of [0, 1]) o[SWING + i] += 14 * e * sin(a);
    o[BTILT] += 1.6 * e * sin(a - 0.5);
    o[ROLL] += 7 * span(st, 0.7, 2.6, 0.3) * sin((st - 0.7) * 8);
  },
  // Peering past his raised lantern, slowly searching.
  look(o, st) {
    const e = span(st, 0.4, 2.6, 0.4);
    o[TWIST] += 14 * e * sin(st * 1.7);
    o[POLE] += 6 * e * sin(st * 1.7 + 0.6);
    o[BTILT] += 3 * e * sin(st * 1.7 - 0.4);
  },
  // A nod tips the rain off his brim, which drips over the side.
  brim(o, st, me) {
    const e = span(st, 0.3, 1.5, 0.25);
    o[BPITCH] += 10 * e * pulse((st - 0.3) * 5.2);
    if (st > 0.85 && !me.dripped) { me.dripped = true; me.puff(4, [me.x - 3, 18, 1], -6); }
  },
  // A fish leaps out on the near side, over the oar and back in with a splash; he jumps.
  fish(o, st, me, ring) {
    const u = (st - 0.45) / 0.9;
    me.fish = u > 0 && u < 1 ? { at: [-3 - 11 * u, me.near ? -15 : 15, 36 * u * (1 - u) - 1], yaw: 180, pitch: 55 - 110 * u } : null;
    for (const [k, w] of [[0, 0.45], [1, 1.35]]) if (st > w && !me[`fin${k}`]) { me[`fin${k}`] = true; ring(me.blades[1 - me.near], 1); me.puff(5, me.blades[1 - me.near], 14); }
  },
  yawn(o, st) {
    const e = span(st, 0.4, 1.8, 0.5);
    o[DROP] -= 0.3 * e;
    o[BPITCH] -= 3 * e;
  },
  // Shoulders bounce and die down.
  laugh(o, st) {
    const e = span(st, 0, 1.9, 0.2) * exp(-st * 0.9);
    o[DROP] += 0.4 * e * pulse(st * 23);
    o[BPITCH] -= 3 * e * pulse(st * 23);
  },
};

// Still, he is drawn once in REST ms: the swell, a breath and a blink go on, and the page keeps its frames.
const REST = 125;

// His finer motion, for smed3d.js to call once a frame after its springs. It returns the face he rests in.
function life(me) {
  const { out, rand } = me;
  const plain = new Float32Array(out.length);
  const before = new Float32Array(out.length);
  const water = (me.water = new Float32Array(16));
  let next = 0;
  // A ring on the water at p (as the dots have it), of strength k.
  const ring = (p, k) => { water.set([p[0], p[2], 0, k], next * 4); next = (next + 1) % 3; };
  let born = null;
  let was = 0;
  let calm = 0; // 1 while he drifts idle, eased, so what idling adds never cuts in or out.
  let rested = false;
  let actAt = 0;
  let microAt = 0;
  let lapAt = 0;
  let perkUntil = 0;
  let sign = 0;
  let sighAt = -9;
  let beatAt = -9; // When his beat on coming to rest began, and which.
  let beat = 0;
  let last = '';
  let late = false;
  let tired = 0; // 1 late at night, eased: he hangs a little.
  let stretched = false;
  let now = 0;
  let stroke = 0;
  let lampAt = -9;
  let parked = false;
  let stirUntil = 0; // Until when he is drawn every frame.
  let doing1 = '';
  let glance1 = null;
  // What smed3d.js may leave undrawn: all but a frame in REST ms while he is still. Anything that moves him draws
  // him every frame for a while.
  me.nap = (ms) => now >= stirUntil && ms < REST;
  me.stir = (s = 0.6) => { stirUntil = max(stirUntil, now + s); };
  // A look at what was just touched, an app's tile, before anything else happens: head and eyes go to it.
  me.look = (target) => {
    const t = target.getBoundingClientRect();
    const b = me.el.getBoundingClientRect();
    const g = [(t.left + t.width / 2 - b.left - b.width / 2) / 72, (b.bottom - 56 - t.top - t.height / 2) / 72, 1.4];
    const turn = max(-40, min(40, (Math.atan2(g[0], g[2]) * 180) / Math.PI));
    const pitch = max(-16, min(14, (-Math.asin(g[1] / Math.hypot(...g)) * 90) / Math.PI));
    me.glance = { turn, pitch, gaze: [max(-2.6, min(2.6, g[0] * 2.4)), max(-2, min(1, -g[1] * 2))], until: now + 0.9 };
    me.stir(1.2);
  };
  // Where his weight rests: his chest's tilt and twist, each eased twice.
  const lean = [0, 0];
  const leanVia = [0, 0];
  const leanTo = [0, 0];

  // Drifting is mostly rest. Every few seconds one small sign of life: his eyes go somewhere, with or without his
  // head; a thought widens his smile; his weight shifts; he takes a deeper breath. Every ten to eighteen seconds a
  // beat or a row across the lane, never the same beat twice running: a wave, a fish, the lantern raised to look
  // and, while it rains, the rain tipped off his brim. He keeps the scene's hours: late at night (23 to 5) his beat
  // is a yawn, and the first one on a morning visit (5 to 9, once it is light) is a stretch.
  const idle = (fresh, t, light) => {
    const hour = light.hour ?? 12;
    late = hour >= 23 || hour < 5;
    const day = !(light.night > 0.5);
    const stretch = day && !stretched && hour >= 5 && hour < 9;
    if (fresh) {
      beatAt = t + rand(0.1, 0.3);
      beat = (beat + 1 + floor(rand(0, 2))) % 3;
      if (beat === 2) me.blinkAt = beatAt + 0.35;
      actAt = max(actAt, t + (stretch ? rand(2, 4) : rand(6, 10)));
      microAt = max(microAt, t + rand(1.2, 2.4));
    }
    if (t > actAt) {
      actAt = t + rand(10, 18);
      const all = (light.rain || 0) > 0.2 ? ['brim', 'wave', 'row'] : ['wave', 'fish', 'look', 'row', 'row'];
      let pick = late || stretch ? 'yawn' : all[floor(rand(0, all.length))];
      if (pick === last && pick !== 'row') pick = 'row';
      last = pick;
      if (pick === 'row') me.stroll();
      else me.perform(pick);
    } else if (t > microAt) {
      microAt = t + rand(2.4, 6);
      sign = (sign + 1 + floor(rand(0, 4))) % 5; // Never the same sign of life twice running.
      const side = rand(0, 1) < 0.3 ? -1 : 1;
      if (sign === 0) me.glance = { turn: 0, pitch: 0, gaze: [side * 2.2, rand(-0.8, 0.8)], until: t + rand(0.7, 1.4) };
      else if (sign === 1) {
        me.glance = { turn: side * rand(12, 24), pitch: rand(-3, 6), gaze: [side * 1.4, 0.5], until: t + rand(1, 2) };
        if (rand(0, 1) < 0.6) me.blinkAt = t + 0.06; // A turn of the head often takes a blink with it.
      } else if (sign === 2) perkUntil = t + rand(1, 1.8);
      else if (sign === 3) leanTo.splice(0, 2, rand(-3, 3), rand(-6, 6));
      else sighAt = t;
    }
  };

  return (doing, st, t, asleep, quiet, light) => {
    born ??= t;
    const dt = t - was;
    was = t;
    now = t;
    // The rings spread and fade; each stroke's catch rings the water at both blades, and drifting, the hull now
    // and then laps at it.
    for (let i = 3; i < 12; i += 4) if (water[i] > 0 && (water[i - 1] += dt) > 1.6) water[i] = 0;
    if (me.phase < stroke) { ring(me.blades[0], 0.8); ring(me.blades[1], 0.8); }
    stroke = me.phase;
    if (doing === 'drift' && t > lapAt) { lapAt = t + rand(1.6, 2.8); ring(me.hull, 0.6); }
    water[12] = min(abs(me.v) / 40, 1);
    water[13] = me.x;
    // When a window over the page closes, he is back with his lamp aglow.
    if (parked !== me.el.classList.contains('is-parked')) {
      parked = !parked;
      if (!parked) lampAt = t + 0.2;
    }
    me.lamp = 0.7 * sin(Math.PI * min(1, max(0, t - lampAt) / 0.8)) ** 2;
    const resting = doing === 'drift';
    if (resting) idle(!rested, t, light);
    rested = resting;
    if (doing === 'yawn') stretched = true;
    if (doing !== doing1) Object.assign(me, { fish: null, dripped: false, fin0: false, fin1: false });
    plain.set(out);
    MOVES[doing]?.(out, st, me, ring);

    calm += ((resting && !asleep ? 1 : 0) - calm) * (1 - exp(-dt * 5));
    const a = 1 - exp(-dt * 3);
    for (let i = 0; i < 2; i += 1) {
      leanVia[i] += (leanTo[i] - leanVia[i]) * a;
      lean[i] += (leanVia[i] - lean[i]) * a;
    }
    tired += ((late ? 1 : 0) - tired) * (1 - exp(-dt * 1.2));
    const sigh = calm * sin(Math.PI * min(1, (t - sighAt) / 2.4)) ** 2;
    out[BTILT] += lean[0] * calm;
    out[TWIST] += lean[1] * calm;
    out[DROP] += 0.3 * tired * calm - 0.3 * sigh;
    out[BPITCH] += 5 * tired * calm - 2 * sigh;
    out[RAISE] += 5 * sigh;
    out[RAISE + 1] += 5 * sigh;
    // Coming to rest he does one thing at once: a bob and a look up, his lantern raised to see, or a look over his
    // shoulder with a blink. Each moves his head more than a voxel.
    const b = calm * span(t, beatAt, beatAt + 1.2, 0.3);
    if (beat === 0) {
      out[DROP] += 1.3 * b;
      out[BPITCH] -= 8 * b;
    } else if (beat === 1) {
      out[POLE] += 22 * b;
      out[TWIST] += 12 * b;
      out[DROP] += 0.6 * b;
    } else {
      out[TWIST] += 22 * b;
      out[BTILT] -= 7 * b;
      out[DROP] += 0.4 * b;
    }

    // Loaded in the middle of a beat, all of this comes in with the finer look instead of at full swing.
    const k = ease((t - born) / 0.5);
    if (k < 1) for (let i = 0; i < out.length; i += 1) out[i] = plain[i] + (out[i] - plain[i]) * k;
    // Anything of his moving, a new state or look, the lamp, rowing: every frame for a while.
    let moved = 0;
    for (let i = 0; i < out.length; i += 1) moved = max(moved, abs(out[i] - before[i]));
    before.set(out);
    if (moved > dt * 6 || doing !== doing1 || me.glance !== glance1 || me.lamp > 0.01 || k < 1 || doing !== 'drift' || abs(me.v) > 1) me.stir();
    doing1 = doing;
    glance1 = me.glance;
    return late || quiet > 90 ? 'sleepy' : resting && t < perkUntil ? 'grin' : 'smile';
  };
}

// The finer programs for smed3d.js's context and his finer motion from the moment this file is in, with the
// occlusion his vertices are lit by (worked out once). Until it is bound the attribute reads as zero: no occlusion.
// A context that was lost and restored asks again; the motion and the occlusion are kept from the first time.
let wrapped = false;
let occluded = null;
export async function fine(gl, me, mesh) {
  me.live ??= life(me);
  if (!wrapped) {
    wrapped = true;
    // Any input may move him: drawn every frame for a while. A touched app's tile draws his eyes at once.
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'scroll']) addEventListener(type, () => me.stir(), { passive: true, capture: true });
    addEventListener('pointerdown', (e) => { const a = e.target.closest?.('a.app'); if (a) me.look(a); }, { passive: true, capture: true });
  }
  occluded ??= await occlusion(mesh);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, occluded, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 4, 0);
  // Until both are linked he goes on in his first-view look.
  const [figure, shadow] = await Promise.all([program(gl, FINE_VS, FINE_FS), program(gl, WATER_VS, WATER_FS)]);
  me.stir(1); // The finer look is dithered in over half a second.
  return { figure, shadow };
}

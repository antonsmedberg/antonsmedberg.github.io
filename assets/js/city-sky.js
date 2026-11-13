// What the city brings in after the page has loaded: the occasional traffic, and GLSL that city.js compiles beside
// the clear sky it starts with: clouds, rain, snow, lightning, the ripples and glints on the water, the Milky Way
// and the slide of the city's planes; and the timing of lightning. All of it comes in by uIn, so
// the hand-over shows no seam.

import { wings, bridgeAt, BR, hex, norm, WHITE, RED, IRON, K, ZERO, BELOW } from './city.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The occasional traffic: a freighter under the high span about every seven minutes, geese in their seasons and two
// airliners descending toward Kastrup along the bridge. Each comes on its first round after this module arrives,
// from out of view, so nothing appears in place. Like the city's movers, each part is built at rest when `m` is
// given and posed by `part` every frame: the freighter and the airliners where their runs begin, set along them.
let since = null;
export function traffic(part, m, t, skein) {
  if (!m) since ??= t;
  const after = (period, phase) => +((Math.floor(t / period + phase) - phase) * period >= since);
  const { d, n, yaw } = BR;
  const off = 3300 - (((t / 420 + 0.34) % 1) * 6400);
  part(() => {
    const [x, z] = bridgeAt((BR.P0 + BR.P1) / 2, 0);
    const f = [-n[0], -n[1]];
    const sy = Math.atan2(f[1], f[0]);
    const at = (l) => [x + f[0] * l, z + f[1] * l];
    m.box(x, -0.5, z, 124, 2.6, 19, hex('#8a3b32'), { yaw: sy });
    m.box(x, 2.1, z, 126, 5.4, 20, hex('#27344a'), { yaw: sy, roof: hex('#5c626a') });
    ['#c4553f', '#3f73b2', '#d9b24c', '#6f8a5c'].forEach((c, i) => {
      const [bx, bz] = at(44 - i * 26);
      m.box(bx, 7.5, bz, 23, 5 + (i % 2) * 2.6, 16, hex(c), { yaw: sy });
    });
    const [hx, hz] = at(-50);
    m.box(hx, 7.5, hz, 13, 13, 18, WHITE, { yaw: sy, kind: K.train, v: [0, 1] });
    m.box(hx - f[0] * 3, 20.5, hz - f[1] * 3, 5, 5, 6, hex('#c4553f'), { yaw: sy });
    m.light(hx, 26, hz, 1.6, WHITE, 0, 1);
    const [w0x, w0z] = at(-62);
    const [w1x, w1z] = at(-250);
    m.quad([w0x - n[0] * 9, 0.25, w0z + n[1] * 9], [w0x + n[0] * 9, 0.25, w0z - n[1] * 9], [w1x + d[0] * 30, 0.25, w1z + d[1] * 30], [w1x - d[0] * 30, 0.25, w1z - d[1] * 30], hex('#dfe8ee'), K.plain, ZERO, BELOW);
  }, n[0] * off, 0, n[1] * off, 0, 0, 1, 1, after(420, 0.34));
  const u = (t / 80 + 0.3) % 1;
  const dir = norm([-skein, 0, 0.08 * skein]);
  const lead = [skein * (900 - 1800 * u), 96 + 6 * Math.sin(u * 11), -140 + skein * (144 * u - 72)];
  for (let i = 0; i < 9; i += 1) {
    const k = i < 6 ? i : i - 5;
    const side = i < 6 ? 1 : -1;
    wings(part, m, lead[0] - dir[0] * k * 9 + dir[2] * side * k * 6, lead[1] - k * 0.4, lead[2] - dir[2] * k * 9 - dir[0] * side * k * 6, Math.atan2(dir[2], dir[0]), Math.sin(t * 6.5 - i * 0.8) * 0.55 + 0.1, 3.4, IRON, +(skein !== 0) * after(80, 0.3));
  }
  for (const ph of [0.29, 0.79]) {
    const s = ((t / 110 + ph) % 1) * 11000;
    const [ax, az] = bridgeAt(-5250, -480);
    const p = [ax, 950, az];
    const at = (l, w) => [p[0] + d[0] * l + n[0] * w, p[2] + d[1] * l + n[1] * w];
    part(() => {
      m.box(p[0], p[1], p[2], 37, 3.9, 3.9, WHITE, { yaw });
      m.box(p[0], p[1] + 0.6, p[2], 5.5, 0.7, 34, hex('#cfd3d6'), { yaw });
      const [tx, tz] = at(-16, 0);
      m.box(tx, p[1] + 3.6, tz, 4.5, 6, 0.7, hex('#3f73b2'), { yaw });
      m.box(tx, p[1] + 2.6, tz, 3.2, 0.5, 12, hex('#cfd3d6'), { yaw });
      const [lx, lz] = at(0, 17);
      const [rx, rz] = at(0, -17);
      m.light(lx, p[1] + 0.6, lz, 2.4, RED, 0, 1);
      m.light(rx, p[1] + 0.6, rz, 2.4, hex('#48e07a'), 0, 1);
    }, d[0] * s, -0.075 * s, d[1] * s, 0, 0, 1, 1, after(110, ph));
    // The strobe.
    part(() => m.light(p[0], p[1] - 3.4, p[2], 3.2, WHITE, 0.8, 1), d[0] * s, -0.075 * s, d[1] * s, 0, 0, 1, 1, after(110, ph) * +((t * 0.9 + ph * 7) % 1 < 0.12));
  }
}

// How far a plane z metres off slides, 0 to 1: as it would for a camera stepping aside, whole from 150 m in.
const SLIP = 'float slip(float z){ return min(240./(REACH+z),1.); }';

// The city's planes slide by depth when the view leans. The city is kept as drawn; this pass, at the art pixel's
// grain, finds for each pixel what lands on it: the nearest plane whose own slide carries it there, else, where the
// planes that stood there have left, the neighbour that stayed behind. It writes that slide, and beside it the same
// for what the water mirrors, which slides with the thing mirrored, not with the water it lies on. The screen's pass
// then reads the kept city that far back, at its own finer grain, so a plane moves by screen pixels, not art pixels.
// The corner pixel also carries, in blue, how much of the sun's disc the slid city hides, for the glare.
export const SLIDE = `${SLIP}
uniform sampler2D uScene; uniform highp sampler2D uDepth,uDepthR; uniform float uSS;
// The city by its depth, open water by its distance, the sky not at all.
float slide(vec2 p){
  float z=texelFetch(uDepth,clamp(ivec2(p*uSS),ivec2(0),ivec2(uRes*uSS)-1),0).r,b=(p.y/uRes.y*2.-1.-uShift)/uFl;
  return z<1.?slip(lin(z)):b<-.001?slip(-uCam.y/b):0.;
}
float mirrored(vec2 p){ float z=texelFetch(uDepthR,clamp(ivec2(p),ivec2(0),ivec2(uRes)-1),0).r; return z<1.?slip(lin(z)):0.; }
// What lands on art pixel px: its slide, and the slide of what the water there mirrors (below the horizon).
vec2 land(vec2 px,bool low){
  vec2 got=vec2(-1.,low?-1.:0.),back=vec2(-1.);
  float m=max(max(abs(uSway.x),abs(uSway.y)),.001);
  for(float k=ceil(m+.5);k>0.&&min(got.x,got.y)<0.;k--){
    float f=k/m; vec2 p=px-uSway*f;
    if(got.x<0.){ float w=slide(p); if(abs(w-f)*m<=.5) got.x=w; else if(w<f) back.x=f; }
    // The mirror, rippled anyway, is looked for at every other step.
    if(got.y<0.&&mod(k,2.)<1.){ float w=mirrored(p); if(abs(w-f)*m<=1.) got.y=w; else if(w<f) back.y=f; }
  }
  vec2 w=vec2(slide(px),low?mirrored(px):0.);
  for(int i=0;i<2;i++) if(got[i]<0.) got[i]=w[i]*m>.5&&back[i]>0.?back[i]:w[i];
  return got;
}
void main(){
  vec2 px=gl_FragCoord.xy;
  o=vec4(land(px,px.y<(uShift*.5+.5)*uRes.y),0.,1.);
  if(px==vec2(.5)){
    vec2 c=((vec2(dot(uSunDir,uR)*uFl/uAspect,uSunDir.y*uFl)/dot(uSunDir,uF)+vec2(0.,uShift))*.5+.5)*uRes; float r=.0115*uFl*uRes.y*.5;
    for(int i=0;i<16;i++){
      vec2 q=c+(vec2(i&3,i>>2)-1.5)*.5*r; q-=uSway*land(q,false).x;
      o.b+=step(.05,texelFetch(uScene,clamp(ivec2(q*uSS),ivec2(0),ivec2(uRes*uSS)-1),0).a)/16.;
    }
  }
}`;

const FBM = `float cloud=0.; // The share of the sky the clouds cover, 0 to 1.
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ if(float(i)>3.-uQ) break; s+=a*noise(p); p=p*2.03+vec2(11.7,5.3); a*=.5; } return s; }
void cover(){ cloud=clamp((uCover.x*.22+.2)/.7,0.,1.); }`;

// The clouds, drawn into a picture of their own of at most a third of a million pixels. A ray climbs through a
// layer of cloud a few hundred metres to a few kilometres deep, in seven steps (four lower down the ladder). Over
// each point the clouds stand to a height set by noise and the cover, so heaps rise from flat feet, and under
// overcast the layer closes into thicker and thinner parts. Each step is lit by how much cloud stands toward the
// sun and how high in its heap it lies: crowns lit, bellies shaded, the deeper under a tall heap; thin edges
// between the eye and the sun glow; all in the hour's colours, the towns' glow on the feet at night. Rain lowers
// and darkens the layer, a storm raises it into towers that lightning lights from inside. High above, cirrus is
// combed out along the wind in wisps with clear sky between. Far clouds sink into the haze.
export const CLOUDS = `${FBM}
uniform sampler2D uClouds; uniform float uHop,uKeep;
// How high cloud stands over a point, 0 to 1 of its layer. Once the octaves left cannot lift it to y, it stops: the
// point is clear of cloud.
float heap(vec2 q,float x,float g,float y){
  float a=.5,s=0.;
  for(int i=0;i<4;i++){ if(float(i)>3.-uQ||s+2.*a<x+y/g) break; s+=a*noise(q); q=q*2.03+vec2(11.7,5.3); a*=.5; }
  return clamp((s-x)*g,0.,1.);
}
void main(){
  vec2 px=gl_FragCoord.xy*uScale; ppr=uFl*uRes.y*.5;
  vec3 r=ray(px);
  cover();
  o=vec4(0.);
  if(r.y<.003||uIn<=0.) return;
  // A clear day keeps a few wisps of cirrus and nothing lower; a clear night keeps its stars.
  float clear=smoothstep(.1,0.,cloud+uWx.x)*(1.-uNight);
  if(cloud+uWx.x<.02&&clear<=0.) return;
  float x=.78-.42*cloud-.3*uWx.x,B=mix(1500.,500.,max(uWx.x*.6,uWx.y)),D=mix(400.,1100.,cloud)+uWind.w*4000.,g=4.-2.6*uWx.x;
  // Each pixel starts its march a quarter step on from its neighbours in a two-by-two block, and the soft read takes
  // the four alike; each frame moves every start on by uHop, a sixteenth of a step at a time, and the picture keeps
  // the frames before. At rest each pixel has then marched as finely as sixteen marches, with no grain and no slices.
  ivec2 at=ivec2(gl_FragCoord.xy)&1;
  float t0=(B-uCam.y)/r.y,t1=min((B+D-uCam.y)/r.y,t0+15000.),n=cloud+uWx.x<.02?0.:7.-3.*uQ,dt=(t1-t0)/max(n,1.),T=1.,j=fract(float((at.x*2+at.y*3)&3)*.25+uHop);
  vec2 ts=normalize(uSunDir.xz+1e-4)*(1.2-uSunDir.y),p0=r.xz/max(r.y,.02)*.6+uSeed;
  // The dark key has no white of its own to add.
  vec3 lit=mix(uCloud[0],vec3(1.),.15*uDay)+uSunCol*.25*(1.-uWind.w),shade=mix(uCloud[1],uSky[1],.25)*(1.-.12*uWx.y)*(1.-.45*uWind.w*smoothstep(.3,.7,noise(p0))),acc=vec3(0.);
  float fa=(fract(uFlash.y)-.5)*1.2-atan(r.x,-r.z)+atan(uF.x,-uF.z),glow=uFlash.x*(exp(-abs(fa)*3.)*.9+.1),toSun=hg(dot(r,uSunDir),.72),toMoon=hg(dot(r,uMoonDir),.6);
  for(float i=0.;i<8.;i++){
    if(i>=n||T<.05) break;
    vec3 p=uCam+r*(t0+(i+j)*dt);
    float y=(p.y-B)/D;
    vec2 q=(p.xz-uDrift*1.5)*.0005+uSeed;
    // Thick cloud hangs lower, so under overcast the deck shows its rolls from below.
    float h=heap(q,x,g,y),b=(1.-h)*.35*uWx.x,d=smoothstep(h,h-.15,y);
    if(y<b+.14) d*=smoothstep(b,b+.1,y+.04*noise(q*12.));
    if(d<.01) continue;
    float up=clamp((y-b)/max(h-b,.01),0.,1.),l=exp(-max(heap(q+ts*.25,x,g,-9.)-y,0.)*2.5)*mix(.2,1.,up);
    vec3 L=mix(shade*(1.-.3*h*(1.-up)),lit,l)+(uSunCol*toSun*.14+uMoonCol*toMoon*.07)*(1.-d)*l;
    L+=vec3(.95,.58,.3)*uNight*.14*(1.-y)*exp(-r.y*10.)+vec3(.75,.8,1.)*glow*(1.-y*.5)*(.6+.4*d);
    float a=1.-exp(-d*dt*.004);
    acc+=T*a*L; T*=1.-a;
  }
  // Cirrus: wisps first, then inside them fibres along the wind, curling a little; fading toward an overcast. On a
  // clear day fewer and fainter, and only low over the sea, where perspective lays them flat and they frame the town;
  // the open sky above stays a clean gradient.
  vec2 w=normalize(uWind.xy+vec2(.6,.2)),hq=(uCam.xz+r.xz/r.y*8000.-uDrift*2.4)*.00011+uSeed.yx;
  float hi=smoothstep(.48+.12*clear,.72+.08*clear,noise(hq*.85+3.))*(.44-.26*uWx.x)*smoothstep(.02,.14,r.y)*max(smoothstep(0.,.25,cloud),clear*.6*smoothstep(.22,.1,r.y));
  if(hi>0.){
    vec2 hf=vec2(dot(hq,w)*.28,dot(hq,vec2(-w.y,w.x))*1.5)+.55*vec2(noise(hq*1.4),noise(hq*1.4+7.));
    hi*=smoothstep(.52,.82,fbm(hf)*.75+noise(hf*vec2(3.,9.))*.3);
    acc+=T*hi*(lit+uSunCol*((.2+.5*clear)*uLow+.1*toSun)); T*=1.-hi;
  }
  float al=1.-T;
  vec3 col=mix(acc/max(al,1e-4),uSky[3],smoothstep(.16,0.,r.y)*.55);
  o=mix(texelFetch(uClouds,ivec2(gl_FragCoord.xy),0),vec4(col,1.)*al*smoothstep(.003,.025,r.y)*uIn,uKeep);
}`;

// What the picture at the screen's grain takes from the clouds' picture, and the weather drawn over all.
export const WX = `${FBM}
${SLIP}
// Stars by magnitude, some coloured, twinkling more low down, lost in the towns' glow; they come in with the module.
vec3 stars(vec3 r){
  vec2 sp=vec2(atan(r.x,-r.z),asin(r.y))*190.,id=floor(sp); float h=hash(id);
  if(h<.93) return vec3(0.);
  float m=fract(h*13.7); m*=m*m;
  vec2 f=(fract(sp)-.5-(vec2(fract(h*71.),fract(h*37.))-.5)*.5)*ppr/190./uDot;
  float tw=1.+(.15+.6*exp(-r.y*9.))*sin(uT*(2.+fract(h*91.)*5.)+h*600.)*sin(uT*1.3+h*90.);
  vec3 k=fract(h*29.)<.7?vec3(1.):mix(vec3(.72,.82,1.),vec3(1.,.78,.55),fract(h*53.));
  return k*(.14+1.2*m)*tw*exp(-dot(f,f)*(2.2-1.2*m))*uStar*uIn*smoothstep(.01,.14,r.y);
}
uniform sampler2D uClouds,uSlide; uniform highp sampler2D uDepth; uniform float uSS;
// Where a pixel reads the kept city: back along the slide of what landed on its art pixel, at the screen's grain,
// and for the water's mirror along the slide of the thing mirrored. Read that fine, a pixel beside something
// nearer in the kept city would show a sliver of it; there the art pixel's own source stands in. By night the
// lamps' columns on open water come with the mirror.
void at(inout vec2 p,out vec4 c,out vec4 r){
  ivec2 e=ivec2(uRes/uHd)-1,a=clamp(ivec2(floor(p/uHd)),ivec2(0),e),q; vec2 s=uSway/uHd,p0=p;
  vec4 t=texelFetch(uSlide,a,0); float m=max(max(abs(s.x),abs(s.y)),.001);
  p-=uSway*t.r; q=clamp(ivec2(p/uHd),ivec2(0),e); c=texelFetch(uCity,q,0);
  vec2 own=vec2(a)+.5-s*round(m*t.r)/m;
  if(c.a>0.&&q!=ivec2(own)&&slip(lin(texelFetch(uDepth,q*int(uSS),0).r))>t.r+.03){ p=own*uHd; q=clamp(ivec2(own),ivec2(0),e); c=texelFetch(uCity,q,0); }
  r=vec4(0.);
  if(p0.y<(uShift*.5+.5)*uRes.y){
    // The mirror trembles side to side in bending bands that drift, so the lamps' columns shimmer; two sines, not
    // noise, as it runs on every pixel of water. It is read between pixels, so it bends rather than tears; by day it
    // trembles less and takes half the pixel below, as a sunlit town's reflection is soft and drawn out. Toward the
    // horizon the water lies flat to the eye and the far shore's mirror stands still, or masts in it would squirm.
    vec2 g=p0/uHd,w=p0-uSway*t.g+vec2(sin(g.y*.8+uT*1.6+3.*sin(g.x*.06+g.y*.11+uT*.2))*uHd*(.5+.2*uDay)*uIn*smoothstep(.02,.1,(uShift*.5+.5)-p0.y/uRes.y),-.5*uDay*uHd);
    q=clamp(ivec2(w/uHd),ivec2(0),e); r=texture(uWater,w/uRes);
    if(uNight>.05&&c.a<=0.){ vec4 l=texelFetch(uCity,q,0); c.rgb=l.a>0.?vec3(0.):l.rgb; }
    // Where words stand on the water under light ink, the town's mirrored light and the columns under its windows
    // fall to the dark key, as they would farther from the quay, but for glints a pixel or two tall. The fall takes
    // the zone's first 48 CSS pixels, where the page has its icons, so the mirror keeps its place under the quay.
    // Under dark ink the mirror thins by three quarters into the sky the sea shows, within the first 24.
    float far=smoothstep(0.,48.*uDot,uLine.y-p0.y)*uIn;
    if(far>0.&&uSide.y<1.){
      float dim=1.-.9*far*(1.-uSide.y)*smoothstep(.82,.76,noise(vec2(p0.x*.03,p0.y*.7)/uDot+uT*vec2(.2,.5)));
      r.rgb*=dim; if(c.a<=0.) c.rgb*=dim;
    }
    r*=1.-.75*smoothstep(0.,24.*uDot,uLine.y-p0.y)*uIn*uSide.y;
  }
}
// Where a direction lands on the screen, 0 to 1; above the top the clouds' picture holds nothing.
vec3 uvOf(vec3 d){ vec2 u=(vec2(dot(d,uR)*uFl/uAspect,d.y*uFl)/max(dot(d,uF),.05)+vec2(0.,uShift))*.5+.5; return vec3(clamp(u,0.,1.),smoothstep(1.12,.98,u.y)); }
// The Milky Way: a knotted band split by a dark dust lane, and airglow low over the horizon, both lost to
// twilight, cloud and the towns.
vec3 galaxy(vec3 r,vec3 c){
  float b=dot(r,normalize(vec3(.8,-.35,.1))),a=atan(r.y,r.x+r.z);
  float lane=1.-.4*exp(-pow((b-.015+.02*noise(vec2(a*6.,1.)))*45.,2.))*smoothstep(.3,.6,noise(vec2(a*5.,b*30.)));
  float m=exp(-b*b*30.)*(.5+fbm(vec2(a*9.,b*24.)+3.))*(1.-.3*smoothstep(.55,.8,noise(vec2(a*14.,b*40.))))*lane;
  return c+(vec3(.6,.66,.85)*m*.1*smoothstep(.02,.2,r.y)+vec3(.05,.09,.06)*.3*exp(-abs(r.y-.1)*14.))*uStar*uIn;
}
// Read softly, four taps half a texel out: each takes a two-by-two block of the march's starts in equal parts.
vec3 clouds(vec3 r,vec3 c,float full){
  cover();
  // By day the Milky Way is nothing; its noise would cost the whole sky.
  if(full>0.&&uStar>0.) c=galaxy(r,c);
  vec3 u=uvOf(r); vec2 d=.5/vec2(textureSize(uClouds,0));
  vec4 k=(texture(uClouds,u.xy+d)+texture(uClouds,u.xy-d)+texture(uClouds,u.xy+vec2(d.x,-d.y))+texture(uClouds,u.xy-vec2(d.x,-d.y)))*.25*u.z;
  // Where the page's words stand on a bright picture a belly is no darker than the palette's own with a third of
  // the crown's light, as the sea that mirrors it needs; clear of them it keeps its depth, and the heap its form.
  float l=dot(k.rgb,LUM),f=dot(mix(uCloud[1],uCloud[0],.33),LUM)*k.a;
  if(l<f) k.rgb*=mix(1.,f/max(l,1e-3),max(zw.x,zw.y)*uSide.x);
  c=c*(1.-k.a)+k.rgb;
  // A storm's deck: a darker shelf rolling low over the horizon with a pale lip, rain curtains hanging from it.
  if(uWind.w>0.){
    float az=atan(r.x,-r.z),e=r.y+.03*noise(vec2(az*6.,1.)),cur=smoothstep(.5,.8,noise(vec2(az*30.,uT*.03)))*smoothstep(.12,.02,r.y);
    c=mix(c,c*.5,smoothstep(.17,.1,e)*smoothstep(0.,.03,r.y)*uWind.w)+uCloud[0]*.25*exp(-pow((e-.175)*70.,2.))*uWind.w;
    c=mix(c,c*.6+uSky[3]*.15,cur*uWind.w*.7);
  }
  return c;
}
float veil(vec3 d){ return 1.-texture(uClouds,uvOf(d).xy).a; }
// Value noise with its slope, for the water's facets.
vec3 noised(vec2 p){ vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
  float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
  return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y,du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx)); }
// Ripples that follow the wind, longer and faster downwind, still in a calm: the facet's normal, and in w how much the
// ripples too small to see widen the light's path. By day they are short and low: the bright sky they mirror would
// show a long, steep swell as bands, while fine ones break it into a calm texture that perspective stretches
// sideways, and the sun's path into glitter. An octave too small to see is not worked out, only its width added.
vec4 facet(vec3 p,float fp,float A){
  // Under a broken sky the ripples lie lower still: tipping between bright cloud and blue they would marble.
  cover();
  vec2 d=uWind.xy/max(length(uWind.xy),.3),q=vec2(dot(p.xz,d),dot(p.xz,vec2(-d.y,d.x))),s=vec2(0.);
  float v=.0003,L=10.-6.*uDay,k=(.45-.2*uDay)*(1.-.45*uDay*cloud);
  for(int i=0;i<3;i++){
    float f=smoothstep(L*.6,L*.15,fp);
    if(f>0.) s+=noised(q/L*vec2(1.,.45)+vec2(-uT*1.6/sqrt(L),float(i)*3.7)).yz*vec2(1.,.45)*A*k*f;
    v+=A*A*k*k*(1.-f)*.35;
    L*=.38; k*=.85+.4*uDay;
  }
  s=(s.x*d+s.y*vec2(-d.y,d.x))*uIn;
  return vec4(normalize(vec3(-s.x,1.,-s.y)),v);
}
// The sun or moon on facets that tip toward it, broken into dashes by the ripples.
vec3 glints(vec3 r,vec4 f,vec3 p,float fp,float fr){
  vec3 h=normalize(uGlitDir-r); float ch=max(dot(h,f.xyz),.05),a2=3.*f.w+.002;
  return uGlitCol*min(exp(-(1.-ch*ch)/(ch*ch*a2))/(a2*ch*ch*ch*ch)*fr*.006/max(dot(f.xyz,-r),.05),2.)*smoothstep(.35,.9,noise(p.xz*vec2(.9,2.6)/(1.+fp*3.)+uT*vec2(.7,-.4)))*uIn;
}
// Rain rings on the near water, more and faster the harder it rains: each drop throws up a fleck, then its ring
// spreads, a lit crest round a shadowed trough, fading as it goes; softer under the night's dark key.
vec3 rings(vec3 c,vec3 p,float t){
  if(uWx.y<=0.||t>200.||uIn<=0.) return c;
  vec2 g=p.xz*.9,id=floor(g); float h=hash(id),k=fract(uT*1.4+h*9.);
  vec2 o=fract(g)-.25-.5*vec2(fract(h*31.),fract(h*67.));
  float w=.05+t*.002,d=length(o)-k*.25,a=(1.-k)*(1.-k)*uIn*step(h,uWx.y*.8)*smoothstep(140.,30.,t)*(.5+.5*uDay);
  c*=1.-.25*a*smoothstep(w,0.,d+w);
  return mix(c,mix(uSky[3],vec3(1.),.5),a*(.6*smoothstep(w,0.,abs(d))+.8*smoothstep(.06,0.,length(o))*step(k,.15)));
}
// Rain in three depths, falling about seven metres a second and slanting with the wind across the view; snow
// in four, falling a metre or two a second, fluttering and drifting, the near flakes large and soft. Both catch
// the lamps at night. Lightning flickers in the sky, now and then with a bolt to the horizon; a low sun sends
// shafts through the gaps in broken cloud. Under reduced motion, rain and snow hold still.
vec3 weather(vec3 c,vec2 px,vec3 r,float cv,inout float valid){
  if(uIn<=0.) return c;
  cover();
  float t=uT,ln=clamp(dot(uWind.xy,uR.xz)/7.,-.9,.9),lamp=0.;
  // By night what stands dark near a lamp or a lit window takes a little of its light: walls, trunks, the quay's face.
  if(uGlowAmt>0.){ vec3 g=texture(uGlow,(px-uKept)/uRes).rgb*uGlowAmt; lamp=dot(g,vec3(.33)); c+=c*g*vec3(1.6,1.1,.6)*cv*uIn*smoothstep(.3,.04,dot(c,LUM)); }
  vec3 air=mix(uSky[3],uCloud[0],.5)+lamp*4.;
  if(uWx.y>0.&&uStat==0.){
    for(int i=0;i<3;i++){
      float fi=float(i),s=(1.-.3*fi)*uDot,cw=6.*s,u=(px.x+ln*px.y)/cw,id=floor(u)+fi*97.;
      float v=(px.y+t*7.*ppr/(4.+6.*fi*fi)+hash(vec2(id,fi))*999.)/(ppr*.06*s),L=.18-.04*fi;
      float a=smoothstep(.5,.0,abs(fract(u)-.5)*cw/(1.+s*.4))*step(fract(v),L)*step(hash(vec2(id,floor(v))),uWx.y*(.5+.25*fi));
      // A shower reads by its near streaks, so they come in strong at once; heavier rain adds more, not darker.
      a*=fract(v)/L*(.45-.1*fi)*(1.4+.5*uNight)*sqrt(uWx.y)*uIn;
      if(a>0.){ c=mix(c,dot(c,LUM)>.4?c*.72:max(c*1.2+.1,air),a); valid=0.; }
    }
  }
  if(uWx.z>0.&&uStat==0.){
    for(int i=0;i<4;i++){
      float fi=float(i),s=(1.4-.3*fi)*uDot,cs=40.*s;
      vec2 q=px+vec2(-dot(uDrift,uR.xz)*ppr*.004/(1.+fi)-t*ln*20.*s,t*ppr*(.05-.009*fi)),id=floor(q/cs);
      // A flake fades in as the snow thickens past it, so a shower comes and goes by density.
      float h=hash(id+fi*13.),on=uWx.z*(.55+.12*fi)-h;
      if(on<0.) continue;
      vec2 e=q-id*cs-vec2(.2+.6*fract(h*71.),.2+.6*fract(h*37.))*cs;
      float rad=(1.2+2.2*fract(h*19.))*s*(1.3-.25*fi);
      // Only beside its flake does a pixel work out the flutter.
      if(abs(e.x)>rad+.12*cs||abs(e.y)>rad) continue;
      float d=length(e-vec2(sin(t*(.8+h)+h*40.)*.12*cs,0.));
      float a=smoothstep(rad,rad*(.3+.15*fi),d)*(.85-.15*fi)*uIn*min(on*25.,1.);
      if(a>0.){ c=mix(c,max(c,mix(uCloud[0],vec3(1.),.5))+lamp*3.,a); valid=0.; }
    }
  }
  if(uWind.w>.02&&uFlash.x>.01&&uStat==0.){
    // The flash lights the air and the water; in most groups a thin bolt forks from the cloud's foot to the
    // horizon, and the water mirrors it.
    c+=vec3(.6,.66,.9)*uFlash.x*.07*(1.-cv*.5);
    if(fract(uFlash.y*7.)<.6){
      float y=px.y/uRes.y*2.-1.,ym=y<uShift?2.*uShift-y:y,t=(ym-uShift)/(1.-uShift);
      float j=(fbm(vec2(ym*5.,uFlash.y*9.))-.5)*.3+(noise(vec2(ym*40.,uFlash.y))-.5)*.04,bx=px.x/uRes.x*2.-1.-fract(uFlash.y)*1.6+.8-j;
      float d=min(abs(bx),abs(bx+(.55-t)*.35*sign(fract(uFlash.y*3.)-.5))+step(.55,t)+step(t,.2))*uRes.x*.5/uDot;
      c=mix(c,vec3(.92,.94,1.),min(1.,(smoothstep(1.4,.2,d)+exp(-d*.25)*.25)*uFlash.x*(y<uShift?.45:1.)*(1.-cv)*smoothstep(.85,.7,t)));
      if(d<3.) valid=0.;
    }
  }
  if(uLow>0.&&cloud>.15&&cloud<.85&&uWx.x<.6){
    float th=atan(px.y-(uSunDir.y/dot(uSunDir,uF)*uFl+uShift+1.)*.5*uRes.y,px.x-(dot(uSunDir,uR)*uFl/uAspect/dot(uSunDir,uF)+1.)*.5*uRes.x);
    float sh=noise(vec2(th*9.,uSeed.x+uT*.01))*noise(vec2(th*23.,uSeed.y-uT*.015));
    c=mix(c,max(c,uSunCol),sh*sh*uLow*uLow*.12*(1.-cv*.6)*uIn*smoothstep(-.1,.3,r.y+.1)*smoothstep(.8,.1,length(r-uSunDir)));
  }
  return c;
}
#define SKY
// Sun and moon as through a long lens. They grow from the first program's small discs over the hand-over.
float rS(){ return mix(.0085,.0115,uIn); }
// At least 13 CSS px in radius, so small phones still show its face.
float rM(){ return max(mix(.0095,.017,uIn),13.*uIn*uDot/ppr); }
vec2 disc(vec3 r,vec3 d,float s,float flat_){ vec3 x=normalize(cross(d,vec3(0,1,0))); return vec2(dot(r-d,x),dot(r-d,cross(x,d))/flat_)/s; }
vec3 sel(float lo,float la){ lo=radians(lo); la=radians(la); return vec3(cos(la)*sin(lo),sin(la),cos(la)*cos(lo)); }
// A mare: a dark, soft-edged patch at its longitude and latitude, radius in degrees, its shore broken by noise.
float mare(vec3 n,float lo,float la,float rr){ return smoothstep(cos(radians(rr)),cos(radians(rr*.75)),dot(n,sel(lo,la))+.01*(noise(n.xy*9.+lo)-.5)); }
// A young crater: a bright spot and, for some, rays thrown far across the face.
float crater(vec3 n,float lo,float la,float k,float ray){
  vec3 m=sel(lo,la),t=normalize(cross(m,vec3(0,1,0))); float d=acos(clamp(dot(n,m),-1.,1.)),a=atan(dot(n,cross(t,m)),dot(n,t));
  return k*exp(-d*d*2500.)+ray*exp(-d*2.5)*smoothstep(.6,.95,noise(vec2(a*7.,lo)))*smoothstep(.02,.05,d)*.22;
}
// The near side: the maria in their places (longitude, latitude, radius in degrees, darkness): Imbrium,
// Serenitatis, Tranquillitatis, Crisium, Fecunditatis, Nectaris, Nubium, Humorum, Procellarum and its arms,
// Insularum, Cognitum, Vaporum, Frigoris, Smythii; highlands with a fine texture; Tycho, Copernicus, Kepler and
// Aristarchus with their rays.
const vec4 MARIA[17]=vec4[](vec4(-16,33,19,1),vec4(17,27,12,1),vec4(30,8,14,1),vec4(59,17,9,1),vec4(51,-6,11,1),
  vec4(34,-15,6.5,1),vec4(-15,-20,12,1),vec4(-39,-24,7,1),vec4(-60,20,22,.85),vec4(-50,0,17,.85),vec4(-30,8,9,.85),
  vec4(-22,-10,7,.85),vec4(4,14,5,.9),vec4(-28,56,8,.75),vec4(-2,58,8,.75),vec4(24,57,7,.75),vec4(-80,-18,6,.7));
float albedo(vec3 n){
  float d=0.;
  for(int i=0;i<17;i++) d=max(d,mare(n,MARIA[i].x,MARIA[i].y,MARIA[i].z)*MARIA[i].w);
  float b=.62-.36*d*(.9+.2*noise(n.xy*5.))+.05*(noise(n.xy*23.)-.5)+.03*(noise(n.xy*61.)-.5);
  return b+crater(n,-11.,-43.,.5,1.)+crater(n,-20.,10.,.35,.6)+crater(n,-38.,8.,.25,.35)+crater(n,-47.,24.,.55,.15);
}
// The moon in its phase: relief along a soft terminator, the lit limb toward the sun, earthshine, a corona in thin
// cloud, warmer and a little flattened low down.
vec3 moon(vec3 r,vec3 c,inout float valid){
  float s=rM();
  if(uMoonUp<=0.||dot(r,uMoonDir)<.99) return c;
  vec2 q=disc(r,uMoonDir,s,1.-.12*exp(-uMoonDir.y*30.)); float l=length(q),aa=uDot/(ppr*s);
  if(l<3.5) valid=0.;
  float t=1.-veil(uMoonDir),thin=t*(1.-t)*4.;
  c+=uMoonCol*(exp(-l*1.1)*.3+exp(-l*.25)*.08+thin*exp(-abs(l-2.6)*1.5)*.25)*(1.-c);
  if(l>1.+aa) return c;
  vec3 n=vec3(q,sqrt(max(1.-l*l,0.)));
  vec3 g=vec3(noise(q*10.)-noise(q*10.+vec2(.07,0.)),noise(q*10.)-noise(q*10.+vec2(0.,.07)),0.)*1.2;
  float i=dot(normalize(n+g*smoothstep(.35,0.,abs(dot(n,uMoonL)))),uMoonL);
  float a=albedo(n),lit=smoothstep(-.02,.12,i)*(.55+.45*smoothstep(0.,.6,i));
  vec3 day=mix(vec3(1.,.82,.62),vec3(1.,.96,.88),uMoonUp)*a*lit*(.86+.14*n.z)*1.15;
  vec3 face=sky(r)+uMoonCol*.04+vec3(.05,.06,.08)*a*(1.-uMoonL.z)*.6+min(day,1.);
  return mix(c,face,smoothstep(1.+aa,1.-aa,l)*uMoonUp*smoothstep(0.,.04,uMoonDir.y));
}
// The sun: a blinding disc with a soft limb, reddening through yellow and orange low down, where haze lies across
// its lower limb in soft bands.
vec3 sun(vec3 r,vec3 c,inout float valid){
  float s=rS();
  if(uSunUp<=0.||dot(r,uSunDir)<.995) return c;
  vec2 q=disc(r,uSunDir,s,1.-.2*exp(-uSunDir.y*30.)); float l=length(q),aa=uDot/(ppr*s),mu=sqrt(max(1.-l*l,0.));
  if(l<4.) valid=0.;
  float low=exp(-uSunDir.y*45.),band=1.-low*smoothstep(.3,-1.,q.y)*(.35+.25*sin(q.y*11.+3.));
  vec3 k=uDisc*mix(vec3(1.,.5,.2),vec3(1),smoothstep(-.01,.12,uSunDir.y))*(1.-.4*(1.-mu)*vec3(.7,1.,1.5))*band*(1.+.8*smoothstep(.06,.3,uSunDir.y));
  k*=max(1.,(dot(c,LUM)+.3)/max(dot(k,LUM),.01));
  return mix(c,min(k,1.),smoothstep(1.+aa,1.-aa,l)*uSunUp);
}
// The aureole from the share of the sun the slid city leaves clear: the core burns its nearest sky to white,
// falling off through warm white and pale gold; a low sun's bloom spreads wide along the horizon; thin cloud
// across it glows and lets soft shafts through.
vec3 glare(vec3 r){
  float s=rS(),a=length(r-uSunDir)/s;
  if(uSunUp<=0.||a>90.) return vec3(0.);
  float v=texelFetch(uSlide,ivec2(0),0).b,t=1.-veil(uSunDir),low=exp(-uSunDir.y*18.);
  vec3 d=r-uSunDir; float w=length(vec2(length(d.xz)*(1.-.75*low),d.y))/s;
  vec3 warm=mix(mix(vec3(1.,.93,.78),vec3(1.,.82,.55),smoothstep(2.,9.,a)),mix(vec3(1.,.7,.38),vec3(1.,.45,.2),smoothstep(3.,20.,w)),uLow);
  float core=exp(-max(a-1.,0.)*.7)*1.1,halo=exp(-w*.12)*(.12+.5*uLow)+exp(-w*.04)*(.05+.3*uLow);
  float shaft=t*(1.-t)*4.*exp(-a*.04)*smoothstep(.45,.8,noise(vec2(atan(d.y,dot(d,uR))*9.,uT*.02)))*.35;
  return mix(vec3(1.),warm,smoothstep(1.2,3.5,a))*(1.-v)*(core+halo*(1.+t*(1.-t)*3.)+shaft)*uSunUp*(1.-t*.8);
}
`;

// The picture's light under the words is judged where it is drawn, so nothing is read back. From the small measuring
// copy (red the root of the light, green whether it counts) into a column one pixel wide, a row for each of the
// copy's. First each row's needs per zone from its extremes: the exposure that brings its lightest to 0.1 and the
// lift that brings its darkest to 0.34, top zone then foot, kept as what is taken away so that a fresh column asks
// for nothing. Then those spread to neighbours and eased: beyond its zone a row takes the nearest zone row's need;
// the most of 25 rows, then their mean; tightening fast, letting go slowly, by a level at least so that it arrives.
export const JUDGE = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex,uPrev; uniform vec2 uLine,uK;
void main(){
  ivec2 n=textureSize(uTex,0); int j=int(gl_FragCoord.y); float h=float(n.y);
  if(uK.x<0.){
    float a=1.,b=0.;
    for(int i=0;i<n.x;i++){ vec2 s=texelFetch(uTex,ivec2(i,j),0).rg; if(s.g>.5){ a=min(a,s.r*s.r); b=max(b,s.r*s.r); } }
    vec2 q=1.-vec2(sqrt(min(1.,.1/max(b,1e-4))),1.-clamp((.34/max(a,1e-3)-1.)/.35,0.,1.)),y=(float(j)+.5)/h-uLine;
    o=a>b?vec4(0.):vec4(y.x>0.?q:vec2(0.),y.y<0.?q:vec2(0.));
    return;
  }
  ivec2 lo=ivec2(min(int(floor(uLine.x*h+.5)),n.y-1),0),hi=ivec2(n.y-1,max(int(ceil(uLine.y*h-.5))-1,0));
  vec4 to=vec4(0.);
  for(int e=0;e<25;e++){
    vec4 m=vec4(0.);
    for(int d=0;d<25;d++) m=max(m,vec4(texelFetch(uTex,ivec2(0,clamp(j+e-d,lo.x,hi.x)),0).xy,texelFetch(uTex,ivec2(0,clamp(j+e-d,lo.y,hi.y)),0).zw));
    to+=m/25.;
  }
  vec4 p=texelFetch(uPrev,ivec2(0,j),0),d=to-p;
  o=p+sign(d)*max(abs(d)*mix(vec4(uK.y),vec4(uK.x),greaterThan(d,vec4(0.))),min(abs(d),vec4(.004)));
}`;

// The clouds' picture keeps up to `most` frames (none: start again) while the sky's camera stands at `at`; each is
// marched from a start a sixteenth of a step on (CLOUDS) and drawn by `draw(hop, keep)`, keeping 1 - keep of the
// last. While the weather or the light turns the city keeps a few, so the clouds turn with it and stay soft.
// Reduced motion draws its sixteen at once.
let kept = 0;
let hops = 0;
let seen = -1;
let skip = false;
export function clouds(draw, at, most, calm) {
  const moving = at !== seen && !calm;
  if (!most || calm || moving) kept = hops = 0;
  seen = at;
  // Once a standing sky's sixteen are in, or while the camera moves, every other frame is marched: standing, its
  // clouds drift a pixel in seconds, and moving, a frame late is not seen.
  if ((kept >= 16 || moving) && (skip = !skip)) return;
  for (let i = calm ? 16 : 1; i > 0; i -= 1) {
    kept = Math.min(kept + 1, calm || !most ? 16 : most);
    hops += 1;
    draw(((hops * 7) % 16) / 16, 1 / kept);
  }
}

// Weather and the hour asked come in on a critically damped spring: some 3.5 s to settle, smooth at both ends, and a
// change of mind on the way keeps its speed. Weather in the sky's order: rain, snow and thunder wait for cloud, which
// stays till they have nearly stopped. Steps `wx` toward `to` and returns how far is left.
const wv = new Float32Array(8);
export function ease(wx, to, dt, calm) {
  const t = clamp(((to[0] > 0.02 ? wx[0] / to[0] : 1) - 0.6) / 0.35, 0, 1);
  const come = t * t * (3 - 2 * t);
  let left = 0;
  for (let i = 0; i < 8; i += 1) {
    const g = i === 1 || i === 2 || i === 6 ? to[i] * come : i ? to[i] : wx[1] + wx[2] > 0.5 ? Math.max(to[0], wx[0]) : to[0];
    const d = g - wx[i];
    left += Math.abs(d);
    // The last thousandths would only keep the town relighting with nothing to see.
    if (calm || (Math.abs(d) < 2e-3 && Math.abs(wv[i]) < 2e-2)) {
      wx[i] = g;
      wv[i] = 0;
    } else {
      wv[i] += (d * 2 - wv[i] * 2.83) * dt;
      wx[i] += wv[i] * dt;
    }
  }
  return left;
}

// The hour drawn, from `at` toward `goal` the short way round the clock; once there, null if the clock's own hour
// takes over (`home`). Near sunrise and sunset (`sun`) the light turns fastest, so there the hour goes slowest: at
// most 0.8 hours a second within half an hour of either, 3.8 from two and a half hours off. Two minutes or less
// land at once: a clock's step is no change to watch.
let hv = 0;
export function hour(at, goal, home, dt, calm, sun) {
  const d = ((goal - at + 36) % 24) - 12;
  if (calm || Math.abs(d) < 0.034) {
    hv = 0;
    return home ? null : goal;
  }
  const most = 0.8 + 1.5 * clamp(Math.min(...sun.map((x) => Math.abs(((at - x + 36) % 24) - 12))) - 0.5, 0, 2);
  hv = clamp(hv + (d * 2 - hv * 2.83) * dt, -most, most);
  return (at + hv * dt + 24) % 24;
}

// The governor, made with the rung it starts on and climbs no higher than, told every animation frame its time, whether
// the city draws in it (2 while anything moves), the city's own milliseconds, the rung it stands on and its relights so
// far. It watches what the visitor sees, the gaps between frames, and makes no call into the GPU to do it. A gap is the
// city's when the frame before it drew; resting, the city draws in some frames only, and a heavy one shows as the gap
// after it. When a third or more of the city's gaps in the last half second (ten at least) ran over 20 ms, it sheds a
// rung at once (1), and again each half second that goes on; a hitch or two is not a third. After 8 s with nine gaps in
// ten under 18 ms, the last second still, it climbs one (-1): never while the pages move, and never into a rung that
// failed within a minute for each time it has failed. `state` is for the page's log: rung, why it last moved, the last
// second's gaps and drawn frames.
export const ladder = (top) => {
  const gaps = [];
  const seen = [];
  const fails = [];
  const bar = [];
  let last = 0;
  let before = false;
  let moved = -1e9;
  let calm = performance.now();
  const state = { level: top, why: 'start', p50: 0, p95: 0, fps: 0, relights: 0 };
  return Object.assign((now, drew, cost, level, relits) => {
    // A frame after the page was hidden is no gap.
    if (now - last < 1000) gaps.push([now, now - last, before]);
    last = now;
    before = drew;
    if (drew > 1) moved = now;
    while (gaps[0]?.[0] < now - 1000) gaps.shift();
    if (drew) seen.push([now, relits]);
    while (seen[0]?.[0] < now - 1000) seen.shift();
    const at = (a, q) => a.map((g) => g[1]).sort((x, y) => x - y)[Math.floor(a.length * q)] || 0;
    const own = gaps.filter((g) => g[2] && g[0] > now - 500);
    const slow = own.filter((g) => g[1] > 20).length;
    const ms = (q) => Math.round(at(gaps, q) * 10) / 10;
    Object.assign(state, { level, p50: ms(0.5), p95: ms(0.95), fps: seen.length, relights: relits - (seen[0]?.[1] ?? relits) });
    if (level < 6 && now - calm > 500 && own.length > 9 && (slow * 3 >= own.length || cost > 4)) {
      calm = now;
      fails[level] = (fails[level] || 0) + 1;
      bar[level] = now + 60000 * fails[level];
      state.why = `shed, ${slow} of ${own.length} gaps over 20 ms, own ${cost.toFixed(1)} ms`;
      return 1;
    }
    if (now - calm < 8000 || level <= top || at(gaps, 0.9) > 18 || now - moved < 1000 || now < bar[level - 1]) return 0;
    calm = now;
    state.why = 'climb, 8 s clean';
    return -1;
  }, { state });
};

// The key frame the city is kept at. `look(p)` gives the camera at page `p`; `tall` is the picture's height in art
// pixels. The tower's axis crosses the picture as the pages turn; the key frame is the page where it stands a
// whole number of art pixels from where it stands on the first, found by Newton from the last key, and it changes
// only when the tower has moved to another pixel or the picture is redrawn anyway (`fresh`). Moving (`busy`), a frame
// in which the clouds march keeps the last key, so no frame both relights the town and marches the clouds; the shift
// carries the tower that frame, and the moment after the pages stop, until rest relights it. Returns how far the
// tower stands now from where the key frame has it, and leaves the camera at the key frame. Past the last stop
// nothing moves, so there the key stays.
let keyAt = 0;
let keyOn = null;
export function key(look, p, last, tall, fresh, busy) {
  const across = (q) => {
    const v = look(q);
    return ((v.fl * tall) / 2) * ((v.r[0] * v.pos[0] + v.r[2] * v.pos[2]) / (v.f[0] * v.pos[0] + v.f[2] * v.pos[2]));
  };
  const first = across(0);
  const x = across(p) - first;
  // Whether `clouds`, which runs after this, marches this frame.
  const march = !((kept >= 16 || p !== seen) && !skip);
  if (fresh || (Math.round(x) !== keyOn && !(busy && march))) {
    keyOn = Math.round(x);
    keyAt = p;
    for (let i = 0; i < 3; i += 1) {
      const a = across(keyAt) - first - keyOn;
      const d = across(keyAt + 1e-4) - first - keyOn - a;
      if (d) keyAt = clamp(keyAt - (a * 1e-4) / d, 0, last);
    }
  }
  return x - across(keyAt) + first;
}

// Lightning comes in groups of one to three flashes a tenth of a second or two apart; a group lasts under half a
// second and the next starts at least one and a half seconds after it, rarer the weaker the storm, so no second ever
// holds more than three flashes. `out` takes the light now, 0 to 1, and the group's seed, which places it.
// The storm's own clock runs at its strength, so a storm that is still building does not push its next group away.
let clock = 0;
let due = 0;
let start = -9;
let last = 0;
let group = [];
let seed = 0;
export function thunder(out, s, amount) {
  clock += clamp(s - last, 0, 1) * amount;
  last = s;
  if (amount < 0.02) {
    out[0] = 0;
    return;
  }
  if (clock > due && s - start > 1.5) {
    start = s;
    seed = Math.random() * 97;
    group = [s];
    while (group.length < 3 && Math.random() < 0.55) group.push(group[group.length - 1] + 0.08 + Math.random() * 0.14);
    due = clock + 2 + Math.random() * 9;
  }
  out[0] = Math.min(1, group.reduce((l, g) => l + (s >= g ? Math.exp(-(s - g) * 16) * (g === group[0] ? 1 : 0.7) : 0), 0));
  out[1] = seed;
}

// What the city brings in after the page has loaded: the occasional traffic, and GLSL that city.js compiles beside
// the clear sky it starts with: clouds, rain, snow, lightning, the ripples and glints on the water, the Milky Way
// and the near fringe; and the timing of lightning. All of it comes in by uIn, so the hand-over shows no seam.

import { bird, bridgeAt, BR, hex, norm, WHITE, RED, IRON, K, ZERO, BELOW } from './city.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The occasional traffic: a freighter under the high span about every seven minutes, geese in their seasons and two
// airliners descending toward Kastrup along the bridge. Each comes on its first round after this module arrives,
// from out of view, so nothing appears in place.
let since = null;
export function traffic(m, t, lamps, skein) {
  since ??= t;
  const after = (period, phase) => (Math.floor(t / period + phase) - phase) * period >= since;
  const { d, n, yaw } = BR;
  if (after(420, 0.34)) {
    const off = 3300 - (((t / 420 + 0.34) % 1) * 6400);
    const [x, z] = bridgeAt((BR.P0 + BR.P1) / 2, off);
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
  }
  if (skein && after(80, 0.3)) {
    const u = (t / 80 + 0.3) % 1;
    const dir = norm([-skein, 0, 0.08 * skein]);
    const lead = [skein * (900 - 1800 * u), 96 + 6 * Math.sin(u * 11), -140 + skein * (144 * u - 72)];
    for (let i = 0; i < 9; i += 1) {
      const k = i < 6 ? i : i - 5;
      const side = i < 6 ? 1 : -1;
      bird(m, [lead[0] - dir[0] * k * 9 + dir[2] * side * k * 6, lead[1] - k * 0.4, lead[2] - dir[2] * k * 9 - dir[0] * side * k * 6], dir, Math.sin(t * 6.5 - i * 0.8) * 0.55 + 0.1, 3.4, IRON);
    }
  }
  for (const ph of [0.29, 0.79]) {
    if (!after(110, ph)) continue;
    const s = ((t / 110 + ph) % 1) * 11000;
    const [ax, az] = bridgeAt(s - 5250, -480);
    const p = [ax, 950 - 0.075 * s, az];
    const at = (l, w) => [p[0] + d[0] * l + n[0] * w, p[2] + d[1] * l + n[1] * w];
    m.box(p[0], p[1], p[2], 37, 3.9, 3.9, WHITE, { yaw });
    m.box(p[0], p[1] + 0.6, p[2], 5.5, 0.7, 34, hex('#cfd3d6'), { yaw });
    const [tx, tz] = at(-16, 0);
    m.box(tx, p[1] + 3.6, tz, 4.5, 6, 0.7, hex('#3f73b2'), { yaw });
    m.box(tx, p[1] + 2.6, tz, 3.2, 0.5, 12, hex('#cfd3d6'), { yaw });
    if ((t * 0.9 + ph * 7) % 1 < 0.12) m.light(p[0], p[1] - 3.4, p[2], 3.2, WHITE, 0.8, 1);
    if (lamps) {
      const [lx, lz] = at(0, 17);
      const [rx, rz] = at(0, -17);
      m.light(lx, p[1] + 0.6, lz, 2.4, RED, 0, 1);
      m.light(rx, p[1] + 0.6, rz, 2.4, hex('#48e07a'), 0, 1);
    }
  }
}

const FBM = `float cloud=0.; // The share of the sky the clouds cover, 0 to 1.
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ if(float(i)>3.-uQ) break; s+=a*noise(p); p=p*2.03+vec2(11.7,5.3); a*=.5; } return s; }
void cover(){ cloud=clamp((uCover.x*.22+.2)/.7,0.,1.); }`;

// The clouds, drawn into a picture of their own of at most a third of a million pixels. A ray climbs through a
// layer of cloud a few hundred metres to a few kilometres deep, in seven steps (four lower down the ladder). Over each point the clouds stand to a
// height set by noise and the cover, so heaps rise from flat feet, and under overcast the layer closes into
// thicker and thinner parts. Each step is lit by how much cloud stands toward the sun: crowns lit, feet
// shaded, thin edges glowing when the sun stands behind, all in the hour's colours, the towns' glow on the feet
// at night. Rain lowers and darkens the layer, a storm raises it into towers that lightning lights from inside.
// A thin high layer drifts faster above. Far clouds sink into the haze.
export const CLOUDS = `${FBM}
void main(){
  vec2 px=gl_FragCoord.xy*uScale; ppr=uFl*uRes.y*.5;
  vec3 r=ray(px);
  cover();
  o=vec4(0.);
  if(r.y<.003||uIn<=0.) return;
  if(cloud+uWx.x<.02) return;
  float x=.78-.42*cloud-.3*uWx.x,B=mix(1500.,500.,max(uWx.x*.6,uWx.y)),D=mix(400.,1100.,cloud)+uWind.w*4000.;
  float t0=(B-uCam.y)/r.y,t1=min((B+D-uCam.y)/r.y,t0+15000.),n=7.-3.*uQ,dt=(t1-t0)/n,T=1.,j=.3+.4*hash(px);
  vec2 ts=normalize(uSunDir.xz+1e-4)*(1.2-uSunDir.y),p0=r.xz/max(r.y,.02)*.6+uSeed;
  vec3 lit=mix(uCloud[0],vec3(1.),.15)+uSunCol*.25*(1.-uWind.w),shade=mix(uCloud[1],uSky[1],.25)*(1.-.12*uWx.y)*(1.-.45*uWind.w*smoothstep(.3,.7,noise(p0))),acc=vec3(0.);
  float fa=(fract(uFlash.y)-.5)*1.2-atan(r.x,-r.z)+atan(uF.x,-uF.z),glow=uFlash.x*(exp(-abs(fa)*3.)*.9+.1);
  for(float i=0.;i<8.;i++){
    if(i>=n||T<.03) break;
    vec3 p=uCam+r*(t0+(i+j)*dt);
    float y=(p.y-B)/D;
    vec2 q=(p.xz-uDrift*1.5)*.0005+uSeed;
    // Thick cloud hangs lower, so under overcast the deck shows its rolls from below.
    float g=4.-2.6*uWx.x,h=clamp((fbm(q)-x)*g,0.,1.),b=(1.-h)*.35*uWx.x,d=smoothstep(h,h-.15,y)*smoothstep(b,b+.1,y+.04*noise(q*12.));
    if(d<.01) continue;
    float l=exp(-max(clamp((fbm(q+ts*.25)-x)*g,0.,1.)-y,0.)*2.5)*mix(.3,1.,clamp((y-b)/max(h-b,.01),0.,1.));
    vec3 L=mix(shade,lit,l)+(uSunCol*hg(dot(r,uSunDir),.6)+uMoonCol*hg(dot(r,uMoonDir),.6))*.07*(1.-d)*l;
    L+=vec3(.95,.58,.3)*uNight*.14*(1.-y)*exp(-r.y*10.)+vec3(.75,.8,1.)*glow*(1.-y*.5)*(.6+.4*d);
    float a=1.-exp(-d*dt*.004);
    acc+=T*a*L; T*=1.-a;
  }
  vec2 hq=(uCam.xz+r.xz/r.y*7000.-uDrift*2.4)*vec2(.00006,.0002)+uSeed.yx;
  float hi=smoothstep(.55,.78,fbm(hq)+cloud*.12)*(.4-.25*uWx.x)*smoothstep(.02,.12,r.y)*smoothstep(0.,.25,cloud);
  acc+=T*hi*(lit+uSunCol*.2*uLow); T*=1.-hi;
  float al=1.-T;
  vec3 col=mix(acc/max(al,1e-4),uSky[3],smoothstep(.16,0.,r.y)*.55);
  o=vec4(col,1.)*al*smoothstep(.003,.025,r.y)*uIn;
}`;

// What the picture at the screen's grain takes from the clouds' picture, and the weather drawn over all.
export const WX = `${FBM}
uniform sampler2D uClouds;
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
// Read softly, four taps a texel apart, so the grain of the clouds' few steps does not show.
vec3 clouds(vec3 r,vec3 c,float full){
  cover();
  if(full>0.) c=galaxy(r,c);
  vec3 u=uvOf(r); vec2 d=.7/vec2(textureSize(uClouds,0));
  vec4 k=(texture(uClouds,u.xy+d)+texture(uClouds,u.xy-d)+texture(uClouds,u.xy+vec2(d.x,-d.y))+texture(uClouds,u.xy-vec2(d.x,-d.y)))*.25*u.z;
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
// ripples too small to see widen the light's path.
vec4 facet(vec3 p,float fp,float A){
  vec2 d=uWind.xy/max(length(uWind.xy),.3),q=vec2(dot(p.xz,d),dot(p.xz,vec2(-d.y,d.x))),s=vec2(0.);
  float v=.0003,L=10.,k=.45;
  for(int i=0;i<3;i++){
    float f=smoothstep(L*.6,L*.15,fp);
    s+=noised(q/L*vec2(1.,.45)+vec2(-uT*1.6/sqrt(L),float(i)*3.7)).yz*vec2(1.,.45)*A*k*f; v+=A*A*k*k*(1.-f)*.35;
    L*=.38; k*=.85;
  }
  s=(s.x*d+s.y*vec2(-d.y,d.x))*uIn;
  return vec4(normalize(vec3(-s.x,1.,-s.y)),v);
}
// The sun or moon on facets that tip toward it, broken into dashes by the ripples.
vec3 glints(vec3 r,vec4 f,vec3 p,float fp,float fr){
  vec3 h=normalize(uGlitDir-r); float ch=max(dot(h,f.xyz),.05),a2=3.*f.w+.002;
  return uGlitCol*min(exp(-(1.-ch*ch)/(ch*ch*a2))/(a2*ch*ch*ch*ch)*fr*.006/max(dot(f.xyz,-r),.05),2.)*smoothstep(.35,.9,noise(p.xz*vec2(.9,2.6)/(1.+fp*3.)+uT*vec2(.7,-.4)))*uIn;
}
// Rain rings on the near water, more and faster the harder it rains.
vec3 rings(vec3 c,vec3 p,float t){
  if(uWx.y<=0.||t>200.||uIn<=0.) return c;
  vec2 g=p.xz*1.3,id=floor(g); float h=hash(id),k=fract(uT*1.4+h*9.);
  vec2 o=fract(g)-.25-.5*vec2(fract(h*31.),fract(h*67.));
  return mix(c,mix(uSky[3],vec3(1.),.3),(1.-k)*(1.-k)*.3*uIn*step(h,uWx.y*.45)*smoothstep(140.,30.,t)*smoothstep(.05+t*.002,0.,abs(length(o)-k*.25)));
}
// Rain in three depths, falling about seven metres a second and slanting with the wind across the view; snow
// in four, falling a metre or two a second, fluttering and drifting, the near flakes large and soft. Both catch
// the lamps at night. Lightning flickers in the sky, now and then with a bolt to the horizon; a low sun sends
// shafts through the gaps in broken cloud. Under reduced motion, rain and snow hold still.
vec3 weather(vec3 c,vec2 px,vec3 r,float cv,inout float valid){
  if(uIn<=0.) return c;
  cover();
  float t=uT,ln=clamp(dot(uWind.xy,uR.xz)/7.,-.9,.9),lamp=0.;
  if(uGlowAmt>0.) lamp=dot(texture(uGlow,px/uRes).rgb,vec3(.33))*uGlowAmt;
  vec3 air=mix(uSky[3],uCloud[0],.5)+lamp*4.;
  if(uWx.y>0.&&uStat==0.){
    for(int i=0;i<3;i++){
      float fi=float(i),s=(1.-.3*fi)*uDot,cw=6.*s,u=(px.x+ln*px.y)/cw,id=floor(u)+fi*97.;
      float v=(px.y+t*7.*ppr/(4.+6.*fi*fi)+hash(vec2(id,fi))*999.)/(ppr*.06*s),L=.18-.04*fi;
      float a=smoothstep(.5,.0,abs(fract(u)-.5)*cw/(1.+s*.4))*step(fract(v),L)*step(hash(vec2(id,floor(v))),uWx.y*(.5+.25*fi));
      a*=fract(v)/L*(.45-.1*fi)*(1.+uNight)*uWx.y*uIn;
      if(a>0.){ c=mix(c,dot(c,LUM)>.4?c*.72:max(c*1.2+.1,air),a); valid=0.; }
    }
  }
  if(uWx.z>0.&&uStat==0.){
    for(int i=0;i<4;i++){
      float fi=float(i),s=(1.4-.3*fi)*uDot,cs=40.*s;
      vec2 q=px+vec2(-dot(uDrift,uR.xz)*ppr*.004/(1.+fi)-t*ln*20.*s,t*ppr*(.05-.009*fi)),id=floor(q/cs);
      float h=hash(id+fi*13.);
      if(h>uWx.z*(.55+.12*fi)) continue;
      vec2 o=(vec2(.2+.6*fract(h*71.),.2+.6*fract(h*37.))+vec2(sin(t*(.8+h)+h*40.)*.12,0.))*cs;
      float rad=(1.2+2.2*fract(h*19.))*s*(1.3-.25*fi),d=length(q-id*cs-o);
      float a=smoothstep(rad,rad*(.3+.15*fi),d)*(.85-.15*fi)*uIn;
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
ivec2 spotOf(vec3 d){ return ivec2(clamp((vec2(dot(d,uR)*uFl/uAspect,d.y*uFl)/dot(d,uF)+vec2(0.,uShift))*.5+.5,0.,.999)*uRes/uHd); }
// The aureole from the share of the sun the city leaves clear: the core burns its nearest sky to white, falling off
// through warm white and pale gold; a low sun's bloom spreads wide along the horizon; thin cloud across it glows and
// lets soft shafts through.
vec3 glare(vec3 r){
  float s=rS(),a=length(r-uSunDir)/s;
  if(uSunUp<=0.||a>90.) return vec3(0.);
  float v=0.,o=.6*ppr*s/uHd,t=1.-veil(uSunDir),low=exp(-uSunDir.y*18.); ivec2 p=spotOf(uSunDir),m=ivec2(uRes/uHd)-1;
  for(int i=0;i<5;i++) v+=texelFetch(uCity,clamp(p+ivec2(vec2(i==1?o:i==2?-o:0.,i==3?o:i==4?-o:0.)),ivec2(0),m),0).a;
  vec3 d=r-uSunDir; float w=length(vec2(length(d.xz)*(1.-.75*low),d.y))/s;
  vec3 warm=mix(mix(vec3(1.,.93,.78),vec3(1.,.82,.55),smoothstep(2.,9.,a)),mix(vec3(1.,.7,.38),vec3(1.,.45,.2),smoothstep(3.,20.,w)),uLow);
  float core=exp(-max(a-1.,0.)*.7)*1.1,halo=exp(-w*.12)*(.12+.5*uLow)+exp(-w*.04)*(.05+.3*uLow);
  float shaft=t*(1.-t)*4.*exp(-a*.04)*smoothstep(.45,.8,noise(vec2(atan(d.y,dot(d,uR))*9.,uT*.02)))*.35;
  return mix(vec3(1.),warm,smoothstep(1.2,3.5,a))*(1.-v*.2)*(core+halo*(1.+t*(1.-t)*3.)+shaft)*uSunUp*(1.-t*.8);
}
`;

// The near fringe of reeds and, on a wide screen, a moored mast, for the city at the art pixel's grain: it lies over
// everything, dark, slides farthest and comes in with the clouds.
export const FRINGE = `float seg(vec2 p,vec2 a,vec2 b){ vec2 pa=p-a,ba=b-a; return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.)); }
// The near fringe in hundredths of the height from the bottom left: reeds at both edges and, when wide, a moored
// mast. Returns the distance to the nearest; lit is how far toward the light.
float fringe(vec2 q,float wide,out float lit){
  float way=sign(dot(uSunDir,uR)+1e-4),d=9.; lit=0.;
  if(uAspect>1.){
    // The mast rocks with its boat; a spreader and a stay hold it.
    float mx=wide-5.; vec2 top=vec2(mx+1.2+sin(uT*.5)*.6,66.),foot=vec2(mx-1.8,-2.),mid=mix(foot,top,.62);
    float m=min(seg(q,foot,top)-mix(.42,.2,q.y/66.),min(seg(q,mid-vec2(2.6,-.1),mid+vec2(2.6,-.1))-.14,seg(q,top,vec2(wide+6.,16.))-.08));
    if(m<d){ d=m; lit=.4; }
  }
  // On an upright screen the stems keep close to the edge, by the row of apps.
  float ci=floor(q.x/.8),nar=uAspect>1.?1.:.3;
  for(int k=-3;k<=3;k++){
    float id=ci+float(k),h1=hash(vec2(id,uFore.w)),h2=fract(h1*57.3),h3=fract(h1*191.7),xb=(id+h1)*.8,xr=wide-xb;
    // The stems stand near the edges, most on the right.
    float tall=(uFore.z+5.+9.*h2)*max(exp(-xr*xr/(12.*nar)),.9*exp(-xb*xb/2.5));
    if(tall<uFore.z+3.||q.y>tall+3.) continue;
    // A reed bends, leans in and sways, mostly with a plume and a blade halfway up.
    float v=q.y/tall,in_=xb<xr?1.:-1.,bend=in_*(.5+h3)*tall*.07*nar+sin(uT*(.7+h2*.5)+id*.9)*.5*uWind.z+dot(uWind.xy,uR.xz)*tall*.01,cx=xb+bend*v*v,r=abs(q.x-cx)-.26*(1.-v)-.1;
    if(h3>.35) r=min(r,(length((q-vec2(xb+bend*.86,tall*.93))/vec2(.5,2.8))-1.)*.45);
    vec2 leaf=vec2(xb+bend*.3,tall*.55); r=min(r,seg(q,leaf,leaf+vec2(in_*(1.4+h2)*nar,6.+4.*h3))-.2*clamp(1.-(q.y-leaf.y)/10.,0.,1.));
    if(r<d){ d=r; lit=smoothstep(-.3,.3,(q.x-cx)*way)*(.3+.7*v); }
  }
  return d;
}
void over(inout vec3 g,inout float cv,vec2 px){
  float un=uRes.y*.01,lit; vec2 q=(px-uFore.xy)/un;
  if(uForeA>0.&&q.y<68.&&(q.x<7.||q.x>uRes.x/un-12.)){
    float a=smoothstep(.1,-.1,fringe(q,uRes.x/un,lit))*uForeA;
    if(a>0.){ float c2=cv*(1.-a)+a; g=(g*cv*(1.-a)+(uForeC*(1.+q.y*.008)+uRimC*lit*.3)*a)/c2; cv=c2; }
  }
}`;

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

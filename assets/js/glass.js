// Liquid Glass over the city. One shader draws every glass shape: the scene
// behind it clear in the middle, bent and split into colours in a band along
// the rim. It is tinted the way dark glass is, not painted over: what is
// already dark enough for white text passes untouched, and only what is
// brighter is held under the level that text needs, pixel by pixel, keeping
// its colour. Each element gets the result in a small canvas of its own, so
// the shape moves with the page and only the picture inside it is a frame
// behind.
//
// One glass per place. A shape added here is drawn by this shader alone: the
// stylesheet takes its blur and fill away (`.is-lensed`) and keeps only the
// hairline rim and one shadow, so nothing is drawn twice.

const VS = `#version 300 es
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.-1.,0.,1.); }`;

const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex;
const float CEIL=.135,KNEE=.055;
uniform vec2 uRes,uLight,uTexels;
uniform vec4 uSrc;
uniform vec3 uFill;
uniform float uPx,uRadius,uBlur,uSquircle;
// Distance to a rounded box, and the direction away from it. With uSquircle
// the corners are the superellipse the browser clips the element to, so the
// bend follows the real outline.
float box(vec2 p,vec2 half_,float r,float sq,out vec2 dir){
  vec2 q=abs(p)-(half_-r);
  vec2 s=vec2(p.x<0.?-1.:1.,p.y<0.?-1.:1.);
  if(q.x>0.&&q.y>0.){
    if(sq>0.){
      vec2 q2=q*q; float f=sqrt(sqrt(dot(q2,q2))); vec2 g=q2*q/(f*f*f); float gl=length(g);
      dir=g/gl*s; return (f-r)/gl;
    }
    dir=normalize(q)*s; return length(q)-r;
  }
  if(q.x>q.y){ dir=vec2(s.x,0.); return q.x-r; }
  dir=vec2(0.,s.y); return q.y-r;
}
// The scene behind a point, out of focus. The city is drawn in large pixels;
// its smaller copies are read here, never the pixels themselves, so the glass
// is optically clean while the city stays pixel art.
vec3 scene(vec2 q,float radius){
  vec2 uv=uSrc.xy+q/uRes*uSrc.zw,r=radius/uRes*uSrc.zw*.7;
  float lod=log2(max(radius/uRes.x*uSrc.z*uTexels.x,1.))+.6;
  vec3 sum=textureLod(uTex,vec2(uv.x,1.-uv.y),lod).rgb*.36;
  for(int i=0;i<4;i++){
    vec2 at=uv+vec2(i<2?-1.:1.,(i&1)==0?-1.:1.)*r;
    sum+=textureLod(uTex,vec2(at.x,1.-at.y),lod).rgb*.16;
  }
  return sum;
}
void main(){
  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 p=px-uRes*.5;
  vec2 dir;
  float inside=-box(p,uRes*.5,uRadius*uPx,uSquircle,dir);
  // The bezel: a band along the rim where the glass curves away. The bend
  // grows toward the edge like the slope of a rounded lip.
  float band=min(uRadius,18.)*uPx;
  float t=clamp(inside/band,0.,1.);
  float edge=(1.-t)*(1.-t)*(1.-t);
  vec2 q=px-dir*edge*band;
  float blur=mix(uBlur,uBlur*.5,edge)*uPx;
  vec3 col;
  if(edge>.004){
    vec2 split=dir*edge*band*.09;
    col=vec3(scene(q+split,blur).r,scene(q,blur).g,scene(q-split,blur).b);
  } else col=scene(q,blur);
  float luma=dot(col,vec3(.2126,.7152,.0722));
  col=mix(vec3(luma),col,1.12);
  // The tint. White text needs a luminance of at most 0.183 behind it for
  // 4.5:1. Up to the knee the scene passes as it is; above it the luminance
  // bends over toward CEIL and never reaches it, and the colour is scaled,
  // not mixed with grey, so a sunset stays a sunset behind the glass.
  vec3 lin=pow(max(col,0.),vec3(2.2));
  float y=dot(lin,vec3(.2126,.7152,.0722))+1e-4;
  float room=CEIL-KNEE;
  col=pow(lin*(y<KNEE?1.:(KNEE+room*(1.-exp((KNEE-y)/room)))/y),vec3(1./2.2));
  // A thin veil of the fill gives the pane a body of its own, and over a dark
  // scene a little light, as clear glass has.
  col=mix(col,uFill,.1);
  col+=.05*(1.-smoothstep(0.,.3,luma));
  // Lit from above. A soft shade along the far edge gives the glass its
  // thickness; the rim itself is the stylesheet's hairline, drawn once.
  float away=max(dot(dir,-uLight),0.);
  col+=(.5-px.y/uRes.y)*.05;
  float deep=smoothstep(band*1.3,2.*uPx,inside);
  col*=1.-deep*deep*(.06+.14*away);
  // The element's own corners clip the picture, squircle or round.
  o=vec4(col,1.);
}`;

const FILL = [0.082, 0.094, 0.122];

export function mountGlass(source) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return null;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(program);
  gl.useProgram(program);
  const u = {};
  for (const name of ['uRes', 'uLight', 'uTexels', 'uSrc', 'uFill', 'uPx', 'uRadius', 'uBlur', 'uSquircle']) u[name] = gl.getUniformLocation(program, name);
  gl.bindVertexArray(gl.createVertexArray());
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform3f(u.uFill, ...FILL);

  const items = [];
  let fresh = true;
  let scale = Math.min(2, devicePixelRatio || 1);
  let slow = 0;
  let last = 0;

  return {
    add(el, { blur = 3 } = {}) {
      const fx = document.createElement('canvas');
      fx.className = 'glass__fx';
      fx.setAttribute('aria-hidden', 'true');
      // Until the shape is first drawn it is the stylesheet's glass, with no picture.
      fx.hidden = true;
      el.prepend(fx);
      items.push({ el, fx, ctx: fx.getContext('2d'), blur, radius: 0, squircle: 0, key: '', on: false });
    },
    // The scene has a new frame.
    refresh() { fresh = true; },
    // True until that frame has been drawn into the shapes.
    get stale() { return fresh; },
    // Draw what changed. `light` is the unit direction the rim catches most.
    frame(now, light, live) {
      // Slow frames: draw the glass coarser, once, rather than drop the scene's own.
      if (last && now - last > 30) slow += 1; else slow = Math.max(0, slow - 0.2);
      last = now;
      if (slow > 40 && scale > 1) { scale = Math.max(1, scale * 0.7); slow = 0; }
      if (fresh && source.width) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform2f(u.uTexels, source.width, source.height);
      }
      const wall = source.getBoundingClientRect();
      for (const item of items) {
        const { el, fx } = item;
        const box = live(el) ? el.getBoundingClientRect() : null;
        const shown = Boolean(box && box.width > 0 && box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight);
        // The class and the picture go on and off together: while a shape is
        // this glass the stylesheet draws none, and the other way round.
        if (shown !== item.on) {
          item.on = shown;
          el.classList.toggle('is-lensed', shown);
          fx.hidden = !shown;
          item.key = '';
        }
        if (!shown) continue;
        const src = [(box.left - wall.left) / wall.width, (box.top - wall.top) / wall.height, box.width / wall.width, box.height / wall.height];
        const w = Math.max(1, Math.round(el.offsetWidth * scale));
        const h = Math.max(1, Math.round(el.offsetHeight * scale));
        const key = [w, h, ...src.map((v) => v.toFixed(4)), light[0].toFixed(2)].join();
        if (!fresh && key === item.key) continue;
        item.key = key;
        if (canvas.width < w || canvas.height < h) {
          canvas.width = Math.max(canvas.width, w);
          canvas.height = Math.max(canvas.height, h);
        }
        if (fx.width !== w || fx.height !== h) {
          fx.width = w;
          fx.height = h;
          const style = getComputedStyle(el);
          item.radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, el.offsetWidth / 2, el.offsetHeight / 2);
          item.squircle = style.getPropertyValue('corner-top-left-shape') === 'squircle' ? 1 : 0;
        }
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u.uRes, w, h);
        gl.uniform2f(u.uLight, light[0], light[1]);
        gl.uniform4f(u.uSrc, ...src);
        gl.uniform1f(u.uPx, scale);
        gl.uniform1f(u.uRadius, item.radius);
        gl.uniform1f(u.uSquircle, item.squircle);
        gl.uniform1f(u.uBlur, item.blur);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        item.ctx.clearRect(0, 0, w, h);
        item.ctx.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
      }
      fresh = false;
    },
  };
}

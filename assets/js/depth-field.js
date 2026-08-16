// Lightweight depth/signal field. It deliberately degrades on small/coarse devices.
const RAMP=[[117,225,207],[139,140,255],[240,189,114]];
const mix=(a,b,t)=>Math.round(a+(b-a)*t);
function colour(t){const x=Math.max(0,Math.min(1,t));if(x<.56){const k=x/.56;return RAMP[0].map((v,i)=>mix(v,RAMP[1][i],k))}const k=(x-.56)/.44;return RAMP[1].map((v,i)=>mix(v,RAMP[2][i],k))}
function hash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)}
export function mountDepthField(canvas){
  const ctx=canvas?.getContext?.('2d',{alpha:true});if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse=matchMedia('(pointer: coarse)').matches||innerWidth<720;
  const cols=coarse?54:86,rows=coarse?22:34;
  let w=1,h=1,dpr=1,raf=0,running=false,last=0;
  const resize=()=>{const r=canvas.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,coarse?1.5:2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)};
  function draw(now){if(coarse&&!reduced&&now-last<32)return;last=now;ctx.clearRect(0,0,w,h);const time=reduced?0:now/1000;const sweep=(time%8)/8;for(let r=0;r<rows;r++){const rt=r/(rows-1);const z=1.3+Math.pow(rt,1.45)*13.5;for(let c=0;c<cols;c++){const ct=c/(cols-1);const x=(ct-.5)*12;const relief=(hash(c*.35+Math.floor(time*.08),r*.27)-.5)*1.1;const inv=1/z;const sx=w*.67+x*inv*w*.48;const sy=h*.53+relief*inv*h*.9;const dt=1-(z-1.3)/13.5;const col=colour(dt);const scanZ=14.8-sweep*13.5;const lift=Math.max(0,1-Math.abs(z-scanZ)/.75);const a=.10+dt*.44+lift*.42;const s=Math.max(.8,inv*4+lift*1.15);ctx.fillStyle=`rgba(${col[0]},${col[1]},${col[2]},${a})`;ctx.fillRect(sx,sy,s,s)}}}
  const frame=n=>{draw(n);if(running)raf=requestAnimationFrame(frame)};const start=()=>{if(running||reduced)return;running=true;raf=requestAnimationFrame(frame)};const stop=()=>{running=false;cancelAnimationFrame(raf)};
  new ResizeObserver(()=>{resize();draw(performance.now())}).observe(canvas);new IntersectionObserver(([e])=>e.isIntersecting?start():stop(),{threshold:.02}).observe(canvas);document.addEventListener('visibilitychange',()=>document.hidden?stop():start());resize();draw(performance.now());if(!reduced)start();
}

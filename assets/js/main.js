import { mountDepthField } from './depth-field.js';
document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const masthead=document.querySelector('.masthead');
if(masthead){const s=document.createElement('span');s.setAttribute('aria-hidden','true');s.style.cssText='position:absolute;top:0;width:1px;height:1px';document.body.prepend(s);new IntersectionObserver(([e])=>masthead.dataset.stuck=String(!e.isIntersecting)).observe(s)}

const field=document.getElementById('depth-field');if(field)mountDepthField(field);

const reveals=[...document.querySelectorAll('.reveal')];
if(reveals.length){const io=new IntersectionObserver((entries,obs)=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');obs.unobserve(e.target)}}),{rootMargin:'0px 0px -7% 0px',threshold:.06});reveals.forEach(el=>io.observe(el))}

document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

// Keep optional CV downloads invisible when the binary is not present in a fresh clone.
document.querySelectorAll('[data-optional-file]').forEach(async link=>{
  try{const r=await fetch(link.getAttribute('href'),{method:'HEAD',cache:'no-store'});if(!r.ok)link.hidden=true}catch{link.hidden=true}
});

// Scroll spy for anchors that exist on the current page.
const navLinks=[...document.querySelectorAll('.nav a[href^="#"]')];
const sections=navLinks.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
if(sections.length){const spy=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;navLinks.forEach(a=>{if(a.getAttribute('href')===`#${e.target.id}`)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')})}),{rootMargin:'-45% 0px -50%'});sections.forEach(s=>spy.observe(s))}

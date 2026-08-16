import { mountDepthField } from './depth-field.js';

document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const masthead = document.querySelector('.masthead');
if (masthead) {
  const sentinel = document.createElement('span');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;width:1px;height:1px;';
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => {
    masthead.dataset.stuck = String(!entry.isIntersecting);
  }).observe(sentinel);
}

const field = document.getElementById('depth-field');
if (field) mountDepthField(field);

const revealables = [...document.querySelectorAll('.reveal')];
if (revealables.length) {
  const observer = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
  revealables.forEach(element => observer.observe(element));
}

document.querySelectorAll('[data-year]').forEach(element => {
  element.textContent = String(new Date().getFullYear());
});

// Optional binary CV downloads are hidden in fresh clones until the file exists.
document.querySelectorAll('[data-optional-file]').forEach(async link => {
  try {
    const response = await fetch(link.getAttribute('href'), { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) link.hidden = true;
  } catch {
    link.hidden = true;
  }
});

// Scroll spy for same-page anchors only.
const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
if (sections.length) {
  const spy = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-45% 0px -50%' });
  sections.forEach(section => spy.observe(section));
}

// Small depth response for proof surfaces. Transform-only, desktop/fine pointers only.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const parallaxItems = [...document.querySelectorAll('[data-parallax]')];
if (!reducedMotion && finePointer && parallaxItems.length) {
  let frame = 0;
  const update = () => {
    frame = 0;
    const center = innerHeight * 0.5;
    for (const item of parallaxItems) {
      const rect = item.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > innerHeight + 80) continue;
      const strength = Math.min(10, Number(item.dataset.parallax) || 5);
      const itemCenter = rect.top + rect.height * 0.5;
      const normalized = Math.max(-1, Math.min(1, (itemCenter - center) / innerHeight));
      item.style.setProperty('--parallax-y', `${(-normalized * strength).toFixed(2)}px`);
    }
  };
  const requestUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate, { passive: true });
  requestUpdate();
}

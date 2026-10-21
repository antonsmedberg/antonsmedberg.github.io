// main.js — progressive enhancement only.
// Everything on the page reads and navigates without this file. It adds the
// theme toggle, the scroll spy, the reveal of text blocks, Fig. 0 (the
// stipple, the photograph on request, and the depth cloud loaded on request)
// and the copy-address button.

import { sample, computeDots, paintDots, fitCanvas } from './stipple.js';

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

root.classList.remove('no-js');

/* -------------------------------------------------------------------------
   Theme: Auto → Light → Dark → Auto. The inline <head> script applied the
   stored choice before first paint; this wires the button.
   ------------------------------------------------------------------------- */

const themeButton = document.querySelector('[data-theme-toggle]');
const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')];
const lang = root.lang === 'sv' ? 'sv' : 'en';

const themeLabels = {
  en: {
    auto: 'Theme: follows the system. Switch to light',
    light: 'Theme: light. Switch to dark',
    dark: 'Theme: dark. Follow the system',
  },
  sv: {
    auto: 'Tema: följer systemet. Byt till ljust',
    light: 'Tema: ljust. Byt till mörkt',
    dark: 'Tema: mörkt. Följ systemet',
  },
};

function themeState() {
  const stored = root.dataset.theme;
  return stored === 'light' || stored === 'dark' ? stored : 'auto';
}

function syncTheme() {
  const state = themeState();
  if (themeButton) {
    themeButton.dataset.state = state;
    themeButton.setAttribute('aria-label', themeLabels[lang][state]);
  }
  // Browser chrome follows the paper colour that is actually in effect.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  themeMetas.forEach((meta) => { meta.content = paper; });
  document.dispatchEvent(new CustomEvent('themechange', { detail: { state, paper } }));
}

if (themeButton) {
  themeButton.addEventListener('click', () => {
    const next = { auto: 'light', light: 'dark', dark: 'auto' }[themeState()];
    try {
      if (next === 'auto') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch (e) { /* private mode: the choice lasts for this page */ }
    if (next === 'auto') delete root.dataset.theme;
    else root.dataset.theme = next;
    syncTheme();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
}

syncTheme();

/* -------------------------------------------------------------------------
   Scroll spy — one observer over the sections, both navigation sets.
   When no section is in the band (the hero, the footer) nothing is current.
   ------------------------------------------------------------------------- */

const navLinks = [...document.querySelectorAll('.nav a[href^="#"], .folio a[href^="#"]')];
const sections = [...new Set(navLinks.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean))];

if (sections.length && 'IntersectionObserver' in window) {
  const visible = new Map();
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target, entry.intersectionRatio);
        else visible.delete(entry.target);
      }
      let current = null;
      let best = -1;
      for (const [section, ratio] of visible) {
        if (ratio > best) { best = ratio; current = section; }
      }
      for (const link of navLinks) {
        if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    },
    { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.1, 0.5] }
  );
  sections.forEach((section) => spy.observe(section));
}

/* -------------------------------------------------------------------------
   Reveal — text blocks only. The class that hides them is added here, after
   the observer exists, so a script failure can never hide content.
   ------------------------------------------------------------------------- */

const revealables = [...document.querySelectorAll('.reveal')];

if (revealables.length && !reduceMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );
  const fold = innerHeight;
  root.classList.add('io');
  for (const el of revealables) {
    if (el.getBoundingClientRect().top < fold) el.classList.add('is-visible');
    else observer.observe(el);
  }
}

/* -------------------------------------------------------------------------
   Fig. 0 — one portrait, three renderings from the same depth map.
   ------------------------------------------------------------------------- */

const fig = document.querySelector('[data-portrait]');

if (fig) {
  const canvas = fig.querySelector('[data-stipple]');
  const photo = fig.querySelector('[data-photo]');
  const cloudBox = fig.querySelector('[data-cloud]');
  const countEl = fig.querySelector('[data-count]');
  const captions = {
    stipple: fig.querySelector('[data-caption-stipple]'),
    photo: fig.querySelector('[data-caption-photo]'),
    cloud: fig.querySelector('[data-caption-cloud]'),
  };
  const buttons = [...fig.querySelectorAll('[data-mode-btn]')];
  const photoURL = fig.dataset.sampler;
  const depthURL = fig.dataset.depth;

  let dots = null;
  let cloud = null;
  let cloudLoading = null;

  const ink = () => getComputedStyle(root).getPropertyValue('--ink').trim();

  const paint = (progress = 1) => {
    if (!dots || !fitCanvas(canvas)) return;
    paintDots(canvas, dots, ink(), progress);
  };

  const groupDigits = (n) => n.toLocaleString('en-GB').replace(/,/g, ' ');

  const setMode = (mode) => {
    fig.dataset.mode = mode;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode)));
    for (const [key, el] of Object.entries(captions)) {
      if (el) el.hidden = key !== mode;
    }
    if (mode === 'cloud') showCloud();
    else if (cloud) cloud.pause();
  };

  // a) The stipple: computed once, drawn top to bottom over 1.1 s.
  sample(photoURL, depthURL)
    .then((data) => {
      dots = computeDots(data);
      if (countEl) countEl.textContent = groupDigits(dots.length / 3);
      if (fig.dataset.mode === 'loading') fig.dataset.mode = 'stipple';
      if (reduceMotion.matches) {
        paint(1);
        return;
      }
      const started = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - started) / 1100);
        paint(1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    })
    .catch(() => {
      // Without the sampler images the photograph stays, as a drawing.
      fig.dataset.mode = 'loading';
      buttons.forEach((b) => { b.disabled = true; });
    });

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => paint(1), 120);
  });
  document.addEventListener('themechange', () => paint(1));

  // b) The photograph: a persistent state via the control, a temporary peek
  //    on hover (fine pointers) and press-and-hold (touch).
  buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.modeBtn)));

  const plate = fig.querySelector('.plate');
  if (plate && photo) {
    let held = false;
    const peek = (on) => {
      if (on) fig.dataset.peek = '';
      else delete fig.dataset.peek;
    };
    // The rendering control floats on the plate; pointing at it never peeks.
    const onControl = (e) => Boolean(e.target.closest && e.target.closest('.seg, .rescan'));
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      plate.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        peek(fig.dataset.mode === 'stipple' && !onControl(e));
      }, { passive: true });
      plate.addEventListener('pointerleave', () => peek(false));
    }
    plate.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || fig.dataset.mode !== 'stipple' || onControl(e)) return;
      held = true;
      peek(true);
    });
    const release = () => { if (held) { held = false; peek(false); } };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => plate.addEventListener(type, release));
    plate.addEventListener('contextmenu', (e) => { if (held) e.preventDefault(); });
  }

  // c) The depth cloud: raw WebGL, imported the first time it is asked for.
  function showCloud() {
    if (cloud) { cloud.resume(); return; }
    if (cloudLoading) return;
    cloudLoading = import('./depth-cloud.js')
      .then((module) => {
        if (fig.dataset.mode !== 'cloud') return;
        cloud = module.mount(cloudBox, {
          depthURL,
          photoURL,
          reduceMotion: reduceMotion.matches,
          onCount: (kept, total) => {
            fig.querySelectorAll('[data-kept]').forEach((el) => { el.textContent = groupDigits(kept); });
            fig.querySelectorAll('[data-total]').forEach((el) => { el.textContent = groupDigits(total); });
          },
          onLost: () => {
            setMode('stipple');
            const lost = fig.querySelector('[data-cloud-lost]');
            if (lost) lost.hidden = false;
            buttons.find((b) => b.dataset.modeBtn === 'cloud')?.setAttribute('disabled', '');
            cloud = null;
          },
        });
        if (!cloud) {
          setMode('stipple');
          buttons.find((b) => b.dataset.modeBtn === 'cloud')?.setAttribute('disabled', '');
          const lost = fig.querySelector('[data-cloud-lost]');
          if (lost) lost.hidden = false;
        }
      })
      .catch(() => setMode('stipple'))
      .finally(() => { cloudLoading = null; });
  }

  fig.querySelector('[data-rescan]')?.addEventListener('click', () => cloud?.rescan());
}

/* -------------------------------------------------------------------------
   Copy the e-mail address (contact section).
   ------------------------------------------------------------------------- */

document.querySelectorAll('[data-copy]').forEach((button) => {
  const label = button.querySelector('[data-copy-label]') || button;
  const original = label.textContent;
  button.hidden = !navigator.clipboard;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      label.textContent = button.dataset.copied || 'Copied';
      setTimeout(() => { label.textContent = original; }, 1600);
    } catch (e) { /* the address is also plain text beside the button */ }
  });
});

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

// Progressive enhancement only. Everything reads and navigates without this
// file. It adds the theme toggle, reveal, the swiped pages, the glass bar, the
// window that apps open in, the 3D city, the sun that is its clock, and the mascot.
// Everything that moves is a spring, so a new touch can take it over mid-way.

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reduceGlass = matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)');
// Short windows and phones on their side: the bar stands as a rail down the
// side. The same query switches the layout in style.css.
const rail = matchMedia('(max-height: 540px) and (min-width: 600px)');
// Tablets and computers: an open window is a sheet with the home screen round
// it. Anywhere else it covers the home screen whole.
const sheet = matchMedia('(min-width: 720px) and (min-height: 541px)');
const screenEl = document.querySelector('.screen');
const pager = document.querySelector('.pager');
const pages = pager ? [...pager.querySelectorAll(':scope > .pg')] : [];
// The pager's width is read once per resize, never in a scroll handler.
let pagerWidth = pager ? pager.clientWidth : 0;
if (pager) addEventListener('resize', () => { pagerWidth = pager.clientWidth; });
const pageAt = () => (pager ? pager.scrollLeft / Math.max(1, pagerWidth) : 0);
const pageIndex = () => Math.round(pageAt());
const scrollTop = () => (pager ? pages[pageIndex()].scrollTop : scrollY);
const lang = root.lang === 'sv' ? 'sv' : 'en';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

root.classList.remove('no-js');

/* -------------------------------------------------------------------------
   Springs. `springStep` is the exact step of a damped spring over dt, so the
   curve is the same at any frame rate (f in Hz, zeta 1 = no bounce). `animate`
   runs step functions once a frame until they return false.
   ------------------------------------------------------------------------- */

function springStep(s, goal, f, zeta, dt) {
  const w = 2 * Math.PI * f;
  const x = s.x - goal;
  const e = Math.exp(-zeta * w * dt);
  if (zeta < 1) {
    const a = w * Math.sqrt(1 - zeta * zeta);
    const c = Math.cos(a * dt);
    const sn = Math.sin(a * dt);
    const k = (zeta * w) / a;
    s.x = goal + e * ((c + k * sn) * x + (sn / a) * s.v);
    s.v = e * (((-w * w * sn) / a) * x + (c - k * sn) * s.v);
  } else {
    s.x = goal + e * ((1 + w * dt) * x + dt * s.v);
    s.v = e * (-w * w * dt * x + (1 - w * dt) * s.v);
  }
  return s;
}

// One family of springs for everything that moves: frequency in Hz, damping.
// `quick` is a control answering a touch, with a little overshoot; `move` is
// a window or a sheet travelling; `page` carries the pages and the bar's
// selection to a tab in about a third of a second with no bounce; `calm` is
// what trails or returns. The stylesheet's --spring and --press are `quick`
// and a press written out as curves.
const SPRINGS = { quick: [3.6, 0.72], move: [2.6, 0.9], page: [3.2, 1], calm: [1.8, 1] };
const spring = (s, goal, kind, dt) => springStep(s, goal, SPRINGS[kind][0], SPRINGS[kind][1], dt);

const steppers = new Set();
let stepFrame = 0;
let stepAt = 0;
function animate(fn) {
  steppers.add(fn);
  if (!stepFrame) {
    stepAt = performance.now();
    stepFrame = requestAnimationFrame(function run(now) {
      // A slow device gets fewer frames, not a slower motion: the step is exact for any dt, so only a long
      // pause (a hidden tab) is cut short.
      const dt = Math.min(0.1, Math.max(0.001, (now - stepAt) / 1000));
      stepAt = now;
      for (const step of [...steppers]) if (step(dt) === false) steppers.delete(step);
      stepFrame = steppers.size ? requestAnimationFrame(run) : 0;
    });
  }
  return () => steppers.delete(fn);
}

// A finger's speed at release: the slope over its last 100 ms, in px/s.
function tracker() {
  let samples = [];
  return {
    add(t, x, y = 0) {
      samples.push([t, x, y]);
      while (samples.length > 2 && t - samples[0][0] > 100) samples.shift();
    },
    speed(now) {
      const [t0, x0, y0] = samples[0] || [0, 0, 0];
      const [t1, x1, y1] = samples[samples.length - 1] || [0, 0, 0];
      samples = [];
      // A finger that rested before lifting throws nothing.
      if (t1 - t0 < 8 || now - t1 > 60) return [0, 0];
      return [((x1 - x0) / (t1 - t0)) * 1000, ((y1 - y0) / (t1 - t0)) * 1000];
    },
  };
}

// Past an edge a drag keeps moving, less and less: travel `over` shows as this.
const rubber = (over, size) => (0.55 * over * size) / (size + 0.55 * over);

/* -------------------------------------------------------------------------
   Theme: auto, light, dark, auto. The inline <head> script applied the
   stored choice before first paint; this wires the button.
   ------------------------------------------------------------------------- */

const themeButton = document.querySelector('[data-theme-toggle]');
const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')];

const themeLabels = {
  en: {
    auto: 'Theme: automatic. Switch to light',
    light: 'Theme: light. Switch to dark',
    dark: 'Theme: dark. Switch to automatic',
  },
  sv: {
    auto: 'Tema: automatiskt. Byt till ljust',
    light: 'Tema: ljust. Byt till mörkt',
    dark: 'Tema: mörkt. Byt till automatiskt',
  },
};

function themeState() {
  const stored = root.dataset.theme;
  return stored === 'light' || stored === 'dark' ? stored : 'auto';
}

function syncTheme() {
  const state = themeState();
  if (themeButton) {
    themeButton.setAttribute('aria-label', themeLabels[lang][state]);
  }
  // Browser chrome follows the page colour that is actually in effect.
  const paper = getComputedStyle(document.body).backgroundColor;
  themeMetas.forEach((meta) => { meta.content = paper; });
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
   The sky's colours as CSS custom properties. The home screen reads them
   from the city; the other pages borrow what it last showed.
   ------------------------------------------------------------------------- */

const SKIES = ['night', 'dawn', 'day', 'dusk'];
const TINTS = { top: '--sky-top', horizon: '--sky-horizon', accent: '--sky-accent' };
const HEX = /^#[0-9a-f]{6}$/i;

function paintSky(sky, tint) {
  // A new key of the day can turn the page's light (style.css), and the browser's chrome with it.
  if (SKIES.includes(sky) && root.dataset.sky !== sky) { root.dataset.sky = sky; syncTheme(); }
  for (const [key, prop] of Object.entries(TINTS)) {
    if (tint && HEX.test(tint[key])) root.style.setProperty(prop, tint[key]);
  }
}

if (!document.querySelector('canvas.wall')) {
  try {
    const kept = JSON.parse(sessionStorage.getItem('sky'));
    if (kept) paintSky(kept.sky, kept.tint);
  } catch (e) { /* no storage or an old value: the stylesheet's sky stands */ }
}

/* -------------------------------------------------------------------------
   Reveal: text blocks only. The class that hides them is added here, after
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
  // Every place is read before any class is written, so the page is laid out once here, not once per block.
  const tops = revealables.map((el) => el.getBoundingClientRect().top);
  root.classList.add('io');
  revealables.forEach((el, i) => (tops[i] < innerHeight ? el.classList.add('is-visible') : observer.observe(el)));
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

/* -------------------------------------------------------------------------
   The name is sized so its longest line runs the width it is given, whatever
   face it ends up set in. The stylesheet caps it and has a size without this.
   ------------------------------------------------------------------------- */

const nameEl = document.querySelector('.name');
let fitName = () => {};
if (nameEl) {
  const line = nameEl.firstElementChild;
  let queued = 0;
  const fit = () => {
    queued = 0;
    nameEl.style.removeProperty('--name-fit');
    const size = parseFloat(getComputedStyle(nameEl).fontSize);
    const width = line.getBoundingClientRect().width;
    if (width > 0) nameEl.style.setProperty('--name-fit', `${((size * nameEl.clientWidth) / width).toFixed(2)}px`);
  };
  fitName = () => { if (!queued) queued = requestAnimationFrame(fit); };
  fit();
  document.fonts?.ready.then(fit);
  addEventListener('resize', fitName);
}

/* -------------------------------------------------------------------------
   Pages. A tab, a link or a throw of the bar's selection sends the pager to
   a page on a spring; a touch on the pager takes it back at once.
   ------------------------------------------------------------------------- */

const bar = document.querySelector('.tabbar');
let smed = null;
let appOpen = false;
let city = null;
let sun = null;
let wx = null;
let stopPage = null;
const smedEl = bar && bar.querySelector('.smed');
let awayTimer = 0;
let seated = false;
let actedAt = -Infinity;

// He stays on screen. Only under an open window does he shrink away, and he comes back when it closes.
function parkMascot() {
  if (!smedEl) return;
  const on = appOpen;
  smedEl.classList.toggle('is-seated', seated && !on);
  if (on === smedEl.classList.contains('is-parked')) return;
  clearTimeout(awayTimer);
  if (on) awayTimer = setTimeout(() => smedEl.classList.add('is-away'), 320);
  else {
    // Back in the layout first, so the way in is animated too.
    smedEl.classList.remove('is-away');
    smedEl.getBoundingClientRect();
  }
  smedEl.classList.toggle('is-parked', on);
}

// The header folds down to the mark and the dot once the page under it has
// scrolled, and opens again at the top. Folded, it has no room for what the
// status pill shows when open.
const masthead = document.querySelector('.masthead');
const island = document.querySelector('.island details');
// The header and the bar fold together, on one class on the root: after 48 px down, and open again 24 px
// up or near the top, so a page that wavers does not make them flicker. A new page starts from where it stands.
// A page with less than 160 px to scroll never folds them: there is nothing to make room for.
let folded = false;
let down = false;
let turned = 0;
// While the pages carry him away from Home he waits under the bar, as under a folded one.
let leaving = false;
// Off Home he also waits there while a page has more to read: he comes up only at a page's end, where
// nothing but its own margin is behind him, so he never stands on a line of text.
let reading = false;
const sink = () => smed?.duck?.(folded || leaving || reading);
function condense(fresh) {
  if (!masthead) return;
  const i = pager ? clamp(pageIndex(), 0, pages.length - 1) : -1;
  const page = pager ? pages[i] : document.documentElement;
  const y = page.scrollTop;
  // On the home page at rest the status stands on the sky itself; anywhere else it needs its glass.
  masthead.classList.toggle('is-bare', i === 0 && y <= 40 && !island?.open);
  if (fresh === true) { down = false; turned = y; }
  const room = page.scrollHeight - page.clientHeight;
  const fold = room >= 160
    && (fresh === true ? y > 48 : folded ? y >= 24 && (down || turned - y <= 24) : y > 48 && down && y - turned > 48);
  const read = i > 0 && y < room - 8;
  if (fold === folded && read === reading) return;
  reading = read;
  if (fold !== folded) {
    folded = fold;
    root.classList.toggle('is-folded', fold);
    if (fold && island) island.open = false;
  }
  // Bit goes down behind the folded bar and comes back up as it opens.
  sink();
}
island?.addEventListener('toggle', condense);

// Only Home keeps his lane. On the other tabs, and on a page of its own, the first screen is text to its edges,
// so once the pages rest he sits on the bar's top edge, smaller, and the page scrolls under him as under the bar.
function visitPage() {
  const was = seated;
  seated = !pager || pageIndex() > 0;
  if (seated && !was) smed?.play('sit');
  parkMascot();
}

// He answers what happens on the site, lightly: one act every few seconds at
// most. An act asked for mid-run waits in the figure until he stands still.
function cueMascot(name) {
  const now = performance.now();
  if (!smed || now - actedAt < 5000) return false;
  actedAt = now;
  smed.play(name);
  return true;
}

// The page a tab or a throw has sent the pager to, while it is on its way.
let pageGoal = null;

function settlePager() {
  if (stopPage) stopPage();
  stopPage = null;
  pageGoal = null;
}

// What follows the pager: the bar's selection, the layers' travel and the city's camera.
// A spring calls it in the frame it moves the pager; a finger's scroll calls it from the scroll event.
let follow = () => {};
// How far the pages have moved, kept as they move so no frame has to read it.
let paged = 0;

// A city nobody can see is not drawn: under a window, and behind a page other than Home once the pages rest.
// It wakes before the first frame that moves them.
let covered = false;
let away = false;
const pauseCity = (rest) => { away = rest; city?.setPaused(covered || away); };

function goToPage(i, speed = 0) {
  const to = i * pagerWidth;
  if (stopPage) stopPage();
  pauseCity(false);
  if (reduceMotion.matches) {
    settlePager();
    // No travel: the page is swapped and fades in.
    if (Math.abs(pager.scrollLeft - to) > 1) pager.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease' });
    pager.scrollLeft = to;
    return;
  }
  if (!speed && Math.abs(pager.scrollLeft - to) < 1) { settlePager(); return; }
  const s = { x: pager.scrollLeft, v: speed };
  pageGoal = i;
  stopPage = animate((dt) => {
    spring(s, to, 'page', dt);
    const there = Math.abs(s.x - to) < 0.5 && Math.abs(s.v) < 10;
    const x = there ? to : s.x;
    pager.scrollLeft = x;
    if (there) {
      stopPage = null;
      pageGoal = null;
    }
    // From the value just set, not read back: a read here would lay the page out a second time this frame.
    follow(x / Math.max(1, pagerWidth), false);
    return !there;
  });
}

/* -------------------------------------------------------------------------
   Travel. The pages are one space seen from a moving camera: what a page holds
   lies at different depths, so on the way between two pages the far layers
   lag, the near ones run ahead, shrink and fade, and everything turns a little
   toward where it is going. It is a pure function of how far the pager has
   scrolled, so it follows a finger exactly and settles with the page's spring.
   ------------------------------------------------------------------------- */

// Per page, back to front: the first layer lies nearest the city.
const strata = pages.map((page) => {
  const els = [...page.querySelectorAll(':scope > .shell > *')].flatMap((el) => (el.matches('.projects, .cv-side') ? [...el.children] : [el]));
  return els.map((el, k) => ({ el, z: els.length > 1 ? k / (els.length - 1) : 0.5 }));
});
const travelled = pages.map(() => 0);

function travel(p) {
  if (reduceMotion.matches) return;
  pages.forEach((page, i) => {
    const off = i - p;
    // A page that is out of sight, or at rest, carries no transform at all.
    const d = Math.abs(off) >= 1 || Math.abs(off) < 0.002 ? 0 : off;
    if (d === travelled[i]) return;
    travelled[i] = d;
    const a = Math.abs(d);
    for (const { el, z } of strata[i]) {
      if (!d) { el.style.transform = ''; el.style.opacity = ''; continue; }
      // Zero at both ends of the trip, so a layer neither starts nor lands with a step.
      const x = d * (1 - a) * pagerWidth * (z - 0.4) * 0.5;
      el.style.transform = `perspective(900px) translate3d(${x.toFixed(1)}px, 0, 0) rotateY(${(-d * (2 + 3 * z)).toFixed(2)}deg) scale(${(1 - a * (0.02 + 0.04 * z)).toFixed(4)})`;
      el.style.opacity = (1 - a * (0.15 + 0.35 * z)).toFixed(3);
    }
  });
}

// The deck of projects: where each card sticks while the next slides over it.
const deck = [...document.querySelectorAll('.pg .project')];
if (deck.length) {
  const page = deck[0].closest('.pg');
  const stuck = deck.map(() => '');
  const stack = () => {
    const style = getComputedStyle(page);
    // Sticky offsets count from the page's padding, which already clears the top bar.
    const room = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) + 16;
    // Every height is read before any offset is written, so the deck is laid out once, not once per card.
    const heights = deck.map((card) => card.offsetHeight);
    deck.forEach((card, i) => {
      const at = `${Math.round(Math.min(i * 10, room - heights[i]))}px`;
      if (at !== stuck[i]) { stuck[i] = at; card.style.setProperty('--stick', at); }
    });
  };
  const sized = new ResizeObserver(stack);
  deck.forEach((card) => sized.observe(card));
  addEventListener('resize', stack);
  stack();
}

function pageOfHash(hash) {
  const el = hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
  return el ? pages.indexOf(el.closest('.pg')) : -1;
}

/* -------------------------------------------------------------------------
   The bar. Its selection is a drop of brighter tint that lies inside the bar
   with the same gap all round. A tap sends the head to its tab on the pages'
   spring; the tail follows, so the drop stretches on the way and runs
   together where it lands. It lies along the bottom or stands as a rail.
   ------------------------------------------------------------------------- */

if (bar) {
  const tabs = [...bar.querySelectorAll('a')];
  // Positions are in tabs, not pixels, so the selection keeps its place while the bar changes size.
  const head = { x: 0, v: 0 };
  const tail = { x: 0, v: 0 };
  let aim = 0;
  let running = false;
  const draw = () => {
    const from = Math.min(head.x, tail.x);
    bar.style.setProperty('--l', from.toFixed(4));
    bar.style.setProperty('--ls', (Math.max(head.x, tail.x) + 1 - from).toFixed(4));
    tabs.forEach((a, k) => a.style.setProperty('--near', clamp(1 - Math.abs(head.x - k), 0, 1).toFixed(3)));
  };
  const run = () => {
    if (running) return;
    running = true;
    animate((dt) => {
      spring(head, aim, 'page', dt);
      spring(tail, head.x, 'move', dt);
      draw();
      const near = (s, to) => Math.abs(s.x - to) < 0.002 && Math.abs(s.v) < 0.05;
      const still = near(head, aim) && near(tail, head.x);
      if (still) { head.x = aim; tail.x = aim; head.v = 0; tail.v = 0; draw(); running = false; }
      return !still;
    });
  };
  // Send the selection to tab x: at once on arrival, else on the pages' spring.
  const place = (x, jump) => {
    aim = x;
    if (jump || reduceMotion.matches) { head.x = x; tail.x = x; head.v = 0; tail.v = 0; draw(); } else run();
    bar.classList.add('has-lens');
  };
  const syncLens = () => {
    if (pager) return;
    const i = tabs.findIndex((a) => a.hasAttribute('aria-current'));
    if (i >= 0) place(i, true);
    else bar.classList.remove('has-lens');
  };
  syncLens();

  if (pager) {
    const first = pageOfHash(location.hash);
    if (first > 0) pager.scrollLeft = first * pagerWidth;
    let current = -1;
    // What waits for the trip to end: the mascot's walk to the new tab and the
    // pixel face the other pages set their labels in. While the pager travels,
    // and for 300 ms after it and the finger have come to rest, nothing else starts.
    let fingers = false;
    let restTimer = 0;
    const rested = () => {
      clearTimeout(restTimer);
      restTimer = setTimeout(() => {
        if (fingers || stopPage) return;
        if (current > 0) document.body.classList.add('px');
        // Away from Home he keeps his seat on the bar; only Home sends him back to his own tab. Waiting under
        // the bar, he is let up first and sent on at once: one rise, straight to his place.
        leaving = false;
        sink();
        if (current > 0) smed?.play('sit'); else smed?.goTo(0);
        // Whether he stays is settled here, once the pages are at rest: never while a finger or a spring moves them.
        visitPage();
        pauseCity(current > 0);
      }, 300);
    };
    follow = (p, jump) => {
      // Sent to a tab, the selection goes straight there and the page follows.
      place(pageGoal ?? p, jump);
      paged = p;
      travel(p);
      city?.setProgress(p);
      const i = clamp(Math.round(p), 0, tabs.length - 1);
      // Off Home, by a tab, a throw or a page dragged past halfway, he goes under at once: never over a page's text.
      const leave = !seated && (pageGoal ?? i) > 0;
      if (leave !== leaving) { leaving = leave; sink(); }
      if (i !== current) {
        current = i;
        tabs.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
        // His words belong to the page they were said on.
        smedEl?.classList.remove('is-saying');
        condense(true);
        history.replaceState(history.state, '', i === 0 ? location.pathname + location.search : `#${pages[i].id}`);
      }
      rested();
    };
    follow(pageAt(), true);
    // A spring that is carrying the pager has already said where it is, in the same frame.
    pager.addEventListener('scroll', () => { if (!stopPage) follow(pageAt(), false); }, { passive: true });
    pager.addEventListener('touchstart', () => { fingers = true; }, { passive: true });
    for (const type of ['touchend', 'touchcancel']) pager.addEventListener(type, (e) => { fingers = e.touches.length > 0; rested(); }, { passive: true });
    addEventListener('resize', () => { settlePager(); pager.scrollLeft = current * pagerWidth; follow(current, true); });
    // A swipe. Once a finger has moved 7 px across more than down, the pages follow it 1:1, painted once a frame;
    // let go, half a page or a throw sends them on, and the throw's speed goes on in the spring. A touch takes a
    // page in flight where it is. Up and down, and the CV's own index, scroll as they would.
    const swipe = tracker();
    let from = null;
    let to = 0;
    let frame = 0;
    pager.addEventListener('touchstart', (e) => {
      settlePager();
      const t = e.touches[0];
      // Where the pages stand is kept as they move, so a touch reads no layout.
      from = e.touches.length === 1 && !e.target.closest('.cv__index') ? { x: t.clientX, y: t.clientY, left: paged * pagerWidth, on: false } : null;
    }, { passive: true });
    pager.addEventListener('touchmove', (e) => {
      if (!from) return;
      const { clientX: x, clientY: y } = e.touches[0];
      if (!from.on) {
        if (Math.hypot(x - from.x, y - from.y) < 7) return;
        if (Math.abs(x - from.x) <= Math.abs(y - from.y)) { from = null; return; }
        from = { ...from, x, on: true };
        pauseCity(false);
      }
      swipe.add(e.timeStamp, x);
      to = clamp(from.left - (x - from.x), 0, (pages.length - 1) * pagerWidth);
      frame ||= requestAnimationFrame(() => { frame = 0; pager.scrollLeft = to; });
    }, { passive: true });
    // A touch the browser takes back ends the swipe as a lift would, so the pages never stop between two.
    const lift = (e) => {
      if (!from?.on || e.touches.length) return;
      const [v] = swipe.speed(e.timeStamp);
      const start = Math.round(from.left / pagerWidth);
      const p = to / pagerWidth;
      from = null;
      cancelAnimationFrame(frame);
      frame = 0;
      goToPage(clamp(Math.abs(v) > 300 ? start - Math.sign(v) : Math.round(p), Math.max(0, start - 1), Math.min(pages.length - 1, start + 1)), -v);
    };
    for (const type of ['touchend', 'touchcancel']) pager.addEventListener(type, lift, { passive: true });
    // A sideways wheel or trackpad turns one page per gesture.
    let wheel = 0;
    let quiet = 0;
    pager.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      clearTimeout(quiet);
      quiet = setTimeout(() => { wheel = 0; }, 300);
      if (wheel === null) return;
      wheel += e.deltaX;
      if (Math.abs(wheel) < 50) return;
      goToPage(clamp(current + Math.sign(wheel), 0, pages.length - 1));
      wheel = null;
    }, { passive: true });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.dataset.sheet || a.dataset.to || e.metaKey || e.ctrlKey) return;
      const i = pageOfHash(a.hash);
      if (i < 0) return;
      e.preventDefault();
      goToPage(i);
    });
  }

  bar.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || pager) return;
    const i = tabs.indexOf(a);
    place(i, false);
    smed?.goTo(i);
  });

  let lastY = scrollTop();
  let ticking = false;
  let hopped = false;
  let still = 0;
  const onVertical = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollTop();
      if (y !== lastY && y > lastY !== down) { down = y > lastY; turned = lastY; }
      // One hop for a fast scroll, not one a frame: he hops again only after the page has rested.
      if (Math.abs(y - lastY) > 90 && !hopped) { hopped = true; smed?.hop(); }
      clearTimeout(still);
      still = setTimeout(() => { hopped = false; }, 300);
      lastY = y;
      // condense reads the page before anything is written; parkMascot only writes.
      condense();
      parkMascot();
    });
  };
  (pager ? pages : [window]).forEach((s) => s.addEventListener('scroll', onVertical, { passive: true }));
}

/* -------------------------------------------------------------------------
   The sun is the clock. It stands in the sky left of the tower where the sun
   over Malmö stands on its way from sunrise to sunset, and the moon makes the
   same crossing by night. Take hold of it, or focus it and use the arrow
   keys, and it runs the city's day; let go and it springs back to now. It
   needs no city to draw: over the still picture it is the same sun.
   ------------------------------------------------------------------------- */

const malmoTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
const malmoDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', month: 'numeric', day: 'numeric', timeZoneName: 'shortOffset' });
const clockText = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
const minutesOf = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
// `?hour=N` starts the page at another hour on Malmö's clock.
const preview = new URLSearchParams(location.search).get('hour');
const asked = preview === null ? null : Number(preview);
const malmoNow = () => (asked === null ? minutesOf(malmoTime.format(new Date())) : asked * 60);
// How far Malmö's day has run, for the dot on the arc under the page titles.
root.style.setProperty('--day', (minutesOf(malmoTime.format(new Date())) / 1440).toFixed(3));
let dialHeld = false;
// Set once the city is up: it paints its sky's colours into the stylesheet.
let showSky = () => {};

// Today's sun over Malmö, by the same sums the city lights itself with: the hours it rises, stands
// highest and sets, and its height at any hour as the sine of its elevation, so 0 is the horizon.
function sunPath(date) {
  const part = Object.fromEntries(malmoDate.formatToParts(date).map((p) => [p.type, p.value]));
  const offset = parseInt(part.timeZoneName.replace('GMT', ''), 10) || 0;
  const doy = (Date.UTC(date.getUTCFullYear(), part.month - 1, part.day) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000 + 1;
  const lat = (55.6 * Math.PI) / 180;
  // Declination and the equation of time by Spencer's series: sunrise and sunset to a few minutes.
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  const wave = (c1, s1, c2, s2) => c1 * Math.cos(g) + s1 * Math.sin(g) + c2 * Math.cos(2 * g) + s2 * Math.sin(2 * g);
  const tilt = 0.006918 + wave(-0.399912, 0.070257, -0.006758, 0.000907) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // Noon by the sun: Malmö lies 13 degrees east, the clock's meridian 15 for each hour of its offset.
  const noon = 12 + offset - 13 / 15 - (3.82 * (0.000075 + wave(0.001868, -0.032077, -0.014615, -0.040849)));
  // Sunrise and sunset are when the disc's top meets the horizon: its centre 0.833 degrees below it.
  const half = (Math.acos(clamp((-0.01454 - Math.sin(lat) * Math.sin(tilt)) / (Math.cos(lat) * Math.cos(tilt)), -1, 1)) * 12) / Math.PI;
  return { rise: noon - half, noon, set: noon + half, height: (hour) => Math.sin(lat) * Math.sin(tilt) + Math.cos(lat) * Math.cos(tilt) * Math.cos(((hour - noon) * Math.PI) / 12) };
}

function mountSun(el, sky) {
  const DAY = 1440;
  const path = sunPath(new Date());
  const rise = path.rise * 60;
  const set = path.set * 60;
  const noon = path.noon * 60;
  const high = path.height(path.noon);
  const deep = -path.height(path.noon + 12);
  const dark = DAY - (set - rise);
  const wrap = (m) => ((m % DAY) + DAY) % DAY;
  // The minute nearest `ref` that reads `m` on the clock, so a spring takes the short way round.
  const near = (m, ref) => m + DAY * Math.ceil((ref - m) / DAY - 0.5);
  // Where a minute lies on the crossing: `t` is how far across, by day from sunrise to sunset and by
  // night from sunset to sunrise, and `up` how high, as a share of the sun's highest today or, for
  // the moon, of how deep the sun then stands under the horizon.
  const spot = (m) => {
    const day = m >= rise && m <= set;
    const h = path.height(m / 60);
    return { day, t: day ? (m - rise) / (set - rise) : wrap(m - set) / dark, up: Math.max(0, day ? h / high : -h / deep) };
  };
  // Day and night end to end, 0 to 2: how far along a minute lies, and the minute at a place.
  const along = (m) => { const s = spot(wrap(m)); return s.day ? s.t : 1 + s.t; };
  const minuteAt = (a) => { const u = ((a % 2) + 2) % 2; return u <= 1 ? rise + u * (set - rise) : set + (u - 1) * dark; };
  // What the handle says beside the time: the sun's next set or rise. Swedish weather pages write "sol ned"
  // and "sol upp".
  const words = { en: ['Sunset', 'Sunrise'], sv: ['Sol ned', 'Sol upp'] }[lang];
  const stateAt = (m) => (m >= rise && m < set ? `${words[0]} ${clockText(set)}` : `${words[1]} ${clockText(rise)}`);
  // The stylesheet's sky for a minute, for when there is no city to say.
  const skyAt = (m) => (m < rise - 48 || m > set + 48 ? 'night' : m < rise + 60 ? 'dawn' : m > set - 60 ? 'dusk' : 'day');

  // The path the handle shows while held. The city draws the sun and the moon where the handle stands.
  sky.innerHTML = '<svg class="sky__arc"><path/><path/><path/></svg>';
  const [base, dayArc, nightArc] = sky.firstChild.children;
  const hand = el.querySelector('.sun__hand');
  const clock = document.querySelector('[data-clock]');
  const alm = el.previousElementSibling;
  const eye = alm.firstElementChild;
  const here = eye.textContent;

  let shown = malmoNow();
  let want = shown;
  let held = false;
  let grab = null;
  let moving = null;
  let said = -1;
  const dial = { x: shown, v: 0 };

  // The room the crossing has, read when it can change and never during a drag: where it starts in
  // the window, how far across it runs, the line it rises from and how high it goes.
  let box = null;
  const gauge = () => {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return false;
    // The room the sun takes: `--orb` across, its disc and close glow 11 and its bloom 24 units of 80.
    const orb = parseFloat(getComputedStyle(el).getPropertyValue('--orb'));
    const disc = (orb * 11) / 80;
    // The crossing rises from the tower's foot, where the room reaches it; the city sets a low sun behind
    // its roofs.
    const ground = parseFloat(screenEl.style.getPropertyValue('--tower-b')) - el.offsetTop - disc / 2;
    // At its highest the sun keeps its bloom in its room, clear of the almanac. In a room lower than that
    // it crosses flat along the room's foot, above the icons and as far from the words as it can.
    const low = h < orb;
    const clear = (orb * 24) / 80 + 2;
    const foot = low ? h - disc - 2 : Math.max(clear, Math.min(h - disc - 4, ground || Infinity));
    const lift = low ? 0 : Math.min(foot - clear, w * 0.5);
    // `in` is where the crossing starts inside the box, `x` and `y` where that is in the window.
    const r = hand.offsetWidth / 2;
    const above = Math.max(0, el.getBoundingClientRect().top - Math.max(...[alm, alm.previousElementSibling].map((e) => e.getBoundingClientRect().bottom)));
    box = { in: disc + 4, x: el.offsetLeft + disc + 4, y: el.offsetTop, span: w - 2 * disc - 8, foot, lift, lo: r - above, hi: h - r };
    const at = (t, up) => `${(box.x + t * box.span).toFixed(1)} ${(box.y + foot - up * lift).toFixed(1)}`;
    const run = (from, to) => `M${Array.from({ length: 49 }, (_, i) => { const s = spot(wrap(from + ((to - from) * i) / 48)); return at(i / 48, s.up); }).join('L')}`;
    // The line of the horizon with a tick at each end and under the highest point, then the two crossings.
    const tick = (t) => `M${at(t, 0)}v6`;
    base.setAttribute('d', `M${at(0, 0)}L${at(1, 0)}${tick(0)}${tick(0.5)}${tick(1)}`);
    dayArc.setAttribute('d', run(rise, set));
    nightArc.setAttribute('d', run(set, rise + DAY));
    return true;
  };
  // The handle rests on the disc the city drew, else on the page's spot, kept between the words above
  // the room and the room's foot, off the icons.
  let spotAt = [0, 0];
  let drawn = null;
  let placed = [NaN, NaN];
  const place = () => {
    if (!box) return;
    const [x, at] = drawn ? [drawn.x - box.x + box.in, drawn.y - box.y] : spotAt;
    const y = box.lo > box.hi ? (box.lo + box.hi) / 2 : Math.max(box.lo, Math.min(at, box.hi));
    if (Math.abs(x - placed[0]) <= 0.5 && Math.abs(y - placed[1]) <= 0.5) return;
    placed = [x, y];
    hand.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };
  const draw = (again) => {
    if (again === true) said = -1;
    if (!box) return;
    const m = wrap(shown);
    const s = spot(m);
    const x = s.t * box.span;
    const y = box.foot - s.up * box.lift;
    spotAt = [box.in + x, y];
    place();
    // The city draws the sun or the moon here, with its glow and its light on the water. By night it also
    // hears where the sun went down or will come up: the glow of dusk and of dawn belongs there.
    city?.setSun?.(box.x + x, box.y + y, s.day);
    if (!s.day) city?.setSun?.(box.x + (s.t < 0.5 ? box.span : 0), box.y + box.foot, true);
    const wasNight = sky.classList.contains('is-night');
    sky.classList.toggle('is-night', !s.day);
    sky.classList.toggle('is-held', held);
    el.classList.toggle('is-held', Boolean(grab));
    alm.classList.toggle('is-held', held);
    if (held && !wasNight && !s.day) cueMascot('surprise');
    if (Math.floor(m) === said) return;
    // A new minute at rest comes in softly; under a finger, or drawn again, it is there at once.
    if (said >= 0 && !dialHeld && !reduceMotion.matches) clock.animate([{ opacity: 0.35 }, {}], 240);
    said = Math.floor(m);
    clock.textContent = clockText(m);
    hand.setAttribute('aria-valuenow', String(said));
    hand.setAttribute('aria-valuetext', `${clockText(m)}, ${stateAt(m)}`);
    // The forecast for the minute shown, from now to a day ahead, and above the clock how far ahead that is.
    const ahead = Math.round(wrap(m - minutesOf(malmoTime.format(new Date())) + 30) - 30);
    const hours = Math.round((wrap(m - malmoNow() + 30) - 30) / 60);
    eye.textContent = hours < 1 ? here : eye.dataset.ahead.replace('#', hours);
    wx?.show(Date.now() + ahead * 60000);
    if (!city) paintSky(skyAt(m));
  };
  // Hand the hour to the city while the sun is held, and give it back to the real clock after.
  const show = () => {
    dialHeld = held || Boolean(moving);
    city?.setHour(dialHeld ? wrap(shown) / 60 : asked);
    showSky();
    draw();
  };
  // The sun follows what is asked of it on a spring: quick under a finger, calm on the way back to
  // the real time.
  const run = () => {
    if (moving) return;
    moving = animate((dt) => {
      const before = dial.x;
      const goal = held ? want : near(malmoNow(), dial.x);
      spring(dial, goal, held ? 'quick' : 'calm', dt);
      // A tick at sunrise, noon and sunset: a phone that can, taps as the finger passes one.
      for (const mark of [rise, noon, set]) {
        const at = near(mark, before);
        if ((at - before) * (at - dial.x) < 0 && grab && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(6);
      }
      const still = Math.abs(dial.x - goal) < 0.5 && Math.abs(dial.v) < 6;
      if (still) { moving = null; dial.x = goal; dial.v = 0; }
      shown = dial.x;
      show();
      return !still;
    });
  };
  const hold = (minutes) => {
    held = true;
    want = minutes;
    if (!reduceMotion.matches) { run(); return; }
    dial.x = want;
    shown = want;
    show();
  };
  const release = () => {
    if (!held) return;
    held = false;
    grab = null;
    if (!reduceMotion.matches) { run(); return; }
    shown = malmoNow();
    dial.x = shown;
    show();
  };

  hand.setAttribute('role', 'slider');
  hand.setAttribute('tabindex', '0');
  hand.setAttribute('aria-label', hand.dataset.dial);
  hand.setAttribute('aria-valuemin', '0');
  hand.setAttribute('aria-valuemax', String(DAY - 1));
  el.dataset.live = '';
  new ResizeObserver(() => { if (gauge()) draw(); }).observe(el);
  addEventListener('resize', () => { if (gauge()) draw(); });
  setInterval(() => { if (!dialHeld) { shown = malmoNow(); dial.x = shown; draw(); } }, 20000);

  // The body goes as far across as the finger does. Past sunset the moon comes up where the sun did.
  hand.addEventListener('pointerdown', (e) => {
    if (e.button || !gauge()) return;
    hand.setPointerCapture(e.pointerId);
    grab = { x: e.clientX, from: along(dial.x), id: e.pointerId };
    hold(dial.x);
  });
  hand.addEventListener('pointermove', (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    hold(near(minuteAt(grab.from + (e.clientX - grab.x) / box.span), want));
  });
  const drop = () => { if (grab) release(); };
  hand.addEventListener('pointerup', drop);
  hand.addEventListener('pointercancel', drop);
  hand.addEventListener('keydown', (e) => {
    const turn = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 60, PageDown: -60 }[e.key];
    if (turn) hold(Math.round((held ? want : shown) / 15) * 15 + turn);
    else if (e.key === 'Home') hold(0);
    else if (e.key === 'End') hold(DAY - 1);
    else if (e.key === 'Escape') release();
    else return;
    e.preventDefault();
  });
  hand.addEventListener('blur', release);

  return {
    // Draw again: the city or the weather has just come.
    draw: () => draw(true),
    follow: (disc) => { drawn = disc || null; place(); },
    // Whether the sun is up at a moment, for the forecast's symbols.
    dayAt: (ms) => path.height(minutesOf(malmoTime.format(new Date(ms))) / 60) > 0,
  };
}

{
  const el = document.querySelector('.sun');
  const sky = document.querySelector('.sky');
  if (el && sky) {
    sun = mountSun(el, sky);
    // The weather comes once the page has loaded, so it never holds up the first picture. Without it the
    // almanac keeps to the clock and the sun.
    const alm = document.querySelector('.alm');
    const start = () => {
      const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/assets/css/sky.css' });
      document.head.append(css);
      Promise.all([import('./weather.js'), new Promise((done) => { css.onload = css.onerror = done; })]).then(([{ mountWeather }]) => {
        wx = mountWeather(alm, { lang, dayAt: sun.dayAt, city: () => city, asked });
        sun.draw();
      }, () => { /* offline or blocked: the almanac keeps to the clock and the sun */ });
    };
    if (alm && document.readyState === 'complete') start();
    else if (alm) addEventListener('load', start, { once: true });
  }

}

/* -------------------------------------------------------------------------
   Depth. The pointer, or the tilt of a phone that reports it without asking,
   moves the light on the glass and drifts the home screen's layers a few
   pixels against the city. `lean` runs from -1 to 1 on each axis.
   ------------------------------------------------------------------------- */

const lean = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, tx: 0, ty: 0 };
// What drifts, and how many pixels at full lean: more the nearer the eye.
const drifters = [['.name', 3], ['.who', 5], ['.alm', 5], ['.apps', 7], ['.pg .head', 4]].flatMap(([sel, depth]) => [...document.querySelectorAll(sel)].map((el) => ({ el, depth })));
if (screenEl && !reduceMotion.matches) {
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    lean.tx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    lean.ty = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
  }, { passive: true });
  // iOS asks the visitor before it reports tilt; a portfolio does not ask.
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    let rest = null;
    addEventListener('deviceorientation', (e) => {
      if (e.gamma === null || e.beta === null) return;
      rest ??= { gamma: e.gamma, beta: e.beta };
      lean.tx = clamp((e.gamma - rest.gamma) / 22, -1, 1);
      lean.ty = clamp((e.beta - rest.beta) / 22, -1, 1);
    }, { passive: true });
  }
}

/* -------------------------------------------------------------------------
   The 3D city: its sky in the stylesheet, its tower in the layout, the glass
   bending it, and the dial that runs its day.
   ------------------------------------------------------------------------- */

const wallCanvas = document.querySelector('canvas.wall');
let cityMounted = Promise.resolve();

if (wallCanvas) {
  // The city is asked for once the first picture is on the screen, so the stylesheet and the fonts have
  // the line to themselves until then. The mascot starts after the city, but his file is fetched beside
  // it: two round trips at once, not one after the other. The shader glass waits for the city's first
  // frame; until then every shape is the stylesheet's glass.
  const painted = new Promise((done) => { requestAnimationFrame(() => setTimeout(done)); });
  cityMounted = painted.then(() => {
    if (smedEl) {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = '/assets/js/smed3d.js';
      document.head.append(link);
    }
    return import('./city.js');
  }).then(async ({ mountCity }) => {
    // The hour the city starts at: `?hour=N`, else now. It is an hour on
    // Malmö's clock, so the answer is the nearest moment that clock reads
    // it, wherever the visitor is.
    const at = () => {
      if (asked === null) return new Date();
      return new Date(Date.now() + (asked * 60 - minutesOf(malmoTime.format(new Date()))) * 60000);
    };
    city = mountCity(wallCanvas, { at, front: document.querySelector('.wall-front') });
    // Without WebGL 2 the still of the night stands, so the words take the light ink whatever the hour.
    if (!city) { root.classList.add('no-gl'); delete screenEl.dataset.top; delete screenEl.dataset.foot; return; }
    // The city fades in over the screen's sky once it has drawn, not when its context is made.
    const drawn = () => { if (!root.classList.contains('has-city')) root.classList.add('has-city'); };
    city.onFrame(drawn);
    if (pager) city.setProgress(pageAt());
    sun?.draw();

    showSky = () => {
      const sky = city.sky;
      const tint = city.tint;
      paintSky(sky, tint);
      if (dialHeld) return;
      try { sessionStorage.setItem('sky', JSON.stringify({ sky, tint })); } catch (e) { /* the other pages keep the stylesheet's sky */ }
    };
    showSky();
    setInterval(() => { if (!dialHeld) showSky(); }, 30000);

    // Which side the tower stands on, and where its near edge is, so the
    // layout can keep the name and the widgets clear of it.
    let towerAt = '';
    const placeTower = () => {
      const box = city.towerRect();
      if (!screenEl || !box.w) return;
      const next = `${Math.round(box.x)} ${Math.round(box.x + box.w)} ${Math.round(box.y + box.h)}`;
      if (next === towerAt) return;
      towerAt = next;
      screenEl.style.setProperty('--tower-l', `${Math.round(box.x)}px`);
      screenEl.style.setProperty('--tower-r', `${Math.round(box.x + box.w)}px`);
      screenEl.style.setProperty('--tower-b', `${Math.round(box.y + box.h)}px`);
      screenEl.dataset.tower = box.x + box.w / 2 < wallCanvas.clientWidth / 2 ? 'left' : 'right';
      fitName();
    };

    // Every glass shape over the city gets the scene itself, bent at its rim.
    // This loop is the only place a shape is handed to the shader, and it
    // passes over anything that lies on another: one glass per place.
    let glass = null;
    const lensed = [];
    let glassAsked = reduceGlass.matches;
    const lens = async () => {
      glass = (await import('./glass.js')).mountGlass(wallCanvas);
      if (!glass) return;
      const body = bar && bar.querySelector('.tabbar__body');
      // Only the small shapes: the bar, the chips and the quiet button on the sky. The cards on the pages are plain.
      for (const el of [body, ...screenEl.querySelectorAll('.glass, .cv-actions .btn--quiet')]) {
        if (!el || el.parentElement.closest('.glass, .glass-card')) continue;
        glass.add(el, { blur: 2.5 });
        lensed.push(el);
      }
      // The rim's turn is written again for the shapes just handed over.
      turned = null;
    };
    // Tell the city how much of its foot the interface covers: the bar, the mascot's lane over it and
    // the row of apps where that stands on the lane. A rail covers none of it. And how far down the words
    // at the top reach, with the apps where they stand on the sky.
    const words = [...document.querySelectorAll('.masthead, .name, .who, .alm')];
    const cover = () => {
      if (!bar) return;
      const lane = bar.getBoundingClientRect().top - parseFloat(getComputedStyle(screenEl).getPropertyValue('--lane'));
      const apps = appsGrid?.getBoundingClientRect();
      const low = apps && apps.bottom > lane - 24 && !rail.matches;
      city.setUiBottom?.(rail.matches ? 0 : Math.max(0, innerHeight - (low ? apps.top : lane)));
      city.setUiTop?.(Math.ceil(Math.max(...words.map((el) => el.getBoundingClientRect().bottom), low ? 0 : apps?.bottom || 0) + 4));
    };
    let n = 0;
    placeTower();
    cover();
    addEventListener('resize', () => { placeTower(); cover(); });
    // In a small window the row is still on its way when the resize is heard: the name is fitted a frame later.
    const sized = new ResizeObserver(cover);
    for (const el of [appsGrid?.parentElement, ...words]) if (el) sized.observe(el);
    // The ink the city asks for the words at the top and at the foot; a rail's apps stand with the top.
    let inked = '';
    city.onFrame(() => {
      drawn();
      if (!glassAsked) { glassAsked = true; lens(); }
      n += 1;
      if (n % 30 === 2 && pageAt() < 0.01) placeTower();
      glass?.refresh();
      sun?.follow(city.sunPx);
      const ink = city.ink;
      const key = ink && ink.top + ink.bottom + rail.matches;
      if (!key || key === inked) return;
      inked = key;
      screenEl.dataset.top = ink.top;
      screenEl.dataset.foot = rail.matches ? ink.top : ink.bottom;
    });

    // One loop for the light, the drift and the glass. The rim's bright
    // corner turns with the lean and with the page.
    // Under an open window only a sheet leaves the home screen in view.
    // The status in the header is glass only while it is not standing bare on the sky.
    const live = (el) => (!root.dataset.app || (sheet.matches && screenEl.contains(el))) && !(el.closest('.island') && masthead.classList.contains('is-bare'));
    let turned = null;
    let drifted = '';
    let before = 0;
    let moved = 0;
    let checked = 0;
    const stir = () => { moved = performance.now(); };
    for (const type of ['scroll', 'pointerdown', 'pointermove', 'transitionrun', 'toggle']) addEventListener(type, stir, { passive: true, capture: true });
    addEventListener('resize', stir);
    const frame = (now) => {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(0.1, Math.max(0.001, (now - before) / 1000));
      before = now;
      spring(lean.x, lean.tx, 'calm', dt);
      spring(lean.y, lean.ty, 'calm', dt);
      const drift = `${lean.x.x.toFixed(2)} ${lean.y.x.toFixed(2)}`;
      if (drift !== drifted) moved = now;
      // Nothing has moved and the city has no new frame: the glass stands as
      // it is. A slow check still catches what no event announces. The glass
      // reads where the shapes stand before this frame writes, so no layout is forced.
      const look = steppers.size > 0 || now - moved < 400 || glass?.stale || now - checked >= 500;
      const turn = Math.round(clamp(lean.x.x * 26 + Math.sin(paged * 1.4) * 16, -40, 40));
      const angle = ((225 + turn) * Math.PI) / 180;
      // Until the city has drawn there is no scene to bend: the stylesheet's glass stands.
      if (look && root.classList.contains('has-city')) glass?.frame(now, [Math.cos(angle), Math.sin(angle)], live);
      if (drift !== drifted) {
        drifted = drift;
        for (const { el, depth } of drifters) el.style.translate = `${(-lean.x.x * depth).toFixed(2)}px ${(-lean.y.x * depth).toFixed(2)}px`;
        // The camera leans the same way, so the pier slides against the far shore.
        city.setLean(lean.x.x, lean.y.x);
      }
      if (!look) return;
      checked = now;
      if (turn !== turned) {
        turned = turn;
        for (const el of lensed) el.style.setProperty('--rim', `${135 + turn}deg`);
      }
    };
    requestAnimationFrame(frame);
  });
}

/* -------------------------------------------------------------------------
   The mascot: drawn live in 3D where the browser can, else one still picture
   that answers a tap. It waits for the city, to share its pixel size and its
   light.
   ------------------------------------------------------------------------- */

if (smedEl) {
  // The city's key light, turned into the mascot's view: its camera looks
  // down -z, the city's has swung by its yaw.
  const light = () => {
    if (!city) return null;
    const lit = city.light;
    const [x, y, z] = lit.sun;
    const cos = Math.cos(city.yaw);
    const sin = Math.sin(city.yaw);
    return { ...lit, sun: [cos * x + sin * z, y, cos * z - sin * x] };
  };
  const mountMascot = async () => {
    try {
      const { mountSmed3D } = await import('./smed3d.js');
      const live = await mountSmed3D(smedEl, bar, { light });
      if (live) return live;
    } catch (e) { /* no 3D module, or it could not start: the still takes over */ }
    const lines = JSON.parse(smedEl.dataset.lines || '[]');
    const say = smedEl.querySelector('.smed__say');
    let sayTimer = 0;
    smedEl.classList.replace('smed--live', 'smed--still');
    smedEl.addEventListener('click', () => {
      say.textContent = lines[Math.floor(Math.random() * lines.length)] || smedEl.dataset.hello;
      smedEl.classList.add('is-saying');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => smedEl.classList.remove('is-saying'), 1800);
    });
    return { goTo() {}, hop() {}, play() {} };
  };
  smedEl.classList.add('smed--live');
  const idle = () => new Promise((done) => { (window.requestIdleCallback || setTimeout)(done, { timeout: 1500 }); });
  cityMounted.then(idle, idle).then(mountMascot).then((api) => {
    smed = api;
    if (api.first) cueMascot('dance');
    else if (location.pathname.endsWith('/cv/')) cueMascot('think');
  });
  visitPage();
  // A wave goodbye on the way to the other language; the page that opens says hello in it.
  document.addEventListener('click', (e) => { if (e.target.closest('a[hreflang]')) cueMascot('wave'); });

  // Late at night in Malmö he does not wait up: left alone he yawns and goes
  // to sleep, until something is touched.
  let dozeTimer = 0;
  const stir = () => {
    clearTimeout(dozeTimer);
    dozeTimer = setTimeout(() => {
      if (dialHeld || appOpen || city?.nextSun.kind !== 'rise' || !cueMascot('yawn')) return;
      dozeTimer = setTimeout(() => smed.play('sleep'), 3200);
    }, 8000);
  };
  for (const type of ['pointerdown', 'keydown', 'scroll']) addEventListener(type, stir, { passive: true, capture: true });
  stir();
}

/* -------------------------------------------------------------------------
   The status pill and the jiggle.
   ------------------------------------------------------------------------- */

if (island) {
  document.addEventListener('pointerdown', (e) => { if (island.open && !island.contains(e.target)) island.open = false; });
}

const appsGrid = document.querySelector('.apps');
if (appsGrid) {
  let timer = 0;
  let longPress = false;
  const stop = () => clearTimeout(timer);
  appsGrid.addEventListener('pointerdown', () => {
    longPress = false;
    timer = setTimeout(() => {
      longPress = true;
      if (reduceMotion.matches) return;
      appsGrid.classList.add('is-jiggling');
      setTimeout(() => appsGrid.classList.remove('is-jiggling'), 2200);
    }, 480);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((t) => appsGrid.addEventListener(t, stop));
  appsGrid.addEventListener('contextmenu', (e) => e.preventDefault());
  appsGrid.addEventListener('click', (e) => {
    if (longPress) { e.preventDefault(); e.stopImmediatePropagation(); longPress = false; }
  }, true);
}

/* -------------------------------------------------------------------------
   Rows of screens. Touch scrolls and snaps them natively; a mouse can take
   hold of a row, throw it, and it lands on the screen the throw would reach.
   ------------------------------------------------------------------------- */

{
  let row = null;
  let stopRow = null;
  const finger = tracker();
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.shots');
    if (!el || e.pointerType !== 'mouse' || e.button || el.scrollWidth <= el.clientWidth) return;
    if (stopRow) stopRow();
    row = { el, x: e.clientX, from: el.scrollLeft, id: e.pointerId, moved: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!row || e.pointerId !== row.id) return;
    if (!row.moved && Math.abs(e.clientX - row.x) < 6) return;
    if (!row.moved) { row.moved = true; row.el.classList.add('is-held'); row.el.setPointerCapture(e.pointerId); }
    finger.add(e.timeStamp, e.clientX);
    const want = row.from - (e.clientX - row.x);
    const past = want - clamp(want, 0, row.el.scrollWidth - row.el.clientWidth);
    row.el.scrollLeft = want;
    // Past either end the row gives, as a scroll edge does, and comes back when let go.
    row.el.style.translate = past ? `${(-Math.sign(past) * rubber(Math.abs(past), row.el.clientWidth)).toFixed(1)}px 0` : '';
  });
  const drop = (e) => {
    if (!row || e.pointerId !== row.id) return;
    const { el, moved } = row;
    row = null;
    if (!moved) return;
    el.style.translate = '';
    const [speed] = finger.speed(e.timeStamp);
    const max = el.scrollWidth - el.clientWidth;
    const aim = el.scrollLeft - speed * 0.3;
    // The screen whose middle is nearest where the throw would stop.
    const stops = [...el.children].map((c) => clamp(c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, 0, max));
    const to = stops.reduce((best, s) => (Math.abs(s - aim) < Math.abs(best - aim) ? s : best), stops[0]);
    const s = { x: el.scrollLeft, v: -speed };
    const done = () => { stopRow = null; el.classList.remove('is-held'); };
    if (reduceMotion.matches) { el.scrollLeft = to; done(); return; }
    const cancel = animate((dt) => {
      spring(s, to, 'move', dt);
      el.scrollLeft = s.x;
      if (Math.abs(s.x - to) < 0.5 && Math.abs(s.v) < 8) { el.scrollLeft = to; done(); return false; }
      return true;
    });
    stopRow = () => { cancel(); done(); };
  };
  document.addEventListener('pointerup', drop);
  document.addEventListener('pointercancel', drop);
  // A drag is not a click on whatever it ended over.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.shots.is-held')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

/* -------------------------------------------------------------------------
   The CV's section index: a tap rides a spring to the section, and the
   index shows which section is being read. It works in the page and in the
   window, where the copy has no ids.
   ------------------------------------------------------------------------- */

function wireIndex(index, scroller) {
  const article = index.closest('.cv');
  const links = [...index.querySelectorAll('a[data-to]')];
  const sectionOf = (a) => article.querySelector(`[data-sec="${a.dataset.to}"]`);
  const top = () => (scroller ? scroller.scrollTop : scrollY);
  const lead = () => index.offsetHeight + parseFloat(getComputedStyle(index).top) + 12;
  const offsetOf = (el) => el.getBoundingClientRect().top - (scroller ? scroller.getBoundingClientRect().top : 0) + top();
  const scrollTo = (y) => (scroller || window).scrollTo(0, y);
  let stop = null;
  const cancel = () => { if (stop) stop(); stop = null; };
  index.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-to]');
    if (!a) return;
    e.preventDefault();
    cancel();
    const to = Math.max(0, offsetOf(sectionOf(a)) - lead());
    if (reduceMotion.matches) { (scroller || root).style.scrollBehavior = 'auto'; scrollTo(to); (scroller || root).style.scrollBehavior = ''; return; }
    const s = { x: top(), v: 0 };
    (scroller || root).style.scrollBehavior = 'auto';
    stop = animate((dt) => {
      spring(s, to, 'move', dt);
      const done = Math.abs(s.x - to) < 0.6 && Math.abs(s.v) < 8;
      scrollTo(done ? to : s.x);
      if (done) { stop = null; (scroller || root).style.scrollBehavior = ''; }
      return !done;
    });
  });
  for (const type of ['touchstart', 'wheel']) (scroller || window).addEventListener(type, cancel, { passive: true });
  let queued = false;
  const mark = () => {
    queued = false;
    const line = top() + lead() + 8;
    let on = links[0];
    for (const a of links) if (offsetOf(sectionOf(a)) <= line) on = a;
    if (on.hasAttribute('aria-current')) return;
    for (const a of links) {
      if (a === on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }
    // Keep the section being read in the middle of the strip.
    index.scrollTo({ left: on.offsetLeft - (index.clientWidth - on.offsetWidth) / 2, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  };
  (scroller || window).addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(mark); } }, { passive: true });
  mark();
}
document.querySelectorAll('.cv__index').forEach((index) => wireIndex(index, null));

/* -------------------------------------------------------------------------
   The window. A project, a section or the CV opens in place: the window
   grows out of the tile or card that was tapped, and goes back into it. Its
   box is driven by springs, so a tap, Back, Esc or a finger can turn it
   round at any point. Drag the top bar down, or the page when it is at its
   top, to carry the window off. Links keep their real addresses, so
   everything also works as plain pages.
   ------------------------------------------------------------------------- */

const view = document.querySelector('.appview');

if (view) {
  const inner = view.querySelector('.appview__inner');
  const body = view.querySelector('.appview__body');
  const title = view.querySelector('.appview__title');
  const backBtn = view.querySelector('.appview__back');
  const scrim = document.querySelector('.scrim');
  let isOpen = false;
  let opener = null;
  let source = null;

  // A copy must not repeat ids, or the transition names that pair a page's
  // icon with its tile here.
  const detach = (node) => {
    node.querySelectorAll('[id], [style*="view-transition-name"]').forEach((n) => {
      n.removeAttribute('id');
      n.style.viewTransitionName = '';
    });
    return node;
  };

  // A case study and the CV bring their own stylesheets. The home screen does
  // not use them, so they are fetched with the first page a window asks for.
  let styled = null;
  const styles = () => {
    styled ??= Promise.all(['case-study', 'cv'].filter((name) => !document.querySelector(`link[href$="/${name}.css"]`)).map((name) => new Promise((done) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/assets/css/${name}.css`;
      link.onload = done;
      link.onerror = done;
      document.head.append(link);
    })));
    return styled;
  };
  const fetched = new Map();
  // A section of this page is copied at once; another page is fetched.
  const sectionCopy = (href) => {
    const copy = document.createElement('div');
    copy.className = 'shell';
    copy.append(...document.getElementById(href.slice(1)).cloneNode(true).childNodes);
    return detach(copy);
  };
  function contentFor(href) {
    if (href.startsWith('#')) return Promise.resolve(sectionCopy(href));
    if (!fetched.has(href)) {
      const page = fetch(href).then((res) => res.text()).then((text) => new DOMParser().parseFromString(text, 'text/html').querySelector('main .shell.nf, article.cv, main.case > .shell'));
      fetched.set(href, Promise.all([page, styles()]).then(([node]) => node));
    }
    return fetched.get(href).then((node) => detach(node.cloneNode(true)));
  }
  // The bar names the window once its own heading has scrolled out of sight.
  // A section has no heading of its own in the window, so there it stays.
  let named = false;
  body.addEventListener('scroll', () => title.classList.toggle('is-shown', named || body.scrollTop > 96), { passive: true });
  // A page is laid into the window (`fill`) apart from naming the window after it (`entitle`), so a page can be
  // laid in while the window is still hidden, as a finger lands on what opens it, and named once it opens.
  let laid = null;
  // The hidden window is laid out (style.css), so the pictures in the first screen of a page laid into it are
  // fetched then, by the browser's own lazy loading, and not in the first frames of its opening. Its scroll goes
  // back to the top as it closes; setting it here would lay the new page out at once, inside the tap.
  const fill = (node, href) => {
    body.replaceChildren(node);
    laid = href;
    const index = body.querySelector('.cv__index');
    if (index) wireIndex(index, body);
  };
  const entitle = () => {
    const node = body.firstElementChild;
    if (!node) return;
    named = !node.querySelector('h1');
    title.classList.toggle('is-shown', named);
    // A section brings its mark along to the bar.
    const mark = node.querySelector('.head .sec');
    if (mark) title.prepend(mark.cloneNode());
  };

  // The window's box: `open` runs from 0, the source's rectangle, to 1, its
  // own; `pull` is how far a finger has carried it.
  const open = { x: 0, v: 0 };
  const pull = { x: 0, y: 0, vx: 0, vy: 0 };
  let goal = 0;
  let dragging = false;
  let stopBox = null;
  let from = null;

  // A Home tile where it stands on the screen, with its corner. It is read from its place in the layout, not
  // from its painted box, so a press or a settle on the tile does not move it; the home screen's scale as it
  // stands back is in the row's own box.
  const tileBox = (tile) => {
    const row = tile.offsetParent;
    const box = row.getBoundingClientRect();
    const k = box.width / row.offsetWidth;
    const w = tile.offsetWidth * k;
    const corner = getComputedStyle(tile).borderTopLeftRadius;
    return { x: box.left + tile.offsetLeft * k, y: box.top + tile.offsetTop * k, w, h: tile.offsetHeight * k, r: (parseFloat(corner) || 0) * (corner.endsWith('%') ? w / 100 : k), tile: true };
  };
  const sourceBox = () => {
    const el = source && source.isConnected ? source : null;
    const rect = el ? el.getBoundingClientRect() : null;
    if (!rect || !rect.width || rect.bottom < 0 || rect.top > innerHeight) return null;
    if (el.matches('.app__tile')) return tileBox(el);
    const corner = getComputedStyle(el).borderTopLeftRadius;
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height, r: parseFloat(corner) || 0 };
  };
  // The window's own box and corner, read when it is shown or the browser
  // window changes, never between two frames of a spring.
  let full = null;
  let mid = null;
  let corner = 0;
  const gauge = () => {
    full = { x: view.offsetLeft, y: view.offsetTop, w: view.offsetWidth, h: view.offsetHeight };
    // The middle of the pages, which the home screen steps back toward.
    mid = pager ? { x: pager.offsetLeft + pager.offsetWidth / 2, y: pager.offsetTop + pager.offsetHeight / 2 } : { x: 0, y: 0 };
    corner = parseFloat(getComputedStyle(view).getPropertyValue('--view-r')) || 0;
  };
  addEventListener('resize', () => { if (view.classList.contains('is-open')) gauge(); });
  // Every frame of the window is a transform and opacities only. Its corner is painted while the pane is still
  // empty on its way out, then once as its page shows, once when a finger takes it, and on the way back to its
  // tile only after its page has faded: never a frame of a page. From a tile it shows over the first third of the
  // way out, its page with it and not after it, since an empty pane growing over the night reads as a flash; it
  // fades over the last third of the way back, so the tile is never hidden and nothing is swapped in flight.
  let shape = '';
  let held = 0;
  const draw = ({ x, y, w, h, r }, k, far, fade) => {
    const sx = w / full.w;
    const sy = h / full.h;
    view.style.transform = `translate(${(x - full.x).toFixed(2)}px, ${(y - full.y).toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    const round = held && fade ? `${held}px` : goal && fade ? `${corner}px` : `${(r / sx).toFixed(1)}px / ${(r / sy).toFixed(1)}px`;
    if (round !== shape && (goal || !fade)) { shape = round; view.style.borderRadius = round; }
    inner.style.transform = `scale(1, ${(sx / sy).toFixed(4)})`;
    inner.style.opacity = fade.toFixed(3);
    inner.style.visibility = fade ? '' : 'hidden';
    view.style.opacity = clamp(k * (from?.tile ? 3 : from ? 7 : 1.6), 0, 1).toFixed(3);
    scrim.style.opacity = (k * (1 - far * 0.8)).toFixed(3);
    recede(k * (1 - far * 0.8));
  };
  // With nothing to grow from, the window rises a little and fades.
  const icon = () => from || { x: full.x + full.w * 0.04, y: full.y + full.h * 0.06, w: full.w * 0.92, h: full.h * 0.92, r: 40 };
  // The window's frame at `open` and the finger's pull: it shrinks a little as it is carried away.
  const frame = () => {
    const box = icon();
    const t = open.x;
    const far = clamp(Math.hypot(pull.x, pull.y) / (full.h * 0.5), 0, 1);
    const shrink = 1 - 0.16 * far;
    const w = Math.max(8, box.w + (full.w - box.w) * t) * shrink;
    const h = Math.max(8, box.h + (full.h - box.h) * t) * shrink;
    return { x: box.x + (full.x - box.x) * t + pull.x + (full.w * t + box.w * (1 - t) - w) / 2, y: box.y + (full.y - box.y) * t + pull.y, w, h, r: Math.max(0, box.r + (corner - box.r) * t), far };
  };
  const paint = () => { const f = frame(); draw(f, open.x, f.far, goal && !dragging && !held ? clamp((open.x - 0.1) / 0.25, 0, 1) : 1); };
  // The home screen steps back as the window rises over it: smaller and
  // fainter, and still sharp.
  const skyEl = document.querySelector('.sky');
  let receded = 0;
  const recede = (k) => {
    if (!pager) return;
    receded = k;
    pager.style.transform = k ? `scale(${(1 - 0.07 * k).toFixed(4)})` : '';
    pager.style.opacity = k ? (1 - 0.45 * k).toFixed(3) : '';
    skyEl.style.opacity = pager.style.opacity;
  };
  // Once the window covers the home screen the bar is over paper, not the city, and the city rests. The root's
  // attribute that says so, and the home screen's `inert`, restyle the whole page, so they change only before a
  // motion's first frame or after its last: on when the window has opened, off as it sets off to close or a finger
  // takes it.
  const cover = (on) => {
    if (on === Boolean(root.dataset.app)) return;
    if (on) root.dataset.app = '1'; else delete root.dataset.app;
    covered = on && !sheet.matches;
    pauseCity(away);
  };
  const rest = () => {
    for (const el of [view, inner, scrim]) el.removeAttribute('style');
    view.classList.remove('is-moving');
    shape = '';
    held = 0;
  };
  // A page that arrived while the window moved, laid in once it has landed.
  let waiting = null;
  const landed = () => {
    stopBox = null;
    recede(goal);
    rest();
    if (!goal) {
      view.classList.remove('is-open');
      scrim.classList.remove('is-open');
    }
    // What restyles the whole page, or builds a page, waits for the task after the last frame.
    setTimeout(() => {
      if (stopBox || dragging) return;
      cover(goal === 1);
      screenEl.inert = goal === 1;
      if (goal) {
        if (waiting) { fill(...waiting); entitle(); waiting = null; }
        return;
      }
      // Focus goes back to what opened the window, with its ring only when a key closed it, where the browser
      // lets us say so: after a tap a ring round a tile would read as a second tile. The page stays laid in, hidden.
      opener?.focus?.({ preventScroll: true, focusVisible: byKey });
      byKey = false;
      body.scrollTop = 0;
    });
  };
  const move = () => {
    if (stopBox || dragging) return;
    view.classList.add('is-moving');
    if (reduceMotion.matches) {
      // No travel: the window fades in, or out where it stands.
      const done = () => { open.x = goal; open.v = 0; pull.x = 0; pull.y = 0; landed(); };
      if (goal) { done(); view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease' }); } else view.animate([{}, { opacity: 0 }], { duration: 150, easing: 'ease' }).finished.then(done);
      return;
    }
    if (!goal) {
      // Back to the tile in one straight motion from where the window stands, on one spring with no bounce,
      // carrying on with the finger's throw along the way. Its page fades over the first quarter; on the way to a
      // tile it stays and fades with the window over the last third, so it is never a bare pane.
      // The tile was measured on the home screen as it stands back; each frame aims at where the tile is
      // in that frame, as the screen comes forward again, so window and tile land as one.
      const a = frame();
      const b = icon();
      const s0 = 1 - 0.07 * receded;
      const { x: cx, y: cy } = mid;
      const home = { x: cx + (b.x - cx) / s0, y: cy + (b.y - cy) / s0, w: b.w / s0, h: b.h / s0, r: b.r / s0 };
      const dx = home.x + home.w / 2 - a.x - a.w / 2;
      const dy = home.y + home.h / 2 - a.y - a.h / 2;
      const u = { x: 0, v: clamp((pull.vx * dx + pull.vy * dy) / (dx * dx + dy * dy || 1), 0, 8) };
      const k0 = open.x;
      // It is there when it is within a tenth of a pixel, so its last frames already stand on the icon.
      const span = Math.max(Math.abs(home.x - a.x), Math.abs(home.y - a.y), Math.abs(home.w - a.w), Math.abs(home.h - a.h));
      const tile = source?.matches('.app__tile') ? source : null;
      let settled = !tile || reduceMotion.matches;
      stopBox = animate((dt) => {
        spring(u, 1, 'page', dt);
        if ((1 - u.x) * span < 0.1 && Math.abs(u.v) * span < 5) { open.x = 0; open.v = 0; pull.x = 0; pull.y = 0; pull.vx = 0; pull.vy = 0; landed(); return false; }
        const m = Math.min(1, u.x);
        const k = k0 * (1 - m);
        const sc = 1 - 0.07 * k * (1 - a.far * 0.8);
        // A tile is read where it stands, before this frame's writes: the lean may drift it a pixel or two.
        const to = tile ? tileBox(tile) : { x: cx + (home.x - cx) * sc, y: cy + (home.y - cy) * sc, w: home.w * sc, h: home.h * sc, r: home.r * sc };
        const at = (p) => a[p] + (to[p] - a[p]) * m;
        draw({ x: at('x'), y: at('y'), w: at('w'), h: at('h'), r: at('r') }, k, a.far, tile ? clamp((1 - m) * 3, 0, 1) : clamp(1 - m / 0.25, 0, 1));
        // As the window fades into it, the tile gives a small settle: once, as a scale of its own.
        if (!settled && m > 2 / 3) {
          settled = true;
          tile.animate([{ scale: '0.94' }, { scale: '1.03', offset: 0.55 }, { scale: '1' }], { duration: 420, easing: 'ease-out' });
        }
        return true;
      });
      return;
    }
    const px = { x: pull.x, v: pull.vx };
    const py = { x: pull.y, v: pull.vy };
    const reach = Math.hypot(pull.x, pull.y) || 1;
    const round = held;
    stopBox = animate((dt) => {
      // A window let go of goes home on the throw with no bounce, its corners easing back as it comes.
      spring(open, goal, 'move', dt);
      spring(px, 0, 'page', dt);
      spring(py, 0, 'page', dt);
      pull.x = px.x;
      pull.y = py.x;
      if (round) held = Math.round(corner + (round - corner) * clamp(Math.hypot(pull.x, pull.y) / reach, 0, 1));
      const done = Math.abs(open.x - goal) < 0.002 && Math.abs(open.v) < 0.02 && Math.hypot(pull.x, pull.y) < 0.5;
      if (done) { open.x = goal; open.v = 0; pull.x = 0; pull.y = 0; pull.vx = 0; pull.vy = 0; landed(); return false; }
      paint();
      return true;
    });
  };
  const halt = () => { if (stopBox) stopBox(); stopBox = null; };

  // Where the window comes from and where it goes are read before anything is written, so the tap that opens
  // it and the first frame of the close lay nothing out.
  function present() {
    view.classList.add('is-open');
    scrim.classList.add('is-open');
    appOpen = true;
    cueMascot('think');
    parkMascot();
    goal = 1;
    paint();
    view.focus({ preventScroll: true });
    move();
  }

  function dismiss() {
    if (!isOpen) return;
    from = sourceBox();
    isOpen = false;
    appOpen = false;
    cover(false);
    parkMascot();
    goal = 0;
    halt();
    move();
  }

  async function openApp(href, label, link, push) {
    halt();
    opener = link;
    source = link ? link.querySelector('.app__tile, .me') || link.closest('.project') : null;
    from = sourceBox();
    gauge();
    document.body.classList.add('px');
    isOpen = true;
    waiting = null;
    title.textContent = label;
    view.dataset.project = (href.match(/^\/work\/([\w-]+)\.html$/) || [])[1] || '';
    if (laid !== href && href.startsWith('#')) fill(sectionCopy(href), href);
    if (laid === href) entitle();
    else { body.replaceChildren(); laid = null; }
    present();
    if (push) history.pushState({ app: href, label }, '', href);
    if (laid === href) return;
    try {
      const node = await contentFor(href);
      if (!isOpen || title.textContent !== label) return;
      // Built in the middle of the motion it would cost the motion a frame, so it waits for the landing.
      if (stopBox) waiting = [node, href];
      else { fill(node, href); entitle(); }
    } catch (err) {
      location.href = href;
    }
  }

  function close() {
    if (history.state?.app) history.back();
    else dismiss();
  }

  let byKey = false;
  backBtn.addEventListener('click', (e) => { byKey = e.detail === 0; close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) { e.preventDefault(); byKey = true; close(); } });
  addEventListener('popstate', (e) => {
    if (e.state?.app) openApp(e.state.app, e.state.label, null, false);
    else dismiss();
  });

  const isAppLink = (a) => {
    const href = a.getAttribute('href') || '';
    return a.dataset.sheet || /^\/work\/[\w-]+\.html$/.test(href) || /^(\/sv)?\/cv\/$/.test(href);
  };
  // The page is asked for when a finger lands and laid into the hidden window, with the labels' face, so the
  // window opens with its page already built and nothing is built while it moves.
  document.addEventListener('pointerdown', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !isAppLink(a) || a.dataset.sheet || view.contains(a)) return;
    const href = a.getAttribute('href');
    document.body.classList.add('px');
    contentFor(href).then((node) => { if (!isOpen && !stopBox && laid !== href) fill(node, href); }).catch(() => {});
  }, { passive: true });
  // The Home apps' pages are asked for once the page has loaded and gone quiet, so the first tap too opens a
  // window with its page in it and not an empty pane. Not where the visitor has asked to save data.
  // The labels' pixel face is let in then too: letting it in restyles the whole page, which at a tap would
  // cost the opening its first frame.
  const warm = () => setTimeout(() => {
    if (navigator.connection?.saveData) return;
    document.body.classList.add('px');
    for (const a of document.querySelectorAll('.apps .app')) contentFor(a.getAttribute('href')).catch(() => {});
  }, 2500);
  if (document.readyState === 'complete') warm();
  else addEventListener('load', warm, { once: true });
  document.addEventListener('click', (e) => {
    const peek = e.target.closest('.peek[data-open]');
    const a = peek ? peek.closest('.project').querySelector('h3 a') : e.target.closest('a[href]');
    if (!a || !isAppLink(a) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (a.hasAttribute('download')) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    const label = a.dataset.title || a.textContent.trim() || 'CV';
    if (isOpen && view.contains(a)) {
      title.textContent = label;
      view.dataset.project = (href.match(/^\/work\/([\w-]+)\.html$/) || [])[1] || '';
      history.replaceState({ app: href, label }, '', href);
      body.replaceChildren();
      laid = null;
      contentFor(href).then((node) => { fill(node, href); body.scrollTop = 0; entitle(); });
      return;
    }
    openApp(href, label, a.closest('.app, .who, .project') ? a : null, true);
  });

  // Tabs that leave an open app close it first.
  bar?.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || !isOpen || isAppLink(a)) return;
    close();
  });

  // Carry the window. Past the top it gives like a scroll edge; let go and
  // the throw decides whether it leaves or comes back.
  const finger = tracker();
  let grab = null;
  let painting = 0;
  // A finger moves the window 1:1, painted once a frame from its latest place.
  const carry = (x, y, t) => {
    const dy = y - grab.y;
    pull.y = dy >= 0 ? dy : -rubber(-dy, full.h);
    pull.x = (x - grab.x) * 0.5;
    finger.add(t, x, y);
    painting ||= requestAnimationFrame(() => { painting = 0; paint(); });
  };
  const take = (x, y) => {
    halt();
    dragging = true;
    cover(false);
    grab = { x: x - pull.x * 2, y: y - pull.y };
    view.classList.add('is-moving');
    // Carried, its corners round a little, painted this once.
    held = corner + 24;
  };
  const letGo = (t) => {
    if (!dragging) return;
    dragging = false;
    grab = null;
    cancelAnimationFrame(painting);
    painting = 0;
    [pull.vx, pull.vy] = finger.speed(t);
    pull.vx *= 0.5;
    const lands = pull.y + pull.vy * 0.2;
    if (isOpen && lands > full.h * 0.26) close();
    else move();
  };
  const handle = view.querySelector('.appview__bar');
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || e.button || !isOpen) return;
    handle.setPointerCapture(e.pointerId);
    take(e.clientX, e.clientY);
  });
  handle.addEventListener('pointermove', (e) => { if (dragging && grab) carry(e.clientX, e.clientY, e.timeStamp); });
  handle.addEventListener('pointerup', (e) => letGo(e.timeStamp));
  handle.addEventListener('pointercancel', (e) => letGo(e.timeStamp));
  // On the page itself a downward drag from the very top carries the window;
  // any other touch scrolls as usual.
  let touch = null;
  body.addEventListener('touchstart', (e) => {
    touch = e.touches.length === 1 && body.scrollTop <= 0 && isOpen ? { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false } : null;
  }, { passive: true });
  body.addEventListener('touchmove', (e) => {
    if (!touch) return;
    const { clientX: x, clientY: y } = e.touches[0];
    if (!touch.on) {
      const dx = Math.abs(x - touch.x);
      const dy = y - touch.y;
      if (dy < 6 && dx < 6) return;
      if (dy <= dx || !e.cancelable || e.target.closest('.shots')) { touch = null; return; }
      touch.on = true;
      take(touch.x, touch.y);
    }
    e.preventDefault();
    carry(x, y, e.timeStamp);
  }, { passive: false });
  const lift = (e) => { if (touch?.on) letGo(e.timeStamp); touch = null; };
  body.addEventListener('touchend', lift);
  body.addEventListener('touchcancel', lift);
}

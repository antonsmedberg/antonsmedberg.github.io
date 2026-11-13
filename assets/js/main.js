// Progressive enhancement only. Everything reads and navigates without this
// file. It adds the theme toggle, the swiped pages, the glass bar, the
// window that apps open in, the 3D city, the sun that is its clock, and the mascot.
// What moves is run by the browser where it can be, so it stays smooth while the page works.

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
// How far the pages have moved, kept as they move (`follow`) so no frame has to read it.
let paged = 0;
const lang = root.lang === 'sv' ? 'sv' : 'en';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

root.classList.remove('no-js');
// Safari shows a control's pressed state on touch only where a touch listener is heard; this one does nothing else.
document.addEventListener('touchstart', () => {}, { passive: true });

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

// The springs that stay in script, for the sun and the lean, which the city draws each frame anyway: frequency
// in Hz, damping. `quick` is a control answering a touch, with a little overshoot; `calm` is what trails or
// returns. Everything else moves in the stylesheet, on cubic curves (--spring, --press, --glide): Safari runs
// a cubic curve off the main thread, and falls back to it for a linear() one.
const SPRINGS = { quick: [3.6, 0.72], calm: [1.8, 1] };
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

// The page's light follows the scene's own key, as the city measures it: light frost while the picture behind
// it is bright, dark frost once it is dark (style.css), whatever the hour is called.
function paintKey(key) {
  if ((key === 'light' || key === 'dark') && root.dataset.key !== key) { root.dataset.key = key; syncTheme(); }
}

if (!document.querySelector('canvas.wall')) {
  try {
    const kept = JSON.parse(sessionStorage.getItem('sky'));
    if (kept) { paintSky(kept.sky, kept.tint); paintKey(kept.key); }
  } catch (e) { /* no storage or an old value: the stylesheet's sky stands */ }
}

/* -------------------------------------------------------------------------
   Copy the e-mail address (contact section).
   ------------------------------------------------------------------------- */

document.querySelectorAll('[data-copy]').forEach((button) => {
  const label = button.querySelector('[data-copy-label]') || button;
  const original = label.textContent;
  // The change of word is read out, so a screen reader hears that the copy worked.
  label.setAttribute('aria-live', 'polite');
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
const smedEl = document.querySelector('.smed');
let awayTimer = 0;
let actedAt = -Infinity;

// He stays on screen. Only under an open window does he shrink away, and he comes back when it closes.
let parked = false;
function parkMascot() {
  if (!smedEl) return;
  const on = appOpen;
  if (on === parked) return;
  parked = on;
  clearTimeout(awayTimer);
  if (on) {
    awayTimer = setTimeout(() => smedEl.classList.add('is-away'), 320);
    smedEl.classList.add('is-parked');
  } else {
    // Back in the layout first, and out of his parked pose a frame after that, so the way in is animated too
    // without reading the layout in the tap that closes the window.
    smedEl.classList.remove('is-away');
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!parked) smedEl.classList.remove('is-parked'); }));
  }
  smed?.park?.(on);
}

const island = document.querySelector('.island details');

// He answers what happens on the site, lightly: one act every few seconds at
// most. An act asked for mid-run waits in the figure until he stands still.
function cueMascot(name) {
  const now = performance.now();
  if (!smed || now - actedAt < 5000) return false;
  actedAt = now;
  smed.play(name);
  return true;
}

// The page a tab has sent the pager to, while the browser scrolls it there.
let pageGoal = null;

// What follows the pager: the bar's selection, the current tab and the city's camera. The pager scrolls natively,
// under a finger or on its way to a tab, and this follows its scroll events; it only reads where the pages are.
let follow = () => {};

// A city nobody can see is not drawn: under a window, and behind a page other than Home once the pages rest.
// It wakes as soon as they move.
let covered = false;
let away = false;
const pauseCity = (rest) => { away = rest; city?.setPaused(covered || away); };

// A tab sends the pager to its page by the browser's own smooth scroll, which snaps there.
function goToPage(i) {
  pauseCity(false);
  const left = i * pagerWidth;
  if (Math.abs(paged - i) < 0.01) { pageGoal = null; return; }
  pageGoal = i;
  if (reduceMotion.matches) {
    // No travel: the page is swapped and fades in.
    pager.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease' });
    pager.scrollTo({ left, behavior: 'instant' });
    return;
  }
  pager.scrollTo({ left, behavior: 'smooth' });
}

/* -------------------------------------------------------------------------
   Travel. The pages are one space seen from a moving camera: what a page holds
   lies at different depths, so on the way between two pages the far layers
   lag and the near ones run ahead. home.css runs it on the pager's own scroll
   (a scroll-driven animation), so the browser moves the layers with the pages;
   here each layer is given its depth once.
   ------------------------------------------------------------------------- */

// Per page, back to front: the first layer lies nearest the city.
pages.forEach((page) => {
  const els = [...page.querySelectorAll(':scope > .shell > *')].flatMap((el) => (el.matches('.projects, .cv-side') ? [...el.children] : [el]));
  els.forEach((el, k) => {
    el.classList.add('layer');
    el.style.setProperty('--k', (((els.length > 1 ? k / (els.length - 1) : 0.5) - 0.4) * 0.5).toFixed(3));
  });
});

// The deck of projects: where each card sticks while the next slides over it.
const deck = [...document.querySelectorAll('.pg .project')];
if (deck.length) {
  const page = deck[0].closest('.pg');
  const stuck = deck.map(() => '');
  let wanted = [];
  let writing = 0;
  const stack = () => {
    const style = getComputedStyle(page);
    // Sticky offsets count from the page's padding, which already clears the top bar.
    const room = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) + 16;
    // Every height is read before any offset is written, so the deck is laid out once, not once per card.
    const heights = deck.map((card) => card.offsetHeight);
    wanted = deck.map((card, i) => `${Math.round(Math.min(i * 10, room - heights[i]))}px`);
    // The places are written in the next frame, never in the observer's own callback: a new place can bring a
    // card into view, which is then laid out at its real height, and that would resize what the observer
    // watches in the same frame (Safari reports it as a ResizeObserver loop).
    writing ||= requestAnimationFrame(() => {
      writing = 0;
      deck.forEach((card, i) => {
        if (wanted[i] !== stuck[i]) { stuck[i] = wanted[i]; card.style.setProperty('--stick', wanted[i]); }
      });
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
   with the same gap all round. It slides to its tab as a transition of its
   transform (style.css). It lies along the bottom or stands as a rail.
   ------------------------------------------------------------------------- */

if (bar) {
  const tabs = [...bar.querySelectorAll('a')];
  // Positions are in tabs, not pixels, so the selection keeps its place while the bar changes size.
  const place = (i) => {
    bar.style.setProperty('--l', i);
    bar.classList.add('has-lens');
  };
  // The first place is taken at once; only after the first picture does the selection slide.
  requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('is-live')));
  if (!pager) {
    const i = tabs.findIndex((a) => a.hasAttribute('aria-current'));
    if (i >= 0) place(i);
  }

  if (pager) {
    const langLink = document.querySelector('.tool--lang');
    const first = pageOfHash(location.hash);
    if (first > 0) pager.scrollLeft = first * pagerWidth;
    let current = -1;
    // Once the pages and the finger have rested for 300 ms, a city behind a page other than Home stops drawing.
    let fingers = false;
    let restTimer = 0;
    const rested = () => {
      clearTimeout(restTimer);
      restTimer = setTimeout(() => { if (!fingers) pauseCity(current > 0); }, 300);
    };
    follow = (p) => {
      paged = p;
      if (pageGoal !== null && Math.abs(p - pageGoal) < 0.01) pageGoal = null;
      city?.setProgress(p);
      // Sent to a tab, the selection and the current tab go straight there and the pages follow.
      const i = pageGoal ?? clamp(Math.round(p), 0, tabs.length - 1);
      if (i !== current) {
        current = i;
        place(i);
        tabs.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
        // His words belong to the page they were said on.
        smedEl?.classList.remove('is-saying');
        history.replaceState(history.state, '', i === 0 ? location.pathname + location.search : `#${pages[i].id}`);
        // The other language opens on the same tab: the pages carry the same ids in both.
        if (langLink) langLink.hash = i === 0 ? '' : pages[i].id;
      }
      rested();
    };
    follow(pageAt());
    pager.addEventListener('scroll', () => {
      if (away) pauseCity(false);
      follow(pageAt());
    }, { passive: true });
    // A finger on the pages takes them where it is: a tab's trip ends there.
    pager.addEventListener('touchstart', () => { fingers = true; pageGoal = null; }, { passive: true });
    for (const type of ['touchend', 'touchcancel']) pager.addEventListener(type, (e) => { fingers = e.touches.length > 0; rested(); }, { passive: true });
    addEventListener('resize', () => { pageGoal = null; pager.scrollLeft = current * pagerWidth; follow(current); });
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
    place(tabs.indexOf(a));
  });

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
   drifts the home screen's layers and the city's camera a few
   pixels against the city. `lean` runs from -1 to 1 on each axis.
   ------------------------------------------------------------------------- */

const lean = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, tx: 0, ty: 0 };
// What drifts, and how many pixels at full lean: more the nearer the eye.
const drifters = [['.name', 3], ['.who', 5], ['.alm', 5], ['.apps', 7], ['.pg .head', 4]].flatMap(([sel, depth]) => [...document.querySelectorAll(sel)].map((el) => ({ el, depth })));
// Wakes the drift's loop once the city is up; the loop sleeps again when the lean has settled.
let stirLean = () => {};
if (screenEl && !reduceMotion.matches) {
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    lean.tx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    lean.ty = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
    stirLean();
  }, { passive: true });
  // iOS asks the visitor before it reports tilt; a portfolio does not ask.
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    let rest = null;
    addEventListener('deviceorientation', (e) => {
      if (e.gamma === null || e.beta === null) return;
      rest ??= { gamma: e.gamma, beta: e.beta };
      lean.tx = clamp((e.gamma - rest.gamma) / 22, -1, 1);
      lean.ty = clamp((e.beta - rest.beta) / 22, -1, 1);
      stirLean();
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
  // the line to themselves until then. The mascot's file is asked for only once the city has started.
  const painted = new Promise((done) => { requestAnimationFrame(() => setTimeout(done)); });
  cityMounted = painted.then(() => {
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
    // Without WebGL 2 the still of the night stands, so the page keys dark whatever the hour.
    if (!city) { root.classList.add('no-gl'); delete screenEl.dataset.top; delete screenEl.dataset.foot; paintSky('night'); paintKey('dark'); return; }
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
      try { sessionStorage.setItem('sky', JSON.stringify({ sky, tint, key: root.dataset.key })); } catch (e) { /* the other pages keep the stylesheet's sky */ }
    };
    showSky();
    setInterval(() => { if (!dialHeld) showSky(); }, 30000);

    // Which side the tower stands on, and where its near edge is, so the
    // layout can keep the name and the widgets clear of it.
    let towerAt = '';
    let wallWidth = wallCanvas.clientWidth;
    const placeTower = () => {
      const box = city.towerRect();
      if (!screenEl || !box.w) return;
      const next = `${Math.round(box.x)} ${Math.round(box.x + box.w)} ${Math.round(box.y + box.h)}`;
      if (next === towerAt) return;
      towerAt = next;
      screenEl.style.setProperty('--tower-l', `${Math.round(box.x)}px`);
      screenEl.style.setProperty('--tower-r', `${Math.round(box.x + box.w)}px`);
      screenEl.style.setProperty('--tower-b', `${Math.round(box.y + box.h)}px`);
      screenEl.dataset.tower = box.x + box.w / 2 < wallWidth / 2 ? 'left' : 'right';
      fitName();
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
    addEventListener('resize', () => { wallWidth = wallCanvas.clientWidth; placeTower(); cover(); });
    // In a small window the row is still on its way when the resize is heard: the name is fitted a frame later.
    const sized = new ResizeObserver(cover);
    for (const el of [appsGrid?.parentElement, ...words]) if (el) sized.observe(el);
    // The ink the city asks for the words at the top and at the foot; a rail's apps stand with the top.
    let inked = '';
    // The scene's key turns the page's light at once on the first frame, and after that only once the new key
    // has held for three seconds and nothing moves, so a scene near the line never makes it flip while one reads.
    let keyed = false;
    let keyWant = null;
    let keySince = 0;
    city.onFrame(() => {
      drawn();
      n += 1;
      if (n % 30 === 2 && paged < 0.01) placeTower();
      sun?.follow(city.sunPx);
      const ink = city.ink;
      if (ink) {
        const want = ink.top === 'dark' ? 'light' : 'dark';
        const now = performance.now();
        if (!keyed) { keyed = true; paintKey(want); }
        else if (want === root.dataset.key) keyWant = null;
        else if (want !== keyWant) { keyWant = want; keySince = now; }
        else if (now - keySince > 3000 && !steppers.size) { keyWant = null; paintKey(want); }
      }
      const key = ink && ink.top + ink.bottom + rail.matches;
      if (!key || key === inked) return;
      inked = key;
      screenEl.dataset.top = ink.top;
      screenEl.dataset.foot = rail.matches ? ink.top : ink.bottom;
    });

    // One loop for the drift: the home screen's layers and the city's camera lean together. It runs only from a
    // move of the pointer or a tilt until the lean stands on its goal.
    let drifted = '';
    let before = 0;
    let drifting = 0;
    const frame = (now) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - before) / 1000));
      before = now;
      spring(lean.x, lean.tx, 'calm', dt);
      spring(lean.y, lean.ty, 'calm', dt);
      const settled = Math.abs(lean.x.x - lean.tx) + Math.abs(lean.y.x - lean.ty) < 0.001 && Math.abs(lean.x.v) + Math.abs(lean.y.v) < 0.01;
      if (settled) { lean.x.x = lean.tx; lean.y.x = lean.ty; lean.x.v = 0; lean.y.v = 0; }
      drifting = settled ? 0 : requestAnimationFrame(frame);
      const drift = `${lean.x.x.toFixed(2)} ${lean.y.x.toFixed(2)}`;
      if (drift === drifted) return;
      drifted = drift;
      for (const { el, depth } of drifters) el.style.translate = `${(-lean.x.x * depth).toFixed(2)}px ${(-lean.y.x * depth).toFixed(2)}px`;
      // The camera leans the same way, so the pier slides against the far shore.
      city.setLean(lean.x.x, lean.y.x);
    };
    stirLean = () => {
      if (drifting) return;
      before = performance.now();
      drifting = requestAnimationFrame(frame);
    };
    stirLean();
  });
}

/* -------------------------------------------------------------------------
   The mascot: drawn live in 3D where the browser can, else one still picture
   that answers a tap. It waits for the city, to share its pixel size and its
   light.
   ------------------------------------------------------------------------- */

if (smedEl) {
  // The city's key light, turned into the mascot's view: its camera looks
  // down -z, the city's has swung by its yaw. And whether it rains, for his brim.
  const light = () => {
    if (!city) return null;
    const lit = city.light;
    const [x, y, z] = lit.sun;
    const cos = Math.cos(city.yaw);
    const sin = Math.sin(city.yaw);
    return { ...lit, sun: [cos * x + sin * z, y, cos * z - sin * x], rain: city.weather.rain };
  };
  const mountMascot = async () => {
    try {
      const { mountSmed3D } = await import('./smed3d.js');
      const live = await mountSmed3D(smedEl, { light });
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
    return { play() {} };
  };
  smedEl.classList.add('smed--live');
  const idle = () => new Promise((done) => { (window.requestIdleCallback || setTimeout)(done, { timeout: 1500 }); });
  cityMounted.then(idle, idle).then(mountMascot).then((api) => { smed = api; });
  // A wave goodbye on the way to the other language; the page that opens says hello in it.
  document.addEventListener('click', (e) => { if (e.target.closest('a[hreflang]')) cueMascot('wave'); });

  // Late at night in Malmö he does not wait up: left alone he yawns and goes
  // to sleep, until something is touched.
  // A touch only notes the time; the one timer pending looks at it when it fires and waits out the rest.
  let dozeTimer = 0;
  let stirredAt = 0;
  const doze = () => {
    const wait = stirredAt + 8000 - performance.now();
    // In whole milliseconds: a timer may fire a fraction early, and a wait under one would go round again at once.
    if (wait > 0) { dozeTimer = setTimeout(doze, Math.ceil(wait)); return; }
    dozeTimer = 0;
    if (dialHeld || appOpen || city?.nextSun.kind !== 'rise' || !cueMascot('yawn')) return;
    const yawned = stirredAt;
    dozeTimer = setTimeout(() => {
      if (stirredAt !== yawned) { doze(); return; }
      dozeTimer = 0;
      smed.play('sleep');
    }, 3200);
  };
  const stir = () => {
    stirredAt = performance.now();
    dozeTimer ||= setTimeout(doze, 8000);
  };
  for (const type of ['pointerdown', 'keydown', 'scroll']) addEventListener(type, stir, { passive: true, capture: true });
  stir();
}

/* -------------------------------------------------------------------------
   The status pill and the jiggle.
   ------------------------------------------------------------------------- */

if (island) {
  // It closes on a press outside it, on Escape (focus going back to what opened it) and when focus leaves it.
  document.addEventListener('pointerdown', (e) => { if (island.open && !island.contains(e.target)) island.open = false; });
  island.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !island.open) return;
    island.open = false;
    island.querySelector('summary').focus();
  });
  island.addEventListener('focusout', (e) => { if (island.open && e.relatedTarget && !island.contains(e.relatedTarget)) island.open = false; });
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
   hold of a row, throw it, and the browser's own smooth scroll carries it to
   the screen the throw would reach.
   ------------------------------------------------------------------------- */

{
  let row = null;
  const finger = tracker();
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.shots');
    if (!el || e.pointerType !== 'mouse' || e.button || el.scrollWidth <= el.clientWidth) return;
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
    el.scrollTo({ left: to, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
    // Held until the click that ends the drag has been heard, so it opens nothing.
    setTimeout(() => el.classList.remove('is-held'));
  };
  document.addEventListener('pointerup', drop);
  document.addEventListener('pointercancel', drop);
  // A drag is not a click on whatever it ended over.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.shots.is-held')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

/* -------------------------------------------------------------------------
   The CV's section index: a tap scrolls smoothly to the section, and the
   index shows which section is being read. It works in the page and in the
   window, where the copy has no ids.
   ------------------------------------------------------------------------- */

// A window's copy is wired with a signal, so its listeners go with it when the next page is laid in.
function wireIndex(index, scroller, article = index.closest('.cv'), signal) {
  // Seated above the page in a window's top band, it covers none of the page; in the page it sticks over it.
  const docked = !scroller.contains(index);
  const links = [...index.querySelectorAll('a[data-to]')];
  const sectionOf = (a) => article.querySelector(`[data-sec="${a.dataset.to}"]`);
  const top = () => scroller.scrollTop;
  const lead = () => (docked ? 12 : index.offsetHeight + parseFloat(getComputedStyle(index).top) + 12);
  const offsetOf = (el) => el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + top();
  index.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-to]');
    if (!a) return;
    e.preventDefault();
    scroller.scrollTo({ top: Math.max(0, offsetOf(sectionOf(a)) - lead()), behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  });
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
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(mark); } };
  scroller.addEventListener('scroll', queue, { passive: true, signal });
  // The first mark waits for a frame too: inside the tap that lays a page in, it would lay that page out.
  queue();
}
// A page of its own scrolls in its screen (style.css).
document.querySelectorAll('body > .screen .cv__index').forEach((index) => wireIndex(index, index.closest('.screen')));

/* -------------------------------------------------------------------------
   The window. A project, a section or the CV opens in place. On a phone it
   is a sheet that rises from the bottom edge over a dimming scrim and goes
   back down; on a tablet or a computer it is a panel in the middle that rises
   a little as it fades in. Both are animations of transform and opacity
   alone, which the browser runs off the main thread; a tap, Back, Esc or a
   finger takes one over from wherever it stands. On a phone, drag the top
   bar down, or the page when it is at its top, to carry the sheet off. Links
   keep their real addresses, so everything also works as plain pages.
   ------------------------------------------------------------------------- */

const view = document.querySelector('.appview');
// A page with no window prints itself.
if (!view) document.addEventListener('click', (e) => { if (e.target.closest('[data-print]')) print(); });

if (view) {
  const inner = view.querySelector('.appview__inner');
  const body = view.querySelector('.appview__body');
  const title = view.querySelector('.appview__title');
  const backBtn = view.querySelector('.appview__back');
  const scrim = document.querySelector('.scrim');
  let isOpen = false;
  let opener = null;

  // A copy must not repeat ids, or the transition names that pair a page's icon with its tile here. Its ids
  // take a prefix, and what points at them inside it follows, so its labels still name their sections.
  const detach = (node) => {
    node.querySelectorAll('[style*="view-transition-name"]').forEach((n) => { n.style.viewTransitionName = ''; });
    node.querySelectorAll('[id]').forEach((n) => { n.id = `win-${n.id}`; });
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']) {
      [node, ...node.querySelectorAll(`[${attr}]`)].filter((n) => n.hasAttribute(attr)).forEach((n) => n.setAttribute(attr, n.getAttribute(attr).split(/\s+/).map((id) => `win-${id}`).join(' ')));
    }
    node.querySelectorAll('a[href^="#"]').forEach((a) => { if (a.hash.length > 1) a.setAttribute('href', `#win-${a.hash.slice(1)}`); });
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
      // A page in another language than this one says so, so it is read in its own.
      const page = fetch(href).then((res) => res.text()).then((text) => {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const node = doc.querySelector('main .shell.nf, article.cv, main.case > .shell');
        if (node && doc.documentElement.lang && doc.documentElement.lang !== root.lang) node.lang = doc.documentElement.lang;
        return node;
      });
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
  // The CV's section index is seated in the window's top band, under the back button and the title, so the
  // page never scrolls under it.
  const dock = view.querySelector('.appview__dock');
  let wired = null;
  const fill = (node, href) => {
    const index = node.querySelector('.cv__index');
    dock.replaceChildren(...(index ? [index] : []));
    body.replaceChildren(node);
    laid = href;
    wired?.abort();
    wired = new AbortController();
    if (index) wireIndex(index, body, node.matches('.cv') ? node : node.querySelector('.cv'), wired.signal);
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

  // The motion: one curve, read from the stylesheet (--glide), the window and the scrim on it together. The
  // window's inline style always holds where it is going, so a cancelled motion leaves it there, and each new
  // one starts from where the last stands now (its present frame, written down) or from where a finger left it.
  const glideCurve = getComputedStyle(root).getPropertyValue('--glide').trim() || 'ease-out';
  const SHOWN = { transform: 'none', opacity: '1' };
  const gone = () => (reduceMotion.matches ? { transform: 'none', opacity: '0' } : sheet.matches ? { transform: 'translateY(24px)', opacity: '0' } : { transform: 'translateY(100%)', opacity: '1' });
  let motion = null;
  let scrimMotion = null;
  const stand = () => {
    for (const m of [motion, scrimMotion]) if (m) { m.commitStyles(); m.cancel(); }
    motion = null;
    scrimMotion = null;
  };
  const glide = (to, ms, done) => {
    stand();
    const from = { transform: view.style.transform || 'none', opacity: view.style.opacity || '1' };
    const scrimFrom = scrim.style.opacity || '0';
    const scrimTo = to === SHOWN ? '1' : '0';
    Object.assign(view.style, to);
    scrim.style.opacity = scrimTo;
    const timing = reduceMotion.matches ? { duration: 150, easing: 'ease' } : { duration: ms, easing: glideCurve };
    const m = view.animate([from, to], timing);
    motion = m;
    scrimMotion = scrim.animate([{ opacity: scrimFrom }, { opacity: scrimTo }], timing);
    m.finished.then(() => { if (motion !== m) return; motion = null; scrimMotion = null; done(); }, () => {});
  };
  const moving = () => Boolean(motion);
  // Once the window covers the home screen the city rests, and on a phone the home screen is not drawn at all
  // (style.css). The root's attribute and the home screen's `inert` restyle the whole page, so they change only
  // after an opening's last frame and before a closing's first.
  const cover = (on) => {
    if (on === Boolean(root.dataset.app)) return;
    if (on) root.dataset.app = '1'; else delete root.dataset.app;
    screenEl.inert = on;
    covered = on && !sheet.matches;
    pauseCity(away);
  };
  const opened = () => cover(true);
  const closed = () => {
    view.classList.remove('is-open');
    scrim.classList.remove('is-open');
    // Focus goes back to what opened the window, with its ring only when a key closed it, where the browser
    // lets us say so. The page stays laid in, hidden.
    opener?.focus?.({ preventScroll: true, focusVisible: byKey });
    byKey = false;
    body.scrollTop = 0;
  };

  function present() {
    if (!view.classList.contains('is-open')) { Object.assign(view.style, gone()); scrim.style.opacity = '0'; }
    view.classList.add('is-open');
    scrim.classList.add('is-open');
    appOpen = true;
    cueMascot('think');
    parkMascot();
    view.focus({ preventScroll: true });
    glide(SHOWN, 420, opened);
  }

  function dismiss() {
    if (!isOpen) return;
    isOpen = false;
    appOpen = false;
    cover(false);
    parkMascot();
    glide(gone(), 320, closed);
  }

  async function openApp(href, label, link, push) {
    opener = link;
    isOpen = true;
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
      // Laid in as soon as it is here: the motion runs off the main thread, so building the page holds it up
      // no more than it would at rest.
      fill(node, href);
      entitle();
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

  // Print: the page's own print where it stands; from the window, the CV's own page, from a frame that is never
  // shown, so its print styles apply and not the home screen's.
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-print]');
    if (!button) return;
    if (!view.contains(button) || !laid) { print(); return; }
    const frame = Object.assign(document.createElement('iframe'), { src: laid, title: '', tabIndex: -1 });
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position: fixed; width: 0; height: 0; border: 0; visibility: hidden';
    frame.addEventListener('load', () => {
      frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
      frame.contentWindow.print();
    }, { once: true });
    document.body.append(frame);
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
    contentFor(href).then((node) => { if (!isOpen && !moving() && laid !== href) fill(node, href); }).catch(() => {});
  }, { passive: true });
  // The Home apps' pages are asked for once the page has loaded and gone quiet, so the first tap too opens a
  // window with its page in it and not an empty pane. Not where the visitor has asked to save data.
  const warm = () => setTimeout(() => {
    if (navigator.connection?.saveData) return;
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
    // The CV is named CV in the window, whatever the link that opened it says.
    const label = a.dataset.title || (/^(\/sv)?\/cv\/$/.test(href) ? 'CV' : a.textContent.trim());
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

  // The scrim closes the window where it shows round a panel.
  scrim.addEventListener('click', close);

  // Carry the sheet, on a phone. It follows the finger down, and gives a little past its top; let go, and a
  // throw or more than a quarter of the way carries it off, anything less sends it back up.
  const finger = tracker();
  let grab = null;
  let painting = 0;
  const carry = (y, t) => {
    const dy = y - grab.y;
    grab.at = dy >= 0 ? dy : -rubber(-dy, grab.h);
    finger.add(t, 0, y);
    painting ||= requestAnimationFrame(() => {
      painting = 0;
      view.style.transform = `translateY(${grab.at.toFixed(1)}px)`;
      scrim.style.opacity = clamp(1 - grab.at / grab.h, 0, 1).toFixed(3);
    });
  };
  const take = (y) => {
    stand();
    // Where the sheet stands, read once as the finger lands; from then on the finger says.
    const at = new DOMMatrix(getComputedStyle(view).transform).m42;
    grab = { y: y - at, at, h: view.offsetHeight };
    cover(false);
  };
  const letGo = (t) => {
    if (!grab) return;
    const { at, h } = grab;
    grab = null;
    cancelAnimationFrame(painting);
    painting = 0;
    const [, vy] = finger.speed(t);
    if (isOpen && at + vy * 0.2 > h * 0.25) close();
    else if (isOpen) glide(SHOWN, 320, opened);
  };
  const handle = view.querySelector('.appview__bar');
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || e.button || !isOpen || sheet.matches || reduceMotion.matches) return;
    handle.setPointerCapture(e.pointerId);
    take(e.clientY);
  });
  handle.addEventListener('pointermove', (e) => { if (grab) carry(e.clientY, e.timeStamp); });
  handle.addEventListener('pointerup', (e) => letGo(e.timeStamp));
  handle.addEventListener('pointercancel', (e) => letGo(e.timeStamp));
  // On the page itself a downward drag from the very top carries the sheet; any other touch scrolls as usual.
  let touch = null;
  body.addEventListener('touchstart', (e) => {
    touch = e.touches.length === 1 && body.scrollTop <= 0 && isOpen && !sheet.matches && !reduceMotion.matches ? { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false } : null;
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
      take(touch.y);
    }
    e.preventDefault();
    carry(y, e.timeStamp);
  }, { passive: false });
  const lift = (e) => { if (touch?.on) letGo(e.timeStamp); touch = null; };
  body.addEventListener('touchend', lift);
  body.addEventListener('touchcancel', lift);
}

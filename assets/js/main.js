/**
 * main.js — progressive enhancement only.
 *
 * Every word of content is already in the HTML. Nothing here is required to
 * read the page; if this file fails to load, the site still works.
 *
 * All scroll and pointer work is batched into a single rAF loop that only runs
 * when something has actually changed, so the page does no work while idle.
 */


const root = document.documentElement;
root.classList.remove('no-js');
root.classList.add('js');

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');

/* -------------------------------------------------------------------------
   Hero depth field
   ------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------
   Masthead
   One boolean, one surface. The bar densifies; nothing nested resizes, which
   is what made the old header read as a box inside a box inside a border.
   ------------------------------------------------------------------------- */

const masthead = document.querySelector('.masthead');
const nav = document.querySelector('.nav');

/* A single indicator slides between nav items instead of each item owning its
   own underline. One element, two custom properties, no layout thrash. */
let navIndicator = null;
if (nav && nav.children.length) {
  navIndicator = nav.querySelector('.nav__pill');
  if (!navIndicator) {
    navIndicator = document.createElement('span');
    navIndicator.className = 'nav__pill';
    navIndicator.setAttribute('aria-hidden', 'true');
    nav.prepend(navIndicator);
  }
}

function moveIndicator(target) {
  if (!navIndicator || !target) return;
  const navBox = nav.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  navIndicator.style.setProperty('--x', `${(box.left - navBox.left).toFixed(1)}px`);
  navIndicator.style.setProperty('--w', `${box.width.toFixed(1)}px`);
  nav.dataset.indicating = 'true';
}

function restIndicator() {
  const current = nav?.querySelector('a[aria-current="true"]');
  if (current) moveIndicator(current);
  else if (nav) nav.dataset.indicating = 'false';
}

if (nav) {
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('pointerenter', () => moveIndicator(link));
    link.addEventListener('focus', () => moveIndicator(link));
  });
  nav.addEventListener('pointerleave', restIndicator);
  addEventListener('resize', restIndicator, { passive: true });
}

/* -------------------------------------------------------------------------
   2.5D parallax
   The stage owns three custom properties. Every layer inside it reads the same
   three and multiplies them by its own --depth, so the depth ordering lives in
   CSS and this file only reports where the pointer and the scroll are.
   ------------------------------------------------------------------------- */

const stages = [...document.querySelectorAll('[data-depth-stage]')];
const parallaxItems = [...document.querySelectorAll('[data-parallax]')];

const pointerTarget = { x: 0, y: 0 };
const pointerCurrent = { x: 0, y: 0 };

let scrollY = window.scrollY;
let needsFrame = false;

function schedule() {
  if (needsFrame) return;
  needsFrame = true;
  requestAnimationFrame(update);
}

function update() {
  needsFrame = false;

  if (masthead) {
    masthead.dataset.scrolled = String(scrollY > 8);
    // The hairline under the bar doubles as a reading-progress meter, so the
    // one decorative line in the header carries real information.
    const max = document.documentElement.scrollHeight - innerHeight;
    masthead.style.setProperty('--progress', max > 0 ? (scrollY / max).toFixed(4) : '0');
  }

  if (prefersReducedMotion.matches) return;

  // Ease toward the pointer so the scene never snaps.
  pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.08;
  pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.08;

  for (const stage of stages) {
    const rect = stage.getBoundingClientRect();
    // -1 when the stage sits below the fold, +1 once it has passed above it.
    const progress = 1 - (rect.top + rect.height / 2) / (innerHeight / 2);
    stage.style.setProperty('--px', pointerCurrent.x.toFixed(3));
    stage.style.setProperty('--py', pointerCurrent.y.toFixed(3));
    stage.style.setProperty('--sy', Math.max(-1.5, Math.min(1.5, progress)).toFixed(3));
  }

  for (const item of parallaxItems) {
    const strength = Number(item.dataset.parallax) || 0;
    const rect = item.getBoundingClientRect();
    if (rect.bottom < -200 || rect.top > innerHeight + 200) continue;
    const progress = 1 - (rect.top + rect.height / 2) / (innerHeight / 2);
    item.style.setProperty('--shift', (progress * strength).toFixed(2));
  }

  // Keep easing until the pointer has settled.
  if (
    Math.abs(pointerTarget.x - pointerCurrent.x) > 0.001 ||
    Math.abs(pointerTarget.y - pointerCurrent.y) > 0.001
  ) {
    schedule();
  }
}

addEventListener('scroll', () => { scrollY = window.scrollY; schedule(); }, { passive: true });
addEventListener('resize', schedule, { passive: true });

if (finePointer.matches) {
  addEventListener('pointermove', (event) => {
    pointerTarget.x = (event.clientX / innerWidth - 0.5) * 2;
    pointerTarget.y = (event.clientY / innerHeight - 0.5) * 2;
    schedule();
  }, { passive: true });
}

// Reset the scene when the visitor turns motion off mid-session.
prefersReducedMotion.addEventListener('change', () => {
  if (!prefersReducedMotion.matches) return;
  for (const stage of stages) {
    stage.style.removeProperty('--px');
    stage.style.removeProperty('--py');
    stage.style.removeProperty('--sy');
  }
});

schedule();

/* -------------------------------------------------------------------------
   Reveal on scroll — gated behind the .js class set above
   ------------------------------------------------------------------------- */

const revealables = document.querySelectorAll('.reveal');
if (revealables.length) {
  const observer = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });

  revealables.forEach((el) => observer.observe(el));
}

/* -------------------------------------------------------------------------
   Scroll spy for same-page anchors
   ------------------------------------------------------------------------- */

const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if (sections.length) {
  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of navLinks) {
        if (link.getAttribute('href') === `#${entry.target.id}`) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      }
      restIndicator();
    }
  }, { rootMargin: '-45% 0px -50% 0px' });

  sections.forEach((section) => spy.observe(section));
}

/* -------------------------------------------------------------------------
   Housekeeping
   ------------------------------------------------------------------------- */

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

// Links to files that may not exist yet in a fresh clone (CV PDFs) hide
// themselves rather than serving a 404 to a recruiter.
document.querySelectorAll('[data-optional-file]').forEach(async (link) => {
  try {
    const response = await fetch(link.getAttribute('href'), { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) link.hidden = true;
  } catch {
    link.hidden = true;
  }
});

/* Cards track the pointer so the sheen sits under the cursor. Two custom
   properties per card, written only while the pointer is inside it. */
if (finePointer.matches && !prefersReducedMotion.matches) {
  document.querySelectorAll('.project-card, .toolkit-group, .contact-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((event.clientX - box.left) / box.width * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${((event.clientY - box.top) / box.height * 100).toFixed(1)}%`);
    }, { passive: true });
  });
}

/* -------------------------------------------------------------------------
   PDF Modal
   ------------------------------------------------------------------------- */

const pdfModal = document.getElementById('pdfModal');
const pdfIframe = document.getElementById('pdfIframe');
const pdfCloseBtn = document.getElementById('pdfCloseBtn');
const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
const pdfFallbackDownload = document.getElementById('pdfFallbackDownload');
const pdfFallback = document.getElementById('pdfFallback');
const pdfTitle = document.getElementById('pdfModalTitle');
const openPdfBtns = document.querySelectorAll('.btn-open-pdf');

let lastFocusedElement = null;

function openPdfModal(pdfUrl, title) {
  if (!pdfModal) return;
  lastFocusedElement = document.activeElement;
  
  if (pdfIframe) {
    pdfIframe.src = pdfUrl;
    pdfIframe.style.display = 'block';
    if (pdfFallback) pdfFallback.style.display = 'none';
  }
  if (pdfDownloadBtn) pdfDownloadBtn.href = pdfUrl;
  if (pdfFallbackDownload) pdfFallbackDownload.href = pdfUrl;
  if (pdfTitle && title) pdfTitle.textContent = title;
  
  pdfModal.classList.add('is-open');
  pdfModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  
  if (pdfCloseBtn) pdfCloseBtn.focus();
}

function closePdfModal() {
  if (!pdfModal) return;
  pdfModal.classList.remove('is-open');
  pdfModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  
  if (pdfIframe) pdfIframe.src = '';
  
  if (lastFocusedElement) lastFocusedElement.focus();
}

if (pdfModal) {
  openPdfBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pdfUrl = btn.dataset.pdf || btn.getAttribute('href');
      const title = btn.dataset.title || 'CV — Anton Smedberg';
      openPdfModal(pdfUrl, title);
    });
  });
  
  if (pdfCloseBtn) {
    pdfCloseBtn.addEventListener('click', closePdfModal);
  }
  
  pdfModal.addEventListener('click', (e) => {
    if (e.target === pdfModal) closePdfModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pdfModal.classList.contains('is-open')) {
      closePdfModal();
    }
  });
}

restIndicator();

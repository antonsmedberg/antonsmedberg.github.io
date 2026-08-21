// main.js — progressive enhancement only.
// Content and primary navigation still work if this file never runs.

const root = document.documentElement;
root.classList.remove('no-js');
root.classList.add('js');

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* -------------------------------------------------------------------------
   Reveal on scroll
   ------------------------------------------------------------------------- */

const revealables = document.querySelectorAll('.reveal');

if (!revealables.length) {
  // nothing to do
} else if (reduceMotion.matches || !('IntersectionObserver' in window)) {
  revealables.forEach((el) => el.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
  );

  revealables.forEach((el) => revealObserver.observe(el));

  // Anything already past the viewport on load should not wait for a scroll.
  addEventListener('load', () => {
    revealables.forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-visible');
    });
  });
}

/* -------------------------------------------------------------------------
   Scroll spy
   ------------------------------------------------------------------------- */

const navLinks = [...document.querySelectorAll('.nav a[href^="#"], .dock a[href^="#"]')];
const sections = navLinks
  .map((link) => document.getElementById(link.getAttribute('href').slice(1)))
  .filter(Boolean);

if (sections.length && 'IntersectionObserver' in window) {
  const spy = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      for (const link of navLinks) {
        if (link.getAttribute('href') === `#${visible.target.id}`) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      }
    },
    { rootMargin: '-38% 0px -52% 0px', threshold: [0, 0.2, 0.5, 0.8] }
  );

  sections.forEach((section) => spy.observe(section));
}

/* -------------------------------------------------------------------------
   Header state
   ------------------------------------------------------------------------- */

const masthead = document.querySelector('.masthead');

if (masthead) {
  const hero = document.querySelector('.hero');

  // The bar floats over a dark hero, then lands on light paper. Switch it at
  // the boundary rather than at a fixed scroll offset, so it stays correct at
  // every viewport height.
  const updateHeader = () => {
    masthead.dataset.scrolled = String(scrollY > 8);

    // Pages without a dark hero (case studies, 404) always use the light bar.
    if (!hero) {
      masthead.dataset.theme = 'light';
      return;
    }

    // Hysteresis. Without a dead band the theme flips back and forth while the
    // hero's bottom edge sits under the bar, which is the flicker.
    const edge = hero.getBoundingClientRect().bottom - masthead.offsetHeight - 8;
    const current = masthead.dataset.theme;

    if (current !== 'light' && edge < -24) masthead.dataset.theme = 'light';
    else if (current !== 'dark' && edge > 24) masthead.dataset.theme = 'dark';
    else if (!current) masthead.dataset.theme = edge > 0 ? 'dark' : 'light';

  };

  // Auto-hide: retreat on scroll down, return on scroll up. A small threshold
  // stops trackpad jitter from toggling it, and it always returns near the top.
  let lastY = scrollY;
  let intent = 0;
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      ticking = false;
      updateHeader();

      const y = Math.max(0, scrollY);
      const delta = y - lastY;

      // Condense tracks absolute position, so it must update even when the
      // delta is below the jitter threshold — otherwise a smooth-scroll that
      // settles gently leaves the bar stuck in its narrow state.
      masthead.dataset.condensed = String(y > 40);

      if (y <= 40) {
        masthead.dataset.hidden = 'false';
        masthead.dataset.condensed = 'false';
        lastY = y;
        return;
      }

      // Accumulate intent rather than reacting to every frame: the bar only
      // moves after a sustained ~90px of travel in one direction, so a nudge
      // of the trackpad never flips it.
      if (Math.sign(delta) !== Math.sign(intent)) intent = 0;
      intent += delta;

      if (intent > 90 && y > 260) {
        masthead.dataset.hidden = 'true';
        intent = 0;
      } else if (intent < -70) {
        masthead.dataset.hidden = 'false';
        intent = 0;
      }

      lastY = y;
    });
  };

  updateHeader();
  masthead.dataset.condensed = String(scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
}

/* -------------------------------------------------------------------------
   CV modal
   ------------------------------------------------------------------------- */

const pdfModal = document.getElementById('pdfModal');

if (pdfModal) {
  const pdfIframe = document.getElementById('pdfIframe');
  const pdfCloseBtn = document.getElementById('pdfCloseBtn');
  const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
  const pdfFallback = document.getElementById('pdfFallbackDownload');
  const pdfTitle = document.getElementById('pdfModalTitle');

  let lastFocused = null;

  const focusables = () =>
    [...pdfModal.querySelectorAll('a[href], button:not([disabled]), iframe')].filter(
      (el) => el.offsetParent !== null || el === pdfIframe
    );

  const openModal = (url, title) => {
    lastFocused = document.activeElement;

    if (pdfIframe) pdfIframe.src = url;
    if (pdfDownloadBtn) pdfDownloadBtn.href = url;
    if (pdfFallback) pdfFallback.href = url;
    if (pdfTitle && title) pdfTitle.textContent = title;

    pdfModal.classList.add('is-open');
    pdfModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => pdfCloseBtn?.focus());
  };

  const closeModal = () => {
    pdfModal.classList.remove('is-open');
    pdfModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // Release the PDF so it stops consuming memory in the background.
    if (pdfIframe) pdfIframe.src = 'about:blank';

    if (lastFocused instanceof HTMLElement) lastFocused.focus();
    lastFocused = null;
  };

  document.querySelectorAll('.pdf-modal-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      const url = trigger.dataset.pdf || trigger.getAttribute('href');
      if (!url) return;

      // Let modifier-clicks and middle-clicks open the PDF in a new tab.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();
      openModal(url, trigger.dataset.title || pdfTitle?.dataset.default || 'CV');
    });
  });

  pdfCloseBtn?.addEventListener('click', closeModal);

  pdfModal.addEventListener('click', (event) => {
    if (event.target === pdfModal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (!pdfModal.classList.contains('is-open')) return;

    if (event.key === 'Escape') {
      closeModal();
      return;
    }

    if (event.key !== 'Tab') return;

    const items = focusables();
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

/* -------------------------------------------------------------------------
   Housekeeping
   ------------------------------------------------------------------------- */

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

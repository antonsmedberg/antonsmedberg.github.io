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

const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
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

    const boundary = hero
      ? hero.getBoundingClientRect().bottom - masthead.offsetHeight - 8
      : -1;

    masthead.dataset.theme = boundary > 0 ? 'dark' : 'light';

    const scrollable = document.documentElement.scrollHeight - innerHeight;
    masthead.style.setProperty('--progress', scrollable > 0 ? (scrollY / scrollable).toFixed(4) : '0');
  };

  updateHeader();
  addEventListener('scroll', updateHeader, { passive: true });
}

/* -------------------------------------------------------------------------
   Mobile nav sheet
   ------------------------------------------------------------------------- */

const navToggle = document.querySelector('[data-nav-toggle]');
const navSheet = document.getElementById('navSheet');

if (navToggle && navSheet) {
  const setNav = (open) => {
    navToggle.setAttribute('aria-expanded', String(open));
    navSheet.dataset.open = String(open);
  };

  navToggle.addEventListener('click', () => {
    setNav(navToggle.getAttribute('aria-expanded') !== 'true');
  });

  navSheet.addEventListener('click', (event) => {
    if (event.target.closest('a')) setNav(false);
  });

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setNav(false);
  });

  matchMedia('(min-width: 900px)').addEventListener('change', (event) => {
    if (event.matches) setNav(false);
  });
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

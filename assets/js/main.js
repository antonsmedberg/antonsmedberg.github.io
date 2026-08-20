// main.js — progressive enhancement only.
// Content and primary navigation still work if JavaScript fails.

const root = document.documentElement;
root.classList.remove('no-js');
root.classList.add('js');

/* Reveal --------------------------------------------------------------- */

const revealables = document.querySelectorAll('.reveal');

if (revealables.length && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -7% 0px', threshold: 0.06 }
  );

  revealables.forEach((element) => observer.observe(element));
} else {
  revealables.forEach((element) => element.classList.add('is-visible'));
}

/* Scroll spy ----------------------------------------------------------- */

const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')]
  .filter((link) => {
    const hash = link.getAttribute('href');
    return hash && hash.length > 1;
  });

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
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        link.toggleAttribute('aria-current', active);
        if (active) link.setAttribute('aria-current', 'true');
      }
    },
    {
      rootMargin: '-38% 0px -52% 0px',
      threshold: [0, 0.2, 0.5, 0.8]
    }
  );

  sections.forEach((section) => spy.observe(section));
}

/* Header --------------------------------------------------------------- */

const masthead = document.querySelector('.masthead');

function updateHeader() {
  if (!masthead) return;
  masthead.dataset.scrolled = String(window.scrollY > 8);
}

updateHeader();
addEventListener('scroll', updateHeader, { passive: true });

/* PDF modal ------------------------------------------------------------ */

const pdfModal = document.getElementById('pdfModal');
const pdfIframe = document.getElementById('pdfIframe');
const pdfCloseBtn = document.getElementById('pdfCloseBtn');
const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
const pdfFallbackDownload = document.getElementById('pdfFallbackDownload');
const pdfTitle = document.getElementById('pdfModalTitle');
const openPdfBtns = document.querySelectorAll('.pdf-modal-trigger');

let lastFocusedElement = null;

function openPdfModal(pdfUrl, title = 'CV — Anton Smedberg') {
  if (!pdfModal || !pdfIframe || !pdfUrl) return;

  lastFocusedElement = document.activeElement;

  pdfIframe.src = pdfUrl;
  if (pdfDownloadBtn) pdfDownloadBtn.href = pdfUrl;
  if (pdfFallbackDownload) pdfFallbackDownload.href = pdfUrl;
  if (pdfTitle) pdfTitle.textContent = title;

  pdfModal.classList.add('is-open');
  pdfModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => pdfCloseBtn?.focus());
}

function closePdfModal() {
  if (!pdfModal) return;

  pdfModal.classList.remove('is-open');
  pdfModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (pdfIframe) pdfIframe.src = 'about:blank';

  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }

  lastFocusedElement = null;
}

if (pdfModal) {
  openPdfBtns.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();

      const url = button.dataset.pdf || button.getAttribute('href');

      // If the progressive modal cannot be used, the real href remains a
      // valid PDF fallback in the HTML.
      if (!url) return;

      openPdfModal(
        url,
        button.dataset.title || 'CV — Anton Smedberg'
      );
    });
  });

  pdfCloseBtn?.addEventListener('click', closePdfModal);

  pdfModal.addEventListener('click', (event) => {
    if (event.target === pdfModal) closePdfModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pdfModal.classList.contains('is-open')) {
      closePdfModal();
    }
  });
}

/* Housekeeping --------------------------------------------------------- */

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

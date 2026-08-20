// main.js — progressive enhancement only.
// Every word of content is already in the HTML. Nothing here is required to
// read the page; if this file fails to load, the site still works.

const root = document.documentElement;
root.classList.remove('no-js');
root.classList.add('js');

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* -------------------------------------------------------------------------
   Reveal on scroll
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

const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')]
  .filter((link) => {
    const hash = link.getAttribute('href');
    return hash && hash.length > 1;
  });
const sections = navLinks
  .map((link) => {
    const id = link.getAttribute('href').slice(1);
    return document.getElementById(id);
  })
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
    }
  }, { rootMargin: '-45% 0px -50% 0px' });

  sections.forEach((section) => spy.observe(section));
}

/* -------------------------------------------------------------------------
   Header scroll state
   ------------------------------------------------------------------------- */

const masthead = document.querySelector('.masthead');
if (masthead) {
  addEventListener('scroll', () => {
    masthead.dataset.scrolled = String(scrollY > 8);
  }, { passive: true });
}

/* -------------------------------------------------------------------------
   PDF Modal
   ------------------------------------------------------------------------- */

const pdfModal = document.getElementById('pdfModal');
const pdfIframe = document.getElementById('pdfIframe');
const pdfCloseBtn = document.getElementById('pdfCloseBtn');
const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
const pdfFallbackDownload = document.getElementById('pdfFallbackDownload');
const openPdfBtns = document.querySelectorAll('.pdf-modal-trigger');

function openPdfModal(pdfUrl, title) {
  if (!pdfModal || !pdfIframe) return;
  
  pdfIframe.src = pdfUrl;
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
}

if (pdfModal) {
  openPdfBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const url = btn.dataset.pdf || btn.href;
      const title = btn.dataset.title || 'CV — Anton Smedberg';
      openPdfModal(url, title);
    });
  });
  
  if (pdfCloseBtn) {
    pdfCloseBtn.addEventListener('click', closePdfModal);
  }
  
  pdfModal.addEventListener('click', (event) => {
    if (event.target === pdfModal) closePdfModal();
  });
  
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pdfModal.classList.contains('is-open')) {
      closePdfModal();
    }
  });
}

/* -------------------------------------------------------------------------
   Housekeeping
   ------------------------------------------------------------------------- */

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

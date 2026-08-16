/**
 * main.js — progressive enhancement only.
 * Every word of content is already in the HTML; nothing here is required to
 * read the page. Keeps the site crawlable and resilient if JS fails.
 */

import { mountDepthField } from './depth-field.js';

/* Mark the document as scripted. Reveal animations are gated on this class,
   so a failed or blocked script leaves the page fully readable. */
document.documentElement.classList.add('js');

/* Hero depth field ---------------------------------------------------------- */
const field = document.getElementById('depth-field');
if (field) mountDepthField(field);

/* Sticky header hairline ---------------------------------------------------- */
const masthead = document.querySelector('.masthead');
if (masthead) {
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);

  new IntersectionObserver(([entry]) => {
    masthead.dataset.stuck = String(!entry.isIntersecting);
  }).observe(sentinel);
}

/* Scroll reveal ------------------------------------------------------------- */
const revealables = document.querySelectorAll('[data-reveal]');
if (revealables.length) {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  revealables.forEach((el) => io.observe(el));
}

/* Scroll spy — marks the nav link for the section in view -------------------- */
const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
if (navLinks.length) {
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.setAttribute(
          'aria-current',
          link.getAttribute('href') === `#${entry.target.id}` ? 'true' : 'false'
        );
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  sections.forEach((section) => spy.observe(section));
}

/* Footer year --------------------------------------------------------------- */
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

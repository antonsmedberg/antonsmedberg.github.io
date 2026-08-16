# Anton Smedberg — Portfolio

This is my portfolio site. Live at [antonsmedberg.github.io](https://antonsmedberg.github.io/).

I built it as a static site — no build step, no framework, no CDN dependencies. Just HTML, CSS, and a small amount of JavaScript for progressive enhancement. Every word of content lives in the HTML, so search engines, LinkedIn's link preview, and anyone with JavaScript disabled all see the full page.

## What's inside

- **Home** — Hero, about, selected work, experience, toolkit, contact
- **CV** — Full CV in HTML with embedded PDF viewer and download
- **404** — Not-found page
- **Assets** — Photos, CV PDFs, favicon, social card image

## Tech notes

- Responsive from 390px up
- Content renders without JavaScript
- `prefers-reduced-motion` disables animations
- Skip link, focus rings, labelled icon buttons
- Inline SVG sprite (no icon CDN)
- Print stylesheet on the CV page

## Editing

There's no CMS — I edit the HTML directly. To add a project, I copy a card block in `index.html`. To add a role, I copy a timeline entry and mirror it on `cv.html`.

## Licence

The code in this repository is licensed under the [MIT License](LICENSE).

Written content, CV, and photographs are not covered by this licence — all rights reserved.

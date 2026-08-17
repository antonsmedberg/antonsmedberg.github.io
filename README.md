# antonsmedberg.github.io

Portfolio and CV for **Anton Smedberg** — iOS developer, Malmö, Sweden.

Static site. No framework, no build step, no third-party CDN. All content is in
the HTML, so search engines, LinkedIn's link preview and anyone with JavaScript
disabled see the full page.

Live: <https://antonsmedberg.github.io/>

---

## Design language — "instrument"

Light, precise, high-contrast. The surface behaves like technical
documentation: white panels, single-pixel rules, generous measure, and **one
accent** (`--accent: #2f4bd8`) used for everything interactive and nothing else.

The multi-hue depth ramp is deliberately confined to the one place it carries
meaning — the depth reconstruction in the hero — so the interface around it
stays quiet. On a light ground the ramp inverts: **contrast is the depth cue**,
so far points sit pale (`#8c9cb2`) and near points sit ink (`#0c1426`), with a
hue journey through indigo alongside.

To change the whole look, edit the `:root` block at the top of
`assets/css/style.css`. Nothing else hardcodes a colour.

**Type:** Schibsted Grotesk (variable) carries both display and text — a Nordic
grotesk with real character at headline sizes and a workable text cut, which
keeps the family count to two. IBM Plex Mono handles data, labels and
measurements. Self-hosted from `assets/fonts/`, 76 KB total, no request to
Google and no GDPR question about hotlinking fonts from an EU site.

## The hero — a LiDAR line scan

One graphic does two jobs. Evenly spaced horizontal lines run across the frame.
Where they cross the figure they bend upward in proportion to depth and describe
the face; where they do not, they are perfectly straight and run to the edge.
The same system that draws the portrait **is** the background, so nothing has to
be blended into anything else — there is only one thing there.

That is also literally what a depth sensor does: sweep a line across a surface
and record where it bends.

### Why this and not the earlier attempts

- **A point cloud** rendered depth as thousands of discrete samples. However
  carefully density, size and alpha were tuned, that reads as noise — because it
  *is* noise, sampled off a surface.
- **Iso-depth contours** were smooth, but they sat as a separate object on top
  of a separate grid, and the grid read as graph paper.

The line scan removes the grid entirely, because the flat parts of the lines are
the background.

### Occlusion is what makes it read as solid

Each line carries a fill in the page colour running to the bottom of the frame,
and lines are drawn far-to-near — top row first. Nearer ridges therefore hide
the tails of the ones behind them. Without that step the same paths read as a
wire mesh rather than a form.

Two consequences worth knowing:

- The fills are the page colour, so they are invisible against the background
  **but they still cover anything underneath them.** `.identity-scene` carries
  `overflow: hidden` so the scan can never reach the headline column. Removing
  that clip greys out the hero copy.
- If you change `--bg`, change `--scan-fill` with it.

### The field

`tools/build-assets.py` weights the height field toward **shading detail**, not
silhouette volume. With the volume term dominant, the relief comes out as a
smooth hill; the brow, nose and jaw only appear when the detail band leads. The
depth map used elsewhere (`portrait-depth.png`) is weighted the other way, which
is why two weightings exist.

The field is then feathered to zero across the silhouette, so lines rejoin the
flat background without a step.

### Depth ordering

| Layer                     | `--depth` | What it is                     |
|---------------------------|-----------|--------------------------------|
| `.identity-bg`            | −6        | ambient colour, mixed in oklch |
| `.identity-scan`          | −2        | the line scan                  |
| `.identity-portrait-wrap` | +3        | the photograph                 |

`main.js` writes `--px` / `--py` (pointer) and `--sy` (scroll) onto the stage;
each layer multiplies those by its own depth. The scan and the photograph
separating under the pointer is where the 2.5D comes from — no canvas, no
per-frame work, 61 fps.

## Other things that carry information

- **The hairline under the header** is a reading-progress meter, not decoration.
- **Toolkit glyphs** are custom, drawn on one 24px grid with a 1.4 stroke and
  square joints, rather than a borrowed icon set.
- **Shape carries meaning.** Every data chip — `.tech`, `.skill-pill`,
  `.status`, `.identity-chip` — shares a 7px radius. The pill shape is reserved
  for `.hero__eyebrow`, the one element reporting live state.
- **Link marks match their destination.** External links carry the out-arrow
  and it travels up and right on hover; internal links carry a plain arrow that
  travels sideways.
- **Every raised surface has a one-pixel light edge** along its top. At this
  contrast level that is what separates a panel from a rectangle.
- **The nav pill** slides and resizes between items; `main.js` writes `--x` and
  `--w` and the element does the rest.
- **The first project card** spans the full grid because MetalVisualKit is the
  one fully public, installable artefact. The hierarchy encodes verifiability.
- **Capture brackets** on the hero and on every screenshot use the same reticle
  language, so a screenshot reads as something captured rather than framed.
- **Film grain** is generated from an inline `feTurbulence`, so it costs one
  data URI and no request, and it keeps large flat areas from banding.

## Structure

```
index.html            Home — hero, proof strip, work, experience, skills, about, contact
cv.html               Full CV in HTML, printable, with PDF download
sv/                   Swedish versions of both
work/                 Four case-study pages + screenshots
404.html              Not-found page

assets/css/style.css  All styling. Tokens at the top.
assets/fonts/         Self-hosted woff2
assets/js/main.js     Progressive enhancement — nav state, parallax, reveals
assets/img/face-scan.svg   LiDAR line scan of the portrait (generated)
assets/img/           Portrait, favicon, social card
tools/build-assets.py Regenerates the portrait cut-out and screenshots
tools/source/         Original photo + cached cut-out (not served)
```

## Regenerating images

```bash
pip install pillow
python3 tools/build-assets.py
```

It reuses `tools/source/portrait-cutout-cache.png`, so `rembg` is only needed
if you replace the source photograph — delete the cache file and install
`rembg[cpu]` to redo the background removal.

The script prints the correct `width`/`height` attributes for each screenshot.
**Use them.** Declaring a 16:9 size on a portrait phone capture is what caused
the stretched screenshots and the layout shift in the previous version.

## Local preview

```bash
python3 -m http.server 8000
```

Paths are root-relative, so opening `index.html` from the filesystem will not
load the CSS.

## Quality floor

Verified across 9 pages at 7 viewports (320 → 1920):

- no horizontal overflow anywhere
- no console or JavaScript errors
- every class in the markup has a matching CSS rule
- no broken internal links
- every `<use href="#icon">` resolves to a symbol present on that page
- content renders with JavaScript disabled — reveal animations are gated behind
  a `.js` class added at runtime

### Frame budget

Three things were measured and fixed rather than assumed:

| Change | Gain |
|---|---|
| Replaced the canvas point cloud with static contour SVGs | +27 fps |
| Dropped a `scale` animation on a masked layer | +27 fps |
| Removed the `mix-blend-mode` film grain (earlier pass) | +12 fps |

Two of those are the same lesson: anything that animates a layer carrying a
mask or a blend forces that layer to re-rasterise every frame. The parallax
already supplies motion, so both animations were cost without benefit.

Currently **61 fps** in software-rendered headless — i.e. no measurable cost.
- `prefers-reduced-motion` disables parallax, the canvas and all transitions
- skip link, visible focus rings, landmark elements, labelled icon buttons
- `cv.html` has a print stylesheet

## Licence

Code is free to reuse. Written content, CV and photographs are not.

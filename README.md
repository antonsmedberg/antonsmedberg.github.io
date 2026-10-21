# antonsmedberg.github.io

I'm Anton Smedberg, an iOS developer in Malmö. I write Swift, SwiftUI and
Swift Concurrency, and I spent five months on the Mobile Apps team at Axis
Communications in Lund putting changes into an app that real customers use.
This repository is my portfolio. It's live at
[antonsmedberg.github.io](https://antonsmedberg.github.io/).

I'm open to iOS and mobile developer roles in Malmö, Lund and Copenhagen —
on-site, hybrid or remote. Swedish and English.

**Stack across this site and my projects:** Swift 6 · SwiftUI · UIKit ·
Swift Concurrency (async/await, actors) · SwiftData · Combine · AVFoundation ·
Metal · ARKit · RealityKit · SpeechAnalyzer · XCTest · Xcode · Swift Package
Manager · Instruments · StoreKit 2 · TestFlight · Git · GitHub Actions ·
Kotlin · Jetpack Compose · Java · Spring Boot · REST · GraphQL

## Running it

Static HTML, CSS and JavaScript. No framework, no build step, no
`npm install`. GitHub Pages serves `main` as-is.

```bash
python3 -m http.server 8000
```

## Layout

```
index.html                   English
sv/index.html                Swedish — written in Swedish, not translated
cv/index.html                CV, English
sv/cv/index.html             CV, Swedish
work/*.html                  Case studies: MetalVisualKit, DeviceMonitor, Subtl, Prism Spatial
work/*-{360,480,…}.webp      The two app captures at the widths the srcset lists
subtl/                       Subtl support site and privacy policy, with its own stylesheet
404.html
robots.txt, sitemap.xml
assets/css/style.css         Fonts, tokens, base, components. One layer, no overrides.
assets/css/case-study.css    Case-study page styles
assets/js/main.js            Theme toggle, scroll spy, reveal, Fig. 0 control, copy button
assets/js/stipple.js         Fig. 0 stipple: sample, computeDots, paintDots, fitCanvas
assets/js/depth-cloud.js     Fig. 0 depth cloud. Raw WebGL, imported on request.
assets/img/                  Portrait (300/600/840 w), depth map, mark, icons, OG image
assets/fonts/                Instrument Serif, Instrument Sans, IBM Plex Mono + LICENSE.md
assets/cv/                   CV PDFs, English and Swedish
assets/data/cv.json          The CV content the CV pages and PDFs are built from
tools/build-assets.py        Portrait derivatives, the depth map, the capture sizes
tools/render-images.js       favicon-32.png, apple-touch-icon.png, og-image.png
tools/og.html                Template for the OG image
tools/build-cv.py            cv/ and sv/cv/ from assets/data/cv.json
tools/build-cv-pdf.js        The two PDFs, from the CV pages
tools/stamp.py               Writes the counted numbers into the pages
tools/source/                Studio shot, cut-out cache, the two unedited captures
```

## Fig. 0

One portrait, three renderings, all from the same two images: the
photograph and a depth map baked from it.

**Stipple** (the default). `stipple.js` reads `portrait-300.webp` for
luminance and `portrait-depth.webp` for depth, detail and the silhouette,
then places points on a jittered 260×325 grid with a fixed seed. Dark and
structured areas get more and larger points, near surfaces press harder, and
the shoulders fade into the paper. It is drawn once as a single Canvas 2D
path, redrawn only on resize or a theme change, and the point count in the
caption is written by the script. In dark mode the same dots print in cream:
a paper negative.

**Photograph.** The `<img>` is already in the figure; the control, hover on a
fine pointer, or press-and-hold on touch fades it in over the dots. It is
also what you get without JavaScript.

**Depth cloud.** `depth-cloud.js` is imported the first time the button is
pressed, so nothing WebGL runs before that. A 320×400 lattice of 128 000
candidate points reads the depth map on the GPU; points are culled where the
face is smooth and kept where it has structure, and the script counts the
kept points on the CPU for the caption. One reveal sweep, then the loop
stops. Pointer movement draws single frames; Rescan replays the sweep.

The depth map, `portrait-depth.webp` (300×375, lossless), carries four things
in one image:

| channel | what it holds |
|---------|---------------|
| R | depth: a per-row distance transform plus a high-pass of the shading |
| G | facial detail, from a band-passed edge response with the silhouette suppressed |
| B | distance from the silhouette |
| A | the portrait mask |

The G channel is the part I'd point at in an interview. A uniform grid spends
as many points on a flat cheek as on an eyelid, which is why early versions
gave me a face you couldn't read. Baking edge detail into the image lets both
renderers put small dense points where the face has structure and drop most of
them where it doesn't. The detail channel is baked per photograph: a new face
against the old map looks wrong.

## Rebuilding assets

```bash
pip install pillow numpy scipy       # plus rembg[cpu] if the portrait source changes
python3 tools/build-assets.py        # portrait-*.webp, portrait-depth.webp, work/*-{360,480,…}.webp
node tools/render-images.js          # favicon-32.png, apple-touch-icon.png, og-image.png
python3 tools/build-cv.py            # cv/index.html and sv/cv/index.html from assets/data/cv.json
node tools/build-cv-pdf.js           # assets/cv/*.pdf from the CV pages
python3 tools/stamp.py               # the numbers in the pages
```

`build-assets.py` cuts the studio shot out of its backdrop (cached in
`tools/source/`, so `rembg` is only needed when the source changes), crops it
to 4:5, feathers the shoulders, writes the three portrait sizes and the depth
map, and resizes the two app captures to the widths the `<img srcset>` lists.

`render-images.js` and `build-cv-pdf.js` need Node with Playwright and its
Chromium on `NODE_PATH`. The icons are rendered from `favicon.svg`; the OG
image from `tools/og.html`, which loads the site's own fonts and draws the
stipple with the same `stipple.js` the page uses.

`stamp.py` (stdlib only) rewrites every `<span data-stamp="…">` in the pages
before a commit: the build date, the date of the last commit, the number of
`func test` in a local MetalVisualKit checkout together with the short hash
it was counted at (`--mvk` points at the checkout), and the request count and
weight of a first view of `index.html`, measured from the files on disk. It
only ever replaces the text inside those spans, and running it twice changes
nothing.

## Decisions I'd defend

- **Content on cards, navigation on glass.** Projects, the at-a-glance numbers
  and the skills sheet sit on cards with soft corners; only the masthead and
  the phone tab bar are translucent, because they are the only things that
  float over content. That is the rule Apple gives for Liquid Glass in
  iOS 26, and it keeps the page calm.
- **It should feel like the platform it is about.** Buttons are capsules,
  EN/SV and Fig. 0's renderings are segmented controls drawn the way iOS
  draws them, the phone navigation is a floating tab bar with icons, and the
  logo is an app icon: a continuous-corner tile with an A whose crossbar is a
  red rule running past the letter.
- **Figures say what they are.** Real captures are labelled as captures, the
  two unfinished projects are drawn as architecture diagrams instead of mock
  screens, and the diagrams are real text in real boxes so they reflow on a
  phone instead of shrinking to unreadable.
- **Numbers are counted, not typed.** The test count carries the commit hash
  it was counted at, and the footer's request count and page weight are
  measured from disk by `tools/stamp.py`. If a number goes stale, the stamp
  moves it.
- **Motion only where it means something.** The stipple draws itself once;
  text blocks fade in as they scroll into view; cards lift on hover; between
  pages a project's figure morphs into its case study (cross-document view
  transitions, Chrome 126+ and Safari 18.2+, a plain navigation elsewhere).
  The depth cloud runs only when asked for and stops after one sweep.
  `prefers-reduced-motion` turns all of it off.
- **Light and dark from the system, with a toggle.** `color-scheme: light dark`,
  the dark tokens under `prefers-color-scheme`, and an inline script that
  applies a stored choice before first paint so nothing flashes. In dark the
  logo tile inverts so it never disappears into the page.
- **Contrast is measured, not eyeballed.** With the shipped tokens, body ink
  is 16.7:1 on the page and 18.5:1 on cards, secondary text 8.4:1, captions
  and labels 5.2:1 (5.8:1 on cards) in light and 5.8:1 in dark. The accent
  carries text only in the large cover line (4.8:1 light, 7.8:1 dark); links
  use the darker `--accent-ink` (5.4:1 light, 8.4:1 dark); status chips are
  5.4:1 or better. Everything that is text clears WCAG AA in both themes.
- **Nothing third-party.** No CDN, no analytics, no Google Fonts. The four
  font files are vendored. The footer's "n requests · n KB" line is the
  measured first view of the home page, stamped at build time.

## Contact

anton@smedberg.eu · [LinkedIn](https://www.linkedin.com/in/anton-smedberg-a9aa6121b/)

## Licence

Code under MIT (`LICENSE`). The photograph and the CVs are mine — please
don't reuse those. The fonts are under the SIL Open Font License; see
[`assets/fonts/LICENSE.md`](assets/fonts/LICENSE.md).

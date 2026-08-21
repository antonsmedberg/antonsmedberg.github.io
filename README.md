# antonsmedberg.github.io

I'm Anton Smedberg, an iOS developer in Malmö. I write Swift, SwiftUI and
Swift Concurrency, and I spent five months on the Mobile Apps team at Axis
Communications in Lund putting changes into an app that real customers use.
This repository is my portfolio. It's live at
[antonsmedberg.github.io](https://antonsmedberg.github.io/).

I'm open to iOS and mobile developer roles across Skåne, Öresund and
Copenhagen — on-site, hybrid or remote. Swedish and English.

**Stack across this site and my projects:** Swift 6 · SwiftUI · UIKit ·
Swift Concurrency (async/await, actors) · SwiftData · Combine · AVFoundation ·
Metal · ARKit · RealityKit · Core ML · XCTest · Xcode · Swift Package Manager ·
Instruments · StoreKit 2 · TestFlight · Git · GitHub Actions · Kotlin ·
Jetpack Compose · Java · Spring Boot · REST · GraphQL

## Running it

Static HTML, CSS and JavaScript. No framework, no build step, no
`npm install`. GitHub Pages serves `main` as-is.

```bash
python3 -m http.server 8000
```

## Layout

```
index.html              English
sv/index.html           Swedish — written in Swedish, not translated
work/*.html             Case studies
404.html
assets/css/style.css    Tokens first, then components. One layer, no overrides.
assets/css/case-study.css
assets/js/main.js       Reveal, scroll spy, dock, CV modal, header behaviour
assets/js/depth-hero.js The hero point cloud. Raw WebGL, ~16 KB.
assets/img/             Portrait, depth map, icons
assets/fonts/           Self-hosted woff2
assets/cv/              CV, English and Swedish
tools/build-assets.py   Rebuilds the portrait derivatives and the depth map
```

## The hero

Half photograph, half point cloud. The cloud reads from `portrait-depth.png`,
which carries four things in one image:

| channel | what it holds |
|---------|---------------|
| R | depth |
| G | facial detail, from a band-passed edge response |
| B | distance from the silhouette |
| A | the portrait mask |

The G channel is the part I'd point at in an interview. A uniform grid spends
as many points on a flat cheek as on an eyelid, which is why early versions
gave me a face you couldn't read. Baking edge detail into the image lets the
shader put small dense points where the face has structure and cull most of
them where it doesn't. Each point also samples the photograph for its own
colour, so pupils and lips keep the contrast that makes them recognisable, and
the vertex shader measures the local depth gradient so turning surfaces
resolve brighter — the way a scanner is actually more confident at an edge.

None of that costs a request at runtime. It's one 70 KB PNG plus a texture the
browser has already downloaded for the `<picture>` element.

**Replace the portrait and you have to rebuild the map:**

```bash
pip install pillow numpy scipy rembg
python3 tools/build-assets.py
```

The detail channel is baked per photograph. A new face against the old map
looks wrong.

## Decisions I'd defend

- **Colours come from the magma colormap**, the ramp used to visualise depth
  and thermal data. Felt more honest than picking something off a mood board.
  Every token sits at the top of `style.css`.
- **Contrast is measured, not eyeballed.** Twelve text styles are checked
  against WCAG AA. Dark themes fail this more often than light ones, because
  mid-grey looks fine on a good monitor and vanishes on a phone outdoors.
- **Very little animates.** There was a rotating gradient border and a scroll
  progress bar once. Both were decoration; both are gone. What's left is the
  point cloud, hover states, and a 1px press on buttons.
- **Navigation is a dock, not a hamburger.** Four short words don't need
  hiding behind a tap, and the dock steps aside when the footer appears.
- **Nothing third-party.** No CDN, no analytics, no Google Fonts. 13 requests,
  around 355 KB on desktop.

## Contact

anton@smedberg.eu · [LinkedIn](https://www.linkedin.com/in/anton-smedberg-a9aa6121b/)

## Licence

Code under MIT. The photograph and the CVs are mine — please don't reuse those.

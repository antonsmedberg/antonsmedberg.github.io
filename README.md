# antonsmedberg.github.io

My portfolio. I'm Anton Smedberg — iOS developer in Malmö, currently looking
for a junior role somewhere around Skåne, Öresund or Copenhagen.

Static HTML, CSS and JavaScript. No framework, no build step, no npm install.
GitHub Pages serves `main` directly. If you clone it, opening `index.html`
through a local server is the whole setup.

```bash
python3 -m http.server 8000
```

## Layout

```
index.html              English
sv/index.html           Swedish — full parity, written in Swedish, not translated
work/*.html             Case studies
404.html
assets/css/style.css    Tokens first, then components. One layer, no overrides.
assets/css/case-study.css
assets/js/main.js       Reveal, scroll spy, mobile nav, CV modal
assets/js/depth-hero.js The hero point cloud. Raw WebGL, ~15 KB.
assets/img/             Portrait, depth map, icons
assets/fonts/           Self-hosted woff2
assets/cv/              CV, English and Swedish
tools/build-assets.py   Rebuilds the portrait derivatives and the depth map
```

## About the hero

The face on the front page is half photograph, half point cloud. The point
cloud reads from `portrait-depth.png`, which packs four things into one image:

| channel | what it holds |
|---------|---------------|
| R | depth |
| G | facial detail — band-passed edge response |
| B | distance from the silhouette |
| A | the portrait mask |

The G channel is the part I'd point at. A uniform grid of points spends as
much on a flat cheek as on an eyelid, which is why early versions had a face
you couldn't read. Baking edge detail into the image lets the shader put small
dense points where the face has structure and cull most of them where it
doesn't. Each point also samples the photograph for its own colour, so the
pupils and lips keep the contrast that makes them recognisable.

None of that costs a network request at runtime — it's all in one 70 KB PNG
and a texture the browser has already downloaded for the `<picture>` element.

**Swap the portrait and you have to rebuild the map:**

```bash
pip install pillow numpy scipy rembg
python3 tools/build-assets.py
```

The detail channel is baked per photograph. A new face against the old map
looks wrong.

## Decisions worth knowing

- **Colours come from the magma colormap** — the ramp used to visualise depth
  and thermal data. Felt more honest than picking a palette off a mood board.
  Every token sits at the top of `style.css`.
- **The dark theme is checked, not eyeballed.** Twelve text styles are audited
  against WCAG AA. Dark themes fail contrast more often than light ones,
  because mid-grey looks fine on a good monitor and vanishes on a phone
  outdoors.
- **Almost nothing animates.** There was a rotating gradient border and a
  scroll progress bar. Both were decoration and both are gone. What's left is
  the point cloud, hover states, and a 1px press on buttons.
- **No third-party anything.** No CDN, no analytics, no fonts from Google.
  13 requests, ~355 KB on desktop.

## Licence

Code under MIT. The photograph and the CVs are mine — please don't reuse those.

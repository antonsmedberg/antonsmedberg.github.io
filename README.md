# antonsmedberg.github.io

Portfolio for Anton Smedberg — iOS developer, Malmö.
Static site, no build step, deployed straight from `main` by GitHub Pages.

## Structure

```
index.html              English homepage
sv/index.html           Swedish homepage (full parity)
work/*.html             Case studies
404.html                Not-found page
assets/css/style.css    Design tokens + all components (single layer, no overrides)
assets/css/case-study.css
assets/js/main.js       Reveal, scroll spy, nav sheet, CV modal, header state
assets/js/depth-hero.js Raw-WebGL point cloud (no framework)
assets/img/             Portrait, depth map, icons, OG image
assets/fonts/           Self-hosted woff2 (Schibsted Grotesk, IBM Plex Mono)
assets/cv/              CV PDFs (EN + SV)
tools/build-assets.py   Regenerates portrait derivatives + depth map
```

## The hero

`portrait-depth.png` is an RGBA map, one channel per job:

| channel | meaning                                        |
|---------|------------------------------------------------|
| R       | depth                                          |
| G       | facial detail (band-passed edge response)      |
| B       | silhouette proximity                           |
| A       | portrait alpha                                 |

`depth-hero.js` uses G to decide where to spend points — dense and fine on
eyelids, lips and jaw; sparse and coarse on flat skin — and samples the
portrait itself for per-point colour.

**If you replace the portrait, regenerate the map:**

```bash
pip install pillow numpy scipy rembg
python3 tools/build-assets.py
```

The detail channel is baked per image. A new photo against the old map will
look wrong.

## Local preview

```bash
python3 -m http.server 8000
```

## Notes

- No dependencies, no bundler, no CDN. Everything is self-hosted.
- `.png` copies of images exist only as `<picture>` fallbacks; WebP-capable
  browsers never fetch them.
- Colours come from the magma colormap (the depth-visualisation standard).
  All tokens live at the top of `style.css`.
- Motion respects `prefers-reduced-motion`; the point cloud falls back to a
  plain portrait when WebGL is unavailable.

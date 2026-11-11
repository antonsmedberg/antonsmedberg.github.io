#!/bin/bash
# Builds the raster images the site serves, using only sips, cwebp, ffmpeg and Chrome.
# Project screenshots come straight from the project checkouts, so rerunning
# this after a project's captures change is all it takes to update the site.
#
#   tools/build-images.sh [path/to/Developer]   (default: the repo's parent)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV="${1:-$(dirname "$ROOT")}"
OUT="$ROOT/work/img"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -r "$TMP"' EXIT
mkdir -p "$OUT"

# webp SOURCE NAME WIDTH...  writes OUT/NAME-WIDTH.webp
webp() {
  local src="$1" name="$2"; shift 2
  local w
  for w in "$@"; do
    sips -s format png --resampleWidth "$w" "$src" --out "$TMP/t.png" >/dev/null
    cwebp -quiet -q 82 -m 6 "$TMP/t.png" -o "$OUT/$name-$w.webp"
  done
}

SUBTL="$DEV/Subtl"
for s in home studio studio-dark library import export; do
  webp "$SUBTL/Docs/Screenshots/$s.png" "subtl-$s" 360 602
done
webp "$SUBTL/Artifacts/LinkedIn/2026-11-09-iPhone-Duo/Light-final/Subtl-Duo-LinkedIn-2160x2700.jpg" subtl-duo 720 1080
webp "$SUBTL/Artifacts/Brand/subtl-icon-preview-180.png" icon-subtl 120 180

DM="$DEV/Swift/DeviceMonitor/Media"
for s in 01-overview-dark 02-devices-light 03-device-detail-light 05-insights-dark 07-scan-dark; do
  webp "$DM/screenshots/$s.png" "devicemonitor-${s#*-}" 360 720
done
webp "$DM/screenshots/ipad-pro-13-inch-m5/01-overview-light.png" devicemonitor-ipad 900 1400
# The icon file has its rounded corners and a lit edge drawn in. The pages mask
# every icon themselves, so only the middle is kept: full-bleed, like the rest.
sips -c 900 900 "$DM/app-icon.png" --out "$TMP/dm-icon.png" >/dev/null
webp "$TMP/dm-icon.png" icon-devicemonitor 120 180

webp "$DEV/Swift/MetalVisualKit/Media/loader-simulator.png" metalvisualkit-loader 360 644

for s in home run last-heart results; do
  webp "$ROOT/tools/source/giggledash/$s.jpg" "giggledash-$s" 800 1400
done
webp "$DEV/Swift/GiggleDash/GiggleDash/Assets.xcassets/AppIcon.appiconset/AppIcon.png" icon-giggledash 120 180

# Profile tile: head and shoulders from the portrait cutout, for a tile of 52 to
# 56 px at 2x to 4x. The page draws the tile and its side; the picture is the
# tile's width and 66/56 of its height, so the whole head, hair included,
# rises above the tile's top edge by 10/56 of its width, with a hair's breadth
# of air over it. The shoulders run out at the tile's sides and bottom. The
# quality is set for the first view's weight budget: the 3x file stays under
# the 132 px avatar it replaces.
sips -c 978 830 --cropOffset 22 105 "$ROOT/tools/source/portrait-cutout.png" --out "$TMP/me.png" >/dev/null
for w in 112 168 224; do
  sips --resampleWidth "$w" "$TMP/me.png" --out "$TMP/t.png" >/dev/null
  cwebp -quiet -q 70 -alpha_q 50 -m 6 -sharp_yuv "$TMP/t.png" -o "$ROOT/assets/img/me-cut-$w.webp"
done

# shot WIDTH HEIGHT URL OUT
shot() {
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$TMP/chrome" \
    --window-size="$1,$2" --virtual-time-budget=3000 --screenshot="$4" "$3" >/dev/null 2>&1
}

printf '<!doctype html><style>html,body{margin:0;background:#161b23;overflow:hidden}img{display:block;width:100vw;height:100vh}</style><img src="file://%s">' "$ROOT/assets/img/logo.svg" > "$TMP/touch.html"
shot 720 720 "file://$TMP/touch.html" "$TMP/touch.png"
sips --resampleWidth 180 "$TMP/touch.png" --out "$ROOT/assets/img/apple-touch-icon.png" >/dev/null

printf '<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:100vw;height:100vh}</style><img src="file://%s">' "$ROOT/assets/img/favicon.svg" > "$TMP/fav.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$TMP/chrome" --default-background-color=00000000 \
  --window-size=640,640 --screenshot="$TMP/fav.png" "file://$TMP/fav.html" >/dev/null 2>&1
sips --resampleWidth 32 "$TMP/fav.png" --out "$ROOT/assets/img/favicon-32.png" >/dev/null

# Link preview: the cover composed for LinkedIn (1200 x 627 at 2x, kept outside
# Git in Media/), scaled to 630 high and cut to 1200 wide. It is stored as a
# JPEG at the encoder's finest setting with colour at full resolution: a third
# of the PNG's weight and no difference to see. sips halves the colour below
# its top quality, which shows on the mascot, so ffmpeg writes the file.
# Without the cover the committed picture stays as it is.
COVER="$ROOT/Media/linkedin/linkedin-thumbnail@2x.png"
if [ -f "$COVER" ]; then
  sips --resampleHeight 630 "$COVER" --out "$TMP/cover.png" >/dev/null
  sips -c 630 1200 "$TMP/cover.png" --out "$TMP/og.png" >/dev/null
  ffmpeg -y -loglevel error -i "$TMP/og.png" -vf setsar=1 -q:v 1 -qmin 1 -pix_fmt yuvj444p -bitexact "$ROOT/assets/img/og-image.jpg"
fi

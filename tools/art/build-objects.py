#!/usr/bin/env python3
"""
Bakes the ring of cubes on MetalVisualKit's Home tile from tools/art/objects.mjs.

  assets/art/obj-metalvisualkit.webp   216 x 216, transparent, standing on row 196, in Bit's noon light

Headless Chrome draws it with Bit's own shaders on the GPU (objects.html); sips scales the drawing down and
cwebp packs it. Uses only what the Mac has: Chrome, sips, cwebp and Python's standard library. The page
is served from this checkout on a free local port for the time it takes, since modules do not load from file://.

Run from anywhere:  python3 tools/art/build-objects.py [--keep DIR]   (DIR keeps the full-size drawings)
"""

import base64
import fcntl
import functools
import http.server
import json
import os
import select
import shutil
import subprocess
import sys
import tempfile
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "art")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# The drawing is scaled down to these sizes, written with these suffixes.
SIZES = [(216, "")]
QUALITY = ["-q", "82", "-alpha_q", "70", "-m", "6", "-sharp_yuv"]


class Chrome:
    """Headless Chrome on the DevTools pipe (fds 3 and 4), one page."""

    def __init__(self, profile):
        to_r, to_w = os.pipe()
        from_r, from_w = os.pipe()
        hi_r = fcntl.fcntl(to_r, fcntl.F_DUPFD, 20)
        hi_w = fcntl.fcntl(from_w, fcntl.F_DUPFD, 20)
        args = ["--headless=new", "--remote-debugging-pipe", f"--user-data-dir={profile}", "--no-first-run",
                "--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"]
        wrapper = f'exec "$0" "$@" 3<&{hi_r} 4>&{hi_w} {hi_r}<&- {hi_w}>&-'
        self.proc = subprocess.Popen(["/bin/sh", "-c", wrapper, CHROME, *args], pass_fds=(hi_r, hi_w),
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for fd in (to_r, from_w, hi_r, hi_w):
            os.close(fd)
        self.w, self.r, self.buf, self.seq = to_w, from_r, b"", 0

    def send(self, method, params=None, session=None):
        self.seq += 1
        msg = {"id": self.seq, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        os.write(self.w, json.dumps(msg).encode() + b"\0")
        while True:
            while b"\0" not in self.buf:
                if not select.select([self.r], [], [], 60)[0]:
                    raise TimeoutError(f"Chrome did not answer {method}")
                chunk = os.read(self.r, 1 << 20)
                if not chunk:
                    raise RuntimeError("Chrome exited")
                self.buf += chunk
            raw, self.buf = self.buf.split(b"\0", 1)
            m = json.loads(raw)
            if m.get("id") == self.seq:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error'].get('message')}")
                return m.get("result", {})

    def close(self):
        self.proc.terminate()
        self.proc.wait(10)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def draw(tmp):
    """What objects.html drew: {name: (png bytes, reach)}."""
    server = serve()
    chrome = Chrome(os.path.join(tmp, "chrome"))
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/tools/art/objects.html"
        target = chrome.send("Target.createTarget", {"url": url})["targetId"]
        session = chrome.send("Target.attachToTarget", {"targetId": target, "flatten": True})["sessionId"]
        deadline = time.time() + 120
        while True:
            title = chrome.send("Runtime.evaluate", {"expression": "document.title", "returnByValue": True}, session)["result"]["value"]
            if title in ("done", "error") or time.time() > deadline:
                break
            time.sleep(0.2)
        text = chrome.send("Runtime.evaluate", {"expression": "document.getElementById('out').textContent", "returnByValue": True}, session)["result"]["value"]
    finally:
        chrome.close()
        server.shutdown()
    if title != "done":
        sys.exit(f"objects.html did not finish: {text.strip() or title}")
    toys = {}
    for line in text.strip().splitlines():
        name, data, reach = line.split(" ", 2)
        toys[name] = (base64.b64decode(data.split(",", 1)[1]), json.loads(reach))
    return toys


def main():
    keep = sys.argv[sys.argv.index("--keep") + 1] if "--keep" in sys.argv else None
    tmp = tempfile.mkdtemp()
    try:
        toys = draw(tmp)
        totals = {}
        for name, (png, reach) in toys.items():
            big = os.path.join(tmp, f"{name}-big.png")
            with open(big, "wb") as f:
                f.write(png)
            if keep:
                os.makedirs(keep, exist_ok=True)
                shutil.copy(big, os.path.join(keep, f"{name}-big.png"))
            margin = min(reach["left"], 216 - reach["right"], reach["top"])
            print(f"{name}: reaches x {reach['left']:.1f}-{reach['right']:.1f}, top {reach['top']:.1f}, foot {reach['foot']:.1f} of 216; margin {margin:.1f} px")
            for size, suffix in SIZES:
                small = os.path.join(tmp, f"{name}{suffix}.png")
                subprocess.run(["sips", "-z", str(size), str(size), big, "--out", small], check=True, stdout=subprocess.DEVNULL)
                out = os.path.join(OUT, f"{name}{suffix}.webp")
                subprocess.run(["cwebp", "-quiet", *QUALITY, small, "-o", out], check=True)
                totals[size] = totals.get(size, 0) + os.path.getsize(out)
                print(f"  {name}{suffix}.webp {os.path.getsize(out)} B")
        print("together: " + ", ".join(f"{k} px set {v} B" for k, v in totals.items()))
    finally:
        shutil.rmtree(tmp)


if __name__ == "__main__":
    main()

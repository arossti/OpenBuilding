#!/usr/bin/env python3
"""
BfCA OpenBuilding — no-cache dev server.

Serves the current working directory via Python's http.server but sends
``Cache-Control: no-store, no-cache, must-revalidate, max-age=0`` on every
response so the browser never heuristic-caches .mjs modules or other
assets during rapid iteration. The default ``python3 -m http.server``
lets Chromium cache modules aggressively across reloads, which makes
Playwright-driven verification of edits unreliable.

Usage:
    python3 schema/scripts/nocache-serve.py [port]

Default port is 8000. Invoke from the repo root (npm run serve does this).
"""

import mimetypes
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


# Ensure .mjs ES modules are served with a JS MIME (defensive; Python
# registers this by default on 3.10+, but pin it so a minimal/stripped
# mimetypes DB still works).
mimetypes.add_type("text/javascript", ".mjs")


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class ReusableServer(ThreadingHTTPServer):
    # Rebind immediately after ctrl+c instead of waiting out TIME_WAIT.
    # Python 3.9's default is False; 3.11+ flipped to True.
    allow_reuse_address = True


def main():
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"invalid port: {sys.argv[1]}", file=sys.stderr)
            sys.exit(2)
    with ReusableServer(("", port), NoCacheHandler) as server:
        print(f"serving http://localhost:{port}/  (no-cache headers active)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nshutting down")


if __name__ == "__main__":
    main()

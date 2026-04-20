#!/usr/bin/env python3
"""Pull the BfCA Materials DB sheet as `BEAM Database-DUMP.csv`.

This is the catalogue `beam-csv-to-json.mjs --all` reads to regenerate the
821-record `schema/materials/*.json` set. Sibling to `fetch-beam-sheet.py`
but points at a different Google Sheet (the BEAM workbook is one Sheet;
the Materials DB is a separate Sheet maintained by BfCA).

Uses the direct `/export?format=csv&gid=NNN` endpoint — tab-scoped, so the
gviz truncation issue that bit us in session 3 does not apply. Output
drops into `docs/csv files from BEAM/BEAM Database-DUMP.csv` so the
existing importer pipeline picks it up with zero path changes.

Usage:
  python3 schema/scripts/fetch-materials-db.py
"""

import sys
import urllib.request
from pathlib import Path

# BfCA Materials DB — separate Sheet from the BEAM workbook. Points at the
# shareable single-tab copy Andy exposed on 2026-04-20. The upstream
# authoritative DB sheet (1-gd2iH7UIoDuEt7gIC35PbgJf2sO5go9IwjkSxue-UA) is
# access-restricted; the copy below mirrors it with public viewer rights so
# this fetcher can run without auth. Swap the SHEET_ID if the upstream
# sheet ever gets made viewer-shareable.
SHEET_ID = "1zNE85cuSOBkCPiIDpj9ctYjSLbP_55Kj8TE4GDagU3M"

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = REPO_ROOT / "docs" / "csv files from BEAM" / "BEAM Database-DUMP.csv"


def download_csv() -> bytes:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv"
    print(f"  downloading {url}")
    # Google returns a 307 to the actual download host; urllib follows automatically.
    req = urllib.request.Request(url, headers={"User-Agent": "bfca-openbuilding/0.2"})
    with urllib.request.urlopen(req) as res:
        return res.read()


def main() -> int:
    data = download_csv()
    # A CSV starts with text; a login-wall redirect returns HTML instead. Detect
    # the failure mode and flag it early rather than writing bad bytes.
    head = data[:256].lower()
    if b"<html" in head or b"<!doctype" in head:
        print("  ERROR: response looks like HTML (sheet may not be publicly viewable)")
        return 1
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_bytes(data)
    rows = data.count(b"\n") + 1
    print(f"  wrote {len(data) / 1024:.0f} KB, {rows} rows -> {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

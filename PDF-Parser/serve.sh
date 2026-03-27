#!/bin/bash
# PDF-Parser dev server
# Usage: ./serve.sh [port]
# Opens http://localhost:8000 (or specified port)

PORT=${1:-8000}
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Serving PDF-Parser at http://localhost:$PORT"
echo "Press Ctrl+C to stop"
cd "$DIR" && python3 -m http.server "$PORT"

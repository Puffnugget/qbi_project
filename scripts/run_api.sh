#!/usr/bin/env bash
# Start FastAPI without watching frontend/.next (avoids reload storms with npm run dev).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec uvicorn api.main:app --reload --port 8000 \
  --reload-dir api \
  --reload-dir src

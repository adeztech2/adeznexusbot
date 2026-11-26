#!/bin/bash
# Start script for VPS / panels / Termux.  Usage: bash start.sh
cd "$(dirname "$0")"

# Session folder for the SQLite files (session.js manages cleanup, do not wipe)
mkdir -p lib/session

# .env is optional: on hosts that set variables themselves there is no file
if [ -f .env ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

exec node index.js

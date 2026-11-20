#!/bin/bash
cd "$(dirname "$0")"

# Ensure session folder exists (do NOT wipe — let session.js manage cleanup)
mkdir -p lib/session

set -o allexport
source .env
set +o allexport
exec node index.js

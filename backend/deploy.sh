#!/usr/bin/env bash
# Updates the app on the cPanel server from GitHub, in one command:
#
#   bash ~/Payment-Management-System/backend/deploy.sh
#
# The Node.js app's "Application root" must be this backend folder of the git
# clone (see docs/DEPLOY.md). Pulls, installs, builds, migrates, restarts.

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Enter the app's Node environment (cPanel keeps it in ~/nodevenv/<app root>/<version>).
if [ -z "${VIRTUAL_ENV:-}" ]; then
  ACTIVATE="$(ls -d "$HOME/nodevenv/${APP_DIR#"$HOME"/}"/*/bin/activate 2>/dev/null | tail -n 1)"
  if [ -z "$ACTIVATE" ]; then
    echo "No Node environment for $APP_DIR. Is it set as the app's Application root?" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$ACTIVATE"
fi

set -euo pipefail
cd "$APP_DIR"

# Shared-hosting limits: see "When something goes wrong" in docs/DEPLOY.md.
export NODE_OPTIONS=--disable-wasm-trap-handler TOKIO_WORKER_THREADS=2 MALLOC_ARENA_MAX=2

echo "==> Pulling"
git pull --ff-only

echo "==> Installing"
npm install --include=dev --no-audit --no-fund

echo "==> Building"
npm run build

echo "==> Migrating database"
npm run migrate

echo "==> Restarting"
mkdir -p tmp
touch tmp/restart.txt

echo "Deployed $(git log -1 --format='%h %s')"

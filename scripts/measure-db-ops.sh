#!/usr/bin/env bash
# Counts SQL statements per storefront request against the local dev server.
#
# Each `prisma:query` line the app logs is one billed operation on Prisma
# Postgres (the reason this instrument exists — see CHANGELOG 2026-08-21).
# Run with the dev server *not* already running:
#
#   ./scripts/measure-db-ops.sh
#
# Requires PRISMA_LOG_QUERIES support in server/shared/prisma.ts and a seeded
# local database.
set -euo pipefail

PRODUCT_SLUG="${PRODUCT_SLUG:-rose-musk-blend}"
CATEGORY_SLUG="${CATEGORY_SLUG:-abayas}"
PORT="${PORT:-3999}"
LOG="$(mktemp)"

PRISMA_LOG_QUERIES=1 npx next dev -p "$PORT" > "$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

echo "waiting for dev server (pid $SERVER_PID)..."
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:$PORT" 2>/dev/null && break
  sleep 1
done

# One throwaway warm-up hit per route: the first request pays dev-mode
# compilation, which must not pollute the counts.
warm() { curl -sf -o /dev/null "$1" || echo "WARN: warm-up failed for $1"; }
measure() { # measure <label> <curl args...>
  local label="$1"; shift
  local before after
  before=$(grep -c "^prisma:query" "$LOG" || true)
  curl -sf -o /dev/null "$@" || { echo "$label: REQUEST FAILED"; return; }
  sleep 2 # let streamed RSC rendering finish its trailing queries
  after=$(grep -c "^prisma:query" "$LOG" || true)
  echo "$label: $((after - before)) queries"
}

BASE="http://localhost:$PORT"
STOCK_BODY_ONE='{"items":[{"productId":"prod-5","quantity":1}]}'
STOCK_BODY_FIVE='{"items":[{"productId":"prod-5","quantity":1},{"productId":"prod-8","quantity":1},{"productId":"prod-9","quantity":1},{"productId":"prod-11","quantity":1},{"productId":"prod-12","quantity":1}]}'

warm "$BASE/"
warm "$BASE/category/$CATEGORY_SLUG"
warm "$BASE/product/$PRODUCT_SLUG"
warm "$BASE/api/search/suggestions?q=ro"

echo "--- measured (second hit, compile noise excluded) ---"
measure "homepage            " "$BASE/"
measure "category page       " "$BASE/category/$CATEGORY_SLUG"
measure "product page        " "$BASE/product/$PRODUCT_SLUG"
measure "search keystroke    " "$BASE/api/search/suggestions?q=ro"
measure "check-stock x1 item " -X POST -H 'Content-Type: application/json' -d "$STOCK_BODY_ONE" "$BASE/api/products/check-stock"
measure "check-stock x5 items" -X POST -H 'Content-Type: application/json' -d "$STOCK_BODY_FIVE" "$BASE/api/products/check-stock"

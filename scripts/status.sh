#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$(cd "$(dirname "$0")/.." && pwd)/docker-compose.yml"

echo "==> Container status"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "==> Recent logs (last 20 lines per service)"
docker compose -f "$COMPOSE_FILE" logs --tail=20

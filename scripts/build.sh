#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$(cd "$(dirname "$0")/.." && pwd)/docker-compose.yml"

echo "==> Building images..."
docker compose -f "$COMPOSE_FILE" build "$@"
echo "==> Build complete."

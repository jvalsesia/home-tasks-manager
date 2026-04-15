#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$(cd "$(dirname "$0")/.." && pwd)/docker-compose.yml"

echo "==> Starting containers..."
docker compose -f "$COMPOSE_FILE" up -d "$@"
echo "==> App running at http://localhost"

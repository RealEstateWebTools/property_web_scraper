#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:4321}"

echo "Running smoke tests against ${BASE_URL}"

curl -fsS "${BASE_URL}/health" >/dev/null
echo "PASS /health"

curl -fsS "${BASE_URL}/public_api/v1/health" >/dev/null
echo "PASS /public_api/v1/health"

curl -fsS "${BASE_URL}/public_api/v1/supported_sites" >/dev/null
echo "PASS /public_api/v1/supported_sites"

echo "Smoke tests passed"

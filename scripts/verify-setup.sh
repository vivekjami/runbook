#!/usr/bin/env bash
# verify-setup.sh — End-to-end health check for RunBook
# Verifies: all 6 indices exist, vector search returns results, MCP server responds
# Usage: bash scripts/verify-setup.sh
# Requires: ELASTIC_URL, ELASTIC_API_KEY, and optionally MCP_SERVER_URL

set -euo pipefail

ELASTIC_URL="${ELASTIC_URL:?Set ELASTIC_URL}"
ELASTIC_API_KEY="${ELASTIC_API_KEY:?Set ELASTIC_API_KEY}"
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:8080}"
INDEX_PREFIX="${INDEX_PREFIX:-runbook}"

auth_header="Authorization: ApiKey ${ELASTIC_API_KEY}"
PASS=0; FAIL=0

check() {
  local name="$1"; local cmd="$2"
  echo -n "  $name... "
  if eval "$cmd" &>/dev/null; then
    echo "✓"; (( PASS++ ))
  else
    echo "✗ FAILED"; (( FAIL++ ))
  fi
}

echo "=== RunBook Health Check ==="
echo ""

echo "[ Elastic Cluster ]"
check "Cluster reachable" \
  "curl -sf -H '$auth_header' '${ELASTIC_URL}/_cluster/health?timeout=5s'"

echo ""
echo "[ Elastic Indices ]"
for index in runbook_embeddings incident_dna blast_radius_snapshots shadow_actions chronicle_reports human_resolutions; do
  check "${INDEX_PREFIX}_${index}" \
    "curl -sf -o /dev/null -H '$auth_header' '${ELASTIC_URL}/${INDEX_PREFIX}_${index}'"
done

echo ""
echo "[ Index Mappings — dense_vector present ]"
for index in runbook_embeddings incident_dna; do
  check "${index} has dense_vector embedding field" \
    "curl -sf -H '$auth_header' '${ELASTIC_URL}/${INDEX_PREFIX}_${index}/_mapping' | grep -q 'dense_vector'"
done

echo ""
echo "[ Runbook Data ]"
count=$(curl -sf -H "$auth_header" "${ELASTIC_URL}/${INDEX_PREFIX}_runbook_embeddings/_count" | python3 -c "import sys,json;print(json.load(sys.stdin)['count'])" 2>/dev/null || echo 0)
echo -n "  Runbook chunks indexed: ${count}... "
if [[ "$count" -gt 0 ]]; then
  echo "✓"; (( PASS++ ))
else
  echo "✗ FAILED — run: bash scripts/ingest-runbooks.sh"; (( FAIL++ ))
fi

dna_count=$(curl -sf -H "$auth_header" "${ELASTIC_URL}/${INDEX_PREFIX}_incident_dna/_count" | python3 -c "import sys,json;print(json.load(sys.stdin)['count'])" 2>/dev/null || echo 0)
echo -n "  DNA records (historical incidents): ${dna_count}... "
if [[ "$dna_count" -ge 3 ]]; then
  echo "✓"; (( PASS++ ))
else
  echo "✗ FAILED — need INC-0045, INC-0046, INC-0047 in incident_dna"; (( FAIL++ ))
fi

echo ""
echo "[ MCP Server ]"
check "MCP server /health responds" \
  "curl -sf '${MCP_SERVER_URL}/health' | grep -q '\"status\"'"
check "MCP server elastic_connected" \
  "curl -sf '${MCP_SERVER_URL}/health' | grep -q '\"elastic_connected\": true'"

echo ""
echo "==========================="
echo "PASSED: ${PASS}  FAILED: ${FAIL}"
if [[ "$FAIL" -eq 0 ]]; then
  echo "All checks passed. Ready to run inject-incident.sh"
else
  echo "Fix the failed checks before proceeding."
  exit 1
fi

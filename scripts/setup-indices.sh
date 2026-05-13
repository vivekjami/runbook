#!/usr/bin/env bash
# setup-indices.sh — Create all 6 RunBook Elastic indices
# Usage: bash scripts/setup-indices.sh
# Requires: ELASTIC_URL and ELASTIC_API_KEY environment variables (or edit config below)

set -euo pipefail

ELASTIC_URL="${ELASTIC_URL:?Set ELASTIC_URL to your Elasticsearch endpoint}"
ELASTIC_API_KEY="${ELASTIC_API_KEY:?Set ELASTIC_API_KEY to your Elastic API key}"
INDEX_PREFIX="${INDEX_PREFIX:-runbook}"
MAPPINGS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../config/index-mappings" && pwd)"

auth_header="Authorization: ApiKey ${ELASTIC_API_KEY}"
content_header="Content-Type: application/json"

create_index() {
  local name="$1"
  local mapping_file="${MAPPINGS_DIR}/${name}.json"

  if [[ ! -f "$mapping_file" ]]; then
    echo "ERROR: Mapping file not found: $mapping_file"
    exit 1
  fi

  local index_name="${INDEX_PREFIX}_${name}"
  echo -n "Creating index '${index_name}'... "

  http_code=$(curl -s -o /tmp/runbook_es_response.json -w "%{http_code}" \
    -X PUT "${ELASTIC_URL}/${index_name}" \
    -H "$auth_header" \
    -H "$content_header" \
    --data-binary "@${mapping_file}")

  if [[ "$http_code" == "200" ]]; then
    echo "✓"
  elif [[ "$http_code" == "400" ]]; then
    response=$(cat /tmp/runbook_es_response.json)
    if echo "$response" | grep -q "resource_already_exists_exception"; then
      echo "already exists (skipped)"
    else
      echo "FAILED (HTTP $http_code)"
      cat /tmp/runbook_es_response.json
      exit 1
    fi
  else
    echo "FAILED (HTTP $http_code)"
    cat /tmp/runbook_es_response.json
    exit 1
  fi
}

echo "=== RunBook Index Setup ==="
echo "Elastic URL: ${ELASTIC_URL}"
echo "Index prefix: ${INDEX_PREFIX}"
echo ""

# Create all 6 indices in dependency order
create_index "runbook_embeddings"
create_index "incident_dna"
create_index "blast_radius_snapshots"
create_index "shadow_actions"
create_index "chronicle_reports"
create_index "human_resolutions"

echo ""
echo "=== Verifying indices ==="
for index in runbook_embeddings incident_dna blast_radius_snapshots shadow_actions chronicle_reports human_resolutions; do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "$auth_header" \
    "${ELASTIC_URL}/${INDEX_PREFIX}_${index}")
  if [[ "$status" == "200" ]]; then
    echo "  ✓ ${INDEX_PREFIX}_${index}"
  else
    echo "  ✗ ${INDEX_PREFIX}_${index} (HTTP $status)"
  fi
done

echo ""
echo "Setup complete. Run 'bash scripts/verify-setup.sh' for a full health check."

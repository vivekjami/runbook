#!/usr/bin/env bash
# inject-incident.sh — Inject the demo incident: checkout-service memory spike
# This is the script you run at 0:20 in the demo video.
# It injects 8 minutes of metric data showing a memory spike on checkout-service
# while all other services remain normal.
#
# Usage: bash scripts/inject-incident.sh [--incident-id INC-XXXX]
# Requires: ELASTIC_URL, ELASTIC_API_KEY

set -euo pipefail

ELASTIC_URL="${ELASTIC_URL:?Set ELASTIC_URL}"
ELASTIC_API_KEY="${ELASTIC_API_KEY:?Set ELASTIC_API_KEY}"
INCIDENT_ID="${1:-INC-$(date +%Y%m%d%H%M)}"
INDEX_PREFIX="${INDEX_PREFIX:-runbook}"

auth_header="Authorization: ApiKey ${ELASTIC_API_KEY}"
content_header="Content-Type: application/json"
now_epoch=$(date +%s)

echo "=== RunBook Demo Incident Injection ==="
echo "Incident ID: ${INCIDENT_ID}"
echo "Injecting checkout-service memory spike..."
echo ""

# ---------------------------------------------------------------------------
# Helper: push a bulk batch to Elasticsearch
# ---------------------------------------------------------------------------
push_bulk() {
  local data="$1"
  curl -s -o /dev/null -X POST "${ELASTIC_URL}/_bulk" \
    -H "$auth_header" \
    -H "Content-Type: application/x-ndjson" \
    --data-binary "$data"
}

# ---------------------------------------------------------------------------
# Generate 4 minutes of normal metrics for all services (pre-incident baseline)
# ---------------------------------------------------------------------------
echo -n "Injecting baseline (pre-incident, all services normal)... "
bulk_body=""
services=("payments-api" "auth-service" "product-catalog" "notification-service" "checkout-service")
for i in $(seq 0 3); do
  ts=$(( (now_epoch - 300 + i * 60) * 1000 ))
  for svc in "${services[@]}"; do
    if [[ "$svc" == "checkout-service" ]]; then
      mem=536870912  # 512MB normal
    else
      mem=314572800  # 300MB
    fi
    bulk_body+='{"index":{"_index":"metrics-runbook-demo"}}'$'\n'
    bulk_body+="{\"@timestamp\":${ts},\"service\":{\"name\":\"${svc}\"},\"system\":{\"memory\":{\"actual\":{\"bytes\":${mem}}}},\"http\":{\"response\":{\"duration\":$(( RANDOM % 50 + 100 ))}},\"event\":{\"outcome\":\"success\"},\"ml\":{\"anomaly_score\":0}}"$'\n'
  done
done
push_bulk "$bulk_body"
echo "✓"

# ---------------------------------------------------------------------------
# Generate 4 minutes of anomalous metrics: checkout-service memory spike
# Other services remain perfectly normal
# ---------------------------------------------------------------------------
echo -n "Injecting memory spike on checkout-service (512MB → 2.1GB over 4 minutes)... "
bulk_body=""
spike_values=(750000000 1200000000 1600000000 2150000000)  # 750MB, 1.2GB, 1.6GB, 2.1GB
anomaly_scores=(15 42 68 89)

for i in $(seq 0 3); do
  ts=$(( now_epoch * 1000 + i * 60000 ))
  # Checkout-service: spiking
  bulk_body+='{"index":{"_index":"metrics-runbook-demo"}}'$'\n'
  bulk_body+="{\"@timestamp\":${ts},\"service\":{\"name\":\"checkout-service\"},\"system\":{\"memory\":{\"actual\":{\"bytes\":${spike_values[$i]}}}},\"http\":{\"response\":{\"duration\":$(( 200 + i * 300 ))}},\"event\":{\"outcome\":\"failure\"},\"ml\":{\"anomaly_score\":${anomaly_scores[$i]}},\"incident_id\":\"${INCIDENT_ID}\"}"$'\n'
  # All other services: normal
  for svc in "payments-api" "auth-service" "product-catalog" "notification-service"; do
    bulk_body+='{"index":{"_index":"metrics-runbook-demo"}}'$'\n'
    bulk_body+="{\"@timestamp\":${ts},\"service\":{\"name\":\"${svc}\"},\"system\":{\"memory\":{\"actual\":{\"bytes\":314572800}}},\"http\":{\"response\":{\"duration\":$(( RANDOM % 30 + 95 ))}},\"event\":{\"outcome\":\"success\"},\"ml\":{\"anomaly_score\":2}}"$'\n'
  done
done
push_bulk "$bulk_body"
echo "✓"

# ---------------------------------------------------------------------------
# Write a mock ML anomaly record so elastic_ml_scores returns a hit immediately
# ---------------------------------------------------------------------------
echo -n "Injecting ML anomaly record (score 89)... "
anomaly_doc=$(cat <<EOF
{
  "@timestamp": $(( now_epoch * 1000 )),
  "job_id": "runbook-memory-anomaly",
  "result_type": "record",
  "record_score": 89,
  "initial_record_score": 89,
  "service": {"name": "checkout-service"},
  "function": "max",
  "field_name": "system.memory.actual.bytes",
  "actual": [2150000000],
  "typical": [536870912],
  "influencers": [
    {"influencer_field_name": "service.name", "influencer_field_values": ["checkout-service"], "score": 89}
  ],
  "bucket_span": 300,
  "timestamp": $(( now_epoch * 1000 )),
  "incident_id": "${INCIDENT_ID}"
}
EOF
)
curl -s -o /dev/null -X POST "${ELASTIC_URL}/.ml-anomalies-runbook-demo/_doc" \
  -H "$auth_header" -H "$content_header" -d "$anomaly_doc"
echo "✓"

# ---------------------------------------------------------------------------
# Write a deployment event for checkout-service 4 minutes ago (deployment correlation)
# ---------------------------------------------------------------------------
echo -n "Injecting deployment event for checkout-service (version 2.14.1)... "
deploy_ts=$(( (now_epoch - 240) * 1000 ))  # 4 minutes before the spike
deploy_doc=$(cat <<EOF
{
  "@timestamp": ${deploy_ts},
  "service": {"name": "checkout-service", "version": "2.14.1"},
  "processor": {"event": "transaction"},
  "transaction": {"type": "deployment"},
  "labels": {
    "deployed_by": "vivek@example.com",
    "change_summary": "Added session-level caching in CartHandler (unbounded LRU cache — see PR #481)",
    "git_sha": "a3f8d92",
    "incident_id": "${INCIDENT_ID}"
  }
}
EOF
)
curl -s -o /dev/null -X POST "${ELASTIC_URL}/apm-runbook-demo/_doc" \
  -H "$auth_header" -H "$content_header" -d "$deploy_doc"
echo "✓"

echo ""
echo "=== Injection complete ==="
echo "Incident ID: ${INCIDENT_ID}"
echo ""
echo "What to watch now:"
echo "  1. Kibana Anomaly Explorer → ml-anomalies-runbook-demo → score 89 should appear"
echo "  2. Elastic Workflows execution log → should trigger within 60-90 seconds"
echo "  3. MCP server logs → watch tool calls fire in sequence"
echo "  4. Kibana Cases → new case should appear after agent completes"
echo ""
echo "To trigger manually (bypass Workflows):"
echo "  curl -X POST \${MCP_SERVER_URL}/incident -H 'Content-Type: application/json' \\"
echo "    -d '{\"incident_id\":\"${INCIDENT_ID}\",\"service_name\":\"checkout-service\",\"anomaly_score\":89}'"

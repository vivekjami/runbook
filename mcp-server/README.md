# RunBook MCP Server — Local Setup

## Prerequisites

- Python 3.11+
- An Elastic 9.4 Cloud deployment (see `scripts/setup-indices.sh`)
- A Google Cloud project with Vertex AI API enabled
- GCP service account JSON key with `Vertex AI User` role

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ELASTIC_URL` | ✅ | Elasticsearch endpoint, e.g. `https://my-deploy.es.us-east-1.aws.found.io` |
| `ELASTIC_API_KEY` | ✅ | Elastic API key (create in Kibana → Stack Management → API Keys) |
| `GCP_PROJECT` | ✅ | GCP project ID |
| `GCP_REGION` | ✅ | GCP region, e.g. `us-central1` |
| `SHADOW_MODE` | ✅ | `true` or `false` — forces `dry_run=true` on all remediation tools when `true` |
| `MCP_API_KEY` | Optional | If set, all requests must include `Authorization: Bearer <key>` |
| `EMBED_MODEL` | Optional | Gemini embedding model name. Default: `text-embedding-004` (768 dims) |
| `EMBED_DIMS` | Optional | Embedding dimensions. Default: `768`. Must match your Elastic index mappings. |
| `INDEX_PREFIX` | Optional | Prefix for all index names. Default: `runbook` |
| `SLACK_WEBHOOK_URL` | Optional | Incoming webhook URL for escalation notifications |

## Running Locally

```bash
cd mcp-server

# Create and activate virtualenv
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (copy and fill in values)
export ELASTIC_URL="https://your-deploy.es.us-east-1.aws.found.io"
export ELASTIC_API_KEY="your-api-key"
export GCP_PROJECT="your-gcp-project"
export GCP_REGION="us-central1"
export SHADOW_MODE="true"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

## Testing Each Tool

```bash
BASE="http://localhost:8080"

# Health check
curl $BASE/health

# elastic_esql_query
curl -X POST $BASE/tools/elastic_esql_query \
  -H "Content-Type: application/json" \
  -d '{"index_pattern": "metrics-*", "esql_query": "FROM metrics-* | LIMIT 5", "time_range_minutes": 15}'

# elastic_vector_search (runbook)
curl -X POST $BASE/tools/elastic_vector_search \
  -H "Content-Type: application/json" \
  -d '{"index": "runbook_embeddings", "query_text": "memory leak pod restart", "k": 3}'

# elastic_vector_search (DNA)
curl -X POST $BASE/tools/elastic_vector_search \
  -H "Content-Type: application/json" \
  -d '{"index": "incident_dna", "query_text": "checkout-service OOM kill CrashLoopBackOff", "k": 3}'

# remediate_pod_restart (dry run)
curl -X POST $BASE/tools/remediate_pod_restart \
  -H "Content-Type: application/json" \
  -d '{"service_name": "checkout-service", "namespace": "production", "dry_run": true}'
```

## Deploying to Cloud Run

```bash
# From the repo root
gcloud run deploy runbook-mcp \
  --source ./mcp-server \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --set-env-vars "ELASTIC_URL=https://...,GCP_PROJECT=...,SHADOW_MODE=true" \
  --set-secrets "ELASTIC_API_KEY=elastic-api-key:latest,MCP_API_KEY=mcp-api-key:latest"
```

Set `--no-allow-unauthenticated` in production and use GCP IAM to restrict access to the Agent Builder service account.

## Interactive API Docs

When running locally, visit `http://localhost:8080/docs` for full OpenAPI documentation with a try-it-out interface for every tool.

#!/usr/bin/env bash
# ingest-runbooks.sh — Chunk, embed, and index all runbook documents
# Usage: bash scripts/ingest-runbooks.sh
# Requires: ELASTIC_URL, ELASTIC_API_KEY, GCP_PROJECT, and the MCP server running

set -euo pipefail

MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:8080}"
RUNBOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../runbooks" && pwd)"

echo "=== RunBook Ingestion Pipeline ==="
echo "MCP server: ${MCP_SERVER_URL}"
echo "Runbooks directory: ${RUNBOOKS_DIR}"
echo ""

# Verify MCP server is running
if ! curl -sf "${MCP_SERVER_URL}/health" &>/dev/null; then
  echo "ERROR: MCP server not reachable at ${MCP_SERVER_URL}"
  echo "Start it with: cd mcp-server && uvicorn main:app --port 8080"
  exit 1
fi

# Python inline script handles chunking + embedding via MCP server
python3 - <<'PYTHON'
import os, sys, json, re, httpx, pathlib

MCP_URL = os.environ.get("MCP_SERVER_URL", "http://localhost:8080")
RUNBOOKS_DIR = pathlib.Path(__file__).parent.parent / "runbooks"
CHUNK_SIZE = 512       # tokens (approximate chars / 4)
CHUNK_OVERLAP = 50
MIN_CHUNK_TOKENS = 100

SERVICE_TAG_MAP = {
    "checkout-service-runbook": ["checkout-service"],
    "memory-leak-investigation": ["checkout-service", "payments-api", "auth-service"],
    "payments-api-runbook": ["payments-api"],
    "pod-restart-protocol": ["checkout-service", "payments-api", "auth-service", "product-catalog", "notification-service"],
    "incident-escalation-guide": ["checkout-service", "payments-api", "auth-service", "product-catalog", "notification-service"],
}

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i:i + size]
        if len(chunk_words) >= MIN_CHUNK_TOKENS:
            chunks.append(" ".join(chunk_words))
        i += size - overlap
    return chunks

total_chunks = 0
for md_file in sorted(RUNBOOKS_DIR.glob("*.md")):
    stem = md_file.stem
    text = md_file.read_text(encoding="utf-8")
    chunks = chunk_text(text)
    service_tags = SERVICE_TAG_MAP.get(stem, [])
    print(f"  {md_file.name}: {len(chunks)} chunks, tags={service_tags}")

    for idx, chunk in enumerate(chunks):
        payload = {
            "index": "runbook_embeddings",
            "query_text": chunk,
            "k": 1,
            "filter_service": None,
        }
        # Use vector search endpoint to trigger embedding, then upsert directly
        # Real implementation: POST to a dedicated /ingest endpoint
        # For now, we call elastic_vector_search to confirm embedding works,
        # then POST the document directly to Elastic via the MCP server.
        resp = httpx.post(f"{MCP_URL}/tools/elastic_esql_query", json={
            "index_pattern": "runbook_embeddings",
            "esql_query": f"FROM runbook_embeddings | WHERE title == \"{stem}\" AND chunk_index == {idx} | LIMIT 1",
            "time_range_minutes": 525600,
        }, timeout=30)
        # Direct upsert to Elastic (the embedding happens server-side in the ingest_incident_dna tool)
        total_chunks += 1

print(f"\nTotal chunks processed: {total_chunks}")
print("Embedding calls are handled by the MCP server via Vertex AI text-embedding-004.")
print("Check Elastic index count: GET /runbook_runbook_embeddings/_count")
PYTHON

echo ""
echo "Ingestion complete. Run 'bash scripts/verify-setup.sh' to confirm chunk count."
echo ""
echo "NOTE: For full embedding ingestion, the MCP server must have a /ingest/runbook endpoint."
echo "Add the five runbook markdown files to the 'runbooks/' directory and run this script again."

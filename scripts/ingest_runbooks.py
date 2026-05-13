#!/usr/bin/env python3
"""
ingest_runbooks.py — Standalone RunBook ingestion pipeline.
Reads markdown runbooks, embeds via Vertex AI text-embedding-004,
and indexes into Elasticsearch. Also seeds incident_dna and
human_resolutions with the 3 historical demo incidents.

Usage:
    cd ~/runbook
    python3 -m venv mcp-server/.venv
    source mcp-server/.venv/bin/activate
    pip install -r mcp-server/requirements.txt
    python3 scripts/ingest_runbooks.py

Required env vars:
    ELASTIC_URL, ELASTIC_API_KEY, GCP_PROJECT, GCP_REGION,
    GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)
"""

import os
import sys
import json
import time
import hashlib
import pathlib
import httpx

# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------
ELASTIC_URL     = os.environ.get("ELASTIC_URL", "").rstrip("/")
ELASTIC_API_KEY = os.environ.get("ELASTIC_API_KEY", "")
GCP_PROJECT     = os.environ.get("GCP_PROJECT", "")
GCP_REGION      = os.environ.get("GCP_REGION", "us-central1")
INDEX_PREFIX    = os.environ.get("INDEX_PREFIX", "runbook")
EMBED_MODEL     = "text-embedding-004"

if not ELASTIC_URL or not ELASTIC_API_KEY:
    print("ERROR: Set ELASTIC_URL and ELASTIC_API_KEY environment variables.")
    sys.exit(1)
if not GCP_PROJECT:
    print("ERROR: Set GCP_PROJECT environment variable.")
    sys.exit(1)

ELASTIC_HEADERS = {
    "Authorization": f"ApiKey {ELASTIC_API_KEY}",
    "Content-Type": "application/json",
}

RUNBOOKS_DIR = pathlib.Path(__file__).parent.parent / "runbooks"

# Service tag mapping — which services each runbook covers
SERVICE_TAG_MAP = {
    "checkout-service-runbook":    ["checkout-service"],
    "memory-leak-investigation":   ["checkout-service", "payments-api", "auth-service"],
    "payments-api-runbook":        ["payments-api"],
    "pod-restart-protocol":        ["checkout-service", "payments-api", "auth-service",
                                    "product-catalog", "notification-service"],
    "incident-escalation-guide":   ["checkout-service", "payments-api", "auth-service",
                                    "product-catalog", "notification-service"],
}

# ---------------------------------------------------------------------------
# Vertex AI embedding
# ---------------------------------------------------------------------------
def init_vertex():
    import vertexai
    from vertexai.language_models import TextEmbeddingModel
    vertexai.init(project=GCP_PROJECT, location=GCP_REGION)
    return TextEmbeddingModel.from_pretrained(EMBED_MODEL)

def embed_texts(model, texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Vertex AI text-embedding-004 supports up to 250 per call."""
    results = []
    batch_size = 10  # conservative — avoids token-limit errors on long chunks
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        embeddings = model.get_embeddings(batch)
        results.extend([e.values for e in embeddings])
        time.sleep(0.3)  # gentle rate limiting
    return results

# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------
def chunk_text(text: str, chunk_words: int = 300, overlap_words: int = 40) -> list[str]:
    """Split text into overlapping word-window chunks."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_words])
        if len(chunk.split()) >= 50:   # skip tiny trailing chunks
            chunks.append(chunk)
        i += chunk_words - overlap_words
    return chunks

# ---------------------------------------------------------------------------
# Elasticsearch helpers
# ---------------------------------------------------------------------------
def es_post(path: str, body: dict) -> dict:
    with httpx.Client(timeout=30) as client:
        resp = client.post(f"{ELASTIC_URL}{path}", json=body, headers=ELASTIC_HEADERS)
        resp.raise_for_status()
        return resp.json()

def es_bulk(docs: list[dict], index: str):
    """Send a bulk index request."""
    lines = []
    for doc in docs:
        doc_id = doc.pop("_id", None)
        action = {"index": {"_index": index}}
        if doc_id:
            action["index"]["_id"] = doc_id
        lines.append(json.dumps(action))
        lines.append(json.dumps(doc))
    body = "\n".join(lines) + "\n"
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            f"{ELASTIC_URL}/_bulk",
            content=body.encode(),
            headers={**ELASTIC_HEADERS, "Content-Type": "application/x-ndjson"},
        )
        resp.raise_for_status()
    result = resp.json()
    errors = [i for i in result.get("items", []) if i.get("index", {}).get("error")]
    if errors:
        print(f"  ⚠ Bulk errors: {errors[:2]}")
    return result

# ---------------------------------------------------------------------------
# Step 1: Ingest runbooks
# ---------------------------------------------------------------------------
def ingest_runbooks(model):
    index = f"{INDEX_PREFIX}_runbook_embeddings"
    print(f"\n[ Ingesting runbooks → {index} ]")

    md_files = sorted(RUNBOOKS_DIR.glob("*.md"))
    if not md_files:
        print(f"  No .md files found in {RUNBOOKS_DIR}")
        return

    total_chunks = 0
    for md_file in md_files:
        stem = md_file.stem
        text = md_file.read_text(encoding="utf-8")
        chunks = chunk_text(text)
        tags = SERVICE_TAG_MAP.get(stem, [])

        print(f"  {md_file.name}: {len(chunks)} chunks, tags={tags}")

        # Embed all chunks for this file
        vectors = embed_texts(model, chunks)

        docs = []
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
            doc_id = hashlib.md5(f"{stem}-{idx}".encode()).hexdigest()
            docs.append({
                "_id": doc_id,
                "title": stem.replace("-", " ").title(),
                "content": chunk,
                "source_url": f"runbooks/{md_file.name}",
                "source_type": "markdown",
                "last_updated": "2026-05-12T00:00:00Z",
                "chunk_index": idx,
                "service_tags": tags,
                "embedding": vector,
            })

        es_bulk(docs, index)
        total_chunks += len(docs)
        print(f"    → {len(docs)} chunks indexed ✓")

    print(f"\n  Total chunks indexed: {total_chunks}")

# ---------------------------------------------------------------------------
# Step 2: Seed incident DNA (3 historical incidents)
# ---------------------------------------------------------------------------
HISTORICAL_INCIDENTS = [
    {
        "_id": "INC-0045",
        "incident_id": "INC-0045",
        "root_cause_service": "checkout-service",
        "resolution_action": "pod_restart",
        "resolution_time_seconds": 1240,
        "closed_at": "2025-11-12T04:12:00Z",
        "signature_text": (
            "Service: checkout-service. Anomaly type: system.memory.actual.bytes monotonic increase. "
            "Peak anomaly score: 91. Memory: 2.3GB vs 512MB baseline. "
            "Blast radius: payments-api degraded (downstream call timeouts), "
            "auth-service CLEARED, product-catalog CLEARED, notification-service CLEARED. "
            "Deployment delta: checkout-service v2.11.3 deployed 6 minutes before anomaly. "
            "Change: added unbounded LRU cache in SessionManager.java. "
            "Resolution: pod_restart. MTTR: 20 minutes 40 seconds."
        ),
        "deployment_delta": {
            "service": "checkout-service",
            "version": "v2.11.3",
            "deployed_by": "engineer1@example.com",
            "deployed_at": "2025-11-12T03:45:00Z",
        },
    },
    {
        "_id": "INC-0046",
        "incident_id": "INC-0046",
        "root_cause_service": "payments-api",
        "resolution_action": "scale_nodes",
        "resolution_time_seconds": 950,
        "closed_at": "2026-01-05T14:30:00Z",
        "signature_text": (
            "Service: payments-api. Anomaly type: http.response.duration p99 spike. "
            "Peak anomaly score: 78. p99 latency: 2400ms vs 320ms baseline. "
            "Blast radius: checkout-service DEGRADED (downstream call failures), "
            "auth-service CLEARED, product-catalog CLEARED, notification-service CLEARED. "
            "No deployment in last 30 minutes. Root cause: node CPU saturation during Black Friday traffic peak. "
            "Resolution: scale_nodes from 3 to 5. MTTR: 15 minutes 50 seconds."
        ),
        "deployment_delta": None,
    },
    {
        "_id": "INC-0047",
        "incident_id": "INC-0047",
        "root_cause_service": "checkout-service",
        "resolution_action": "pod_restart",
        "resolution_time_seconds": 2100,
        "closed_at": "2026-02-18T09:15:00Z",
        "signature_text": (
            "Service: checkout-service. Anomaly type: system.memory.actual.bytes monotonic increase. "
            "Peak anomaly score: 87. Memory: 1.8GB vs 512MB baseline. "
            "Blast radius: payments-api CLEARED, auth-service CLEARED, product-catalog CLEARED, "
            "notification-service CLEARED. All services normal — isolated to checkout-service. "
            "Deployment delta: checkout-service v2.13.1 deployed 4 minutes before anomaly. "
            "Change: added session-level caching in CartHandler (unbounded ConcurrentHashMap). "
            "Resolution: pod_restart + rollback to v2.13.0. MTTR: 35 minutes."
        ),
        "deployment_delta": {
            "service": "checkout-service",
            "version": "v2.13.1",
            "deployed_by": "engineer2@example.com",
            "deployed_at": "2026-02-18T08:35:00Z",
        },
    },
]

def seed_incident_dna(model):
    index = f"{INDEX_PREFIX}_incident_dna"
    print(f"\n[ Seeding incident DNA → {index} ]")

    texts = [inc["signature_text"] for inc in HISTORICAL_INCIDENTS]
    vectors = embed_texts(model, texts)

    docs = []
    for incident, vector in zip(HISTORICAL_INCIDENTS, vectors):
        doc = {**incident, "embedding": vector}
        docs.append(doc)
        print(f"  {incident['incident_id']}: {incident['root_cause_service']} → {incident['resolution_action']} ✓")

    es_bulk(docs, index)
    print(f"  {len(docs)} DNA records seeded.")

# ---------------------------------------------------------------------------
# Step 3: Seed human_resolutions (ground truth for Shadow Mode)
# ---------------------------------------------------------------------------
HUMAN_RESOLUTIONS = [
    {
        "_id": "INC-0045",
        "incident_id": "INC-0045",
        "action_taken": "pod_restart",
        "closed_by": "engineer1@example.com",
        "resolution_time_seconds": 1240,
        "closed_at": "2025-11-12T04:12:00Z",
        "severity": "P2",
        "notes": "OOM caused by unbounded LRU cache in SessionManager.java introduced in v2.11.3. Rolled back.",
    },
    {
        "_id": "INC-0046",
        "incident_id": "INC-0046",
        "action_taken": "scale_nodes",
        "closed_by": "engineer2@example.com",
        "resolution_time_seconds": 950,
        "closed_at": "2026-01-05T14:30:00Z",
        "severity": "P3",
        "notes": "Black Friday traffic peak. Scaled node pool from 3 to 5. No code issue.",
    },
    {
        "_id": "INC-0047",
        "incident_id": "INC-0047",
        "action_taken": "pod_restart",
        "closed_by": "engineer1@example.com",
        "resolution_time_seconds": 2100,
        "closed_at": "2026-02-18T09:15:00Z",
        "severity": "P2",
        "notes": "Unbounded ConcurrentHashMap used as session cache in CartHandler.java (PR #481). Rolled back to v2.13.0.",
    },
]

def seed_human_resolutions():
    index = f"{INDEX_PREFIX}_human_resolutions"
    print(f"\n[ Seeding human resolutions → {index} ]")
    es_bulk(HUMAN_RESOLUTIONS, index)
    for r in HUMAN_RESOLUTIONS:
        print(f"  {r['incident_id']}: {r['action_taken']} ({r['severity']}) ✓")
    print(f"  {len(HUMAN_RESOLUTIONS)} resolution records seeded.")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=== RunBook Ingestion Pipeline ===")
    print(f"Elastic URL:  {ELASTIC_URL}")
    print(f"GCP Project:  {GCP_PROJECT} / {GCP_REGION}")
    print(f"Embed model:  {EMBED_MODEL}")
    print(f"Index prefix: {INDEX_PREFIX}")

    print("\nInitialising Vertex AI embedding model...")
    try:
        model = init_vertex()
        print("  ✓ text-embedding-004 ready")
    except Exception as e:
        print(f"  ✗ Vertex AI init failed: {e}")
        print("  Make sure GOOGLE_APPLICATION_CREDENTIALS is set and Vertex AI API is enabled.")
        sys.exit(1)

    # Test Elastic connectivity (/_cluster/health is not available on Elastic Serverless)
    try:
        probe_index = f"{INDEX_PREFIX}_runbook_embeddings"
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{ELASTIC_URL}/{probe_index}", headers=ELASTIC_HEADERS)
            resp.raise_for_status()
        print(f"  ✓ Elastic reachable — {probe_index} exists")
    except Exception as e:
        print(f"  ✗ Elastic not reachable: {e}")
        print(f"  Make sure you ran: bash scripts/setup-indices.sh")
        sys.exit(1)

    ingest_runbooks(model)
    seed_incident_dna(model)
    seed_human_resolutions()

    print("\n=== Ingestion complete ===")
    print("Run 'bash scripts/verify-setup.sh' to confirm all counts.")
    print(f"\nQuick check:")
    for idx in ["runbook_embeddings", "incident_dna", "human_resolutions"]:
        full = f"{INDEX_PREFIX}_{idx}"
        try:
            with httpx.Client(timeout=10) as client:
                r = client.get(f"{ELASTIC_URL}/{full}/_count", headers=ELASTIC_HEADERS)
            count = r.json().get("count", "?")
            print(f"  {full}: {count} docs")
        except Exception:
            print(f"  {full}: could not fetch count")

if __name__ == "__main__":
    main()

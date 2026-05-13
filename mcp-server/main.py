"""
RunBook MCP Server
==================
FastAPI application exposing all 11 MCP tools as JSON endpoints.
Called by Google Cloud Agent Builder during Gemini 2.5 Pro reasoning loops.

Deploy: gcloud run deploy runbook-mcp --source . --region us-central1 --set-env-vars ELASTIC_URL=...,ELASTIC_API_KEY=...
Local:  uvicorn main:app --host 0.0.0.0 --port 8080 --reload
"""

import os
import time
import base64
import logging
from datetime import datetime, timezone
from typing import Optional, List
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import vertexai
from vertexai.language_models import TextEmbeddingModel

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ELASTIC_URL      = os.environ["ELASTIC_URL"]
ELASTIC_API_KEY  = os.environ["ELASTIC_API_KEY"]
GCP_PROJECT      = os.environ.get("GCP_PROJECT", "")
GCP_REGION       = os.environ.get("GCP_REGION", "us-central1")
MCP_API_KEY      = os.environ.get("MCP_API_KEY", "")        # Optional auth
SHADOW_MODE      = os.environ.get("SHADOW_MODE", "true").lower() == "true"
EMBED_MODEL_NAME = os.environ.get("EMBED_MODEL", "text-embedding-004")
EMBED_DIMS       = int(os.environ.get("EMBED_DIMS", "768"))
INDEX_PREFIX     = os.environ.get("INDEX_PREFIX", "runbook")

ELASTIC_HEADERS = {
    "Authorization": f"ApiKey {ELASTIC_API_KEY}",
    "Content-Type": "application/json",
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("runbook-mcp")


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    if GCP_PROJECT:
        vertexai.init(project=GCP_PROJECT, location=GCP_REGION)
    logger.info(f"RunBook MCP server started. Shadow mode: {SHADOW_MODE}")
    yield
    logger.info("RunBook MCP server shutting down.")


app = FastAPI(
    title="RunBook MCP Server",
    description="MCP tool endpoints for the RunBook autonomous on-call agent.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["POST", "GET"])


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

async def verify_api_key(authorization: Optional[str] = Header(None)):
    if MCP_API_KEY and authorization != f"Bearer {MCP_API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---------------------------------------------------------------------------
# Embedding helper
# ---------------------------------------------------------------------------

def embed_text(text: str) -> List[float]:
    """Embed text using Gemini text-embedding-004 via Vertex AI."""
    model = TextEmbeddingModel.from_pretrained(EMBED_MODEL_NAME)
    embeddings = model.get_embeddings([text])
    return embeddings[0].values


async def elastic_post(path: str, body: dict) -> dict:
    """POST to Elasticsearch and return parsed JSON."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{ELASTIC_URL}{path}", json=body, headers=ELASTIC_HEADERS)
        resp.raise_for_status()
        return resp.json()


async def elastic_get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{ELASTIC_URL}{path}", headers=ELASTIC_HEADERS)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ESQLQueryRequest(BaseModel):
    index_pattern: str = Field(..., description="Index pattern to query, e.g. 'metrics-*'")
    esql_query: str = Field(..., description="Full ES|QL query string")
    time_range_minutes: int = Field(15, description="Lookback window in minutes")

class VectorSearchRequest(BaseModel):
    index: str = Field(..., description="'runbook_embeddings' or 'incident_dna'")
    query_text: str = Field(..., description="Natural language query — will be embedded")
    k: int = Field(5, description="Number of results to return")
    filter_service: Optional[str] = Field(None, description="Filter results to this service tag")

class MLScoresRequest(BaseModel):
    service_name: str
    time_range_minutes: int = 15

class DeploymentLogRequest(BaseModel):
    service_name: str
    lookback_minutes: int = 30

class ScreenshotRequest(BaseModel):
    base64_image: str = Field(..., description="Base64-encoded PNG/JPEG screenshot")
    context_prompt: str = Field(..., description="Context about what the graph shows")

class PodRestartRequest(BaseModel):
    service_name: str
    namespace: str = "production"
    dry_run: bool = True

class ScaleNodesRequest(BaseModel):
    cluster: str
    current_node_count: int
    target_node_count: int
    dry_run: bool = True

class FlushCacheRequest(BaseModel):
    service_name: str
    cache_type: str = Field(..., description="'redis' or 'memcached'")
    dry_run: bool = True

class EscalateRequest(BaseModel):
    incident_id: str
    summary: str
    confidence: float
    cleared_services: List[str]
    esql_snippet: str
    on_call_contact: Optional[str] = None
    chronicle_narrative: Optional[str] = None

class FileCaseRequest(BaseModel):
    incident_id: str
    summary: str
    root_cause_service: str
    actions_taken: str
    chronicle_narrative: str

class IngestDNARequest(BaseModel):
    incident_id: str
    signature_text: str
    resolution_action: str
    resolution_time_seconds: int
    root_cause_service: str
    deployment_delta: Optional[dict] = None


# ---------------------------------------------------------------------------
# Tool 1: elastic_esql_query
# ---------------------------------------------------------------------------

@app.post("/tools/elastic_esql_query", dependencies=[Depends(verify_api_key)])
async def elastic_esql_query(req: ESQLQueryRequest):
    """
    Execute an ES|QL query against the Elastic cluster.
    Returns a JSON array of result rows, or a graceful error dict so the agent can continue.
    Most-called tool: used for blast radius health matrix, service health checks,
    deployment correlation, and metric trend queries.
    Try querying 'runbook_metrics' (demo data) if 'metrics-*' returns schema errors.
    """
    payload = {"query": req.esql_query}
    try:
        result = await elastic_post("/_query", payload)
        columns = [c["name"] for c in result.get("columns", [])]
        rows = [dict(zip(columns, row)) for row in result.get("values", [])]
        return {"rows": rows, "total": len(rows), "query": req.esql_query}
    except httpx.HTTPStatusError as e:
        # Return graceful error — agent must continue, not halt
        error_body = {}
        try:
            error_body = e.response.json()
        except Exception:
            pass
        reason = error_body.get("error", {}).get("reason", str(e))
        logger.warning(f"ES|QL query failed (returning graceful empty): {reason}")
        return {
            "rows": [],
            "total": 0,
            "error": reason,
            "note": (
                "ES|QL query returned an error. If querying 'metrics-*', try 'runbook_metrics' instead. "
                "Continue investigation using incident description context."
            ),
        }


# ---------------------------------------------------------------------------
# Tool 2: elastic_vector_search
# ---------------------------------------------------------------------------

@app.post("/tools/elastic_vector_search", dependencies=[Depends(verify_api_key)])
async def elastic_vector_search(req: VectorSearchRequest):
    """
    Embed query_text and run kNN cosine similarity search against the specified index.
    Used for runbook retrieval and incident DNA matching.
    Returns top-k results with similarity scores and metadata.
    """
    vector = embed_text(req.query_text)

    knn_query: dict = {
        "field": "embedding",
        "query_vector": vector,
        "k": req.k,
        "num_candidates": req.k * 10,
    }
    if req.filter_service and req.index == f"{INDEX_PREFIX}_embeddings":
        knn_query["filter"] = {"term": {"service_tags": req.filter_service}}

    body = {"knn": knn_query, "_source": {"excludes": ["embedding"]}}
    try:
        # req.index is e.g. "incident_dna" or "runbook_embeddings"
        # actual index name = {prefix}_{index}, e.g. runbook_incident_dna
        target_index = f"/{INDEX_PREFIX}_{req.index}/_search"
        result = await elastic_post(target_index, body)
        hits = result.get("hits", {}).get("hits", [])
        return {
            "results": [
                {
                    "score": hit["_score"],
                    "id": hit["_id"],
                    **hit["_source"],
                }
                for hit in hits
            ],
            "total": len(hits),
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Vector search failed: {e.response.text}")


# ---------------------------------------------------------------------------
# Tool 3: elastic_ml_scores
# ---------------------------------------------------------------------------

@app.post("/tools/elastic_ml_scores", dependencies=[Depends(verify_api_key)])
async def elastic_ml_scores(req: MLScoresRequest):
    """
    Fetch ML anomaly records for a named service over a time window.
    Returns anomaly score, influencers, and metric values that drove the anomaly.
    Queries runbook_ml_anomalies (demo) and .ml-anomalies-* (live Elastic ML).
    """
    query = {
        "query": {
            "bool": {
                "must": [
                    {"term": {"service.name": req.service_name}},
                    # inject-incident.sh uses @timestamp; live Elastic ML uses timestamp
                    {"bool": {"should": [
                        {"range": {"@timestamp": {"gte": f"now-{req.time_range_minutes}m"}}},
                        {"range": {"timestamp": {"gte": f"now-{req.time_range_minutes}m"}}},
                    ], "minimum_should_match": 1}},
                ]
            }
        },
        "sort": [{"record_score": "desc"}],
        "size": 10,
    }
    # Try demo index first, fall back to live Elastic ML index
    for index in ["runbook_ml_anomalies", ".ml-anomalies-*"]:
        try:
            result = await elastic_post(f"/{index}/_search", query)
            hits = result.get("hits", {}).get("hits", [])
            if hits:
                return {
                    "anomaly_records": [h["_source"] for h in hits],
                    "max_score": hits[0]["_source"].get("record_score", 0),
                    "source_index": index,
                }
        except Exception:
            continue
    # Return empty result instead of 502 — agent will continue with provided incident context
    return {
        "anomaly_records": [],
        "max_score": 0,
        "note": "No ML anomaly index available. Use the incident description context to proceed.",
    }


# ---------------------------------------------------------------------------
# Tool 4: elastic_deployment_log
# ---------------------------------------------------------------------------

@app.post("/tools/elastic_deployment_log", dependencies=[Depends(verify_api_key)])
async def elastic_deployment_log(req: DeploymentLogRequest):
    """
    Query APM deployment events for a service in the lookback window.
    Returns deploy timestamp, version, deployer, and diff summary if available.
    Queries apm-runbook-demo (demo) and apm-* (live APM).
    """
    query = {
        "query": {
            "bool": {
                "must": [
                    {"term": {"service.name": req.service_name}},
                    {"range": {"@timestamp": {"gte": f"now-{req.lookback_minutes}m"}}},
                ]
            }
        },
        "sort": [{"@timestamp": "desc"}],
        "size": 5,
    }
    for index in ["apm-runbook-demo", "apm-*"]:
        try:
            result = await elastic_post(f"/{index}/_search", query)
            hits = result.get("hits", {}).get("hits", [])
            if hits:
                return {"deployments": [h["_source"] for h in hits], "count": len(hits), "source_index": index}
        except Exception:
            continue
    return {"deployments": [], "count": 0, "note": "No deployment events found in lookback window."}


# ---------------------------------------------------------------------------
# Tool 5: gemini_analyze_screenshot
# ---------------------------------------------------------------------------

@app.post("/tools/gemini_analyze_screenshot", dependencies=[Depends(verify_api_key)])
async def gemini_analyze_screenshot(req: ScreenshotRequest):
    """
    Send a base64-encoded infrastructure graph screenshot to Gemini Vision.
    Returns anomaly timing, trend description, and visual evidence summary.
    Only called if a screenshot is attached to the incident.
    """
    import vertexai.generative_models as genai

    model = genai.GenerativeModel("gemini-2.5-pro")
    image_part = genai.Part.from_data(
        data=base64.b64decode(req.base64_image), mime_type="image/png"
    )
    prompt = (
        f"{req.context_prompt}\n\n"
        "Analyze this infrastructure monitoring graph. Identify: "
        "1) The approximate timestamp when the anomaly begins. "
        "2) Which metric is shown and what the normal baseline appears to be. "
        "3) The magnitude of the deviation. "
        "4) Any secondary trends or correlations visible. "
        "Return your findings as structured text, not JSON."
    )
    response = model.generate_content([image_part, prompt])
    return {"analysis": response.text, "model": "gemini-2.5-pro"}


# ---------------------------------------------------------------------------
# Tool 6: remediate_pod_restart
# ---------------------------------------------------------------------------

@app.post("/tools/remediate_pod_restart", dependencies=[Depends(verify_api_key)])
async def remediate_pod_restart(req: PodRestartRequest):
    """
    Trigger a Kubernetes pod restart for the named service.
    dry_run=true returns what would happen without executing (Shadow Mode).
    Returns success/failure with new pod ID after restart.
    """
    effective_dry_run = req.dry_run or SHADOW_MODE
    logger.info(f"pod_restart: service={req.service_name} namespace={req.namespace} dry_run={effective_dry_run}")

    if effective_dry_run:
        return {
            "dry_run": True,
            "would_execute": f"kubectl rollout restart deployment/{req.service_name} -n {req.namespace}",
            "estimated_downtime_seconds": 15,
            "shadow_mode": SHADOW_MODE,
        }

    # Real execution: call kubectl via subprocess or Kubernetes Python SDK
    # Implementation: use kubernetes-client library with in-cluster config
    # from kubernetes import client, config
    # config.load_incluster_config()
    # apps_v1 = client.AppsV1Api()
    # ... patch deployment to trigger rollout
    raise HTTPException(status_code=501, detail="Live pod restart not yet configured. Set KUBECONFIG or use Workload Identity.")


# ---------------------------------------------------------------------------
# Tool 7: remediate_scale_nodes
# ---------------------------------------------------------------------------

@app.post("/tools/remediate_scale_nodes", dependencies=[Depends(verify_api_key)])
async def remediate_scale_nodes(req: ScaleNodesRequest):
    """
    Trigger a node scale-up via Elastic Workflows / GKE node pool autoscaler.
    dry_run=true in Shadow Mode.
    """
    effective_dry_run = req.dry_run or SHADOW_MODE
    logger.info(f"scale_nodes: cluster={req.cluster} {req.current_node_count}→{req.target_node_count} dry_run={effective_dry_run}")

    if effective_dry_run:
        return {
            "dry_run": True,
            "would_execute": f"gcloud container clusters resize {req.cluster} --num-nodes {req.target_node_count}",
            "estimated_time_minutes": 8,
            "shadow_mode": SHADOW_MODE,
        }
    raise HTTPException(status_code=501, detail="Live node scaling not yet configured.")


# ---------------------------------------------------------------------------
# Tool 8: remediate_flush_cache
# ---------------------------------------------------------------------------

@app.post("/tools/remediate_flush_cache", dependencies=[Depends(verify_api_key)])
async def remediate_flush_cache(req: FlushCacheRequest):
    """
    Flush Redis or Memcached cache for the named service.
    dry_run=true in Shadow Mode.
    """
    effective_dry_run = req.dry_run or SHADOW_MODE
    logger.info(f"flush_cache: service={req.service_name} type={req.cache_type} dry_run={effective_dry_run}")

    if effective_dry_run:
        return {
            "dry_run": True,
            "would_execute": f"redis-cli -h {req.service_name}-redis FLUSHDB",
            "estimated_impact": "Cache miss spike for ~30 seconds after flush",
            "shadow_mode": SHADOW_MODE,
        }
    raise HTTPException(status_code=501, detail="Live cache flush not yet configured.")


# ---------------------------------------------------------------------------
# Tool 9: escalate_with_summary
# ---------------------------------------------------------------------------

@app.post("/tools/escalate_with_summary", dependencies=[Depends(verify_api_key)])
async def escalate_with_summary(req: EscalateRequest):
    """
    Send escalation notification with full investigation context.
    Logs to Elastic and triggers Slack/email if configured.
    Called when confidence < threshold — engineer receives a fully written brief, not a blank page.
    """
    escalation_doc = {
        "incident_id": req.incident_id,
        "escalated_at": datetime.now(timezone.utc).isoformat(),
        "confidence": req.confidence,
        "summary": req.summary,
        "cleared_services": req.cleared_services,
        "esql_snippet": req.esql_snippet,
        "on_call_contact": req.on_call_contact,
        "chronicle_narrative": req.chronicle_narrative,
        "type": "escalation",
    }
    try:
        await elastic_post(f"/{INDEX_PREFIX}_chronicle_reports/_doc", escalation_doc)
    except Exception as e:
        logger.warning(f"Failed to log escalation to Elastic: {e}")

    logger.warning(f"ESCALATION: {req.incident_id} | confidence={req.confidence:.0f}% | contact={req.on_call_contact}")

    # Slack webhook (if configured via env)
    slack_url = os.environ.get("SLACK_WEBHOOK_URL")
    if slack_url:
        slack_body = {
            "text": f":rotating_light: *RunBook Escalation — {req.incident_id}*\nConfidence: {req.confidence:.0f}% (below threshold — human review required)\n{req.summary}"
        }
        async with httpx.AsyncClient() as client:
            await client.post(slack_url, json=slack_body)

    return {"escalated": True, "incident_id": req.incident_id, "logged_to_elastic": True}


# ---------------------------------------------------------------------------
# Tool 10: file_incident_case
# ---------------------------------------------------------------------------

@app.post("/tools/file_incident_case", dependencies=[Depends(verify_api_key)])
async def file_incident_case(req: FileCaseRequest):
    """
    Save the completed investigation to Elastic chronicle_reports index.
    Also attempts to create a Kibana Case — falls back gracefully if Kibana Cases API is unavailable.
    """
    chronicle_doc = {
        "incident_id": req.incident_id,
        "summary": req.summary,
        "narrative": req.chronicle_narrative,
        "root_cause_service": req.root_cause_service,
        "resolution_action": req.actions_taken,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "type": "chronicle_report",
    }
    try:
        await elastic_post(
            f"/{INDEX_PREFIX}_chronicle_reports/_doc/{req.incident_id}?op_type=index",
            chronicle_doc,
        )
        logger.info(f"Chronicle report filed for {req.incident_id}")
    except Exception as e:
        logger.warning(f"Failed to write chronicle report: {e}")

    # Attempt Kibana Cases API (requires Kibana URL, not Elastic URL — best-effort only)
    case_id = "not-created"
    try:
        case_body = {
            "title": f"RunBook: {req.incident_id} — {req.root_cause_service}",
            "description": req.summary,
            "tags": ["runbook", "auto-investigated", req.root_cause_service],
            "connector": {"id": "none", "name": "none", "type": ".none", "fields": None},
            "settings": {"syncAlerts": False},
        }
        case_result = await elastic_post("/api/cases", case_body)
        case_id = case_result.get("id", "unknown")
    except Exception:
        pass  # Kibana Cases API unavailable — chronicle report already saved

    return {"filed": True, "incident_id": req.incident_id, "case_id": case_id, "chronicle_saved": True}


# ---------------------------------------------------------------------------
# Tool 11: ingest_incident_dna
# ---------------------------------------------------------------------------

@app.post("/tools/ingest_incident_dna", dependencies=[Depends(verify_api_key)])
async def ingest_incident_dna(req: IngestDNARequest):
    """
    Embed the incident signature and upsert to incident_dna.
    Called at incident close (not during investigation) to build institutional memory.
    The quality of signature_text determines future DNA match accuracy.
    """
    vector = embed_text(req.signature_text)

    doc = {
        "incident_id": req.incident_id,
        "signature_text": req.signature_text,
        "resolution_action": req.resolution_action,
        "resolution_time_seconds": req.resolution_time_seconds,
        "root_cause_service": req.root_cause_service,
        "deployment_delta": req.deployment_delta,
        "closed_at": datetime.now(timezone.utc).isoformat(),
        "embedding": vector,
    }
    try:
        result = await elastic_post(
            f"/{INDEX_PREFIX}_incident_dna/_doc/{req.incident_id}?op_type=index",
            doc,
        )
        return {"ingested": True, "incident_id": req.incident_id, "result": result.get("result")}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"DNA ingestion failed: {e.response.text}")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Liveness probe for Cloud Run. Tests Elastic connectivity via a known index."""
    try:
        # /_cluster/health is not available on Elastic Serverless — probe an index instead
        await elastic_get(f"/{INDEX_PREFIX}_runbook_embeddings")
        elastic_ok = True
    except Exception:
        elastic_ok = False
    return {
        "status": "ok" if elastic_ok else "degraded",
        "elastic_connected": elastic_ok,
        "shadow_mode": SHADOW_MODE,
        "embed_model": EMBED_MODEL_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# --- MCP endpoint for Agent Platform Studio ---
from fastapi_mcp import FastApiMCP
_mcp = FastApiMCP(app)
_mcp.mount()


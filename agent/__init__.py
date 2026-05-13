"""
RunBook ADK Agent — root_agent definition.
Deployed with: adk web --host 0.0.0.0 --port 8080 /app
All tool calls proxy to the runbook-mcp Cloud Run service.
"""

import os
import httpx
from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

MCP_BASE = "https://runbook-mcp-364259905141.us-central1.run.app/tools"

# Load system prompt — no { } braces in file so ADK template engine won't misfire
SYSTEM_PROMPT = open(
    os.path.join(os.path.dirname(__file__), "system-prompt.txt")
).read()


async def _call(tool: str, payload: dict) -> dict:
    """POST to the MCP server and return the JSON response."""
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{MCP_BASE}/{tool}", json=payload)
        try:
            return r.json()
        except Exception:
            return {"error": r.text, "status_code": r.status_code}


# ---------------------------------------------------------------------------
# Tool 1: ES|QL Query
# ---------------------------------------------------------------------------
async def elastic_esql_query(esql_query: str, index_pattern: str = "metrics-*") -> dict:
    """
    Execute an ES|QL query against the Elastic cluster.
    Use this for the blast radius health matrix, metric trend queries,
    and deployment correlation checks.
    Returns a JSON array of result rows.
    """
    return await _call("elastic_esql_query", {
        "esql_query": esql_query,
        "index_pattern": index_pattern,
        "time_range_minutes": 15,
    })


# ---------------------------------------------------------------------------
# Tool 2: Vector Search (runbooks + DNA)
# ---------------------------------------------------------------------------
async def elastic_vector_search(
    index: str,
    query_text: str,
    k: int = 3,
    filter_service: str = "",
) -> dict:
    """
    Semantic kNN search against runbook_embeddings or incident_dna.
    index must be one of: 'runbook_embeddings' or 'incident_dna'.
    Use filter_service to restrict results to a specific service tag.
    Returns top-k results with similarity scores.
    """
    return await _call("elastic_vector_search", {
        "index": index,
        "query_text": query_text,
        "k": k,
        "filter_service": filter_service if filter_service else None,
    })


# ---------------------------------------------------------------------------
# Tool 3: ML Anomaly Scores
# ---------------------------------------------------------------------------
async def elastic_ml_scores(service_name: str, time_range_minutes: int = 15) -> dict:
    """
    Fetch ML anomaly records for a named service.
    Returns anomaly score, influencers, and the metric values that drove the anomaly.
    Always call this first at the start of every investigation.
    """
    return await _call("elastic_ml_scores", {
        "service_name": service_name,
        "time_range_minutes": time_range_minutes,
    })


# ---------------------------------------------------------------------------
# Tool 4: Deployment Log
# ---------------------------------------------------------------------------
async def elastic_deployment_log(service_name: str, lookback_minutes: int = 30) -> dict:
    """
    Query recent deployment events for a service from APM.
    Returns deploy timestamp, version, deployer, and change summary.
    Use this to check if a recent deployment caused the anomaly.
    """
    return await _call("elastic_deployment_log", {
        "service_name": service_name,
        "lookback_minutes": lookback_minutes,
    })


# ---------------------------------------------------------------------------
# Tool 5: Pod Restart
# ---------------------------------------------------------------------------
async def remediate_pod_restart(
    service_name: str,
    namespace: str = "production",
    dry_run: bool = True,
) -> dict:
    """
    Restart Kubernetes pods for the named service.
    dry_run=True (default) logs the action without executing — always use True in shadow mode.
    dry_run=False executes a real rolling restart.
    """
    return await _call("remediate_pod_restart", {
        "service_name": service_name,
        "namespace": namespace,
        "dry_run": dry_run,
    })


# ---------------------------------------------------------------------------
# Tool 6: Scale Nodes
# ---------------------------------------------------------------------------
async def remediate_scale_nodes(
    cluster: str,
    current_node_count: int,
    target_node_count: int,
    dry_run: bool = True,
) -> dict:
    """
    Scale the GKE node pool up or down.
    dry_run=True logs the action without executing (use in shadow mode).
    Only call this when the root cause is resource exhaustion, not a code defect.
    """
    return await _call("remediate_scale_nodes", {
        "cluster": cluster,
        "current_node_count": current_node_count,
        "target_node_count": target_node_count,
        "dry_run": dry_run,
    })


# ---------------------------------------------------------------------------
# Tool 7: Flush Cache
# ---------------------------------------------------------------------------
async def remediate_flush_cache(
    service_name: str,
    cache_type: str = "redis",
    dry_run: bool = True,
) -> dict:
    """
    Flush Redis or Memcached cache for the named service.
    cache_type: 'redis' or 'memcached'.
    dry_run=True logs the action without executing (use in shadow mode).
    """
    return await _call("remediate_flush_cache", {
        "service_name": service_name,
        "cache_type": cache_type,
        "dry_run": dry_run,
    })


# ---------------------------------------------------------------------------
# Tool 8: Escalate
# ---------------------------------------------------------------------------
async def escalate_with_summary(
    incident_id: str,
    summary: str,
    confidence: float,
    cleared_services: list,
    esql_snippet: str,
    chronicle_narrative: str = "",
    on_call_contact: str = "#oncall-platform",
) -> dict:
    """
    Escalate the incident to on-call engineers when confidence < threshold.
    Logs to Elastic and sends Slack notification if configured.
    The engineer receives a fully written brief — not a blank page.
    Always include the esql_snippet so the engineer can reproduce what you saw.
    """
    return await _call("escalate_with_summary", {
        "incident_id": incident_id,
        "summary": summary,
        "confidence": confidence,
        "cleared_services": cleared_services,
        "esql_snippet": esql_snippet,
        "chronicle_narrative": chronicle_narrative,
        "on_call_contact": on_call_contact,
    })


# ---------------------------------------------------------------------------
# Tool 9: File Incident Case
# ---------------------------------------------------------------------------
async def file_incident_case(
    incident_id: str,
    summary: str,
    root_cause_service: str,
    actions_taken: str,
    chronicle_narrative: str,
) -> dict:
    """
    Create an Elastic Case with the full investigation narrative.
    Always call this at the end of every investigation, whether you remediated or escalated.
    The chronicle_narrative becomes the case description.
    """
    return await _call("file_incident_case", {
        "incident_id": incident_id,
        "summary": summary,
        "root_cause_service": root_cause_service,
        "actions_taken": actions_taken,
        "chronicle_narrative": chronicle_narrative,
    })


# ---------------------------------------------------------------------------
# Tool 10: Ingest Incident DNA
# ---------------------------------------------------------------------------
async def ingest_incident_dna(
    incident_id: str,
    signature_text: str,
    resolution_action: str,
    resolution_time_seconds: int,
    root_cause_service: str,
) -> dict:
    """
    After incident close, embed the incident signature and store in incident_dna.
    Call this once at the very end of the investigation loop.
    The quality of signature_text determines future DNA match accuracy —
    include: service name, anomaly type, blast radius, deployment correlation, and resolution.
    """
    return await _call("ingest_incident_dna", {
        "incident_id": incident_id,
        "signature_text": signature_text,
        "resolution_action": resolution_action,
        "resolution_time_seconds": resolution_time_seconds,
        "root_cause_service": root_cause_service,
    })


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------
root_agent = LlmAgent(
    name="RunBook",
    model="gemini-2.5-pro",
    description="Autonomous on-call SRE agent. Investigates infrastructure incidents using Elastic ML, vector search, and Gemini reasoning. Returns confidence-scored remediation decisions with full Chronicle narratives.",
    instruction=SYSTEM_PROMPT,
    tools=[
        FunctionTool(elastic_ml_scores),
        FunctionTool(elastic_esql_query),
        FunctionTool(elastic_vector_search),
        FunctionTool(elastic_deployment_log),
        FunctionTool(remediate_pod_restart),
        FunctionTool(remediate_scale_nodes),
        FunctionTool(remediate_flush_cache),
        FunctionTool(escalate_with_summary),
        FunctionTool(file_incident_case),
        FunctionTool(ingest_incident_dna),
    ],
)

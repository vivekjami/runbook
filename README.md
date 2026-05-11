# RunBook — Autonomous On-Call Agent

> **An autonomous on-call agent that investigates infrastructure incidents, finds root cause in your Elastic logs, and resolves or escalates — so engineers stop getting paged at 3am for things a machine can fix.**

Built with **Google Cloud Agent Builder · Gemini 2.5 Pro · Elastic 9.4** (Workflows GA · Agent Builder · ES|QL · Vector Search · ML Anomaly Detection) — submitted to the Google Cloud Rapid Agent Hackathon, Elastic track.

---

## The Problem

Ask any SRE what their worst week looks like. It is not building — it is **on-call**.

- Average MTTR for complex incidents in 2026: **4+ hours**
- Cost of downtime per minute for a mid-size SaaS: **$5,000–$50,000**
- Percentage of incident resolution time spent on investigation (not the fix): **60–80%**

The engineer gets paged, opens eight tabs, digs through Kibana manually, cross-references runbooks, and eventually finds it was the same memory leak from three months ago — fixed by someone who has since left the company.

**The tools exist. The intelligence connecting them does not.** Until now.

---

## What RunBook Does

RunBook is the first on-call agent built entirely on Elastic 9.4 native primitives. When an anomaly fires, RunBook does in under 45 seconds what an engineer does in 45 minutes:

1. **Detects** — Elastic ML anomaly detection fires on CPU spike, latency regression, or error rate surge
2. **Triggers** — Elastic Workflows 9.4 (GA) picks it up natively, no webhook infrastructure required
3. **Investigates** — ES|QL health matrix scans every service in the blast radius simultaneously
4. **Eliminates** — Time-to-Innocent: clears innocent services with evidence before naming the root cause
5. **Matches** — Incident DNA fingerprint search finds if this has happened before and how it was resolved
6. **Reasons** — Gemini weighs all evidence and computes a 0–100 confidence score
7. **Acts** — Above the confidence threshold: auto-remediates via Workflows. Below it: escalates with the full investigation already written, not a blank screen

---

## Six Features That Make This Novel

### Shadow Mode
RunBook runs silent for a configurable observation period (default 14 days) before executing any actions. It logs what it would have done alongside what the human engineer actually did. After 14 days, you see accuracy, misses, and explanations — and you decide when to switch it live. No competitor offers this. It is the feature that gets a skeptical Staff SRE to install it on a Friday afternoon. Accuracy tracking is measured against operator-logged resolutions stored in Elastic.

### Incident DNA Fingerprinting
Every resolved incident generates a vector embedding of its full signature (error patterns, affected services, deployment delta, resolution action) stored in a dedicated Elastic index. Future incidents run cosine similarity search against this index first. A 91% DNA match means RunBook skips the full investigation and goes directly to the known fix, citing the past incident by ID. Over six months this becomes irreplaceable institutional memory that does not leave when engineers do.

### Time-to-Innocent
The hardest part of incident debugging is ruling out suspects. RunBook measures and optimises for this explicitly. Every incident summary leads with the clearance list: "Cleared: database, CDN, auth-service, queue. Root cause isolated to: checkout-service." Watching seven services get exonerated in eight seconds — something that takes a human 45 minutes — is the most compelling thing you will see in the demo.

### Confidence Scoring
Five weighted factors (runbook match, DNA match, blast radius clarity, deployment correlation, remediation safety) combine into a single 0–100 confidence score. Auto-remediation only fires above the team-configurable threshold. Below it: escalate with the Chronicle narrative and ES|QL snippet pre-written. The threshold is yours to control. The reasoning is always visible.

### Chronicle Narrative
Every incident automatically generates a human-readable timestamped story of what happened, how it was investigated, what was found, and what was done. This is not a summary of what humans said in a Slack thread — it is generated directly from the agent's investigation. Post-mortems that used to take 30–60 minutes to write are ready at incident close.

### Gemini Multimodal Investigation
Attach a Grafana dashboard screenshot to an incident. Gemini reads the graph, extracts anomaly timing and trend breaks, and incorporates the visual evidence into the root cause chain alongside the ES|QL data. No other on-call tool has multimodal evidence ingestion.

---

## Why Elastic 9.4 Specifically

Elastic 9.4 shipped the exact primitives RunBook needs — all GA, all native, all in a single platform:

| Elastic 9.4 Feature | RunBook Uses It For |
|---|---|
| **Workflows GA** | Alert trigger + remediation action layer — no SOAR required. Elastic Workflows was designed for Elastic Security automation; RunBook extends this primitive to the SRE domain, applying the same automation layer to infrastructure incidents. |
| **Agent Builder + Skills** | Modular MCP tools loaded dynamically per incident type |
| **ES|QL subqueries** | Multi-service blast radius correlation in a single query |
| **Vector search (NVIDIA cuVS, 12× faster)** | Runbook semantic search + Incident DNA matching |
| **ML anomaly detection** | Alert generation pre-trained on your own infra metrics |
| **Elastic Cases** | Incident case filing with full investigation audit trail |

Elastic told the world: *"Stop paying the automation tax. There is no separate SOAR tool to buy."* RunBook is the implementation of that promise for teams who do not have three months to build it themselves.

---

## How It Compares

| Tool | Investigates autonomously | Elastic-native | Learns from past incidents | Auto-remediates | Trust-building mode | Cost |
|---|---|---|---|---|---|---|
| **RunBook** | ✅ Full | ✅ 9.4 native | ✅ DNA index | ✅ With confidence gate | ✅ Shadow Mode | $299/mo flat |
| PagerDuty | ❌ Notifies only | ❌ | ❌ | ❌ | ❌ | $25–60/user/mo |
| Rootly | ❌ Summarises humans | ❌ | ❌ | ❌ | ❌ | $20/user/mo |
| FireHydrant | ❌ Static runbooks | ❌ | ❌ | ❌ | ❌ | $9,600/yr |
| DrDroid | Partial | ❌ | ❌ | ❌ | ❌ | OSS |
| Dynatrace AIOps | ✅ | ❌ Requires migration | Partial | ✅ No gate | ❌ | $100k+/yr |
| SOAR platforms | ✅ Scripted only | ❌ | ❌ | ✅ | ❌ | $50–300k/yr |

The closest open-source competitor is DrDroid PlayBooks. It integrates 15+ observability tools but has no Elastic-native baseline, no agentic reasoning loop, no persistent incident memory, and no auto-remediation. RunBook is a different product.

---

## Architecture Overview

```
Elastic ML Anomaly Detection
        │ anomaly score > threshold
        ▼
Elastic Workflows 9.4 (GA)              ← native trigger, no webhook
        │ invokes agent endpoint
        ▼
Google Cloud Agent Builder (Gemini 2.5 Pro)
        │ orchestrates MCP tool calls in sequence
        ├──► elastic_esql_query       → blast radius health matrix
        ├──► elastic_vector_search    → runbook + DNA index
        ├──► elastic_ml_scores        → anomaly evidence per service
        ├──► gemini_analyze_screenshot→ multimodal graph reading
        └──► elastic_deployment_log  → recent deploy correlation
        │
        ▼
Gemini reasons → confidence score 0–100
        │
        ├── ≥ threshold → remediate (pod restart / scale / flush cache)
        │                 file_incident_case
        │                 generate Chronicle narrative
        │                 ingest_incident_dna
        │
        └── < threshold → escalate_with_summary
                          (Chronicle narrative + cleared service list
                           + ES|QL snippet + confidence breakdown)
        │
        ▼
Shadow Mode active: writes to shadow_actions index instead of executing.
Comparison dashboard shows predicted vs actual human resolution weekly.
```

---

## Elastic Indices

| Index | Purpose |
|---|---|
| `runbook_embeddings` | Chunked and embedded runbook docs (Confluence, Notion, markdown, PDF) |
| `incident_dna` | Resolved incident fingerprints with vector embeddings and resolution metadata |
| `blast_radius_snapshots` | ES|QL investigation results per incident, 90-day retention |
| `shadow_actions` | Predicted agent actions in Shadow Mode for comparison |
| `chronicle_reports` | Generated narrative reports linked to Elastic Cases by incident ID |

---

## MCP Tools (11 total)

`elastic_esql_query` · `elastic_vector_search` · `elastic_ml_scores` · `elastic_deployment_log` · `gemini_analyze_screenshot` · `remediate_pod_restart` · `remediate_scale_nodes` · `remediate_flush_cache` · `escalate_with_summary` · `file_incident_case` · `ingest_incident_dna`

---

## Quick Start

```bash
# 1. Clone and configure
git clone https://github.com/your-org/runbook.git && cd runbook
cp config/config.example.yaml config/config.yaml
# Edit config/config.yaml — add Elastic Cloud ID, API key, GCP project ID

# 2. Create Elastic indices
bash scripts/setup-indices.sh

# 3. Ingest sample runbooks
bash scripts/ingest-runbooks.sh

# 4. Deploy the MCP server to Cloud Run
cd mcp-server && gcloud run deploy runbook-mcp --source . --region us-central1

# 5. Verify everything is connected
bash scripts/verify-setup.sh

# 6. Trigger the demo incident
bash scripts/inject-incident.sh
```

Full setup instructions, including Elastic Workflows configuration and Google Cloud Agent Builder registration, are in [IMPLEMENTATION.md](IMPLEMENTATION.md).

---

## Business Model

**Open source core** — Apache 2.0, self-hosted, all features included.

**Cloud tier — $299/month flat** (not per-user). Hosted, zero setup, pre-connected to Elastic Cloud. Managed DNA index with 12-month retention, post-mortem trend dashboards, Slack and email escalation, priority support.

The buyer is a team of 3–12 engineers. Per-user pricing at $20–60/user reaches $720+/month for a 12-person team and triggers a procurement review. $299 flat is one engineer's half-day — a team lead approves it without involving finance.

**20 teams = $5,980/month recurring.** At that point this is not a side project.

---

## Who This Is For

Platform engineering teams and SRE teams at companies with 50–2,000 engineers running on AWS, GCP, or Azure with Elastic already deployed for observability. They are already paying for PagerDuty, a SOAR platform, and Elastic Platinum. RunBook replaces the SOAR and reduces on-call load by an estimated 60% of pages — at a fraction of the cost.

---

## License

Apache 2.0 — see [LICENSE](LICENSE)

---

*Google Cloud Rapid Agent Hackathon · Elastic Track · June 2026*

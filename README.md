<div align="center">

# RunBook
### Autonomous On-Call Agent

**Investigate. Correlate. Remediate. In 45 seconds — not 45 minutes.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Pro-4285F4?style=flat-square&logo=google)](https://cloud.google.com/vertex-ai)
[![Elastic](https://img.shields.io/badge/Elastic-9.4-005571?style=flat-square&logo=elasticsearch)](https://elastic.co)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_+_DB-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square)](LICENSE)

*Submitted to the Google Cloud Rapid Agent Hackathon · Elastic Track · June 2026*

</div>

---

## The Problem

Ask any SRE what their worst week looks like. It is not building — it is **on-call**.

- Average MTTR for complex incidents: **4+ hours**
- Cost of downtime per minute for a mid-size SaaS: **$5,000–$50,000**
- Share of resolution time spent on *investigation*, not the fix: **60–80%**

An engineer gets paged at 3am, opens eight browser tabs, digs through Kibana manually, cross-references runbooks, and eventually finds it was the same database connection pool exhaustion from three months ago — fixed by someone who has since left the company.

> **The tools exist. The intelligence connecting them did not. Until now.**

---

## What RunBook Does

When an anomaly fires, RunBook does in **under 45 seconds** what an engineer does in **45 minutes**:

| Step | What Happens |
|------|-------------|
| **1. Detect** | Elastic ML anomaly detection fires on CPU, latency, or error rate spike |
| **2. Trigger** | Elastic Workflows 9.4 (GA) picks it up natively — no webhook infrastructure |
| **3. Investigate** | ES\|QL health matrix scans every service in the blast radius simultaneously |
| **4. Eliminate** | *Time-to-Innocent*: clears innocent services with evidence before naming root cause |
| **5. Match** | Incident DNA fingerprint search checks if this has happened before |
| **6. Reason** | Gemini 2.5 Pro weighs all evidence and computes a 0–100 confidence score |
| **7. Act** | Above threshold → auto-remediate. Below threshold → escalate with full Chronicle brief |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ELASTIC CLOUD 9.4                             │
│                                                                      │
│  ┌─────────────────┐     anomaly score > threshold                  │
│  │ ML Anomaly Det. │ ──────────────────────────────┐                │
│  └─────────────────┘                               │                │
│                                                    ▼                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Elastic Workflows 9.4 (GA)                     │    │
│  │   native trigger · no SOAR · no webhook infrastructure      │    │
│  └───────────────────────┬─────────────────────────────────────┘    │
│                          │ HTTP POST → MCP agent endpoint           │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────────┐
│                GOOGLE CLOUD (Agent + Compute)                        │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │         Google Cloud Agent Builder (Gemini 2.5 Pro)           │  │
│  │                  MCP Server — 11 Tools                        │  │
│  │                                                               │  │
│  │  elastic_esql_query      ──► blast radius health matrix       │  │
│  │  elastic_vector_search   ──► runbook + DNA semantic search    │  │
│  │  elastic_ml_scores       ──► per-service anomaly evidence     │  │
│  │  elastic_deployment_log  ──► recent deploy correlation        │  │
│  │  gemini_analyze_screenshot──► multimodal graph reading        │  │
│  │  remediate_pod_restart   ──► kubectl rollout restart          │  │
│  │  remediate_scale_nodes   ──► HPA / node pool scaling         │  │
│  │  remediate_flush_cache   ──► Redis FLUSHDB                   │  │
│  │  escalate_with_summary   ──► Slack + Chronicle brief         │  │
│  │  file_incident_case      ──► Elastic Cases + Supabase        │  │
│  │  ingest_incident_dna     ──► vector embed → DNA index        │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                       │
│           ┌──────────────────┴────────────────────┐                 │
│           │      Confidence Score 0–100            │                 │
│           └──────────────┬────────────────────────┘                 │
│                          │                                           │
│          ┌───────────────┴──────────────┐                           │
│          │  ≥ threshold (default 85%)   │  < threshold              │
│          ▼                              ▼                            │
│   AUTO-REMEDIATE                   ESCALATE                         │
│   pod restart / scale / flush      Chronicle narrative              │
│   file_incident_case               ES|QL snippet                   │
│   ingest_incident_dna              cleared service list            │
│   generate Chronicle               confidence breakdown            │
└──────────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────────┐
│                   DASHBOARD (Next.js 16 + Supabase)                  │
│                                                                      │
│   Incident Feed  ──  real-time 15s polling                          │
│   Shadow Mode    ──  predicted vs actual resolution comparison       │
│   DNA Index      ──  fingerprint library + similarity scores        │
│   Runbooks       ──  drag-and-drop ingest → Elastic vector index    │
│   Analytics      ──  MTTR trends, action breakdown, Recharts        │
│   Settings       ──  Elastic URL/key, confidence threshold, billing │
└──────────────────────────────────────────────────────────────────────┘

             ↕ Shadow Mode writes here instead of executing
┌──────────────────────────────────────────────────────────────────────┐
│               ELASTIC INDICES (purpose-built per concern)            │
│                                                                      │
│   runbook_embeddings     chunked + embedded docs for RAG            │
│   incident_dna           resolved incident fingerprint vectors       │
│   blast_radius_snapshots ES|QL investigation results (90d)          │
│   shadow_actions         predicted vs human resolution log          │
│   chronicle_reports      narrative reports linked to Cases          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Six Features That Make This Novel

### 🕵️ Shadow Mode
RunBook observes silently for 14 days before executing any live action. It logs *what it would have done* alongside *what the human engineer actually did*. After 14 days you see accuracy, misses, and reasoning — and you decide when to go live. No competitor offers this trust-building flow.

### 🧬 Incident DNA Fingerprinting
Every resolved incident generates a vector embedding of its full signature (error patterns, affected services, deployment delta, resolution action) stored in a dedicated Elastic index. Future incidents run cosine similarity search against this index first. A 91% DNA match means RunBook skips the full investigation and goes straight to the known fix — citing the past incident by ID. Over 6 months this becomes irreplaceable institutional memory that doesn't leave when engineers do.

### ⚡ Time-to-Innocent
RunBook measures and optimises for clearing suspects explicitly. Every incident summary leads with the exoneration list: *"Cleared: database, CDN, auth-service, queue. Root cause isolated to: checkout-service."* Watching 7 services get cleared in 8 seconds — something that takes a human 45 minutes — is the most compelling thing in the demo.

### 📊 Confidence Scoring
Five weighted factors (runbook match, DNA match, blast radius clarity, deployment correlation, remediation safety) combine into a 0–100 score. Auto-remediation only fires above the team-configurable threshold. Below it: escalate with the Chronicle. The threshold is yours to control. The reasoning is always visible.

### 📖 Chronicle Narrative
Every incident generates a human-readable timestamped story: what happened, how it was investigated, what was found, what was done. Generated directly from the agent's investigation data — not a summary of a Slack thread. Post-mortems that used to take 30–60 minutes to write are ready at incident close.

### 🖼️ Gemini Multimodal Investigation
Attach a Grafana screenshot to an incident. Gemini reads the graph, extracts anomaly timing and trend breaks, and incorporates the visual evidence into the root cause chain alongside the ES\|QL data. No other on-call tool has multimodal evidence ingestion.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Agent Orchestration** | Google Cloud Agent Builder |
| **LLM** | Gemini 2.5 Pro (reasoning + multimodal) |
| **Observability / Data** | Elastic 9.4 — ES\|QL, ML Anomaly Detection, Vector Search, Workflows, Cases |
| **MCP Server** | Python · FastAPI · deployed on Cloud Run |
| **Dashboard** | Next.js 16 · React 19 · Recharts · Tailwind CSS |
| **Auth + DB** | Supabase (Auth, Postgres, RLS) |
| **Billing** | Razorpay Subscriptions |
| **Infrastructure** | GCP — Cloud Run · GKE (for remediation targets) |

---

## Why Elastic 9.4 Specifically

Elastic 9.4 shipped the exact primitives RunBook needed — all GA, all native, all in one platform:

| Elastic Feature | RunBook Uses It For |
|---|---|
| **Workflows GA** | Alert trigger + remediation action layer — no SOAR required |
| **Agent Builder + Skills** | Modular MCP tools loaded dynamically per incident type |
| **ES\|QL subqueries** | Multi-service blast radius correlation in a single query |
| **Vector search (NVIDIA cuVS)** | Runbook semantic search + Incident DNA matching at 12× speed |
| **ML anomaly detection** | Alert generation pre-trained on your own infra metrics |
| **Elastic Cases** | Incident case filing with full investigation audit trail |

> *Elastic told the world: "Stop paying the automation tax. There is no separate SOAR tool to buy."*  
> RunBook is the implementation of that promise.

---

## How It Compares

| Tool | Investigates Autonomously | Elastic-Native | Learns from Past | Auto-Remediates | Trust-Building Mode | Cost |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **RunBook** | ✅ Full agentic | ✅ 9.4 native | ✅ DNA Index | ✅ With confidence gate | ✅ Shadow Mode | $299/mo flat |
| PagerDuty | ❌ Notifies only | ❌ | ❌ | ❌ | ❌ | $25–60/user/mo |
| Rootly | ❌ Summarises humans | ❌ | ❌ | ❌ | ❌ | $20/user/mo |
| FireHydrant | ❌ Static runbooks | ❌ | ❌ | ❌ | ❌ | $9,600/yr |
| Dynatrace AIOps | ✅ | ❌ Migration required | Partial | ✅ No gate | ❌ | $100k+/yr |
| SOAR platforms | ✅ Scripted only | ❌ | ❌ | ✅ | ❌ | $50–300k/yr |

---

## Quick Start

```bash
# 1. Clone and configure
git clone https://github.com/vivekjami/runbook.git && cd runbook
cp config/config.example.yaml config/config.yaml
# Edit config/config.yaml — add Elastic Cloud ID, API key, GCP project ID

# 2. Create Elastic indices
bash scripts/setup-indices.sh

# 3. Ingest sample runbooks
bash scripts/ingest-runbooks.sh

# 4. Deploy the MCP server to Cloud Run
cd mcp-server && gcloud run deploy runbook-mcp --source . --region us-central1

# 5. Set up the dashboard
cd ../dashboard
cp .env.local.example .env.local   # add Supabase URL + anon key
npm install && npm run dev

# 6. Trigger a demo incident (no real infra needed)
curl -X POST http://localhost:3000/api/demo/trigger \
  -H "Authorization: Bearer <your-session-token>"
```

Full setup, Elastic Workflows configuration, and Google Cloud Agent Builder registration are documented in [IMPLEMENTATION.md](IMPLEMENTATION.md).

---

## Dashboard Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page with live terminal investigation demo |
| `/login` | Email/password + Google OAuth |
| `/signup` | 14-day free trial registration |
| `/dashboard` | Real-time incident feed with 15s polling |
| `/dashboard/shadow` | Shadow Mode accuracy gauge and comparison history |
| `/dashboard/dna` | Incident DNA fingerprint library |
| `/dashboard/runbooks` | Drag-and-drop runbook ingest |
| `/dashboard/analytics` | MTTR trends, action breakdown, Recharts charts |
| `/dashboard/incidents/[id]` | Full investigation: timeline, narrative, ES\|QL, confidence factors |
| `/dashboard/settings` | Elastic connection, confidence threshold, billing |

---

## Environment Variables

```bash
# dashboard/.env.local

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Razorpay (optional — billing Phase 2)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_PLAN_ID=
RAZORPAY_WEBHOOK_SECRET=
```

---

## Security

- **Row Level Security** — every Supabase query is explicitly filtered by `workspace_id = auth.uid()` both at the RLS policy layer and the application query layer
- **Middleware auth gate** — all `/dashboard/*` routes redirect to `/login` if no valid session
- **API key masking** — Elastic API keys are displayed as `••••••••` in the UI; the plaintext is only overwritten if the user explicitly types a new value
- **Webhook signature verification** — Razorpay webhooks are verified with HMAC-SHA256 before any DB mutation

---

## Business Model

**Open source core** — Apache 2.0, self-hosted, all features included.

**Cloud tier — $299/month flat** (not per-user). Hosted, zero setup, pre-connected to Elastic Cloud. Managed DNA index with 12-month retention, Slack/email escalation, priority support.

> The buyer is a team of 3–12 engineers. Per-user pricing reaches $720+/month for 12 people and triggers procurement review. $299 flat is one engineer's half-day — a team lead approves it without involving finance.

**20 teams = $5,980 MRR.** At that point this is not a side project.

---

## License

[Apache 2.0](LICENSE)

---

<div align="center">

*Google Cloud Rapid Agent Hackathon · Elastic Track · June 2026*

**Built by [Vivek Jami](https://github.com/vivekjami)**

</div>

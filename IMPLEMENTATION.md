# RunBook — Implementation Guide

> **Complete architecture and step-by-step build plan. No boilerplate — just every decision you need to make, in the order you need to make it, with the reasoning behind each one.**

Deadline: June 12, 2026. You have 32 days. This guide is scoped to finish in 28, leaving 4 days for polish and the demo video.

---

## Before You Start: Mental Model

RunBook is **six systems wired together**, not one system. Build and verify each in isolation before connecting them. The biggest failure mode in a hackathon is building everything at once and having no idea which layer is broken when something goes wrong.

The six systems in dependency order:

```
1. Data Layer        — Elastic indices + synthetic test data
2. Detection Layer   — ML anomaly detection + alert rules
3. Trigger Layer     — Elastic Workflows 9.4
4. Intelligence Layer— MCP server + Gemini agent
5. Action Layer      — Remediation tools + escalation
6. Memory Layer      — DNA fingerprinting + Shadow Mode
```

Build them in this exact order. Each system has a clear "this works" verification step before you move on.

---

## Accounts and Access You Need on Day 1

Get all of these before writing a single line of code. Waiting on credentials mid-build kills momentum.

**Elastic Cloud**
- Sign up for Elastic Cloud at cloud.elastic.co
- Create a deployment on version 9.4 (confirm version at creation — do not accept 8.x)
- Enable the Machine Learning plugin during cluster creation
- Choose at least the Platinum tier (required for ML anomaly detection and Workflows)
- Save your Cloud ID, Elasticsearch endpoint URL, and API key immediately
- Note: The free trial gives you $300 of credit — enough for the full 32 days if you choose a reasonable instance size (2 vCPU, 4GB RAM is sufficient for the demo)

**Google Cloud**
- Create a new GCP project specifically for this hackathon (keeps billing and permissions clean)
- Enable the Vertex AI API
- Enable the Google Cloud Agent Builder API (Vertex AI Agent Builder)
- Enable the Cloud Run API (you will deploy the MCP server here)
- Create a service account with roles: Vertex AI User, Cloud Run Invoker
- Download the service account JSON key

**Gemini API**
- Use **Gemini 2.5 Pro** via Vertex AI — confirmed compliant with official hackathon rules (Section 7A mandates "Gemini" without pinning a specific version; Gemini 2.5 Pro is production-stable today)
- Get API access through your GCP project's Vertex AI endpoint (not Google AI Studio — Vertex AI is required for the Agent Builder integration)
- The Gemini embeddings API (for creating vector embeddings) is separate from the chat/generation API — enable both in your GCP project
- Note: Section 7B prohibits using any AI services from Google Cloud competitors (no AWS Bedrock, no Azure OpenAI, no Anthropic Claude directly)

**GitHub**
- Create the public repository on day 1
- Add the Apache 2.0 license file immediately (the submission requires it to be visible in the repo's About section — do not add it at the last minute)
- Set up the repository description to mention "Elastic MCP" and "Google Cloud Agent Builder" — judges may scan repos before watching videos

---

## Week 1: Data Layer + Detection Layer (Days 1–7)

**This week's goal:** Have a realistic Elastic cluster with data, anomaly detection firing on synthetic incidents, and the five required indices created with correct mappings.

Everything downstream — the agent, the MCP tools, the Workflows trigger — depends on having good data to work with. If you skip this and try to build on empty or poorly structured data, you will debug the wrong things for the rest of the project.

---

### Day 1–2: Elastic Cluster Setup and Index Architecture

**What you are building:** The five Elastic indices with correct field mappings, especially the `dense_vector` fields for the two vector search indices.

**Why this matters first:** Index mappings in Elasticsearch are immutable after creation. If you create `runbook_embeddings` with the wrong vector dimensions and later discover Gemini's embedding model outputs 3072 dimensions instead of 768, you must delete and recreate the index — losing all your ingested runbooks. Get the mappings right on day 1.

**Decisions to make:**

*Vector dimensions:* Check the Gemini embeddings API documentation for the model you are using (the `text-embedding-004` model outputs 768 dimensions; `text-embedding-large-exp-03-07` outputs 3072). Pick one and lock it in. Higher dimensions = better semantic accuracy but slower search. For the demo, 768 is sufficient.

*HNSW parameters for kNN:* The `runbook_embeddings` and `incident_dna` indices need `dense_vector` fields with `index: true` and HNSW parameters. Use `m: 16` and `ef_construction: 100` as starting values. These control search accuracy vs index build time — the defaults are fine for demo scale.

*Shard count:* Use 1 shard for all six indices. You are not building a production cluster; sharding adds complexity with no benefit at demo scale.

**The six indices and their key fields:**

`runbook_embeddings`
— text fields: title, content, source\_url, source\_type, last\_updated
— dense\_vector field: embedding (dimensions matching your chosen model)
— keyword fields: service\_tags (array, for filtering runbooks by service name)

`incident_dna`
— dense\_vector field: embedding
— keyword fields: incident\_id, root\_cause\_service, resolution\_action
— numeric fields: resolution\_time\_seconds, similarity\_score
— object field: deployment\_delta (service, version, deployed\_by, deployed\_at)
— date field: closed\_at

`blast_radius_snapshots`
— keyword fields: incident\_id, triggered\_by\_alert\_id
— object field: service\_health (array of service name, anomaly\_score, status, p99\_latency, error\_rate)
— date field: snapshot\_at
— text field: time\_to\_innocent\_cleared\_services (comma-separated)

`shadow_actions`
— keyword fields: incident\_id, predicted\_action, actual\_human\_action, mode
— boolean field: prediction\_correct
— text field: predicted\_reasoning
— numeric field: predicted\_confidence
— date field: incident\_at

`chronicle_reports`
— keyword field: incident\_id, case\_id
— text field: narrative (the full generated story)
— keyword field: root\_cause\_service, resolution\_action
— numeric fields: time\_to\_detection\_seconds, time\_to\_innocent\_seconds, time\_to\_resolution\_seconds
— date field: generated\_at

`human_resolutions` ← sixth index, internal to Shadow Mode accuracy tracking
— keyword fields: incident\_id, action\_taken, closed\_by
— numeric field: resolution\_time\_seconds
— date field: closed\_at
— text field: notes (optional — engineer's free-text notes on what they actually did)
— keyword field: severity (P1/P2/P3 — for filtering accuracy by incident severity)
This index is populated manually during the demo for the three historical incidents (INC-0045, INC-0046, INC-0047). In production it would be written by your incident management system on case close. The mapping JSON is in `config/index-mappings/human_resolutions.json`.

**Verification:** After creating all six indices, use Kibana Dev Tools to confirm each index exists with the correct field count. Query `GET runbook_embeddings/_mapping` and verify the `embedding` field shows `type: dense_vector` with your chosen dimensions.

---

### Day 2–3: Synthetic Data Generation

**What you are building:** Realistic log, metrics, and APM trace data in Elastic that mimics a real microservices deployment — with three injected incidents already "resolved" so your DNA index has historical data from day one.

**Why synthetic data:** You cannot demo against a real production system. You need data you control — specifically, data with known anomalies you can trigger reliably during the demo video recording. The demo needs to work 20 times in a row without variation.

**The fictional architecture you will simulate (keep it simple):**

Five services: `payments-api`, `checkout-service`, `auth-service`, `product-catalog`, `notification-service`. One database: `postgres-main`. One cache: `redis-cache`. One CDN endpoint.

This is enough to make Time-to-Innocent compelling (seven things to clear, one root cause) without becoming a data engineering project.

**Data you need to generate:**

*Baseline data (7 days of "normal"):* For each service, generate metrics (CPU %, memory %, request rate, p99 latency, error rate) and logs (INFO level, occasional WARN) at normal levels. Use Elastic's data generator tool (available in Kibana under "Sample Data") as a starting point and then modify it, or write a script that pushes data to Elasticsearch via the bulk API on a schedule.

Key baseline numbers to establish (these become your anomaly thresholds):
- `payments-api` baseline p99 latency: 1.1 seconds
- All services baseline error rate: < 0.001 (0.1%)
- `checkout-service` baseline memory: 512MB

*Three pre-resolved incidents for the DNA index:* These do not need to be fully simulated — they just need to exist as records in `incident_dna` with realistic embeddings. Craft them manually:

INC-0045: checkout-service OOM kill, November 2025, resolved by pod restart, 47 minutes MTTR
INC-0046: postgres-main connection pool exhaustion, January 2026, resolved by increasing pool size + restarting checkout-service, 2.1 hours MTTR
INC-0047: checkout-service memory leak after deployment, February 2026, resolved by pod restart, 47 minutes MTTR

INC-0047 is the one that should match your demo incident with 91% similarity. When you build the DNA ingestion in Week 3, embed INC-0047's signature using the same embedding model you use for live incidents — this ensures the similarity score is real, not fabricated.

*The demo incident data:* A spike on `checkout-service` memory (from 512MB to 2.1GB over 4 minutes) starting at a timestamp you control. All other services remain normal. This is the data you will inject live during the demo.

**Verification:** Open Kibana Discover, filter to the last 7 days, and confirm you can see log data for all five services. Check the ML Data Visualizer to confirm the memory metric for `checkout-service` is distinguishable from the other services.

---

### Day 3–4: ML Anomaly Detection Setup

**What you are building:** An Elastic ML job that detects the `checkout-service` memory spike and generates an anomaly with score > 75, plus an alert rule that fires when any service crosses the threshold.

**Why Elastic ML specifically (not a simple threshold rule):** Threshold rules fire constantly during normal traffic spikes. Elastic ML learns your baseline and fires only on statistically significant deviations. This is the difference between 50 pages per day and 5. For the demo, ML detection also looks more impressive than a simple `IF memory > 2GB THEN alert`.

**ML job configuration decisions:**

*Job type:* Use a Single Metric job for the demo. Multi-metric jobs are more powerful but harder to configure correctly in limited time. A single metric job on `max(memory_bytes)` per `service.name` is sufficient to catch the demo incident.

*Bucket span:* 5 minutes. This controls the granularity of anomaly detection. Shorter = more sensitive but more false positives. 5 minutes catches the demo incident without being noisy on the 7-day baseline data.

*Detectors:* `max(system.memory.actual.bytes) partition_field_name: service.name`. This creates a separate model per service and fires when any one of them deviates significantly from its own baseline.

*Influencers:* Add `service.name`, `host.name`, and `kubernetes.pod.name` as influencers. This tells the ML job which fields are causally relevant — they appear in the anomaly record and feed into the investigation.

**Alert rule on top of the ML job:**

Create an Elastic alerting rule of type "Anomaly detection alert". Set it to fire when `anomaly score ≥ 75`. This is the trigger that Elastic Workflows will listen to.

Action for the alert rule: Write a webhook action that calls your MCP server's `/incident` endpoint (you will build this in Week 2). For now, you can point it at a local ngrok URL or a placeholder.

**Verification:** Run the ML job against your 7-day baseline data. Confirm it builds a model without errors. Then inject the demo incident data (the `checkout-service` memory spike) and manually check that the job generates an anomaly record with score > 75. Use Kibana's Anomaly Explorer to visualise this.

---

### Day 5–7: Runbook Ingestion Pipeline

**What you are building:** A pipeline that takes your runbook documents, chunks them into passages, embeds each passage using the Gemini embeddings API, and stores them in `runbook_embeddings`.

**Why this is the highest-risk piece of the entire project:** The quality of the runbook index determines whether semantic search returns useful context to Gemini or garbage. If search returns garbage, Gemini reasons poorly, confidence scores are inaccurate, and the whole intelligence layer looks broken. This is also the piece most teams underestimate — it looks like a simple ETL job but has many subtle failure modes.

**The runbook documents you need to create (do this first):**

Write five realistic runbook documents in markdown. Do not use lorem ipsum — write actual SRE content. These are what gets embedded and searched:

1. `checkout-service-runbook.md` — symptoms of OOM kill, pod restart procedure, how to check memory trends in Elastic, when to escalate
2. `memory-leak-investigation.md` — how to identify a memory leak vs legitimate traffic growth, ES|QL queries for memory trend analysis, common causes in JVM services
3. `payments-api-runbook.md` — service dependencies, SLAs, escalation contacts, known failure modes
4. `pod-restart-protocol.md` — when pod restart is safe vs risky, how to verify service recovery, post-restart verification steps
5. `incident-escalation-guide.md` — severity definitions, escalation contacts per severity, what information to include in an escalation

These five documents are not a lot. But they are enough to demonstrate that semantic search works — the demo query "OOM kill on checkout-service" should return chunks from documents 1 and 2 with high similarity.

**Chunking strategy decisions:**

*Chunk size:* 512 tokens per chunk. This is the standard for RAG applications. Smaller chunks (256 tokens) give more precise retrieval but lose context. Larger chunks (1024 tokens) give more context but are harder for the model to reason from. 512 is the safe default.

*Overlap:* 50-token overlap between consecutive chunks. This prevents important content at chunk boundaries from being lost.

*Metadata to store per chunk:* source document title, source URL (or file path), chunk index within the document, the service tags this runbook applies to (e.g. `["checkout-service", "payments-api"]`), last updated date. This metadata appears in the Gemini reasoning context so it can cite specific runbook sections.

**Embedding pipeline:**

For each chunk: call the Gemini embeddings API with the chunk text → receive a vector of your chosen dimension → upsert to `runbook_embeddings` with the chunk text and all metadata fields.

Do not batch more than 250 chunks per API call. Do not embed chunks shorter than 100 tokens (they typically contain only headers and no useful content).

**Verification:** After ingestion, run a test vector search query against `runbook_embeddings` with the phrase "memory leak pod restart checkout-service" embedded as the query vector. The top result should be a chunk from one of your runbook documents, not a random passage. If the top result is irrelevant, something is wrong with your chunking or embedding — fix it before moving on.

---

## Week 2: Agent Core (Days 8–14)

**This week's goal:** A working agent that can take an incident description as input, call MCP tools, and return a structured investigation result including confidence score and recommended action. By end of week 2 you should be able to trigger the agent manually and see it produce a real output.

---

### Day 8–9: MCP Server Architecture and Deployment

**What you are building:** A lightweight HTTP server that exposes the 11 MCP tools as JSON endpoints. Google Cloud Agent Builder calls these tools during the Gemini 2.5 Pro reasoning loop.

**Architecture decision — what runs where:**

The MCP server is a Python (FastAPI) or Node.js (Express) application. It is the layer between the Gemini agent and your Elastic cluster. It handles authentication to Elastic, executes queries, and returns structured results.

Deploy it to Google Cloud Run. Cloud Run is the right choice because: it scales to zero when not in use (no cost when there are no incidents), it has a stable HTTPS URL (required for the agent to call it), and it integrates naturally with GCP's IAM for securing the endpoint.

Do not deploy to Cloud Functions — the MCP server has startup time that is too slow for cold starts in a function context.

**The 11 MCP tools and what each one does:**

`elastic_esql_query (index_pattern, esql_query, time_range_minutes)`
— Executes the provided ES|QL query against the specified index pattern over the given time range
— Returns a JSON array of results
— This is the most-called tool in the loop — the blast radius scan, deployment correlation, and service health checks all use it

`elastic_vector_search (index, query_text, k, filter_service)`
— Embeds the query_text using Gemini embeddings API
— Runs kNN search against the specified index (runbook_embeddings or incident_dna)
— Optional filter_service parameter restricts results to runbooks tagged for that service
— Returns top k results with scores and metadata

`elastic_ml_scores (service_name, time_range_minutes)`
— Fetches ML anomaly records for the named service over the time window
— Returns anomaly score, influencers, and the metric values that drove the anomaly
— Used to pull the exact anomaly evidence that triggered the alert

`elastic_deployment_log (service_name, lookback_minutes)`
— Queries APM deployment events for the service in the lookback window
— Returns deploy timestamp, version, who deployed, and the diff summary if available
— Used to establish deployment correlation (did a deploy cause this?)

`gemini_analyze_screenshot (base64_image, context_prompt)`
— Sends the image to Gemini Vision with a context prompt describing what kind of infrastructure graph this is
— Returns a text analysis: detected anomalies, approximate timing, trend description
— Only called if a screenshot is attached to the incident

`remediate_pod_restart (service_name, namespace, dry_run)`
— Triggers a Kubernetes pod restart for the named service via Elastic Workflows action
— dry_run: true returns what would happen without executing (used in Shadow Mode)
— Returns success/failure with the new pod ID

`remediate_scale_nodes (cluster, current_node_count, target_node_count, dry_run)`
— Triggers a node scale-up via Elastic Workflows
— dry_run: true in Shadow Mode

`remediate_flush_cache (service_name, cache_type, dry_run)`
— Flushes Redis or Memcached cache for the named service

`escalate_with_summary (incident_id, summary, confidence, cleared_services, esql_snippet, on_call_contact)`
— Sends an escalation notification (initially just logs to Elastic and prints to console — add real Slack/email in Week 3)
— Attaches the Chronicle narrative draft, confidence breakdown, and cleared service list

`file_incident_case (incident_id, summary, root_cause_service, actions_taken, chronicle_narrative)`
— Creates an Elastic Case via the Cases API
— Attaches all investigation artifacts as case comments

`ingest_incident_dna (incident_id, signature_text, resolution_action, resolution_time_seconds, root_cause_service, deployment_delta)`
— Embeds the signature_text using Gemini embeddings API
— Upserts the record to `incident_dna`
— Called at incident close, not during investigation

**Tool security:**
All tools authenticate to Elastic using a dedicated service account API key with minimum required permissions (index-specific read for query tools, write for the case filing and DNA ingestion tools). The Cloud Run service is behind GCP IAM — only the Gemini agent's service account can call it.

**Verification:** After deploying to Cloud Run, call each tool endpoint manually with a test payload using curl. Confirm `elastic_esql_query` returns data from your synthetic dataset. Confirm `elastic_vector_search` against `runbook_embeddings` returns relevant runbook chunks. These two tools failing is the most common issue at this stage — debug them completely before building the agent.

---

### Day 10–11: Google Cloud Agent Builder Setup

**What you are building:** The agent definition in Google Cloud Agent Builder (Vertex AI Agent Builder), connected to your MCP server with Gemini 2.5 Pro as the reasoning model, with the system prompt and tool-calling loop configured.

**Key decisions:**

*Agent type:* Use a "Custom Agent" in the platform, not a pre-built template. You need full control over the system prompt and tool-calling sequence.

*System prompt structure:* The system prompt is the most important configuration in the entire project. It determines how the agent investigates, in what order it calls tools, and how it formats its output. Structure it in four sections:

Section 1 — Role and context: "You are RunBook, an autonomous on-call agent for infrastructure incident investigation. You have access to an Elastic cluster containing logs, metrics, and APM traces for a microservices application..."

Section 2 — Investigation procedure (numbered steps the agent must follow in order):
1. Call `elastic_ml_scores` to retrieve the triggering anomaly details
2. Call `elastic_esql_query` with the blast radius health matrix query to classify all services as CLEARED, DEGRADED, or ROOT_CAUSE_CANDIDATE
3. Call `elastic_vector_search` against `incident_dna` with the incident signature
4. If DNA match score > 0.85: proceed directly to step 6 using the historical resolution
5. If no DNA match: call `elastic_vector_search` against `runbook_embeddings` with the incident signature
6. Call `elastic_deployment_log` for the ROOT_CAUSE_CANDIDATE service
7. If a screenshot is provided: call `gemini_analyze_screenshot`
8. Compute confidence score using the five factors
9. Return the structured investigation result in the specified JSON format

Section 3 — Output format specification: Define the exact JSON schema the agent must return (confidence score, action, root cause service, cleared services list, DNA match reference if applicable, runbook references, Chronicle narrative draft, ES|QL snippet for manual investigation)

Section 4 — Constraints: Never skip steps 1 and 2. Never auto-remediate if the remediation action is irreversible (e.g. database deletion). Always list cleared services before naming root cause. In Shadow Mode, set dry_run: true on all remediation tool calls.

*Tool registration:* Register all 11 MCP tools with the agent using the OpenAPI spec format. Each tool needs a name, description (written for the model, not a human — be precise about what it returns), and parameter schema. The tool descriptions are how the model decides which tool to call — vague descriptions lead to wrong tool calls.

**Verification:** Send a manual test payload to the agent endpoint: a JSON object describing a fake incident (checkout-service memory anomaly, score 82, no DNA match, no screenshot). Watch the agent call tools in the correct order. The final output should be a structured JSON with all required fields populated. If the agent calls tools out of order or skips steps, revise the system prompt.

---

### Day 12–13: Confidence Scoring Logic

**What you are building:** The five-factor confidence computation that determines whether RunBook auto-remediates or escalates.

**Why this is part of the agent setup, not separate code:** The confidence score is computed *inside* the Gemini reasoning step, not in your application code. You pass the raw factor values to Gemini as context, and the model assigns the final score using the weights you define in the system prompt. This is intentional — it lets Gemini adjust for context that the raw numbers miss (for example, a 95% DNA match to an incident that was later determined to be incorrectly diagnosed should be weighted lower).

**The five factors and how to compute each:**

`runbook_match_score (0–100)`
— Take the cosine similarity score from the top runbook search result (it is a 0.0–1.0 float from Elastic)
— Multiply by 100
— If no runbook result had similarity > 0.6, set this to 0 (a low-confidence match is not useful context)

`dna_match_score (0–100)`
— Take the cosine similarity from the top DNA search result × 100
— If no DNA match was found (score < 0.7), set this to 0

`blast_radius_clarity (0–100)`
— If exactly one service is classified ROOT_CAUSE_CANDIDATE: 90
— If two services are ROOT_CAUSE_CANDIDATE: 55
— If three or more: 25
— The formula rewards isolation — a clean single-service anomaly is much more actionable than a cascade

`deployment_correlation (0–100)`
— If a deployment on the root cause service occurred 0–10 minutes before the anomaly: 95
— 10–20 minutes before: 75
— 20–30 minutes before: 40
— No recent deployment found: 20
— A recent deployment is the single strongest signal that the change caused the incident

`remediation_safety (0–100)`
— Pod restart: 95 (fast, reversible, standard procedure)
— Cache flush: 85 (reversible, minor user impact)
— Node scale-up: 70 (slow, expensive, but safe)
— Config change: 40 (requires validation)
— Database operation: 10 (never auto-execute without human confirmation)

Include this scoring rubric in the system prompt. Tell the agent to compute the weighted average: `(runbook × 0.25) + (dna × 0.30) + (clarity × 0.20) + (deployment × 0.15) + (safety × 0.10)`.

**Threshold configuration:** Store the auto-remediation threshold in your config file, not hardcoded. Default value: 85. Let operators change it without redeploying.

**Verification:** Run three test scenarios through the agent:
1. High confidence scenario: clear DNA match, single root cause service, recent deployment, pod restart recommended → should score 88–95 and trigger auto-remediation
2. Medium confidence: no DNA match, good runbook match, two candidate services → should score 60–75 and escalate
3. Low confidence: no DNA match, no runbook match, five candidate services → should score below 40 and escalate with explicit note that more investigation is needed

---

### Day 14: End-to-End Test (Manual Trigger)

Before building the Workflows trigger, verify the full manual loop works. Send a realistic incident payload directly to the agent endpoint. Watch it call tools in sequence. Confirm the output JSON is complete and correctly structured. File a test case in Elastic and verify it appears in Kibana Cases. This is your "Week 2 passes" checkpoint.

If the agent fails here, debug before moving on. The most common failures at this stage: tool authentication errors (Elastic API key missing the right permissions), tool descriptions too vague (agent calls wrong tool), system prompt too long (model loses the output format specification at the end).

---

## Week 3: Differentiating Features (Days 15–21)

**This week's goal:** Shadow Mode working, Incident DNA ingestion on close, Time-to-Innocent displayed correctly in the Chronicle narrative, and Elastic Workflows as the live trigger replacing the manual test calls.

---

### Day 15–16: Elastic Workflows 9.4 Trigger

**What you are building:** The Workflows configuration that listens for ML anomaly alert events and automatically calls your MCP server's `/incident` endpoint.

**Why Workflows specifically instead of a webhook or Lambda:** This is the hackathon's deepest technical requirement. Elastic Workflows GA is the feature the Elastic judges care most about — it is native to Elastic 9.4, requires no external infrastructure, has built-in retry and audit trail, and is exactly what it was designed to do. Using a Lambda function here instead would be a missed point.

**Workflow structure:**

The Workflow is a YAML definition with three components:

*Trigger:* An alert connector listening for the anomaly alert rule you created in Week 1. When the alert fires, the Workflow receives the alert payload including the service name, anomaly score, and timestamp.

*Data enrichment step:* Before calling the agent, the Workflow makes a direct ES|QL call to pull the last 15 minutes of service health data and attach it to the incident context. This reduces the number of tool calls the agent needs to make and speeds up investigation.

*Action step:* An HTTP action that POSTs the enriched incident context to your MCP server's `/incident` endpoint on Cloud Run. Include the Workflows execution ID as a correlation header — this lets you trace any incident back to its Workflow run in Kibana.

**Important nuance about Workflows 9.4's security-native origin:** Elastic Workflows GA was designed primarily for the Elastic Security / SIEM use case (automating SOC analyst responses). The observability/SRE use case is valid but slightly unconventional. Be prepared to explain this clearly in your submission description. The judges will know the SIEM origin — frame it as "extending Workflows beyond security into the SRE domain" which is a feature, not a bug: the same automation primitive that SOC teams use to respond to threats now applies to infrastructure incidents.

**Verification:** Inject the demo incident data (checkout-service memory spike) into Elastic. Watch for the ML job to fire the anomaly. Confirm the alert rule triggers. Confirm the Workflow executes (check the Workflows execution log in Kibana). Confirm your MCP server receives the POST request. End-to-end, this chain should fire within 60–90 seconds of data injection.

---

### Day 17: Shadow Mode Implementation

**What you are building:** A configuration flag that routes all remediation tool calls to write to `shadow_actions` instead of executing, plus a Kibana dashboard that shows the comparison.

**Architecture of Shadow Mode:**

The `dry_run` parameter on all remediation tools is the technical mechanism. When the agent system prompt includes "Shadow Mode is active: set dry_run: true on all remediation tool calls", the MCP server's remediation tools skip execution and instead write a record to `shadow_actions` with: incident ID, predicted action, predicted confidence, predicted reasoning, timestamp.

The comparison happens post-hoc. A Kibana Watcher job runs weekly and joins `shadow_actions` with a separate `human_resolutions` index (where you log what the human actually did to close each incident). The Watcher computes: prediction\_correct (boolean), time delta between predicted and actual action, confidence score vs actual difficulty.

**The `human_resolutions` index** is simple: incident ID, action taken, resolution time, closed by. In the demo environment you populate this manually for the three historical incidents. For the demo video, show the comparison dashboard with the pre-populated data.

**Kibana dashboard for Shadow Mode:**

Create a simple Kibana dashboard with four panels:
- Total incidents observed in Shadow Mode (count)
- Prediction accuracy rate (percentage of prediction_correct = true)
- Average confidence score for correct predictions vs incorrect ones
- A table of the last 10 incidents with prediction vs actual side by side

This dashboard is what you show in the last 30 seconds of the demo video. It is the visual that justifies the "trust-building" framing.

---

### Day 18–19: Incident DNA Fingerprinting on Close

**What you are building:** The post-incident ingestion that turns every resolved incident into a DNA record.

**When it runs:** After an incident case is closed in Elastic (status changes to "closed"), a Watcher fires and calls the `ingest_incident_dna` MCP tool with the incident's signature.

**The signature text that gets embedded:**

This is the most important decision in the DNA feature. The embedding quality — and therefore the similarity matching accuracy — depends entirely on what text you embed. Do not embed just the error messages. Embed a structured summary that captures all the causally relevant dimensions:

"Service: checkout-service. Anomaly type: memory OOM kill. Error patterns: OutOfMemoryError, pod CrashLoopBackOff. Affected services: checkout-service. Blast radius: payments-api degraded. Triggering event: deployment of version 2.14.1 at T-4 minutes. Resolution: pod restart. Resolution time: 47 minutes. Deployment change: added unbounded cache in session handler."

This signature, when embedded, creates a vector that captures the causal chain — not just the symptom. Future incidents where a deployment introduces an unbounded cache will match this record even if the exact error messages differ.

**DNA search threshold decision:** Set the similarity threshold for "this is a known pattern" at 0.85 (85% cosine similarity). Above this threshold the agent states "known pattern" and uses the historical resolution. Between 0.70 and 0.85: "similar pattern — treat as guidance, not confirmation." Below 0.70: no DNA match, proceed to runbook search.

**Verification:** Embed the three historical incidents you created in Week 1 into `incident_dna`. Then run the agent with the demo incident (checkout-service memory spike). Confirm it returns a DNA match to INC-0047 with score > 0.85. If the score is lower, adjust the signature text for INC-0047 to more closely match the demo incident's signature — this is legitimate tuning, not cheating.

---

### Day 20: Time-to-Innocent in the Chronicle Narrative

**What you are building:** The specific section of the Chronicle narrative that lists cleared services with their supporting evidence, before naming the root cause.

**This is not a separate feature — it is the blast radius scan result formatted correctly.**

The blast radius health matrix ES|QL query returns a status field for each service: CLEARED, DEGRADED, or ROOT_CAUSE_CANDIDATE. Time-to-Innocent is the elapsed time between when the alert fired and when all non-root-cause services received a CLEARED status.

Include the elapsed time in the investigation: the blast radius scan runs in approximately 3–8 seconds. That is your Time-to-Innocent measurement for the demo.

**Chronicle narrative template:**

Tell Gemini in the system prompt to format the Chronicle narrative with this structure (it can fill in the content, but the structure must be consistent):

```
INCIDENT TIMELINE — [incident_id]

[timestamp UTC] — Alert fired. [service_name] anomaly score [score] (threshold: 75).
[metric]: [value] vs [baseline] baseline.

BLAST RADIUS INVESTIGATION — completed in [elapsed_seconds] seconds

CLEARED (no anomaly detected):
• [service]: [key metric] normal ([value])
• [repeat for each cleared service]

ROOT CAUSE CANDIDATE:
• [service]: anomaly score [score] | [key metric] [value] vs [baseline] baseline

INCIDENT DNA MATCH:
[if match]: 
  [similarity]% similarity to [incident_id] ([date]). Resolution: [action]. MTTR: [time].
[if no match]:
  No prior incident match above 85% threshold. Proceeding to runbook search.

RUNBOOK MATCH:
  [document title] — [relevant excerpt summary]

DEPLOYMENT CORRELATION:
  [service] version [version] deployed at [timestamp] — [N] minutes before anomaly.
  Deployed by: [name]. Change summary: [summary if available]

CONFIDENCE SCORE: [score]/100
  Runbook match:         [score]/100 (weight: 25%)
  DNA match:             [score]/100 (weight: 30%)
  Blast radius clarity:  [score]/100 (weight: 20%)
  Deployment correlation:[score]/100 (weight: 15%)
  Remediation safety:    [score]/100 (weight: 10%)

ACTION: [AUTO-REMEDIATE | ESCALATE]
  [Action taken or escalation sent]

RESOLUTION:
  [timestamp UTC] — [action] completed. [metric] returned to baseline.
  Total time, alert to resolution: [N] minutes [N] seconds.
  Human MTTR for [incident_id] (prior incident): [N] minutes.
```

**Verification:** Run the demo incident end-to-end and confirm the Chronicle narrative matches this template with all fields populated. The narrative is what appears in the Elastic Case and what gets shown in the demo video — it needs to be visually clean and human-readable.

---

### Day 21: Week 3 Integration Test

Run the complete loop three times from the Workflows trigger, not the manual endpoint. Each run should produce: a Workflows execution record, a blast radius snapshot in Elastic, a Chronicle narrative, a filed Elastic Case, and (if Shadow Mode is off) a completed remediation action. Verify all five artefacts exist in Kibana after each run.

---

## Week 4: Deployment, Polish, Submission (Days 22–32)

**This week's goal:** Hosted URL live, demo video recorded, GitHub repo clean, Devpost submission written. Leave days 30–32 completely free as buffer.

---

### Day 22–24: Live Hosted URL

**Requirement:** The hackathon submission requires a URL to a hosted, functional project. This cannot be localhost.

**What to deploy:**

Deploy a minimal web UI on Cloud Run that acts as the RunBook dashboard. This is a single-page HTML/JS application — not a full product UI, but a professional demo interface with two capabilities:

1. **Shadow Mode comparison panel** — Shows the four-panel accuracy dashboard (total incidents observed, prediction accuracy rate, confidence score distribution, last 10 incidents table). Data is pulled live from `shadow_actions` and `human_resolutions` via the MCP server's read endpoints.

2. **Incident injection trigger** — A single button that calls `inject-incident.sh` logic via an `/api/inject` endpoint. This is what you press at 0:20 in the demo video to fire the checkout-service memory spike live.

For the Kibana investigation views (Anomaly Explorer, Workflows execution log, Elastic Cases), embed them as **Kibana iframes** within the custom UI. Elastic Cloud provides embeddable Kibana URLs — use these rather than handing judges direct cluster access. This gives you the best of both worlds: the visual quality of real Kibana data with the control of a custom interface.

> **Security note:** Do not share Elastic cluster credentials (even read-only) in your submission. Read-only Elastic users still have full data access. Use the iframe embed approach — it requires no credential sharing and looks identical from the outside.

**Cloud Run deployment checklist:**
- MCP server deployed and accessible via HTTPS URL (e.g. `https://runbook-mcp-xxxx-uc.a.run.app`)
- Custom UI deployed as a second Cloud Run service (e.g. `https://runbook-ui-xxxx-uc.a.run.app`)
- Gemini agent endpoint configured with the Cloud Run MCP server URL
- Environment variables for Elastic Cloud ID and API key set in Cloud Run secrets (not hardcoded)
- Cloud Run service account has correct IAM roles
- Both services have `min-instances: 1` set (avoid cold start during demo)

---

### Day 25–26: Demo Video Script and Recording

**The 3-minute arc (do not deviate from this — it is engineered for maximum impact):**

0:00–0:20 — The problem. Show a Slack message: "PROD DOWN — payments-api latency 8× baseline — @oncall". Say: "This is what 3am looks like for your best engineer. RunBook ends this."

0:20–0:45 — Inject the incident live. Run the injection script. Show Elastic ML anomaly detection firing in the Anomaly Explorer. Show Elastic Workflows picking up the event in the Workflows execution log. Do not cut away — the judges need to see it fire in real time.

0:45–1:20 — Time-to-Innocent. This is the most important 35 seconds. Show the blast radius scan results populating: "CLEARED: database, CDN, auth-service, product-catalog, notification-service, redis-cache." Then "ROOT CAUSE CANDIDATE: checkout-service." Say: "A human engineer just spent 45 minutes doing what you watched in 8 seconds."

1:20–1:50 — DNA match and auto-remediation. Show: "Incident DNA match: 91% similarity to INC-0047 (February 2026). Resolution: pod restart. MTTR: 47 minutes." Show the confidence score: 89%. Show Workflows executing the pod restart. Show latency dropping back to baseline on the Kibana time series chart.

1:50–2:20 — Chronicle narrative. Scroll through the generated narrative in the Elastic Case. Highlight the Timeline section and the Confidence Breakdown. Say: "This is the post-mortem your engineer used to spend 30 minutes writing."

2:20–2:50 — Shadow Mode dashboard. Switch to the comparison view. Show 23 incidents, 19 correct predictions, 4 misses with explanations. Say: "Before you give it execution rights, it earns your trust. One toggle in the config."

2:50–3:00 — Close. "RunBook is the first on-call agent native to Elastic 9.4 Workflows. It builds institutional memory over time and earns your trust before it acts. Open source, Apache 2.0. $299/month for cloud-hosted. Your engineers finally sleep."

**Recording checklist:**
- Record at 1920×1080 minimum
- No tab switching during the demo — arrange all windows before you hit record
- Record the injection script firing and the ML anomaly appearing as a single uncut sequence — if you cut away, it looks staged
- Subtitle the video (auto-generate with YouTube's tool and fix errors) — some judges watch without audio
- Keep the video exactly under 3 minutes

---

### Day 27–28: GitHub Repository Polish

**What judges look at in the repository (in order):**

1. The license file in the About section (required for submission — verify this is set)
2. The README.md rendering in the browser
3. The repo description and topics tags
4. The `config/` directory structure — they want to see it is actually configurable
5. The `scripts/` directory — the setup and inject scripts signal whether this is real or a demo shell

**Required repository structure:**

```
runbook/
├── README.md                    ← project overview (the first README you wrote)
├── IMPLEMENTATION.md            ← this guide
├── LICENSE                      ← Apache 2.0 (must be at root)
├── config/
│   ├── config.example.yaml      ← template config with all required fields
│   └── index-mappings/          ← Elastic index mapping JSONs for all 5 indices
├── agent/
│   └── system-prompt.txt        ← the full agent system prompt
├── mcp-server/
│   └── README.md                ← how to run the MCP server locally
├── scripts/
│   ├── setup-indices.sh         ← creates all 5 Elastic indices
│   ├── ingest-runbooks.sh       ← ingests the sample runbooks
│   ├── inject-incident.sh       ← triggers the demo incident
│   └── verify-setup.sh          ← end-to-end health check
├── runbooks/                    ← the 5 sample runbook markdown files
├── workflows/
│   └── anomaly-trigger.yaml     ← the Elastic Workflows definition
└── dashboards/
    └── shadow-comparison.ndjson ← Kibana dashboard export for Shadow Mode
```

**Topics tags to add to the GitHub repo:** `elastic`, `elastic-search`, `mcp`, `google-cloud`, `gemini`, `aiops`, `sre`, `incident-management`, `elasticsearch`, `hackathon`

---

### Day 29: Devpost Submission Writing

**The Devpost description is not your README.** Judges read the Devpost description before they watch the video. It needs to be punchier and shorter than the README.

**Devpost description structure (500–800 words):**

Section 1 — Inspiration (2 sentences): The on-call problem in human terms. "Every SRE knows the 3am page for something a machine should have caught."

Section 2 — What it does (5 sentences): One sentence per major feature. Name Shadow Mode, Incident DNA, and Time-to-Innocent explicitly — these are the concepts judges will remember.

Section 3 — How we built it (be specific about Elastic 9.4 features): Name Elastic Workflows GA, Agent Builder Skills, NVIDIA cuVS vector search, ES|QL subqueries, and ML anomaly detection by name. The Elastic judges know what shipped in 9.4 — demonstrate that you do too.

Section 4 — Challenges: Be honest. The runbook ingestion pipeline chunking quality, getting Workflows to trigger reliably on ML anomaly alerts (the security-native origin meant some configuration was non-obvious), and tuning the confidence scoring weights are all real challenges worth mentioning.

Section 5 — Accomplishments: Time-to-Innocent as a new product concept. Shadow Mode as a trust primitive. The full loop running in under 45 seconds.

Section 6 — What's next: Confluence and Notion native connectors. Multi-cluster support. Fine-tuning on your own incident history. A Grafana plugin for screenshot analysis.

---

### Day 30–32: Buffer and Final Checks

Use this time for the things that always take longer than expected: Cloud Run cold start latency (add min-instances: 1 to avoid 10-second cold starts during the demo), Elastic API rate limits during burst (the blast radius scan plus DNA search plus runbook search all run in sequence — test this at demo speed), and the Devpost submission form (it has more required fields than expected, budget 45 minutes).

**Final submission checklist:**

- [ ] Hosted project URL returns a working page (not a 502)
- [ ] GitHub repo is public with Apache 2.0 license visible in the About section
- [ ] Demo video is under 3 minutes and hosted on YouTube or Vimeo
- [ ] Devpost description is complete with all six sections
- [ ] Elastic track is selected in the submission form
- [ ] Model version in README states Gemini 2.5 Pro via Vertex AI (confirmed compliant with official rules Section 7A)
- [ ] All 11 MCP tools are listed and functional
- [ ] Shadow Mode dashboard is accessible via the hosted URL
- [ ] inject-incident.sh script is in the repo and works from a clean clone

---

## What Can Go Wrong and How to Handle It

**Elastic Workflows does not fire on the ML anomaly alert.**
Most likely cause: the alert rule action type. Workflows listens for rule actions, not raw index events. Verify the alert rule has an action of type "Elastic Workflow" (not just a webhook) and the Workflow is assigned to that action. If Workflows continues to be unreliable, fall back to a Kibana Watcher that calls your MCP server directly — this is slightly less impressive but functionally equivalent for the demo.

**DNA similarity score is too low for the demo incident.**
The embedding of INC-0047's signature does not closely match the demo incident's signature. Fix: add more terms from the demo incident to INC-0047's signature text (the specific error message, the exact metric name, the service name). Re-embed and re-ingest. The goal is 91% — tune until you hit it consistently.

**Gemini calls tools out of order or skips steps.**
Revise the system prompt. The numbered step list must be explicit enough that the model cannot reorder steps. Add "You must follow these steps in order. Do not skip any step. Do not proceed to step N+1 until step N is complete." at the top of the procedure section.

**Cloud Run cold start causes the demo to stall.**
Set `min-instances: 1` on the Cloud Run service to keep one instance warm. This costs a few dollars per month — acceptable for the demo period.

**The ML job does not reach score > 75 on the demo incident.**
Either the baseline model needs more data (run it on 14 days instead of 7) or the anomaly injection needs to be more extreme. Try increasing the memory spike from 2.1GB to 3.5GB, or injecting the spike more suddenly (over 30 seconds instead of 4 minutes).

---

## The Honest Assessment

The four pieces most likely to cause problems, ranked by risk:

1. **Runbook ingestion quality** — If the semantic search returns irrelevant results, the whole intelligence layer breaks. Invest day 5–7 fully here.
2. **Elastic Workflows trigger reliability** — Workflows GA is new. Budget day 15–16 for debugging the trigger chain, not just configuration.
3. **Confidence score tuning** — Getting the demo incident to hit 89% confidence (high enough for auto-remediation) requires deliberate tuning of the five factor values. Do this explicitly, not by accident.
4. **Demo video recording** — The first five takes will not be good. Budget a full day for recording and editing.

Everything else — Cloud Run deployment, Gemini agent setup, Elastic index creation, Chronicle narrative generation — is well-documented and unlikely to surprise you.

---

*This guide covers architecture and execution decisions only. For the project overview and hackathon submission context, see README.md.*

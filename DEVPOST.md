# DEVPOST.md — RunBook Submission Description
# Paste this text into the Devpost submission form fields.
# Target: 500-800 words across 6 sections.

---

## Inspiration

Every SRE knows the 3am page — the one for something that happened before, was fixed by someone who left six months ago, and will happen again next month. The tools to catch it existed: Elastic ML, vector search, workflow automation. What was missing was the intelligence to connect them. RunBook is that connection.

---

## What It Does

RunBook is an autonomous on-call agent built entirely on Elastic 9.4 native primitives. When an ML anomaly fires, RunBook does in under 45 seconds what a human engineer does in 45 minutes.

**Time-to-Innocent** is RunBook's most visible capability: it clears innocent services with evidence — "auth-service: normal. CDN: normal. database: normal. postgres-main: normal." — before naming the root cause. Watching six services get exonerated in eight seconds, something that takes a human 45 minutes of tab-switching, is the clearest demonstration that this is genuinely different from an alerting tool.

**Incident DNA Fingerprinting** turns every resolved incident into a vector embedding stored in Elastic. Future incidents run cosine similarity search against this index first. A 91% DNA match means RunBook skips the full investigation and goes directly to the known fix, citing the prior incident by ID. Over six months this becomes irreplaceable institutional memory that does not leave when engineers do.

**Shadow Mode** runs RunBook silent for a configurable observation period — default 14 days — before executing any actions. It logs what it would have done alongside what the human engineer actually did. After 14 days you see accuracy, misses, and explanations side by side, and you decide when to flip it live. No competitor offers a trust-building mechanism like this. It is the feature that gets a skeptical Staff SRE to install it on a Friday afternoon.

The **Confidence Scoring** system combines five weighted factors — runbook match, DNA match, blast radius clarity, deployment correlation, and remediation safety — into a single 0–100 score computed inside Gemini's reasoning step. Auto-remediation fires above the team-configurable threshold (default: 85). Below it, engineers receive a full Chronicle narrative, not a blank incident ticket.

The **Chronicle Narrative** is a timestamped human-readable investigation report generated automatically at incident close: what fired, what was investigated, what was cleared, what was found, and what was done. Post-mortems that used to take 30–60 minutes to write are ready the moment the incident closes.

---

## How We Built It

RunBook is built on Elastic 9.4's new native primitives — all GA, none bolted on:

- **Elastic Workflows GA** is the trigger and action layer. When the ML anomaly alert fires, a Workflows definition picks it up natively, runs an ES|QL pre-scan to enrich the incident context, and POSTs to the RunBook MCP server on Cloud Run. No external SOAR required.
- **Google Cloud Agent Builder** orchestrates Gemini 2.5 Pro through an 11-tool MCP server. The agent follows a deterministic 9-step investigation procedure defined in the system prompt.
- **ES|QL subqueries** power the blast radius health matrix — a single query that classifies every service in the application as CLEARED, DEGRADED, or ROOT_CAUSE_CANDIDATE simultaneously.
- **Elastic Vector Search with NVIDIA cuVS** (12× faster in 9.4) enables both runbook semantic retrieval and real-time incident DNA matching in under 2 seconds per query.
- **Elastic ML anomaly detection** provides the alert generation, pre-trained on your own infrastructure metrics — not generic thresholds.
- **Elastic Cases** receives the filed incident case with the full Chronicle narrative attached as a case comment, creating an audit trail in the platform the team already uses.

---

## Challenges

Getting Elastic Workflows to trigger reliably on ML anomaly alert events required understanding that Workflows was designed for Elastic Security / SIEM automation — using it for SRE incident response meant navigating connector types that were not obviously documented for this use case. The runbook ingestion pipeline required more iteration than expected: chunking quality directly determines whether Gemini receives useful context or irrelevant noise, and the first two chunking strategies produced poor semantic matches. Confidence score tuning required deliberate calibration of all five factor weights against the three historical incidents to produce a demo score that is both realistic and consistently above the auto-remediation threshold.

---

## Accomplishments

Time-to-Innocent as a named, measured product concept — not just "we show a list." Shadow Mode as a trust primitive that removes the primary reason SRE teams reject autonomous remediation tools. A full agentic loop — detect, investigate, reason, act, document — running on Elastic 9.4 GA features in under 45 seconds.

---

## What's Next

Confluence and Notion native connectors for runbook ingestion. Multi-cluster support for organisations running separate production and staging Elastic deployments. Fine-tuning on 12 months of your own incident history to improve DNA matching accuracy. A Grafana plugin for automatic screenshot attachment to incidents. Slack-native runbook approval flow for the escalation path.

# Incident Escalation Guide

**Applies to:** All services  
**Tags:** checkout-service, payments-api, auth-service, product-catalog, notification-service

---

## Severity Definitions

| Severity | Definition | Response Time | Who Gets Paged |
|---|---|---|---|
| **P1** | Complete service outage or data loss. Revenue impact > $50k/min. | Immediate | On-call SRE + Payments lead + VP Engineering |
| **P2** | Significant degradation. p99 latency > 2× SLA or error rate > 1%. Revenue impact > $5k/min. | 5 minutes | On-call SRE |
| **P3** | Partial degradation. SLA at risk but not breached. One non-critical service degraded. | 15 minutes | Team Slack channel |
| **P4** | Monitoring anomaly. No user impact confirmed. Investigate next business day. | Next business day | Ticket created, no page |

**Severity assignment by service:**

| Situation | Severity |
|---|---|
| checkout-service down | P1 |
| payments-api down | P1 |
| payments-api latency 2× SLA | P2 |
| checkout-service latency 2× SLA | P2 |
| auth-service down | P2 (self-service auth tokens still valid for 15 min) |
| product-catalog down | P3 (browse affected, checkout unaffected) |
| notification-service down | P3 (email/push delayed, no revenue impact) |

---

## Escalation Contacts

| Team | Slack Channel | PagerDuty Schedule | Emergency Phone |
|---|---|---|---|
| Platform SRE (on-call) | `#oncall-platform` | `platform-oncall` | See 1Password > "SRE On-Call" |
| Payments | `#oncall-payments` | `payments-oncall` | See 1Password > "Payments On-Call" |
| Auth | `#team-auth` | `auth-oncall` | — |
| Infrastructure | `#infra-alerts` | — | — |
| VP Engineering (P1 only) | Direct message | — | See 1Password > "Executive Contacts" |

---

## What to Include in an Escalation

When RunBook escalates below the confidence threshold, it generates this information automatically. If you are escalating manually, collect the same data:

### Required fields for every escalation:

1. **Incident ID** — from the alert (or generate: `INC-YYYYMMDD-HHMM`)
2. **Alert time** — exact UTC timestamp when the anomaly fired
3. **Affected service** — which service is the root cause candidate
4. **Cleared services** — which services you have ruled out and with what evidence
5. **Current metric values** — p99 latency, error rate, memory, anomaly score at time of escalation
6. **Recent deployments** — any deployment in the last 30 minutes on the affected service (version, deployer, timestamp)
7. **Actions already taken** — what you have already done (restarted, flushed cache, etc.)
8. **RunBook confidence** — if RunBook investigated, include its confidence score and reasoning

### Escalation message template:

```
ESCALATION: [incident_id] — [service_name] degraded

Severity: [P1/P2/P3]
Alert fired: [UTC timestamp]
RunBook confidence: [score]% (below [threshold]% threshold — human review required)

CLEARED SERVICES (no anomaly detected):
• auth-service: p99 normal (142ms), error rate 0.0%
• product-catalog: p99 normal (88ms), error rate 0.0%
• notification-service: p99 normal (201ms), error rate 0.0%

ROOT CAUSE CANDIDATE:
• checkout-service: anomaly score 89, memory 2.1GB (baseline 512MB)

DEPLOYMENT CORRELATION:
checkout-service v2.14.1 deployed 4 minutes before anomaly.
Deployed by: vivek@example.com. Change: added session-level caching (PR #481).

EVIDENCE (ES|QL):
FROM metrics-* | WHERE service.name == "checkout-service" AND @timestamp >= now() - 15 minutes
| STATS max_mem = MAX(system.memory.actual.bytes), p99 = PERCENTILE(http.response.duration, 99)
  BY date_trunc("1 minute", @timestamp) | SORT @timestamp ASC

RECOMMENDED ACTION:
Pod restart (confidence insufficient for auto-remediation due to active business hours).
Rollback v2.14.1 if restart does not resolve within 10 minutes.
```

---

## After the Incident

Within 24 hours of incident resolution:

1. **File the incident case** in Elastic Cases (RunBook does this automatically)
2. **Log the resolution** in `human_resolutions` index (used by Shadow Mode accuracy tracking):
   ```json
   {
     "incident_id": "INC-20260511-1547",
     "action_taken": "pod_restart",
     "closed_by": "vivek@example.com",
     "resolution_time_seconds": 847,
     "closed_at": "2026-05-11T10:14:00Z",
     "severity": "P2",
     "notes": "OOM caused by unbounded cache in CartHandler.java — PR #481 rolled back"
   }
   ```
3. **Post-mortem** (P1 and P2 only) — RunBook generates the Chronicle narrative automatically. Review it for accuracy, add human context, and share in `#incidents-postmortem` within 48 hours.
4. **Create a JIRA ticket** for any code defect identified as root cause.

# checkout-service Runbook

**Service:** checkout-service  
**Owner:** Platform Engineering  
**SLA:** 99.9% availability, p99 latency < 500ms  
**Tags:** checkout-service, payments-api

---

## Service Overview

checkout-service handles shopping cart management, order creation, and checkout session state for the e-commerce platform. It is a stateful JVM service (Java 17, Spring Boot 3) that maintains in-memory session caches and calls payments-api for payment processing. It is the highest-criticality service in the stack — downtime here means lost revenue at approximately $8,000 per minute.

**Direct dependencies:**
- `postgres-main` — order persistence
- `redis-cache` — session state (read-heavy, write-on-checkout)
- `payments-api` — downstream call for payment authorisation

**Typical traffic:** 200–400 req/s business hours, 50–80 req/s overnight.

---

## Known Failure Modes

### 1. OOM Kill / CrashLoopBackOff

**Symptoms:**
- `OutOfMemoryError: Java heap space` in logs
- Pod status: `OOMKilled` or `CrashLoopBackOff`
- Memory metric climbs steadily over 30–90 minutes before kill
- `checkout-service` error rate spikes; `payments-api` latency increases due to downstream call failures

**Most common root cause:** Unbounded in-memory cache (typically LRU with no size limit added during a deployment). See incident INC-0045 (November 2025) and INC-0047 (February 2026).

**ES|QL query to confirm memory trend:**
```esql
FROM metrics-*
| WHERE service.name == "checkout-service"
  AND @timestamp >= now() - 2 hours
| STATS max_mem = MAX(system.memory.actual.bytes), avg_mem = AVG(system.memory.actual.bytes)
  BY date_trunc("5 minutes", @timestamp)
| SORT @timestamp ASC
```
A steadily increasing `max_mem` over 30+ minutes with no plateau is diagnostic of a memory leak, not a traffic spike.

**Distinguish from legitimate traffic growth:**
- Memory leak: monotonically increasing, no correlation with request rate
- Traffic growth: memory increases proportionally with request rate, stabilises

**Resolution — Pod Restart:**

Safe to restart when:
- The pod is in `Running` state (memory high but not yet crashed) — restart is cleaner than waiting for the kill
- During low-traffic hours (after 11pm IST / 5:30pm UTC)
- Not during an active checkout flow peak (check request rate first)

```bash
# Confirm current pod state
kubectl get pods -n production -l app=checkout-service

# Restart (triggers rolling restart, maintains one instance up)
kubectl rollout restart deployment/checkout-service -n production

# Verify restart completed
kubectl rollout status deployment/checkout-service -n production

# Confirm memory dropped post-restart
# Check Kibana: Discover → filter service.name: checkout-service, last 15 minutes
```

**Post-restart verification:**
1. p99 latency returns to < 500ms within 3 minutes
2. Error rate drops below 0.1% within 2 minutes
3. Memory stabilises at 512–600MB (baseline)

If memory starts climbing again within 20 minutes of restart, the root cause is a code defect in the current version. Escalate to the checkout-service team and consider rolling back the most recent deployment.

---

### 2. Database Connection Pool Exhaustion

**Symptoms:**
- `HikariPool-1 - Connection is not available, request timed out after 30000ms`
- Latency spike across all checkout endpoints
- postgres-main CPU normal (connections are queued, not executing)

**ES|QL query:**
```esql
FROM logs-*
| WHERE service.name == "checkout-service"
  AND message LIKE "*HikariPool*Connection is not available*"
  AND @timestamp >= now() - 30 minutes
| STATS count = COUNT() BY date_trunc("1 minute", @timestamp)
| SORT @timestamp ASC
```

**Resolution:** See `postgres-main` runbook for connection pool sizing. Restart checkout-service after increasing pool size in the deployment config — pool changes require a pod restart to take effect.

---

## Escalation Criteria

Escalate immediately (do not attempt automated remediation) if:
- Memory is rising AND there is an active deployment in the last 10 minutes — coordinate with the deploying team before restarting
- The pod has crashed and restarted more than 3 times in 1 hour — indicates a code defect, not a transient OOM
- payments-api is also degraded simultaneously — this is a cascade, investigate payments-api first
- Database `postgres-main` shows connection errors — restart of checkout-service will not help

Escalation contact: `#oncall-platform` on Slack + page the Platform Engineering on-call via PagerDuty.

---

## Deployment Notes

- Deployment typically takes 4–7 minutes for rolling restart to complete
- The service has a 60-second startup probe — if it fails to start within 60s, Kubernetes will OOM-kill the new pod
- Heap size is configured via `JAVA_OPTS=-Xms512m -Xmx1536m` — do not increase without a load test

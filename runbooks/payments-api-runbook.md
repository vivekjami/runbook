# payments-api Runbook

**Service:** payments-api  
**Owner:** Payments Team  
**SLA:** 99.95% availability, p99 latency < 800ms, zero data loss  
**Tags:** payments-api, checkout-service

---

## Service Overview

payments-api is the payment processing gateway — it handles authorisation, capture, refund, and void operations. It is a Node.js (Express) service that calls external payment processors (Stripe primary, Adyen fallback). It is called exclusively by `checkout-service` and must never be restarted without confirming no transactions are in-flight.

**DO NOT restart payments-api without confirming:**
1. No transactions are currently in `PENDING_CAPTURE` state
2. The database write-ahead log has been flushed (postgres-main shows no open transactions from payments-api)

Incorrect restarts during active transactions can result in double-charges or lost payment confirmations.

**Direct dependencies:**
- `postgres-main` — transaction records (write-heavy)
- External: Stripe API (primary), Adyen API (fallback)
- Called by: `checkout-service`

---

## Known Failure Modes

### 1. Latency Spike — External Payment Processor Degradation

**Symptoms:**
- payments-api p99 latency > 800ms
- checkout-service error rate spikes (timeout on downstream call)
- payments-api internal error rate is LOW (it is not the problem)

**Diagnosis:**
```esql
FROM logs-*
| WHERE service.name == "payments-api"
  AND @timestamp >= now() - 15 minutes
| STATS
    stripe_avg_ms  = AVG(http.upstream.duration) WHERE http.upstream.host == "api.stripe.com",
    adyen_avg_ms   = AVG(http.upstream.duration) WHERE http.upstream.host == "*.adyen.com",
    internal_p99   = PERCENTILE(http.response.duration, 99)
  BY date_trunc("1 minute", @timestamp)
| SORT @timestamp DESC
| LIMIT 10
```

If `stripe_avg_ms > 600ms`, check https://status.stripe.com. This is not a RunBook-resolvable incident — escalate to the Payments team with evidence from the above query.

### 2. Database Connection Exhaustion

**Symptoms:**
- `PG Connection pool exhausted` in logs
- `pg.pool.waitingCount > 10` in metrics
- p99 latency spikes, requests start queuing

**ES|QL:**
```esql
FROM logs-*
| WHERE service.name == "payments-api"
  AND message LIKE "*pool exhausted*" OR message LIKE "*waitingCount*"
  AND @timestamp >= now() - 30 minutes
| STATS count = COUNT() BY date_trunc("1 minute", @timestamp)
```

**Resolution:** Increase connection pool size in env config (`PG_POOL_MAX` — default 10, increase to 20). Requires a coordinated restart — confirm no in-flight transactions first.

### 3. Memory Leak (uncommon, but has occurred)

payments-api is Node.js — heap leaks typically manifest as increasing V8 heap size over 24+ hours, not the sharp spikes seen in JVM services.

---

## SLAs and Escalation

| Metric | Warning | Critical | Action |
|---|---|---|---|
| p99 latency | > 600ms | > 800ms | Investigate upstream (Stripe/Adyen status) |
| Error rate | > 0.01% | > 0.1% | Escalate to Payments team immediately |
| Availability | < 99.99% | < 99.95% | P1 incident — CEO notification required |

**Escalation contacts:**
- Payments on-call: `#oncall-payments` on Slack
- P1 incidents: page `payments-oncall` in PagerDuty
- External processor incident: contact Stripe support at https://support.stripe.com (include your account ID)

---

## Safe Restart Procedure (only when authorised by Payments team lead)

```bash
# Step 1: Confirm no pending transactions
kubectl exec -n production deploy/payments-api -- \
  node -e "require('./src/db').query(\"SELECT COUNT(*) FROM transactions WHERE status = 'PENDING_CAPTURE'\").then(r => console.log(r.rows))"

# Step 2: If count is 0, proceed with restart
kubectl rollout restart deployment/payments-api -n production

# Step 3: Monitor startup
kubectl rollout status deployment/payments-api -n production

# Step 4: Confirm first transactions processing correctly after restart
kubectl logs -n production -l app=payments-api --tail=50 -f
```

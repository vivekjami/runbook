# Pod Restart Protocol

**Applies to:** checkout-service, auth-service, product-catalog, notification-service  
**Does NOT apply to:** payments-api (see payments-api-runbook.md — separate safety checks required)  
**Tags:** checkout-service, payments-api, auth-service, product-catalog, notification-service

---

## When Pod Restart Is Safe

Pod restart is the fastest, safest remediation for a large class of incidents: OOM kill, CrashLoopBackOff from a transient configuration error, or state corruption from a bad deployment. It is safe when:

- ✅ The service is stateless (or state is held in redis-cache, not in-process)
- ✅ The restart will be rolling (Kubernetes default — one new pod starts before old one terminates)
- ✅ A pod restart has not been attempted more than 2 times in the last hour (repeated restarts = code defect, not transient issue)
- ✅ No dependent service is currently writing to this service's database

## When Pod Restart Is Risky

- ⚠️ **During a deployment** — if a rollout is in progress, restarting manually will conflict with the rollout controller
- ⚠️ **payments-api with in-flight transactions** — see payments-api-runbook.md
- ⚠️ **CrashLoopBackOff with increasing back-off time** — if the pod is already in exponential back-off, a manual restart resets the counter but the underlying issue persists
- ⚠️ **Database schema migration in progress** — a restart at the wrong moment can interrupt a migration and leave the schema in a partial state

---

## Standard Restart Procedure

```bash
# 1. Check current pod state
kubectl get pods -n production -l app=<service-name>

# Expected healthy state:
# NAME                              READY   STATUS    RESTARTS   AGE
# checkout-service-7d8f9b-x2kp9    1/1     Running   0          3h

# 2. Check recent restart count (column RESTARTS)
# If RESTARTS > 2 in the last hour: do not restart, escalate.

# 3. Execute rolling restart
kubectl rollout restart deployment/<service-name> -n production

# 4. Monitor the rollout
kubectl rollout status deployment/<service-name> -n production --timeout=120s

# 5. Confirm new pod is healthy
kubectl get pods -n production -l app=<service-name>
# RESTARTS should be 0 for the new pod

# 6. Tail logs to confirm no immediate errors
kubectl logs -n production -l app=<service-name> --tail=100 -f
```

---

## Post-Restart Verification (in Kibana)

After the restart completes, verify recovery using these ES|QL queries:

**Latency recovery:**
```esql
FROM metrics-*
| WHERE service.name == "<service-name>"
  AND @timestamp >= now() - 10 minutes
| STATS p99 = PERCENTILE(http.response.duration, 99) BY date_trunc("1 minute", @timestamp)
| SORT @timestamp ASC
```
Expect p99 to drop to baseline within 3 minutes of the new pod becoming Ready.

**Error rate recovery:**
```esql
FROM metrics-*
| WHERE service.name == "<service-name>"
  AND @timestamp >= now() - 10 minutes
| STATS error_rate = COUNT_IF(event.outcome == "failure") / COUNT(*)
  BY date_trunc("1 minute", @timestamp)
| SORT @timestamp ASC
```
Expect error rate < 0.1% within 2 minutes.

**Memory at startup:**
```esql
FROM metrics-*
| WHERE service.name == "<service-name>"
  AND @timestamp >= now() - 5 minutes
| STATS mem_gb = MAX(system.memory.actual.bytes) / 1073741824
  BY date_trunc("1 minute", @timestamp)
| SORT @timestamp ASC
```
Memory should start at baseline (< 0.6GB for checkout-service) and remain stable. If it starts climbing within 5 minutes, the leak is in the current version — escalate.

---

## Escalate Instead of Restarting If

1. The same pod has crashed more than 3 times in 1 hour — this is a code defect
2. The crash log shows a panic or assertion failure (not OOM) — the binary itself may be corrupted
3. The crash is happening during startup (before the pod reaches Ready) — the new version has a startup bug and rolling restart will fail silently
4. Memory is rising but the pod has not yet crashed — you have time to investigate the deployment diff before acting

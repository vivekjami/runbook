# Memory Leak Investigation Guide

**Applies to:** checkout-service, payments-api, auth-service (all JVM services)  
**Tags:** checkout-service, payments-api, auth-service

---

## How to Tell a Memory Leak from Legitimate Traffic Growth

This is the most common misdiagnosis in memory-related incidents. Getting it wrong leads to either unnecessary pod restarts (for traffic growth) or delayed response to a real leak.

| Signal | Memory Leak | Traffic Growth |
|---|---|---|
| Memory trend | Monotonically increasing, no plateau | Increases proportionally with request rate, plateaus |
| Correlation with request rate | Low — memory grows even during quiet periods | High — memory tracks req/s closely |
| Time to OOM | 30–120 minutes from deployment | Rarely OOM unless traffic 3× baseline |
| Error in logs | `OutOfMemoryError` preceded by GC pressure | None — service handles load cleanly |
| ES|QL signal | Memory/request-rate ratio increases over time | Memory/request-rate ratio stable |

**ES|QL query to compute memory-per-request ratio over time:**
```esql
FROM metrics-*
| WHERE service.name == "checkout-service"
  AND @timestamp >= now() - 2 hours
| STATS
    mem_bytes   = MAX(system.memory.actual.bytes),
    req_rate    = COUNT() / 300
  BY date_trunc("5 minutes", @timestamp)
| EVAL mem_per_req = mem_bytes / req_rate
| SORT @timestamp ASC
```

A rising `mem_per_req` confirms a leak. A flat `mem_per_req` with rising absolute memory confirms traffic growth.

---

## Common Causes of JVM Memory Leaks in This Stack

### 1. Unbounded Cache (Most Common)

Pattern: A developer adds an in-memory cache with no size limit (`new HashMap()` or `ConcurrentHashMap` used as a cache, or `Caffeine.newBuilder()` with no `maximumSize()`).

**Evidence:** Memory grows steadily after a specific deployment. The deployment diff shows a new cache being added.

**Fix:** Add `maximumSize(N)` to Caffeine caches, or bound the HashMap with a `LinkedHashMap` with `removeEldestEntry`. Requires a new deployment. In the meantime, restart the pod to buy time.

**Marker in logs before OOM:**
```
WARN  o.s.b.a.cache.CacheStatisticsAutoConfiguration - Cache 'sessionCache' size: 1,847,293 entries
```

### 2. ThreadLocal Leaks

Pattern: `ThreadLocal` variables are set in request handlers but never removed. In a thread pool, threads are reused — each thread accumulates state.

**Evidence:** Heap dump shows thousands of `ThreadLocalMap$Entry` objects. Usually introduced when a service migrates from a blocking to non-blocking thread model.

**Fix:** Ensure `ThreadLocal.remove()` is called in a `finally` block or request interceptor. Requires a new deployment.

### 3. Connection or Session Object Accumulation

Pattern: HTTP clients, database connections, or WebSocket sessions are created per-request but not closed.

**Evidence:** Rising `CLOSE_WAIT` socket count on the pod (`kubectl exec -it <pod> -- ss -s`), or rising HikariCP active connection count.

**Fix:** Ensure all client objects are created with try-with-resources or explicitly closed. A pod restart clears the connections but the leak will recur.

---

## ES|QL Queries for Memory Trend Analysis

**GC pressure indicators (high GC time = heap near full):**
```esql
FROM logs-*
| WHERE service.name == "checkout-service"
  AND message LIKE "*GC*pause*"
  AND @timestamp >= now() - 1 hour
| STATS gc_events = COUNT(), avg_pause_ms = AVG(gc.pause_duration_ms)
  BY date_trunc("5 minutes", @timestamp)
| SORT @timestamp ASC
```

**Memory headroom — how much time before OOM:**
```esql
FROM metrics-*
| WHERE service.name == "checkout-service"
  AND @timestamp >= now() - 30 minutes
| STATS current_mem = MAX(system.memory.actual.bytes) BY date_trunc("1 minute", @timestamp)
| EVAL headroom_gb = (1.536 - current_mem / 1073741824)
| SORT @timestamp DESC
| LIMIT 5
```
If `headroom_gb < 0.3`, the pod will OOM within 10–20 minutes. Restart now.

**Find the deployment that introduced the leak:**
```esql
FROM apm-*
| WHERE service.name == "checkout-service"
  AND processor.event == "transaction"
  AND transaction.type == "deployment"
  AND @timestamp >= now() - 2 hours
| SORT @timestamp DESC
| LIMIT 5
| KEEP @timestamp, service.version, labels.deployed_by, labels.change_summary
```

---

## Decision Tree

```
Memory rising on checkout-service?
│
├─ Rising for < 20 minutes after a deployment?
│   └─ Check deployment diff for new caches → likely leak → restart + notify team
│
├─ Rising for > 60 minutes with no recent deployment?
│   └─ Check traffic rate correlation
│       ├─ High correlation → traffic growth → no restart needed, scale if needed
│       └─ Low correlation → long-running leak → restart + create incident for root cause
│
└─ Pod already OOMKilled?
    └─ Restart immediately → check if it was in CrashLoopBackOff → escalate if so
```

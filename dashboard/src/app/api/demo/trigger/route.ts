import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Realistic demo incidents for hackathon demonstration
const DEMO_INCIDENTS = [
  {
    id: `INC-DEMO-${Math.floor(Math.random() * 9000) + 1000}`,
    service_name: "payment-service",
    severity: "P1",
    action_taken: "AUTO_REMEDIATED",
    confidence_score: 91,
    anomaly_score: 94,
    narrative: `[14:32:07] INVESTIGATION STARTED — payment-service P99 latency spike (8.2s)

BLAST RADIUS ANALYSIS (8 services checked):
  ✓ checkout-api    CLEARED   p99=120ms  (normal baseline: 115ms)
  ✓ user-service    CLEARED   p99=88ms   (normal baseline: 90ms)
  ✓ auth-service    CLEARED   p99=45ms   (normal baseline: 47ms)
  ✓ notification    CLEARED   p99=32ms   (normal baseline: 35ms)
  ✓ inventory-svc   CLEARED   p99=155ms  (normal baseline: 160ms)
  ✓ search-api      CLEARED   p99=210ms  (normal baseline: 205ms)
  ✓ cdn-edge        CLEARED   p99=18ms   (normal baseline: 20ms)
  ⚠ payment-service SUSPECT  p99=8200ms  anomaly_score=94

DEPLOYMENT CORRELATION:
  ✗ Deploy detected at 14:32 UTC (3 min before spike)
    → Config change: db_pool_size reduced 100 → 20
    → Deployer: infra-bot v2.1.4 (automated canary)

DNA MATCH:
  🧬 INC-2024-891 matched at 97.3% cosine similarity
    → Root cause: db_pool_exhaustion under Black Friday load
    → Resolution: scale db_pool_size=100, restart payment-pod-7d9f2
    → Human MTTR for that incident: 38 minutes

REMEDIATION EXECUTED:
  → kubectl set env deployment/payment-service DB_POOL_SIZE=100
  → kubectl rollout restart deployment/payment-service -n production
  → Pod restarted. p99 returned to 112ms within 45 seconds.

CONFIDENCE FACTORS:
  • Deployment correlation: 97.3% (weight 40%) → score 38.9
  • DNA fingerprint match: 97.3% (weight 30%) → score 29.2
  • Blast radius isolation: 100% (weight 20%) → score 20.0
  • ML anomaly record: 94.0 (weight 10%) → score 9.4
  TOTAL: 97.5% → AUTO_REMEDIATED ✓

Chronicle filed. Incident closed in 47 seconds.`,
    esql_query: `FROM metrics-*
| WHERE @timestamp > NOW() - 15 MINUTES
| WHERE service.name == "payment-service"
| STATS p99 = PERCENTILE(transaction.duration.us, 99),
        error_rate = AVG(error.rate),
        throughput = COUNT(*)
    BY service.name, @timestamp = DATE_TRUNC(1m, @timestamp)
| WHERE p99 > 2000000
| SORT @timestamp DESC`,
    confidence_factors: [
      { label: "Deployment Correlation", score: 97.3, weight: 40 },
      { label: "DNA Fingerprint Match", score: 97.3, weight: 30 },
      { label: "Blast Radius Isolation", score: 100, weight: 20 },
      { label: "ML Anomaly Score", score: 94, weight: 10 },
    ],
    dna_match_id: "INC-2024-891",
    dna_similarity: 97,
    mttr_seconds: 47,
    human_mttr_minutes: 38,
  },
  {
    id: `INC-DEMO-${Math.floor(Math.random() * 9000) + 1000}`,
    service_name: "recommendation-engine",
    severity: "P2",
    action_taken: "SHADOW_LOGGED",
    confidence_score: 72,
    anomaly_score: 78,
    narrative: `[09:15:44] INVESTIGATION STARTED — recommendation-engine OOM errors

BLAST RADIUS ANALYSIS (6 services checked):
  ✓ api-gateway     CLEARED   error_rate=0.02%
  ✓ user-service    CLEARED   error_rate=0.01%
  ✓ catalog-service CLEARED   error_rate=0.00%
  ✓ session-store   CLEARED   error_rate=0.00%
  ✓ cdn-edge        CLEARED   error_rate=0.00%
  ⚠ recommendation  SUSPECT   OOM kills=14/hr  anomaly_score=78

DEPLOYMENT CORRELATION:
  No recent deployments detected in lookback window.

DNA MATCH:
  🧬 INC-2025-112 matched at 68.1% cosine similarity
    → Root cause: memory leak in model inference cache
    → Resolution: flush redis cache + scale pod to 4Gi memory
    → Note: low similarity — requires human verification

SHADOW MODE ACTION (not executed):
  → Would execute: kubectl rollout restart deployment/recommendation-engine
  → Would execute: redis-cli -h rec-redis FLUSHDB
  
CONFIDENCE: 72% — BELOW threshold (85%). Escalating to on-call.

Chronicle filed. Human engineer notified.`,
    esql_query: `FROM metrics-*
| WHERE @timestamp > NOW() - 30 MINUTES
| WHERE service.name == "recommendation-engine"
| STATS oom_count = SUM(kubernetes.pod.memory.oom_kill),
        memory_pct = AVG(kubernetes.node.memory.usage.pct)
    BY service.name, @timestamp = DATE_TRUNC(5m, @timestamp)
| SORT @timestamp DESC`,
    confidence_factors: [
      { label: "DNA Fingerprint Match", score: 68.1, weight: 40 },
      { label: "Blast Radius Isolation", score: 100, weight: 25 },
      { label: "ML Anomaly Score", score: 78, weight: 25 },
      { label: "Deployment Correlation", score: 10, weight: 10 },
    ],
    dna_match_id: "INC-2025-112",
    dna_similarity: 68,
    mttr_seconds: null,
    human_mttr_minutes: 25,
  },
  {
    id: `INC-DEMO-${Math.floor(Math.random() * 9000) + 1000}`,
    service_name: "checkout-api",
    severity: "P1",
    action_taken: "ESCALATED",
    confidence_score: 55,
    anomaly_score: 89,
    narrative: `[23:41:12] INVESTIGATION STARTED — checkout-api 5xx error surge (22% error rate)

BLAST RADIUS ANALYSIS (9 services checked):
  ✓ user-service    CLEARED   error_rate=0.1%
  ✓ auth-service    CLEARED   error_rate=0.0%
  ⚠ payment-service DEGRADED  error_rate=8.3%  downstream dependency
  ⚠ fraud-detection DEGRADED  error_rate=4.1%  downstream dependency
  ⚠ checkout-api    SUSPECT   error_rate=22.1%  anomaly_score=89

DEPLOYMENT CORRELATION:
  No deployments in last 2 hours.

DNA MATCH:
  🧬 Best match: INC-2024-445 at 52.8% similarity
    → Insufficient confidence for auto-remediation.

MULTI-SERVICE DEGRADATION DETECTED:
  → checkout-api, payment-service, fraud-detection all degraded simultaneously
  → Pattern suggests external dependency failure (PSP timeout?) or network partition
  → This is novel — no strong DNA match. Human investigation required.

CONFIDENCE: 55% — BELOW threshold. Escalating to @on-call-platform.

Pre-written brief:
  - Blast radius: 3 services degraded
  - Strongest suspect: external PSP connectivity
  - Suggested first action: check Stripe/Adyen status page
  - ES|QL query attached for deeper drill-down

Chronicle filed.`,
    esql_query: `FROM metrics-*
| WHERE @timestamp > NOW() - 20 MINUTES  
| WHERE service.name IN ("checkout-api", "payment-service", "fraud-detection")
| STATS error_rate = AVG(error.rate), p99 = PERCENTILE(transaction.duration.us, 99)
    BY service.name
| SORT error_rate DESC`,
    confidence_factors: [
      { label: "DNA Fingerprint Match", score: 52.8, weight: 40 },
      { label: "Blast Radius Isolation", score: 33, weight: 25 },
      { label: "ML Anomaly Score", score: 89, weight: 25 },
      { label: "Deployment Correlation", score: 5, weight: 10 },
    ],
    dna_match_id: null,
    dna_similarity: null,
    mttr_seconds: null,
    human_mttr_minutes: 55,
  },
];

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pick a random demo incident template and give it a fresh unique ID + timestamp
    const template = DEMO_INCIDENTS[Math.floor(Math.random() * DEMO_INCIDENTS.length)];
    const incident = {
      ...template,
      id: `INC-DEMO-${Date.now().toString().slice(-6)}`,
      workspace_id: user.id,
      created_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("incidents").insert(incident as any);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, incident_id: incident.id, action: incident.action_taken });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

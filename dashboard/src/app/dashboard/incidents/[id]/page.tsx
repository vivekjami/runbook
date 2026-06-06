import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Terminal, Activity, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { timeAgo, confidenceHex } from "@/lib/utils";

// Parse the narrative text into investigation timeline steps
function parseTimeline(narrative: string | null): { time: string; label: string; type: "ok" | "warn" | "error" | "info" }[] {
  if (!narrative) return [];
  const lines = narrative.split("\n");
  const steps: { time: string; label: string; type: "ok" | "warn" | "error" | "info" }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("✓")) steps.push({ time: "", label: trimmed, type: "ok" });
    else if (trimmed.startsWith("⚠")) steps.push({ time: "", label: trimmed, type: "warn" });
    else if (trimmed.startsWith("✗")) steps.push({ time: "", label: trimmed, type: "error" });
    else if (trimmed.startsWith("→") || trimmed.startsWith("🧬") || trimmed.startsWith("→")) steps.push({ time: "", label: trimmed, type: "info" });
  }
  return steps.slice(0, 8);
}

const STEP_COLORS = {
  ok: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)", text: "var(--accent-emerald)" },
  warn: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", text: "var(--accent-amber)" },
  error: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", text: "var(--accent-red)" },
  info: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)", text: "var(--accent-blue)" },
};

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .single();

  if (!incident) notFound();

  const factors: { label: string; score: number; weight: number }[] = incident.confidence_factors ?? [];
  const timelineSteps = parseTimeline(incident.narrative);
  const mttrSaved = incident.human_mttr_minutes && incident.mttr_seconds
    ? Math.round(incident.human_mttr_minutes - incident.mttr_seconds / 60)
    : null;

  return (
    <div>
      {/* Back + breadcrumb */}
      <Link
        href="/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", marginBottom: "24px", transition: "color 0.15s" }}
      >
        <ArrowLeft size={14} /> Back to feed
      </Link>

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-mono)" }}>{incident.id}</h1>
          <span className={`badge ${
            incident.action_taken === "AUTO_REMEDIATED" ? "badge-remediated"
            : incident.action_taken === "ESCALATED" ? "badge-escalated"
            : "badge-shadow"
          }`}>
            {incident.action_taken?.replace(/_/g, " ")}
          </span>
          <span className={`badge ${
            incident.severity === "P1" ? "badge-root-cause" : incident.severity === "P2" ? "badge-degraded" : "badge-shadow"
          }`}>
            {incident.severity}
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{timeAgo(incident.created_at)}</span>
        </div>

        {/* MTTR comparison */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {incident.mttr_seconds && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                Agent MTTR
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--accent-emerald)", letterSpacing: "-0.02em" }}>
                {incident.mttr_seconds}s
              </div>
            </div>
          )}
          {incident.mttr_seconds && incident.human_mttr_minutes && (
            <div style={{ width: "1px", height: "36px", background: "var(--border)" }} />
          )}
          {incident.human_mttr_minutes && (
            <div>
              <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                Human Benchmark
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-muted)", textDecoration: "line-through" }}>
                {incident.human_mttr_minutes}m
              </div>
            </div>
          )}
          {mttrSaved !== null && mttrSaved > 0 && (
            <>
              <div style={{ width: "1px", height: "36px", background: "var(--border)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  Saved
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--accent-blue)" }}>
                  ~{mttrSaved}m
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Investigation Timeline */}
          {timelineSteps.length > 0 && (
            <div className="glass-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
                <Zap size={15} style={{ color: "var(--accent-amber)" }} />
                Investigation Timeline
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {timelineSteps.map((step, i) => {
                  const c = STEP_COLORS[step.type];
                  return (
                    <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: c.bg,
                        border: `1px solid ${c.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}>
                        {step.type === "ok" && <CheckCircle2 size={11} style={{ color: c.text }} />}
                        {step.type === "warn" && <Activity size={11} style={{ color: c.text }} />}
                        {step.type === "error" && <XCircle size={11} style={{ color: c.text }} />}
                        {step.type === "info" && <Clock size={11} style={{ color: c.text }} />}
                      </div>
                      <div style={{ fontSize: "12.5px", color: step.type === "ok" ? "var(--accent-emerald)" : step.type === "warn" ? "var(--accent-amber)" : step.type === "error" ? "var(--accent-red)" : "var(--text-secondary)", fontFamily: "var(--font-mono)", lineHeight: 1.5, paddingTop: "3px" }}>
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chronicle Narrative */}
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
              <ShieldCheck size={15} style={{ color: "var(--accent-blue)" }} />
              Chronicle Narrative
            </div>
            <div style={{ padding: "24px", background: "#060a12", overflowX: "auto" }}>
              <pre style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
                color: "#94a3b8",
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {incident.narrative ?? "No narrative available for this incident."}
              </pre>
            </div>
          </div>

          {/* ES|QL query */}
          {incident.esql_query && (
            <div className="glass-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
                  <Terminal size={15} style={{ color: "var(--accent-cyan)" }} />
                  ES|QL Blast-Radius Query
                </div>
              </div>
              <div style={{ padding: "20px 24px", background: "#060a12" }}>
                <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "12.5px", color: "var(--accent-cyan)", lineHeight: 1.65 }}>
                  {incident.esql_query}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "24px" }}>
          {/* Confidence score */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
              Confidence Score
            </div>
            <div style={{ fontSize: "56px", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "6px", lineHeight: 1, color: confidenceHex(incident.confidence_score) }}>
              {incident.confidence_score}
              <span style={{ fontSize: "24px", fontWeight: 600 }}>%</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
              {incident.confidence_score >= 85
                ? "Above threshold → auto-remediated"
                : incident.confidence_score >= 60
                ? "Below threshold → escalated to human"
                : "Low confidence → human required"}
            </div>

            {factors.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {factors.map((f) => (
                  <div key={f.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", marginBottom: "5px", color: "var(--text-secondary)" }}>
                      <span>{f.label} <span style={{ color: "var(--text-muted)" }}>({f.weight}%)</span></span>
                      <span style={{ fontWeight: 700, color: confidenceHex(f.score) }}>{f.score.toFixed(1)}</span>
                    </div>
                    <div style={{ width: "100%", height: "5px", background: "var(--bg-secondary)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(f.score, 100)}%`, height: "100%", background: confidenceHex(f.score), borderRadius: "3px", transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service info */}
          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>
              Service Details
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Service", value: incident.service_name },
                { label: "Severity", value: incident.severity },
                { label: "Anomaly Score", value: incident.anomaly_score?.toString() ?? "—" },
                { label: "Investigated", value: timeAgo(incident.created_at) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: "12px" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* DNA match */}
          {incident.dna_match_id && (
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", fontWeight: 600, fontSize: "13.5px" }}>
                <Activity size={15} style={{ color: "var(--accent-emerald)" }} />
                DNA Match
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Matched Incident</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-blue)", fontWeight: 600, fontSize: "12px" }}>
                    {incident.dna_match_id}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Cosine Similarity</span>
                  <span style={{ fontWeight: 700, color: "var(--accent-emerald)" }}>{incident.dna_similarity}%</span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", overflow: "hidden", marginTop: "4px" }}>
                  <div style={{ width: `${incident.dna_similarity ?? 0}%`, height: "100%", background: "var(--accent-emerald)", borderRadius: "2px" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

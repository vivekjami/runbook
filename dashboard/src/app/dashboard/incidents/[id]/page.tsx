import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Terminal, Activity } from "lucide-react";
import { timeAgo, confidenceHex } from "@/lib/utils";

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

  const factors: { label: string; score: number; weight: number }[] =
    incident.confidence_factors ?? [];

  return (
    <div>
      <Link
        href="/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", marginBottom: "20px" }}
      >
        <ArrowLeft size={14} /> Back to feed
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 700 }}>{incident.id}</h1>
          <span className={`badge ${incident.action_taken === "AUTO_REMEDIATED" ? "badge-remediated" : incident.action_taken === "ESCALATED" ? "badge-escalated" : "badge-shadow"}`}>
            {incident.action_taken?.replace(/_/g, " ")}
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{timeAgo(incident.created_at)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agent MTTR</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-emerald)" }}>
              {incident.mttr_seconds ? `${incident.mttr_seconds}s` : "—"}
            </div>
          </div>
          <div style={{ width: "1px", height: "32px", background: "var(--border)" }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Human Benchmark</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-muted)", textDecoration: "line-through" }}>
              {incident.human_mttr_minutes ? `${incident.human_mttr_minutes}m` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left: narrative + ES|QL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
              <ShieldCheck size={16} style={{ color: "var(--accent-blue)" }} /> Chronicle Narrative
            </div>
            <div style={{ padding: "24px", background: "#070b14", overflowX: "auto" }}>
              <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "12.5px", color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {incident.narrative ?? "No narrative available for this incident."}
              </pre>
            </div>
          </div>

          {incident.esql_query && (
            <div className="glass-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
                <Terminal size={16} style={{ color: "var(--accent-cyan)" }} /> ES|QL Blast-Radius Query
              </div>
              <div style={{ padding: "20px 24px", background: "#070b14" }}>
                <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "12.5px", color: "var(--accent-cyan)", lineHeight: 1.6 }}>
                  {incident.esql_query}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right: confidence + DNA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "24px" }}>
          <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
              Confidence Score
            </div>
            <div style={{ fontSize: "52px", fontWeight: 800, marginBottom: "24px", lineHeight: 1, color: confidenceHex(incident.confidence_score) }}>
              {incident.confidence_score}
            </div>
            {factors.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {factors.map((f) => (
                  <div key={f.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px", color: "var(--text-secondary)" }}>
                      <span>{f.label} ({f.weight}%)</span>
                      <span style={{ fontWeight: 600 }}>{f.score.toFixed(1)}</span>
                    </div>
                    <div style={{ width: "100%", height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ width: `${f.score}%`, height: "100%", background: confidenceHex(f.score) }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {incident.dna_match_id && (
            <div className="glass-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontWeight: 600, fontSize: "14px" }}>
                <Activity size={16} style={{ color: "var(--accent-emerald)" }} /> DNA Match
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Matched Incident</span>
                <span style={{ fontFamily: "monospace", color: "var(--accent-blue)", fontWeight: 600 }}>{incident.dna_match_id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Similarity</span>
                <span style={{ fontWeight: 600 }}>{incident.dna_similarity}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, ArrowRight, Clock, ShieldCheck, Zap, RefreshCw, Loader2 } from "lucide-react";
import { timeAgo, confidenceHex } from "@/lib/utils";

type Incident = {
  id: string;
  service_name: string;
  severity: string;
  action_taken: string;
  confidence_score: number;
  anomaly_score: number;
  created_at: string;
};

const ACTION_BADGE: Record<string, string> = {
  AUTO_REMEDIATED: "badge-remediated",
  SHADOW_LOGGED: "badge-shadow",
  ESCALATED: "badge-escalated",
};

const SEVERITY_BADGE: Record<string, string> = {
  P1: "badge-root-cause",
  P2: "badge-degraded",
  P3: "badge-shadow",
};

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const supabase = createClient();

  const fetchIncidents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("incidents")
      .select("id, service_name, severity, action_taken, confidence_score, anomaly_score, created_at")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setIncidents(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchIncidents();
    // Poll every 15s for new incidents from the agent
    const interval = setInterval(fetchIncidents, 15000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleSimulate = async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/demo/trigger", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLastTriggered(data.incident_id);
        await fetchIncidents();
      }
    } finally {
      setTimeout(() => setTriggering(false), 600);
    }
  };

  const rows = incidents;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRows = rows.filter((r) => new Date(r.created_at) >= today);
  const remediated = rows.filter((r) => r.action_taken === "AUTO_REMEDIATED").length;
  const escalated = rows.filter((r) => r.action_taken === "ESCALATED").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.01em" }}>
            Incident Feed
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Real-time investigations powered by Gemini 2.5 Pro and Elastic.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "20px",
            fontSize: "12.5px",
            color: "var(--accent-emerald)",
            fontWeight: 600,
          }}>
            <div className="live-dot" style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent-emerald)" }} />
            Live · polling every 15s
          </div>
          <button
            onClick={() => fetchIncidents()}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: "12.5px" }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleSimulate}
            className="btn-primary"
            disabled={triggering}
            style={{ padding: "9px 18px", fontSize: "13px" }}
          >
            {triggering ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={14} />}
            {triggering ? "Simulating…" : "Simulate Incident"}
          </button>
        </div>
      </div>

      {lastTriggered && (
        <div style={{
          padding: "12px 20px",
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: "12px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13.5px",
        }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-emerald)" }} />
          <span>
            Demo incident <strong style={{ fontFamily: "var(--font-mono)" }}>{lastTriggered}</strong> was seeded with a full investigation narrative.{" "}
            <Link href={`/dashboard/incidents/${lastTriggered}`} style={{ color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}>
              View it →
            </Link>
          </span>
          <button onClick={() => setLastTriggered(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {[
          { label: "Investigated Today", value: todayRows.length, icon: ShieldCheck, color: "var(--accent-blue)" },
          { label: "Auto-Remediated", value: remediated, icon: ArrowRight, color: "var(--accent-emerald)" },
          { label: "Escalated", value: escalated, icon: AlertTriangle, color: "var(--accent-amber)" },
          { label: "Total Incidents", value: rows.length, icon: Clock, color: "var(--accent-purple)" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 500 }}>{stat.label}</span>
              <stat.icon size={15} style={{ color: stat.color }} />
            </div>
            <div className="stat-number" style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{
          padding: "14px 24px",
          borderBottom: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "1.6fr 2fr 0.8fr 1.6fr 1fr 1fr",
          gap: "16px",
          fontSize: "10.5px",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          <div>Incident</div>
          <div>Service</div>
          <div>Anomaly</div>
          <div>Action</div>
          <div>Confidence</div>
          <div style={{ textAlign: "right" }}>Time</div>
        </div>

        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="shimmer" style={{ height: "68px", margin: "4px 0" }} />
          ))
        ) : rows.length === 0 ? (
          <div style={{ padding: "80px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>🤖</div>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Agent is watching</div>
            <p style={{ color: "var(--text-muted)", fontSize: "13.5px", marginBottom: "24px" }}>
              No incidents yet. Click &quot;Simulate Incident&quot; to seed a demo investigation.
            </p>
            <button onClick={handleSimulate} className="btn-primary" disabled={triggering}>
              <Zap size={14} /> Simulate Demo Incident
            </button>
          </div>
        ) : (
          rows.map((incident) => (
            <Link
              href={`/dashboard/incidents/${incident.id}`}
              key={incident.id}
              className="table-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 2fr 0.8fr 1.6fr 1fr 1fr",
                gap: "16px",
                padding: "16px 24px",
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
                color: "inherit",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px", fontSize: "13.5px", fontFamily: "var(--font-mono)" }}>
                  {incident.id}
                </div>
                <span className={`badge ${SEVERITY_BADGE[incident.severity] ?? "badge-shadow"}`}>
                  {incident.severity}
                </span>
              </div>

              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                {incident.service_name}
              </div>

              <div>
                <span style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: incident.anomaly_score >= 80 ? "var(--accent-red)" : incident.anomaly_score >= 60 ? "var(--accent-amber)" : "var(--text-secondary)",
                }}>
                  {incident.anomaly_score}
                </span>
              </div>

              <div>
                <span className={`badge ${ACTION_BADGE[incident.action_taken] ?? "badge-shadow"}`}>
                  {incident.action_taken?.replace(/_/g, " ")}
                </span>
              </div>

              <div style={{ fontWeight: 700, fontSize: "15px", color: confidenceHex(incident.confidence_score), letterSpacing: "-0.01em" }}>
                {incident.confidence_score}%
              </div>

              <div style={{ textAlign: "right", fontSize: "12.5px", color: "var(--text-muted)" }}>
                {timeAgo(incident.created_at)}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

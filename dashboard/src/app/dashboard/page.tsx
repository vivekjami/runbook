import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { timeAgo, confidenceHex } from "@/lib/utils";

// Type for an incident row from Supabase
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

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch real incidents from Supabase — falls back to empty if table not yet created
  const { data: incidents } = await supabase
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows: Incident[] = incidents ?? [];

  // Stats derived from real data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRows = rows.filter((r) => new Date(r.created_at) >= today);
  const remediated = rows.filter((r) => r.action_taken === "AUTO_REMEDIATED").length;
  const escalated = rows.filter((r) => r.action_taken === "ESCALATED").length;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px" }}>
            Incident Feed
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Real-time investigations powered by Gemini and Elastic.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "20px",
            fontSize: "13px",
            color: "var(--accent-emerald)",
            fontWeight: 600,
          }}
        >
          <div
            className="live-dot"
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "var(--accent-emerald)",
            }}
          />
          Live
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {[
          {
            label: "Investigated Today",
            value: todayRows.length,
            icon: ShieldCheck,
            color: "var(--accent-blue)",
          },
          {
            label: "Auto-Remediated",
            value: remediated,
            icon: ArrowRight,
            color: "var(--accent-emerald)",
          },
          {
            label: "Escalated",
            value: escalated,
            icon: AlertTriangle,
            color: "var(--accent-amber)",
          },
          {
            label: "Total Incidents",
            value: rows.length,
            icon: Clock,
            color: "var(--accent-purple)",
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-card" style={{ padding: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                }}
              >
                {stat.label}
              </span>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "grid",
            gridTemplateColumns: "1.5fr 2fr 1fr 1.5fr 1fr 1fr",
            gap: "16px",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <div>Incident</div>
          <div>Service</div>
          <div>Anomaly</div>
          <div>Action</div>
          <div>Confidence</div>
          <div style={{ textAlign: "right" }}>Time</div>
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "14px",
            }}
          >
            No incidents yet. The agent is watching your infrastructure.
          </div>
        ) : (
          rows.map((incident) => (
            <Link
              href={`/dashboard/incidents/${incident.id}`}
              key={incident.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 2fr 1fr 1.5fr 1fr 1fr",
                gap: "16px",
                padding: "18px 24px",
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
                color: "inherit",
                alignItems: "center",
                transition: "background 0.15s ease",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: "4px",
                    fontSize: "14px",
                  }}
                >
                  {incident.id}
                </div>
                <span
                  className={`badge ${
                    incident.severity === "P1"
                      ? "badge-root-cause"
                      : incident.severity === "P2"
                      ? "badge-degraded"
                      : "badge-shadow"
                  }`}
                >
                  {incident.severity}
                </span>
              </div>

              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                }}
              >
                {incident.service_name}
              </div>

              <div style={{ fontWeight: 500, fontSize: "14px" }}>
                {incident.anomaly_score}
              </div>

              <div>
                <span
                  className={`badge ${
                    ACTION_BADGE[incident.action_taken] ?? "badge-shadow"
                  }`}
                >
                  {incident.action_taken?.replace(/_/g, " ")}
                </span>
              </div>

              <div
                style={{
                  fontWeight: 700,
                  fontSize: "15px",
                  color: confidenceHex(incident.confidence_score),
                }}
              >
                {incident.confidence_score}%
              </div>

              <div
                style={{
                  textAlign: "right",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                }}
              >
                {timeAgo(incident.created_at)}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

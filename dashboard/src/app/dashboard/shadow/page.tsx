import { createClient } from "@/lib/supabase/server";
import { Ghost, Activity, CheckCircle2, XCircle } from "lucide-react";
import { timeAgo } from "@/lib/utils";

type ShadowRow = {
  id: string;
  incident_id: string;
  agent_action: string;
  human_action: string | null;
  agent_reasoning: string | null;
  human_reasoning: string | null;
  agreed: boolean | null;
  created_at: string;
};

export default async function ShadowModePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shadow_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows: ShadowRow[] = data ?? [];
  const resolved = rows.filter((r) => r.human_action !== null);
  const accuracy =
    resolved.length > 0
      ? Math.round((resolved.filter((r) => r.agreed).length / resolved.length) * 100)
      : 0;

  const R = 45;
  const C = 2 * Math.PI * R;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 700 }}>Shadow Mode</h1>
            <span className="badge badge-shadow" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Ghost size={12} /> Active
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "580px", lineHeight: 1.6 }}>
            RunBook observes without acting. Compare the agent&apos;s predicted resolutions against what your engineers actually did — before granting write access to production.
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Observation Period</div>
          <div style={{ fontSize: "20px", fontWeight: 700 }}>11 Days Left</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", marginBottom: "32px" }}>
        {/* Gauge */}
        <div className="glass-card" style={{ padding: "32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "20px" }}>
            Prediction Accuracy
          </div>
          <div style={{ position: "relative", width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
            <svg style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }} width="160" height="160" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle cx="50" cy="50" r={R} fill="none"
                stroke={accuracy >= 80 ? "var(--accent-emerald)" : "var(--accent-amber)"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C - (C * accuracy) / 100}
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div style={{ fontSize: "40px", fontWeight: 800 }}>{accuracy}%</div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px", lineHeight: 1.5 }}>
            Based on {resolved.length} resolved incidents.
          </p>
          <button className="btn-primary" style={{ width: "100%" }}>Go Live — Disable Shadow Mode</button>
        </div>

        {/* How it works */}
        <div className="glass-card" style={{ padding: "32px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={16} style={{ color: "var(--accent-blue)" }} /> How trust is built
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {[
              { step: "1", color: "var(--accent-blue)", title: "Observe", desc: "When an alert fires, RunBook investigates fully and logs what it would do — without executing anything." },
              { step: "2", color: "var(--accent-purple)", title: "Compare", desc: "After your engineer resolves the incident, this dashboard compares the human's action against the agent's prediction." },
              { step: "3", color: "var(--accent-emerald)", title: "Trust", desc: "When accuracy meets your standard, click 'Go Live'. RunBook starts auto-remediating incidents above your confidence threshold." },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${item.color}18`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", color: item.color, fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{item.title}</div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "16px" }}>Investigation History</h2>
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1.5fr 1.5fr 2fr 1fr", gap: "16px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <div>Incident</div><div>Agent Predicted</div><div>Human Actual</div><div>Reasoning</div><div style={{ textAlign: "right" }}>Result</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
            No shadow actions yet. Waiting for the first incident.
          </div>
        ) : rows.map((row) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1.5fr 2fr 1fr", gap: "16px", padding: "18px 24px", borderBottom: "1px solid var(--border)", alignItems: "start" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>{row.incident_id}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{timeAgo(row.created_at)}</div>
            </div>
            <div>
              <code style={{ fontSize: "11px", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: "4px", display: "inline-block", marginBottom: "6px" }}>{row.agent_action}</code>
              {row.agent_reasoning && <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>&ldquo;{row.agent_reasoning}&rdquo;</div>}
            </div>
            <div>
              {row.human_action
                ? <><code style={{ fontSize: "11px", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: "4px", display: "inline-block", marginBottom: "6px" }}>{row.human_action}</code>
                  {row.human_reasoning && <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>&ldquo;{row.human_reasoning}&rdquo;</div>}</>
                : <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Pending…</span>}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {row.agreed === true ? "Agent matched human operator's decision exactly."
                : row.agreed === false ? "Agent and human chose different strategies."
                : "Awaiting human resolution."}
            </div>
            <div style={{ textAlign: "right", display: "flex", justifyContent: "flex-end" }}>
              {row.agreed === true
                ? <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--accent-emerald)", fontSize: "13px", fontWeight: 500 }}><CheckCircle2 size={15} /> Match</div>
                : row.agreed === false
                ? <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--accent-amber)", fontSize: "13px", fontWeight: 500 }}><XCircle size={15} /> Diverged</div>
                : <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

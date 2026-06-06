import { createClient } from "@/lib/supabase/server";
import { Database, TrendingDown, Network, Search, ArrowUpRight } from "lucide-react";
import { timeAgo } from "@/lib/utils";

type DNARow = {
  id: string;
  origin_incident_id: string;
  service_name: string;
  resolution_action: string;
  human_mttr_minutes: number;
  similar_count: number;
  created_at: string;
};

export default async function DNAIndexPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dna_index")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows: DNARow[] = data ?? [];

  // Aggregate top actions
  const actionCounts: Record<string, number> = {};
  rows.forEach((r) => {
    actionCounts[r.resolution_action] =
      (actionCounts[r.resolution_action] ?? 0) + 1;
  });
  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const total = rows.length || 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 700 }}>Incident DNA Index</h1>
            <span className="badge badge-remediated" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Database size={12} /> {rows.length} Fingerprints
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "600px", lineHeight: 1.6 }}>
            Every resolved incident is vectorised and stored here. RunBook uses this index to instantly match new anomalies to past resolutions and skip straight to the fix.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input type="text" placeholder="Search signatures…" style={{ paddingLeft: "34px", width: "220px" }} />
          </div>
          <button className="btn-secondary">Export CSV</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "32px" }}>
        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-emerald)" }}>
              <TrendingDown size={20} />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>MTTR Reduction</div>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>-68%</div>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>Matched incidents resolve in 68% less time than novel ones.</p>
        </div>

        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-blue)" }}>
              <Network size={20} />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>Match Rate</div>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>42.5%</div>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>Of new incidents match a known fingerprint at &gt;85% similarity.</p>
        </div>

        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>Top Resolutions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {topActions.length > 0 ? topActions.map(([action, count], i) => {
              const colors = ["var(--accent-blue)", "var(--accent-cyan)", "var(--accent-purple)"];
              const pct = Math.round((count / total) * 100);
              return (
                <div key={action}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <code>{action}</code><span>{pct}%</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: colors[i] }} />
                  </div>
                </div>
              );
            }) : [
              { action: "pod_restart", pct: 45, color: "var(--accent-blue)" },
              { action: "scale_nodes", pct: 30, color: "var(--accent-cyan)" },
              { action: "flush_cache", pct: 15, color: "var(--accent-purple)" },
            ].map((item) => (
              <div key={item.action}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <code>{item.action}</code><span>{item.pct}%</span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${item.pct}%`, height: "100%", background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1.5fr 2fr 1.5fr 1fr 1fr 0.5fr", gap: "16px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <div>Origin Incident</div><div>Service</div><div>Resolution Action</div><div>Human MTTR</div><div>Occurrences</div><div />
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
            No fingerprints yet. Resolve your first incident to seed the DNA index.
          </div>
        ) : rows.map((row) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.5fr 1.5fr 1fr 0.5fr", gap: "16px", padding: "16px 24px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>{row.origin_incident_id}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{timeAgo(row.created_at)}</div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--text-secondary)" }}>{row.service_name}</div>
            <div><code style={{ fontSize: "11px", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: "4px" }}>{row.resolution_action}</code></div>
            <div style={{ fontSize: "13px" }}>{row.human_mttr_minutes ?? "—"} min</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: (row.similar_count ?? 0) > 10 ? "var(--accent-emerald)" : "var(--accent-blue)" }} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{row.similar_count ?? 0}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

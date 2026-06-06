"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { TrendingDown, Zap, ShieldCheck, Clock } from "lucide-react";

type Incident = {
  id: string;
  action_taken: string;
  confidence_score: number;
  mttr_seconds: number | null;
  human_mttr_minutes: number | null;
  created_at: string;
};

const COLORS = {
  AUTO_REMEDIATED: "#10b981",
  ESCALATED: "#f59e0b",
  SHADOW_LOGGED: "#8b5cf6",
};

const PIE_COLORS = ["#10b981", "#f59e0b", "#8b5cf6"];

// Group incidents by day for the trend chart
function groupByDay(incidents: Incident[]) {
  const map: Record<string, { date: string; total: number; remediated: number; escalated: number }> = {};
  incidents.forEach((inc) => {
    const day = inc.created_at.slice(0, 10);
    if (!map[day]) map[day] = { date: day, total: 0, remediated: 0, escalated: 0 };
    map[day].total++;
    if (inc.action_taken === "AUTO_REMEDIATED") map[day].remediated++;
    if (inc.action_taken === "ESCALATED") map[day].escalated++;
  });
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
}

// MTTR comparison chart
function mttrData(incidents: Incident[]) {
  return incidents
    .filter((i) => i.mttr_seconds && i.human_mttr_minutes)
    .slice(0, 10)
    .map((inc, idx) => ({
      name: `INC-${idx + 1}`,
      agent: Math.round((inc.mttr_seconds ?? 0) / 60),
      human: inc.human_mttr_minutes ?? 0,
    }));
}

// Action breakdown for pie
function actionBreakdown(incidents: Incident[]) {
  const counts: Record<string, number> = {};
  incidents.forEach((i) => { counts[i.action_taken] = (counts[i.action_taken] ?? 0) + 1; });
  return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 16px", fontSize: "12.5px" }}>
      <div style={{ marginBottom: "6px", color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("incidents")
      .select("id, action_taken, confidence_score, mttr_seconds, human_mttr_minutes, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setIncidents(data ?? []);
        setLoading(false);
      });
  }, [supabase]);

  const avgAgentMTTR = incidents.filter((i) => i.mttr_seconds).length
    ? Math.round(incidents.filter((i) => i.mttr_seconds).reduce((s, i) => s + (i.mttr_seconds ?? 0), 0) / incidents.filter((i) => i.mttr_seconds).length)
    : 0;

  const avgHumanMTTR = incidents.filter((i) => i.human_mttr_minutes).length
    ? Math.round(incidents.filter((i) => i.human_mttr_minutes).reduce((s, i) => s + (i.human_mttr_minutes ?? 0), 0) / incidents.filter((i) => i.human_mttr_minutes).length)
    : 0;

  const remediatedPct = incidents.length
    ? Math.round((incidents.filter((i) => i.action_taken === "AUTO_REMEDIATED").length / incidents.length) * 100)
    : 0;

  const avgConfidence = incidents.length
    ? Math.round(incidents.reduce((s, i) => s + i.confidence_score, 0) / incidents.length)
    : 0;

  const trendData = groupByDay(incidents);
  const mttr = mttrData(incidents);
  const pieData = actionBreakdown(incidents);

  const STAT_CARDS = [
    { label: "Avg Agent MTTR", value: avgAgentMTTR ? `${avgAgentMTTR}s` : "—", icon: Zap, color: "var(--accent-emerald)", desc: "seconds to resolution" },
    { label: "Avg Human MTTR", value: avgHumanMTTR ? `${avgHumanMTTR}m` : "—", icon: Clock, color: "var(--text-muted)", desc: "minutes (benchmark)" },
    { label: "Auto-Remediated", value: `${remediatedPct}%`, icon: ShieldCheck, color: "var(--accent-blue)", desc: "of all incidents" },
    { label: "Avg Confidence", value: `${avgConfidence}%`, icon: TrendingDown, color: "var(--accent-purple)", desc: "agent decision score" },
  ];

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px" }}>Analytics</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading metrics…</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          {[1,2,3,4].map((i) => (
            <div key={i} className="glass-card shimmer" style={{ height: "100px" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px" }}>Analytics</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Agent performance metrics across {incidents.length} investigated incidents.
          </p>
        </div>
        {avgHumanMTTR > 0 && avgAgentMTTR > 0 && (
          <div style={{
            padding: "12px 20px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "12px",
            textAlign: "right",
          }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
              Time Saved per Incident
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--accent-emerald)" }}>
              ~{avgHumanMTTR}m {"->"} {avgAgentMTTR}s
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{card.label}</span>
              <card.icon size={16} style={{ color: card.color }} />
            </div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: card.color, marginBottom: "4px" }}>{card.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{card.desc}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Incident trend */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-blue)" }} />
            Incident Trend (last 14 days)
          </div>
          {trendData.length === 0 ? (
            <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No trend data yet — trigger some demo incidents.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="remGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="escGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="remediated" stroke="#10b981" fill="url(#remGrad)" strokeWidth={2} name="Remediated" />
                <Area type="monotone" dataKey="escalated" stroke="#f59e0b" fill="url(#escGrad)" strokeWidth={2} name="Escalated" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Action breakdown pie */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-purple)" }} />
            Action Breakdown
          </div>
          {pieData.length === 0 ? (
            <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No data yet.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: PIE_COLORS[i % PIE_COLORS.length] }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MTTR comparison bar chart */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-emerald)" }} />
          MTTR Comparison — Agent vs Human (minutes)
        </div>
        {mttr.length === 0 ? (
          <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            Trigger some demo incidents to see the MTTR comparison chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mttr} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-muted)" }} />
              <Bar dataKey="agent" name="Agent (min)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="human" name="Human (min)" fill="rgba(148,163,184,0.3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

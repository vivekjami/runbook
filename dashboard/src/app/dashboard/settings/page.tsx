"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Server, Shield, CreditCard, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Tab = "elastic" | "agent" | "billing";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("elastic");
  const [elasticUrl, setElasticUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [threshold, setThreshold] = useState(85);
  const [shadowMode, setShadowMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const supabase = createClient();

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      // Load Razorpay script dynamically
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Razorpay script failed to load"));
          document.body.appendChild(script);
        });
      }

      const res = await fetch("/api/billing/subscribe", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.subscription_id) {
        throw new Error(data.error ?? "Failed to create subscription");
      }

      const rzp = new window.Razorpay({
        key: data.razorpay_key,
        subscription_id: data.subscription_id,
        name: "RunBook",
        description: "Pro Plan — $299/month",
        currency: "USD",
        prefill: { email: data.user_email },
        theme: { color: "#3b82f6" },
        handler: () => {
          // Webhook will update the DB; just show a success state here
          alert("Payment successful! Your plan has been upgraded to Pro.");
          window.location.reload();
        },
      });
      rzp.open();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUpgrading(false);
    }
  };

  const saveElastic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("workspace_settings").upsert({
        user_id: user.id,
        elastic_url: elasticUrl,
        elastic_api_key: apiKey,
        confidence_threshold: threshold,
        shadow_mode: shadowMode,
      });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "elastic", label: "Elastic Connection", icon: Server },
    { key: "agent", label: "Agent Config", icon: Shield },
    { key: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px" }}>Workspace Settings</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Manage your Elastic connection, agent behavior, and billing.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "32px", alignItems: "start" }}>
        {/* Tab nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`sidebar-link ${tab === key ? "active" : ""}`}
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Panels */}
        <div>
          {tab === "elastic" && (
            <form onSubmit={saveElastic} className="glass-card" style={{ padding: "32px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Server size={18} style={{ color: "var(--accent-blue)" }} /> Elastic Cloud Configuration
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginBottom: "28px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>Elasticsearch URL</label>
                  <input type="url" value={elasticUrl} onChange={(e) => setElasticUrl(e.target.value)} placeholder="https://my-project.es.us-central1.gcp.elastic.cloud:443" required />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Encrypted at rest" />
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>Stored encrypted. Used by the MCP server to query metrics and vector indices.</p>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? "✓ Saved" : <><Save size={16} /> Save Configuration</>}
              </button>
            </form>
          )}

          {tab === "agent" && (
            <div className="glass-card" style={{ padding: "32px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} style={{ color: "var(--accent-purple)" }} /> Agent Configuration
              </h2>

              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>
                  Confidence Threshold: <span style={{ color: "var(--accent-blue)" }}>{threshold}%</span>
                </label>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.5 }}>
                  Incidents above this score will be auto-remediated. Below it, the agent escalates to your team.
                </p>
                <input type="range" min={50} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent-blue)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                  <span>50% — Aggressive</span><span>100% — Conservative</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>Shadow Mode</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Run agent silently — log actions without executing them.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShadowMode(!shadowMode)}
                  style={{
                    width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                    background: shadowMode ? "var(--accent-blue)" : "var(--bg-secondary)",
                    position: "relative", transition: "background 0.2s ease", flexShrink: 0,
                  }}
                  aria-label="Toggle shadow mode"
                >
                  <span style={{
                    position: "absolute", width: "16px", height: "16px", borderRadius: "50%",
                    background: "white", top: "4px",
                    left: shadowMode ? "24px" : "4px",
                    transition: "left 0.2s ease",
                  }} />
                </button>
              </div>
            </div>
          )}

          {tab === "billing" && (
            <div className="glass-card" style={{ padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "17px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                  <CreditCard size={18} style={{ color: "var(--accent-emerald)" }} /> Billing
                </h2>
                <span className="badge badge-cleared">14-Day Trial</span>
              </div>

              <div style={{ padding: "20px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", marginBottom: "24px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-emerald)", marginBottom: "6px" }}>11 days remaining in your trial</div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px" }}>
                  Full access to all features. No credit card required during trial. Upgrade to continue after expiry.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <button
                    className="btn-primary"
                    style={{ background: "linear-gradient(135deg, var(--accent-emerald), #059669)" }}
                    onClick={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? <Loader2 size={16} className="animate-spin" /> : "Upgrade — $299/mo"}
                  </button>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Processed via Razorpay · USD only</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  "Unlimited incidents",
                  "Unlimited runbook ingestion",
                  "12-month DNA index retention",
                  "Shadow Mode dashboard",
                  "Priority email support",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--accent-emerald)", fontSize: "16px" }}>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

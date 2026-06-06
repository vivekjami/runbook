"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Server, Shield, CreditCard, Loader2, CheckCircle2 } from "lucide-react";

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
  const [loadingSettings, setLoadingSettings] = useState(true);

  const supabase = createClient();

  // Load existing settings on mount
  const loadSettings = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setLoadingSettings(false); return; }

    const { data } = await supabase
      .from("workspace_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setElasticUrl(data.elastic_url ?? "");
      // Don't load the actual key — just show a placeholder if one is saved
      setApiKey(data.elastic_api_key ? "••••••••••••••••" : "");
      setThreshold(data.confidence_threshold ?? 85);
      setShadowMode(data.shadow_mode ?? true);
    }
    setLoadingSettings(false);
  }, [supabase]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const update: Record<string, unknown> = {
        user_id: user.id,
        elastic_url: elasticUrl,
        confidence_threshold: threshold,
        shadow_mode: shadowMode,
        updated_at: new Date().toISOString(),
      };
      // Only update api_key if user actually changed it (not the placeholder)
      if (apiKey && !apiKey.includes("•")) {
        update.elastic_api_key = apiKey;
      }
      await supabase.from("workspace_settings").upsert(update);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "elastic", label: "Elastic Connection", icon: Server },
    { key: "agent", label: "Agent Config", icon: Shield },
    { key: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.01em" }}>
          Workspace Settings
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Manage your Elastic connection, agent behavior, and billing.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: "32px", alignItems: "start" }}>
        {/* Tab nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`sidebar-link ${tab === key ? "active" : ""}`}
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Panels */}
        <div>
          {/* Elastic */}
          {tab === "elastic" && (
            <form onSubmit={saveElastic} className="glass-card" style={{ padding: "32px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Server size={17} style={{ color: "var(--accent-blue)" }} /> Elastic Cloud Configuration
              </h2>
              {loadingSettings ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading saved settings…
                </div>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginBottom: "28px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Elasticsearch URL
                  </label>
                  <input
                    type="url"
                    value={elasticUrl}
                    onChange={(e) => setElasticUrl(e.target.value)}
                    placeholder="https://my-project.es.us-central1.gcp.elastic.cloud:443"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your Elastic API key"
                    onFocus={() => { if (apiKey.includes("•")) setApiKey(""); }}
                  />
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                    Stored encrypted. Used by the MCP server to query metrics and vector indices.
                  </p>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                ) : saved ? (
                  <><CheckCircle2 size={15} /> Saved!</>
                ) : (
                  <><Save size={15} /> Save Configuration</>
                )}
              </button>
            </form>
          )}

          {/* Agent */}
          {tab === "agent" && (
            <div className="glass-card" style={{ padding: "32px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={17} style={{ color: "var(--accent-purple)" }} /> Agent Configuration
              </h2>

              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", fontSize: "13.5px", fontWeight: 600, marginBottom: "6px" }}>
                  Confidence Threshold:{" "}
                  <span style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>{threshold}%</span>
                </label>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.6 }}>
                  Incidents above this score are auto-remediated. Below it, the agent escalates with a pre-written brief.
                </p>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent-blue)", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "6px" }}>
                  <span>50% — Aggressive</span>
                  <span>100% — Conservative</span>
                </div>
              </div>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                marginBottom: "24px",
              }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>Shadow Mode</div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                    Observe without acting — every action is logged but not executed.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShadowMode(!shadowMode)}
                  style={{
                    width: "46px",
                    height: "26px",
                    borderRadius: "13px",
                    border: "none",
                    cursor: "pointer",
                    background: shadowMode ? "var(--accent-blue)" : "var(--bg-secondary)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                  aria-label="Toggle shadow mode"
                >
                  <span style={{
                    position: "absolute",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "white",
                    top: "4px",
                    left: shadowMode ? "24px" : "4px",
                    transition: "left 0.2s ease",
                  }} />
                </button>
              </div>

              <button className="btn-primary" onClick={saveElastic as unknown as React.MouseEventHandler<HTMLButtonElement>} disabled={saving}>
                {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : saved ? <><CheckCircle2 size={15} /> Saved!</> : <><Save size={15} /> Save Config</>}
              </button>
            </div>
          )}

          {/* Billing */}
          {tab === "billing" && (
            <div className="glass-card" style={{ padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <CreditCard size={17} style={{ color: "var(--accent-emerald)" }} /> Billing
                </h2>
                <span className="badge badge-cleared">14-Day Trial</span>
              </div>

              <div style={{
                padding: "20px",
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: "12px",
                marginBottom: "24px",
              }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-emerald)", marginBottom: "6px" }}>
                  Trial active — full access to all features
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px" }}>
                  No credit card required during trial. Upgrade to continue after expiry.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <button
                    className="btn-primary"
                    style={{ background: "linear-gradient(135deg, var(--accent-emerald), #059669)" }}
                    onClick={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : "Upgrade — $299/mo"}
                  </button>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Processed via Razorpay · USD</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  "Unlimited incidents investigated",
                  "Unlimited runbook ingestion",
                  "12-month DNA index retention",
                  "Shadow Mode dashboard",
                  "Priority email support",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "var(--text-secondary)" }}>
                    <CheckCircle2 size={14} style={{ color: "var(--accent-emerald)", flexShrink: 0 }} /> {item}
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

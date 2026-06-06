"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert, Check, Zap, Brain, Clock, ChevronRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";

// ─── Animated terminal that types investigation steps ───────────────────────
const TERMINAL_LINES = [
  { delay: 0,    color: "#64748b", text: "# Alert: payment-service P99 latency spiked to 8.2s" },
  { delay: 600,  color: "#3b82f6", text: "→ Fetching blast-radius matrix for 12 services…" },
  { delay: 1800, color: "#94a3b8", text: "  ✓ checkout-api    [CLEARED]  p99=120ms  normal" },
  { delay: 2200, color: "#94a3b8", text: "  ✓ user-service    [CLEARED]  p99=88ms   normal" },
  { delay: 2600, color: "#94a3b8", text: "  ✓ auth-service    [CLEARED]  p99=45ms   normal" },
  { delay: 3000, color: "#fbbf24", text: "  ⚠ payment-svc    [SUSPECT]  p99=8200ms anomaly_score=94" },
  { delay: 3600, color: "#3b82f6", text: "→ Querying deployment log for payment-service…" },
  { delay: 4400, color: "#ef4444", text: "  ✗ Deploy at 14:32 UTC — db-pool-size reduced 100→20" },
  { delay: 5000, color: "#3b82f6", text: "→ Matching against Incident DNA index…" },
  { delay: 5800, color: "#10b981", text: "  🧬 DNA match: INC-2024-891 (similarity 97.3%)" },
  { delay: 6200, color: "#10b981", text: "  → Resolution: scale db-pool-size to 100, restart pod" },
  { delay: 7000, color: "#8b5cf6", text: "→ Confidence score: 91% — AUTO-REMEDIATING…" },
  { delay: 7800, color: "#10b981", text: "✓ Incident resolved in 47 seconds. MTTR saved: 38 min." },
];

function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setVisibleLines((prev) => [...prev, i]);
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, TERMINAL_LINES[i].delay));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="terminal glow-card" style={{ maxWidth: "640px", margin: "0 auto" }}>
      <div className="terminal-header">
        <div className="terminal-dot" style={{ background: "#ef4444" }} />
        <div className="terminal-dot" style={{ background: "#f59e0b" }} />
        <div className="terminal-dot" style={{ background: "#10b981" }} />
        <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          runbook-agent — investigation in progress
        </span>
      </div>
      <div
        ref={containerRef}
        className="terminal-body"
        style={{ minHeight: "280px", maxHeight: "280px", overflowY: "auto" }}
      >
        {TERMINAL_LINES.map((line, i) =>
          visibleLines.includes(i) ? (
            <div
              key={i}
              style={{
                color: line.color,
                marginBottom: "2px",
                animation: "slide-in 0.2s ease-out both",
                fontFamily: "var(--font-mono)",
              }}
            >
              {line.text}
              {i === visibleLines[visibleLines.length - 1] && i < TERMINAL_LINES.length - 1 && (
                <span className="terminal-cursor" />
              )}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

// ─── Stats ticker ────────────────────────────────────────────────────────────
const STATS = [
  { label: "Avg MTTR", value: "47s", sub: "vs 38min human", color: "var(--accent-emerald)" },
  { label: "Services Cleared", value: "8s", sub: "per service", color: "var(--accent-blue)" },
  { label: "DNA Match Rate", value: "42%", sub: "of incidents", color: "var(--accent-purple)" },
  { label: "Shadow Accuracy", value: "91%", sub: "agent vs human", color: "var(--accent-amber)" },
];

function CountUp({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{val}</>;
}

// ─── Feature cards ───────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "👻",
    title: "Shadow Mode",
    desc: "RunBook observes for 14 days, logging exactly what it would do. Compare against your engineers before flipping the switch.",
    color: "#8b5cf6",
    colorBg: "rgba(139,92,246,0.08)",
  },
  {
    icon: "🧬",
    title: "Incident DNA",
    desc: "Every resolved incident is vectorised. New anomalies are matched to past resolutions in milliseconds — skip straight to the fix.",
    color: "#3b82f6",
    colorBg: "rgba(59,130,246,0.08)",
  },
  {
    icon: "⚡",
    title: "Time-to-Innocent",
    desc: "The hardest part is clearing suspects. RunBook clears innocent services in 8 seconds, narrowing the blast radius automatically.",
    color: "#10b981",
    colorBg: "rgba(16,185,129,0.08)",
  },
  {
    icon: "🎯",
    title: "Confidence Gating",
    desc: "You set the threshold. Above it, RunBook acts. Below it, engineers receive a pre-written brief — not a blank page.",
    color: "#f59e0b",
    colorBg: "rgba(245,158,11,0.08)",
  },
  {
    icon: "📊",
    title: "Chronicle Reports",
    desc: "Every investigation is recorded as a full narrative: what was queried, what was cleared, what was found, and why.",
    color: "#06b6d4",
    colorBg: "rgba(6,182,212,0.08)",
  },
  {
    icon: "🔗",
    title: "Elastic + Gemini",
    desc: "ES|QL blast-radius queries, Gemini 2.5 Pro reasoning, vector search over your runbooks. No vendor lock-in.",
    color: "#ec4899",
    colorBg: "rgba(236,72,153,0.08)",
  },
];

// ─── How it works steps ──────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  { n: "01", title: "Alert fires", desc: "PagerDuty / Alertmanager webhook hits RunBook." },
  { n: "02", title: "Blast radius", desc: "ES|QL queries map all services' health in 8 seconds." },
  { n: "03", title: "DNA match", desc: "Vector search finds the closest resolved incident." },
  { n: "04", title: "Confidence score", desc: "Gemini 2.5 Pro reasons and scores confidence 0–100." },
  { n: "05", title: "Act or escalate", desc: "Above threshold: auto-remediate. Below: human brief." },
  { n: "06", title: "Chronicle report", desc: "Full narrative saved to Elastic for audit & learning." },
];

// ─── Landing page ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", overflowX: "hidden" }}>
      {/* ── Nav ── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 48px",
          borderBottom: "1px solid rgba(31,45,69,0.6)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(3,7,18,0.85)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldAlert size={26} style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }} className="gradient-text">
            RunBook
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Link
            href="/login"
            style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", padding: "8px 16px", borderRadius: "8px", transition: "color 0.15s" }}
          >
            Log in
          </Link>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: "none", padding: "9px 20px" }}>
            Start Free Trial <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          position: "relative",
          padding: "120px 48px 80px",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <div className="hero-orb-1" />
        <div className="hero-orb-2" />

        {mounted && (
          <>
            <div
              className="fade-in-up"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 16px",
                background: "rgba(59,130,246,0.1)",
                borderRadius: "20px",
                border: "1px solid rgba(59,130,246,0.2)",
                color: "var(--accent-blue)",
                fontSize: "12.5px",
                fontWeight: 600,
                marginBottom: "28px",
                letterSpacing: "0.02em",
              }}
            >
              <div
                className="live-dot"
                style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-blue)" }}
              />
              Built for Google Cloud Rapid Agent Hackathon 2026
            </div>

            <h1
              className="fade-in-up fade-in-up-delay-1"
              style={{
                fontSize: "clamp(40px, 6vw, 72px)",
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                marginBottom: "24px",
                maxWidth: "860px",
                margin: "0 auto 24px",
              }}
            >
              Stop getting paged at 3am{" "}
              <br />
              <span className="gradient-text">for things a machine can fix.</span>
            </h1>

            <p
              className="fade-in-up fade-in-up-delay-2"
              style={{
                fontSize: "18px",
                color: "var(--text-secondary)",
                maxWidth: "600px",
                margin: "0 auto 48px",
                lineHeight: 1.65,
              }}
            >
              RunBook is an autonomous on-call agent powered by{" "}
              <strong style={{ color: "var(--text-primary)" }}>Gemini 2.5 Pro</strong> and{" "}
              <strong style={{ color: "var(--text-primary)" }}>Elastic</strong>. It investigates incidents in{" "}
              <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>47 seconds</span>, not 47 minutes.
            </p>

            <div
              className="fade-in-up fade-in-up-delay-3"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "72px", flexWrap: "wrap" }}
            >
              <Link href="/signup" className="btn-primary" style={{ fontSize: "15px", padding: "13px 28px", textDecoration: "none" }}>
                Start 14-Day Free Trial <ArrowRight size={17} />
              </Link>
              <Link href="/dashboard" className="btn-secondary" style={{ fontSize: "15px", padding: "13px 28px", textDecoration: "none" }}>
                <Zap size={16} style={{ color: "var(--accent-amber)" }} /> View Live Demo
              </Link>
            </div>
          </>
        )}

        {/* Terminal demo */}
        <div className="fade-in-up fade-in-up-delay-4">
          <AnimatedTerminal />
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{ padding: "0 48px 80px" }}>
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1px",
            background: "var(--border)",
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              style={{
                padding: "28px 24px",
                textAlign: "center",
                background: "var(--bg-card)",
              }}
            >
              <div style={{ fontSize: "32px", fontWeight: 800, color: s.color, marginBottom: "4px" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 48px", background: "var(--bg-secondary)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "16px" }}>
              Intelligence that{" "}
              <span className="gradient-text-emerald">builds trust</span>
            </h2>
            <p style={{ fontSize: "16px", color: "var(--text-secondary)", maxWidth: "520px", margin: "0 auto", lineHeight: 1.65 }}>
              You won&apos;t give a bot write access to production on day one. We built RunBook around that reality.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass-card"
                style={{ padding: "28px" }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: f.colorBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    marginBottom: "16px",
                  }}
                >
                  {f.icon}
                </div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "10px", color: f.color }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "100px 48px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "16px" }}>
              From alert to resolution in{" "}
              <span className="gradient-text">six steps</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.n}
                style={{
                  padding: "24px",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "-5px",
                    fontSize: "72px",
                    fontWeight: 900,
                    color: "rgba(255,255,255,0.02)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {step.n}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--accent-blue)",
                    letterSpacing: "0.08em",
                    marginBottom: "10px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  STEP {step.n}
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>{step.title}</div>
                <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{step.desc}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <ChevronRight
                    size={16}
                    style={{
                      position: "absolute",
                      right: "-13px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                      zIndex: 2,
                      display: i % 3 === 2 ? "none" : "block",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ padding: "100px 48px", background: "var(--bg-secondary)", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "16px" }}>
          Simple, flat pricing
        </h2>
        <p style={{ fontSize: "16px", color: "var(--text-secondary)", marginBottom: "56px" }}>
          No per-user seats. No overage fees. One price for the whole on-call team.
        </p>

        <div
          className="glass-card"
          style={{
            maxWidth: "420px",
            margin: "0 auto",
            padding: "40px",
            textAlign: "left",
            border: "1px solid rgba(59,130,246,0.3)",
            boxShadow: "0 0 60px rgba(59,130,246,0.08)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: "20px",
              fontSize: "11.5px",
              fontWeight: 700,
              color: "var(--accent-blue)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "16px",
            }}
          >
            <Zap size={11} /> Pro Plan
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "28px" }}>
            <span style={{ fontSize: "52px", fontWeight: 900, letterSpacing: "-0.03em" }}>$299</span>
            <span style={{ color: "var(--text-secondary)", fontSize: "16px" }}>/month</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "32px" }}>
            {[
              "Unlimited incidents investigated",
              "Unlimited runbook ingestion",
              "12-month DNA index retention",
              "Shadow Mode dashboard",
              "Slack + PagerDuty integration",
              "Priority support",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "rgba(16,185,129,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Check size={12} style={{ color: "var(--accent-emerald)" }} />
                </div>
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/signup"
            className="btn-primary"
            style={{ width: "100%", textDecoration: "none", fontSize: "15px", padding: "13px 20px" }}
          >
            Start 14-Day Free Trial <ArrowRight size={16} />
          </Link>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "12px" }}>
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "100px 48px", textAlign: "center" }}>
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "64px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
            border: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          <Brain size={40} style={{ color: "var(--accent-blue)", marginBottom: "20px" }} />
          <h2 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            Your team is the last line of defense.
          </h2>
          <p style={{ fontSize: "16px", color: "var(--text-secondary)", marginBottom: "36px", lineHeight: 1.65 }}>
            Stop burning engineers on alerts that a well-trained agent can handle. RunBook gets smarter with every incident.
          </p>
          <Link href="/signup" className="btn-primary" style={{ fontSize: "16px", padding: "14px 32px", textDecoration: "none" }}>
            Get started for free <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: "40px 48px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldAlert size={18} style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontWeight: 700 }} className="gradient-text">RunBook</span>
          <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            © 2026 · Built for Google Cloud Rapid Agent Hackathon
          </span>
        </div>
        <div style={{ display: "flex", gap: "20px", fontSize: "13px", color: "var(--text-muted)" }}>
          <Link href="/login" style={{ color: "inherit", textDecoration: "none" }}>Login</Link>
          <Link href="/signup" style={{ color: "inherit", textDecoration: "none" }}>Sign up</Link>
        </div>
      </footer>
    </div>
  );
}

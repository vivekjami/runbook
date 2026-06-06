"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert, Check, PlayCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Navigation */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ShieldAlert size={28} style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontSize: "20px", fontWeight: 800 }} className="gradient-text">RunBook</span>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link href="/login" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>Log in</Link>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: "none" }}>Start Free Trial</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "100px 20px", textAlign: "center", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "rgba(59,130,246,0.1)", borderRadius: "20px", border: "1px solid rgba(59,130,246,0.2)", color: "var(--accent-blue)", fontSize: "13px", fontWeight: 600, marginBottom: "24px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-blue)" }} />
          Now available on Vercel
        </div>
        
        <h1 style={{ fontSize: "56px", fontWeight: 800, lineHeight: 1.1, marginBottom: "24px", letterSpacing: "-0.02em" }}>
          Stop getting paged at 3am for things a machine can fix.
        </h1>
        
        <p style={{ fontSize: "20px", color: "var(--text-secondary)", marginBottom: "40px", lineHeight: 1.5, maxWidth: "700px", margin: "0 auto 40px" }}>
          RunBook is an autonomous on-call agent. It investigates incidents in 45 seconds, not 45 minutes. Powered by Elastic and Gemini.
        </p>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <Link href="/signup" className="btn-primary" style={{ fontSize: "16px", padding: "14px 28px", textDecoration: "none" }}>
            Start 14-Day Free Trial <ArrowRight size={18} />
          </Link>
          <button className="btn-secondary" style={{ fontSize: "16px", padding: "14px 28px" }}>
            <PlayCircle size={18} /> Watch Demo
          </button>
        </div>
        
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "16px" }}>
          No credit card required. Flat $299/month after trial.
        </p>
      </section>

      {/* Features */}
      <section style={{ padding: "80px 20px", background: "var(--bg-secondary)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <h2 style={{ fontSize: "36px", fontWeight: 700, marginBottom: "16px" }}>Intelligence that builds trust</h2>
            <p style={{ fontSize: "16px", color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto" }}>
              We know you won't give a bot write access to production on day one. That's why we built RunBook differently.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px" }}>
            {[
              {
                title: "Shadow Mode",
                desc: "RunBook observes for 14 days, logging what it would do. You compare its predictions to your engineers' actual actions before flipping the switch.",
                icon: "👻"
              },
              {
                title: "Incident DNA",
                desc: "Every resolved incident becomes a vector fingerprint. RunBook uses this to instantly match new anomalies to past resolutions.",
                icon: "🧬"
              },
              {
                title: "Time-to-Innocent",
                desc: "The hardest part is ruling out suspects. RunBook clears innocent services in 8 seconds, narrowing the blast radius automatically.",
                icon: "⏱️"
              }
            ].map((feature) => (
              <div key={feature.title} className="glass-card" style={{ padding: "32px" }}>
                <div style={{ fontSize: "32px", marginBottom: "16px" }}>{feature.icon}</div>
                <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>{feature.title}</h3>
                <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "100px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: "36px", fontWeight: 700, marginBottom: "16px" }}>Simple, flat pricing</h2>
        <p style={{ fontSize: "16px", color: "var(--text-secondary)", marginBottom: "40px" }}>No per-user seats. No overage fees. Just one price for the whole team.</p>
        
        <div className="glass-card" style={{ maxWidth: "400px", margin: "0 auto", padding: "40px", textAlign: "left", border: "1px solid var(--accent-blue)" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-blue)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Pro Plan</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "24px" }}>
            <span style={{ fontSize: "48px", fontWeight: 800 }}>$299</span>
            <span style={{ color: "var(--text-secondary)" }}>/month</span>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
            {[
              "Unlimited incidents",
              "Unlimited runbook ingestion",
              "12-month DNA index retention",
              "Shadow mode dashboard",
              "Priority support"
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)", fontSize: "15px" }}>
                <Check size={18} style={{ color: "var(--accent-emerald)" }} /> {item}
              </div>
            ))}
          </div>
          
          <Link href="/signup" className="btn-primary" style={{ width: "100%", textDecoration: "none" }}>Start 14-Day Free Trial</Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer style={{ padding: "40px", borderTop: "1px solid var(--border)", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
        &copy; 2026 RunBook. Built for the Google Cloud Rapid Agent Hackathon.
      </footer>
    </div>
  );
}

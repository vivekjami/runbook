"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Database,
  Ghost,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  LogOut,
  BarChart2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Incident Feed", icon: LayoutDashboard },
  { href: "/dashboard/shadow", label: "Shadow Mode", icon: Ghost },
  { href: "/dashboard/dna", label: "DNA Index", icon: Database },
  { href: "/dashboard/runbooks", label: "Runbooks", icon: BookOpen },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "256px",
        height: "100vh",
        background: "rgba(3, 7, 18, 0.97)",
        backdropFilter: "blur(24px)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", marginBottom: "24px" }}>
        <ShieldAlert size={22} style={{ color: "var(--accent-blue)" }} />
        <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }} className="gradient-text">
          RunBook
        </span>
      </div>

      {/* Status indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "9px 12px",
        background: "rgba(16,185,129,0.06)",
        border: "1px solid rgba(16,185,129,0.15)",
        borderRadius: "10px",
        marginBottom: "20px",
      }}>
        <div
          className="live-dot"
          style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent-emerald)", flexShrink: 0 }}
        />
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-emerald)" }}>Agent Active</span>
        <Activity size={11} style={{ color: "var(--accent-emerald)", marginLeft: "auto" }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 12px 4px", marginBottom: "2px" }}>
          Operations
        </div>
        {NAV_ITEMS.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const isActive = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`sidebar-link ${isActive ? "active" : ""}`}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "16px 12px 4px", marginBottom: "2px" }}>
          Insights
        </div>
        {NAV_ITEMS.slice(4, 5).map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`sidebar-link ${isActive ? "active" : ""}`}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "16px 12px 4px", marginBottom: "2px" }}>
          Config
        </div>
        {NAV_ITEMS.slice(5).map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`sidebar-link ${isActive ? "active" : ""}`}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
        <div style={{
          padding: "10px 12px",
          marginBottom: "8px",
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.15)",
          borderRadius: "10px",
        }}>
          <div style={{ fontSize: "10px", color: "var(--accent-purple)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
            Shadow Mode · Trial
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            14-day trial · observing
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="sidebar-link"
          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

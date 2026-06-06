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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Incident Feed", icon: LayoutDashboard },
  { href: "/dashboard/shadow", label: "Shadow Mode", icon: Ghost },
  { href: "/dashboard/dna", label: "DNA Index", icon: Database },
  { href: "/dashboard/runbooks", label: "Runbooks", icon: BookOpen },
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
        width: "260px",
        height: "100vh",
        background: "rgba(10, 14, 26, 0.95)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          marginBottom: "32px",
        }}
      >
        <ShieldAlert size={24} style={{ color: "var(--accent-blue)" }} />
        <span
          style={{ fontSize: "20px", fontWeight: 800 }}
          className="gradient-text"
        >
          RunBook
        </span>
      </div>

      {/* Status indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: "10px",
          marginBottom: "24px",
        }}
      >
        <div
          className="live-dot"
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "var(--accent-emerald)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-emerald)" }}>
          Agent Active
        </span>
        <Activity size={12} style={{ color: "var(--accent-emerald)", marginLeft: "auto" }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${isActive ? "active" : ""}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
        <div
          style={{
            padding: "8px 12px",
            marginBottom: "8px",
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "10px",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--accent-purple)", fontWeight: 600, marginBottom: "2px" }}>
            SHADOW MODE
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            14-day trial · 11 days left
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="sidebar-link"
          style={{
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

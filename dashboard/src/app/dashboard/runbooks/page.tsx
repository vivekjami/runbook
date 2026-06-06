import { createClient } from "@/lib/supabase/server";
import { Upload, BookOpen, FileText } from "lucide-react";
import { timeAgo } from "@/lib/utils";

type RunbookRow = {
  id: string;
  name: string;
  tags: string[];
  chunk_count: number;
  status: string;
  created_at: string;
};

export default async function RunbooksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("runbooks")
    .select("*")
    .order("created_at", { ascending: false });

  const rows: RunbookRow[] = data ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 700 }}>Runbook Library</h1>
            <span className="badge badge-cleared" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <BookOpen size={12} /> {rows.length} Documents
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "600px", lineHeight: 1.6 }}>
            Upload your Markdown or PDF runbooks. RunBook chunks and embeds them into Elastic for semantic retrieval during active investigations.
          </p>
        </div>
        <button className="btn-primary">
          <Upload size={16} /> Upload Runbook
        </button>
      </div>

      {/* Drop zone */}
      <div
        className="glass-card"
        style={{
          padding: "40px 32px",
          marginBottom: "32px",
          border: "1.5px dashed var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          background: "rgba(26,31,53,0.3)",
          cursor: "pointer",
          transition: "border-color 0.2s ease",
        }}
      >
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: "var(--text-muted)" }}>
          <Upload size={22} />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>Drag and drop runbooks here</h3>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Supports .md, .txt, .pdf — max 10 MB per file
        </p>
        <button className="btn-secondary" style={{ fontSize: "13px" }}>Browse Files</button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: "16px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <div>Document</div><div>Service Tags</div><div>Chunks</div><div style={{ textAlign: "right" }}>Uploaded</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
            No runbooks uploaded yet. The agent will use these during investigations.
          </div>
        ) : rows.map((row) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: "16px", padding: "16px 24px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <FileText size={18} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
              <span style={{ fontWeight: 500, fontSize: "14px" }}>{row.name}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(row.tags ?? []).length > 0
                ? row.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: "11px", padding: "2px 8px", background: "var(--bg-secondary)", borderRadius: "4px", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      {tag}
                    </span>
                  ))
                : <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>No tags</span>}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{row.chunk_count ?? "—"} chunks</div>
            <div style={{ textAlign: "right", fontSize: "13px", color: "var(--text-muted)" }}>{timeAgo(row.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

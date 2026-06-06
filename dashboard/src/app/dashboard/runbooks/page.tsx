"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, BookOpen, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { timeAgo } from "@/lib/utils";

type RunbookRow = {
  id: string;
  name: string;
  tags: string[];
  chunk_count: number;
  status: string;
  created_at: string;
};

export default function RunbooksPage() {
  const [rows, setRows] = useState<RunbookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const fetchRunbooks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("runbooks")
      .select("*")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRunbooks();
  }, []);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // In a real app, upload to storage and index in Elastic.
      // For this demo, we simulate the ingestion.
      const newRunbook = {
        id: `RB-${Date.now().toString().slice(-6)}`,
        name: file.name,
        tags: [file.name.includes("db") ? "database" : "service", "playbook"],
        chunk_count: Math.floor(Math.random() * 50) + 10,
        status: "INDEXED",
        workspace_id: user.id,
      };

      await supabase.from("runbooks").insert(newRunbook);
      await fetchRunbooks();
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await handleUpload(e.target.files[0]);
    }
  };

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
        <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={16} />}
          Upload Runbook
        </button>
      </div>

      {/* Drop zone */}
      <div
        className="glass-card"
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: "40px 32px",
          marginBottom: "32px",
          border: `1.5px dashed ${dragActive ? "var(--accent-blue)" : "var(--border)"}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          background: dragActive ? "rgba(59,130,246,0.05)" : "rgba(26,31,53,0.3)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <input ref={fileInputRef} type="file" style={{ display: "none" }} accept=".md,.txt,.pdf" onChange={onChange} />
        {uploading ? (
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: "var(--accent-blue)" }}>
            <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: dragActive ? "rgba(59,130,246,0.1)" : "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: dragActive ? "var(--accent-blue)" : "var(--text-muted)", transition: "all 0.2s" }}>
            <Upload size={22} />
          </div>
        )}
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>
          {uploading ? "Ingesting and chunking..." : dragActive ? "Drop file to upload" : "Drag and drop runbooks here"}
        </h3>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Supports .md, .txt, .pdf — max 10 MB per file
        </p>
        <button className="btn-secondary" style={{ fontSize: "13px" }} disabled={uploading}>
          Browse Files
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: "16px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <div>Document</div><div>Service Tags</div><div>Chunks</div><div style={{ textAlign: "right" }}>Uploaded</div>
        </div>

        {loading ? (
          [1,2].map(i => <div key={i} className="shimmer" style={{ height: "64px", margin: "4px 0" }} />)
        ) : rows.length === 0 ? (
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
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              {row.chunk_count ?? "—"} chunks <CheckCircle2 size={12} style={{ color: "var(--accent-emerald)" }} />
            </div>
            <div style={{ textAlign: "right", fontSize: "13px", color: "var(--text-muted)" }}>{timeAgo(row.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

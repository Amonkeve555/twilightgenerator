import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, Trash2, RefreshCw, FileText, AlertCircle, CheckCircle2, BookOpenCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Source = {
  id: string;
  storage_path: string;
  label: string;
  filename: string;
  page_count: number | null;
  chunk_count: number;
  status: "pending" | "processing" | "ready" | "error";
  error: string | null;
  created_at: string;
};

const StatusBadge = ({ s }: { s: Source["status"] }) => {
  if (s === "ready")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-300 text-xs font-display uppercase tracking-[0.15em]">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </span>
    );
  if (s === "processing" || s === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-display uppercase tracking-[0.15em]">
        <Loader2 className="h-3 w-3 animate-spin" /> {s}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-destructive text-xs font-display uppercase tracking-[0.15em]">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  );
};

const RulesSourcesPanel = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rules_sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(`Failed to load sources: ${error.message}`);
    } else {
      setSources((data ?? []) as Source[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh while anything is processing
  useEffect(() => {
    if (!sources.some((s) => s.status === "processing" || s.status === "pending")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [sources, load]);

  const triggerIngest = async (sourceId: string) => {
    const { data, error } = await supabase.functions.invoke("ingest-rules-pdf", {
      body: { source_id: sourceId },
    });
    if (error) throw error;
    if ((data as { error?: string })?.error) {
      throw new Error((data as { error: string }).error);
    }
  };

  const onUpload = async () => {
    if (!file) {
      toast.error("Please pick a PDF first.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large (max 50 MB).");
      return;
    }
    const finalLabel = label.trim() || file.name.replace(/\.pdf$/i, "");

    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${uid}/${Date.now()}-${safe}`;

      const up = await supabase.storage.from("rules-pdfs").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw up.error;

      const { data: row, error: insErr } = await supabase
        .from("rules_sources")
        .insert({
          storage_path: path,
          label: finalLabel,
          filename: file.name,
          uploaded_by: uid,
          status: "pending",
        })
        .select()
        .single();
      if (insErr) throw insErr;

      toast.success("Uploaded. Starting ingestion…");
      setLabel("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();

      // Kick off ingest (don't await long, but show errors)
      triggerIngest(row.id).catch((e) => {
        toast.error(`Ingestion failed: ${e instanceof Error ? e.message : String(e)}`);
        load();
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onReingest = async (s: Source) => {
    setBusyId(s.id);
    try {
      await supabase.from("rules_sources").update({ status: "pending", error: null }).eq("id", s.id);
      await load();
      await triggerIngest(s.id);
      toast.success(`Re-ingested ${s.label}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-ingest failed");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (s: Source) => {
    if (!confirm(`Delete "${s.label}" and all its embedded chunks?`)) return;
    setBusyId(s.id);
    try {
      // Chunks cascade-delete via FK
      const { error: dErr } = await supabase.from("rules_sources").delete().eq("id", s.id);
      if (dErr) throw dErr;
      await supabase.storage.from("rules-pdfs").remove([s.storage_path]);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass imperial-border rounded p-5 space-y-3"
      >
        <h3 className="font-display text-sm uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <Upload className="h-4 w-4" /> Upload Official Rules PDF
        </h3>
        <p className="font-body text-sm text-muted-foreground">
          The Rules Assistant will cite passages from these PDFs. Living Rules Reference, Prophecy of Kings, and Codex packs are all supported. Scanned (image-only) PDFs are not — text must be selectable.
        </p>
        <div className="grid sm:grid-cols-[1fr_auto] gap-3">
          <Input
            placeholder='Label (e.g. "Living Rules Reference v3")'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="glass imperial-border"
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-body text-sm text-muted-foreground file:mr-3 file:px-3 file:py-2 file:rounded file:border file:border-border file:bg-secondary file:text-secondary-foreground file:font-display file:text-xs file:uppercase file:tracking-[0.15em] file:cursor-pointer"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={onUpload}
            disabled={!file || uploading}
            className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload & Ingest
          </Button>
        </div>
      </motion.div>

      {/* Sources list */}
      <div className="glass imperial-border rounded">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-[0.2em] text-primary flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4" /> Rule Sources ({sources.length})
          </h3>
          <Button variant="ghost" size="sm" onClick={load} className="font-display text-xs uppercase tracking-[0.15em]">
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
        {loading ? (
          <p className="font-body text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground text-center py-6">
            No PDFs uploaded yet. The Rules Assistant will fall back to general TI4 knowledge until you add one.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {sources.map((s) => (
              <div key={s.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-body text-base text-foreground font-semibold truncate">{s.label}</span>
                    <StatusBadge s={s.status} />
                  </div>
                  <div className="font-body text-xs text-muted-foreground mt-1 truncate">
                    {s.filename}
                    {s.page_count !== null && ` · ${s.page_count} pages`}
                    {s.chunk_count > 0 && ` · ${s.chunk_count} chunks`}
                    {` · uploaded ${new Date(s.created_at).toLocaleDateString()}`}
                  </div>
                  {s.error && (
                    <p className="font-body text-xs text-destructive mt-1 break-words">{s.error}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === s.id || s.status === "processing"}
                    onClick={() => onReingest(s)}
                    className="font-display text-xs uppercase tracking-[0.15em]"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" /> Re-ingest
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === s.id}
                    onClick={() => onDelete(s)}
                    className="font-display text-xs uppercase tracking-[0.15em] text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RulesSourcesPanel;

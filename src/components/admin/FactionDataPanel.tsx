import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Check, X, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { TI4_FACTIONS, POK_FACTIONS, type Faction } from "@/data/factions";

type ProposalRow = {
  id: string;
  status: "pending" | "applied" | "discarded";
  notes: string | null;
  proposal: {
    faction_name: string;
    data: Partial<Faction>;
    citations: Array<{ n: number; label: string; page_start: number | null; page_end: number | null; excerpt: string }>;
  };
  created_at: string;
};

type OverrideRow = {
  id: string;
  faction_name: string;
  data: Partial<Faction>;
  citations: unknown;
  updated_at: string;
};

const ALL_FACTIONS: Faction[] = [...TI4_FACTIONS, ...POK_FACTIONS];

const FactionDataPanel = () => {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, oRes] = await Promise.all([
      supabase.from("faction_data_proposals").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("faction_data_overrides").select("*"),
    ]);
    if (pRes.error) toast.error(`Proposals: ${pRes.error.message}`);
    else setProposals((pRes.data ?? []) as unknown as ProposalRow[]);
    if (oRes.error) toast.error(`Overrides: ${oRes.error.message}`);
    else {
      const map: Record<string, OverrideRow> = {};
      for (const r of (oRes.data ?? []) as OverrideRow[]) map[r.faction_name] = r;
      setOverrides(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredFactions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ALL_FACTIONS;
    return ALL_FACTIONS.filter((f) => f.name.toLowerCase().includes(q) || f.shortName.toLowerCase().includes(q));
  }, [filter]);

  const generate = async (factionName: string) => {
    const current = ALL_FACTIONS.find((f) => f.name === factionName);
    setGenerating(factionName);
    try {
      const { data, error } = await supabase.functions.invoke("generate-faction-data", {
        body: { faction_name: factionName, current_data: current },
      });
      if (error) throw error;
      const err = (data as { error?: string })?.error;
      if (err) throw new Error(err);
      toast.success(`Generated proposal for ${factionName}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const apply = async (p: ProposalRow) => {
    setBusyId(p.id);
    try {
      const { error: upErr } = await supabase.from("faction_data_overrides").upsert(
        [{
          faction_name: p.proposal.faction_name,
          data: p.proposal.data as never,
          citations: p.proposal.citations as never,
          applied_from_proposal: p.id,
        }],
        { onConflict: "faction_name" },
      );
      if (upErr) throw upErr;
      const { error: stErr } = await supabase
        .from("faction_data_proposals")
        .update({ status: "applied" })
        .eq("id", p.id);
      if (stErr) throw stErr;
      toast.success(`Applied override for ${p.proposal.faction_name}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (p: ProposalRow) => {
    setBusyId(p.id);
    try {
      const { error } = await supabase
        .from("faction_data_proposals")
        .update({ status: "discarded" })
        .eq("id", p.id);
      if (error) throw error;
      toast.success("Discarded");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discard failed");
    } finally {
      setBusyId(null);
    }
  };

  const removeOverride = async (factionName: string) => {
    if (!confirm(`Remove the database override for ${factionName}? The Faction Guide will revert to the built-in data.`)) return;
    try {
      const { error } = await supabase.from("faction_data_overrides").delete().eq("faction_name", factionName);
      if (error) throw error;
      toast.success("Override removed");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass imperial-border rounded p-5 space-y-3"
      >
        <h3 className="font-display text-sm uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Generate Faction Data From Ingested PDFs
        </h3>
        <p className="font-body text-sm text-muted-foreground">
          Select a faction to extract its abilities, tech, agent, commander, and hero text from the ingested rule PDFs. Proposals appear below for you to review before they replace the built-in data in the Faction Guide.
        </p>
        <Input
          placeholder="Filter factions…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="glass imperial-border"
        />
        <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {filteredFactions.map((f) => {
            const hasOverride = !!overrides[f.name];
            const isPending = proposals.some((p) => p.proposal.faction_name === f.name);
            return (
              <div key={f.name} className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-background/30">
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground truncate">{f.name}</p>
                  <p className="font-body text-[10px] text-muted-foreground">
                    {hasOverride ? "Override active" : "Built-in"}{isPending ? " · pending proposal" : ""}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generating === f.name}
                    onClick={() => generate(f.name)}
                    className="font-display text-[10px] uppercase tracking-[0.1em]"
                  >
                    {generating === f.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  </Button>
                  {hasOverride && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeOverride(f.name)}
                      className="font-display text-[10px] uppercase tracking-[0.1em] text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="glass imperial-border rounded">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-[0.2em] text-primary">
            Pending Proposals ({proposals.length})
          </h3>
          <Button variant="ghost" size="sm" onClick={load} className="font-display text-xs uppercase tracking-[0.15em]">
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>

        {loading ? (
          <p className="font-body text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : proposals.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground text-center py-6">
            No pending proposals. Generate one above.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {proposals.map((p) => {
              const current = ALL_FACTIONS.find((f) => f.name === p.proposal.faction_name);
              const isOpen = expanded === p.id;
              return (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-body text-base font-semibold text-foreground truncate">
                        {p.proposal.faction_name}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()} · {p.proposal.citations?.length ?? 0} citations
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpanded(isOpen ? null : p.id)}
                        className="font-display text-xs uppercase tracking-[0.15em]"
                      >
                        {isOpen ? "Hide" : "Review"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyId === p.id}
                        onClick={() => apply(p)}
                        className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Check className="mr-1 h-3 w-3" /> Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === p.id}
                        onClick={() => discard(p)}
                        className="font-display text-xs uppercase tracking-[0.15em] text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="grid md:grid-cols-2 gap-3 mt-2">
                      <div className="space-y-1">
                        <p className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Current</p>
                        <pre className="text-[11px] bg-background/40 border border-border rounded p-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono">
                          {JSON.stringify(current, null, 2)}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <p className="font-display text-[10px] uppercase tracking-[0.15em] text-primary">Proposed</p>
                        <pre className="text-[11px] bg-primary/5 border border-primary/30 rounded p-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono">
                          {JSON.stringify(p.proposal.data, null, 2)}
                        </pre>
                      </div>
                      <div className="md:col-span-2">
                        <p className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">Citations</p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {p.proposal.citations?.map((c) => (
                            <div key={c.n} className="text-xs border border-border rounded p-2 bg-background/30">
                              <span className="font-semibold text-primary">[{c.n}] {c.label}</span>
                              {c.page_start ? <span className="text-muted-foreground"> · p. {c.page_start}{c.page_end && c.page_end !== c.page_start ? `–${c.page_end}` : ""}</span> : null}
                              <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{c.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {Object.keys(overrides).length > 0 && (
        <div className="glass imperial-border rounded">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display text-sm uppercase tracking-[0.2em] text-primary">
              Active Overrides ({Object.keys(overrides).length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {Object.values(overrides).map((o) => (
              <div key={o.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground truncate">{o.faction_name}</p>
                  <p className="font-body text-[10px] text-muted-foreground">
                    Updated {new Date(o.updated_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeOverride(o.faction_name)}
                  className="font-display text-xs uppercase tracking-[0.15em] text-destructive"
                >
                  <X className="mr-1 h-3 w-3" /> Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FactionDataPanel;

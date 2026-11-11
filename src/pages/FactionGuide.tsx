import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, ArrowLeft, Swords, Shield, Cpu, Package, Lightbulb, FileText, Zap, User, Crown, Star } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TI4_FACTIONS, POK_FACTIONS, GENERIC_TECH, UNIT_REFERENCE, type Faction, type FactionTech } from "@/data/factions";
import { useMergedFactions } from "@/hooks/useMergedFactions";
import TechTree from "@/components/TechTree";

const TECH_TYPE_COLORS: Record<string, string> = {
  unit: "180 60% 50%",
  green: "120 60% 40%",
  blue: "210 70% 55%",
  yellow: "45 90% 50%",
  red: "0 70% 50%",
};

const TECH_TYPE_LABELS: Record<string, string> = {
  unit: "Unit Upgrade",
  green: "Biotic",
  blue: "Propulsion",
  yellow: "Cybernetic",
  red: "Warfare",
};

const FactionDetail = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex gap-3 items-start">
    <div className="text-primary mt-0.5 flex-shrink-0">{icon}</div>
    <div>
      <p className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground mb-1">{label}</p>
      <div className="text-base text-foreground font-body">{children}</div>
    </div>
  </div>
);

const TechChip = ({ tech, onClick }: { tech: FactionTech; onClick: () => void }) => {
  const color = TECH_TYPE_COLORS[tech.type] || "0 0% 50%";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="px-2.5 py-1 rounded text-xs font-body font-medium transition-all duration-200 border cursor-pointer hover:scale-105 active:scale-95"
      style={{
        borderColor: `hsl(${color} / 0.4)`,
        color: `hsl(${color})`,
        background: `hsl(${color} / 0.1)`,
      }}
    >
      {tech.name}
    </button>
  );
};

type DetailDialogData = 
  | { kind: "tech"; tech: FactionTech; faction: Faction }
  | { kind: "generic_tech"; name: string; type: string; description: string }
  | { kind: "unit"; name: string; description: string };

const parseUnitsFromString = (units: string): string[] => {
  return units.split(",").map((s) => {
    const trimmed = s.trim();
    const match = trimmed.match(/^\d+\s+(.+)$/);
    return match ? match[1].replace(/s$/, "") : trimmed;
  }).filter((v, i, a) => a.indexOf(v) === i);
};

const FactionGuideCard = ({ faction, onDetailClick }: { faction: Faction; onDetailClick: (data: DetailDialogData) => void }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className="glass imperial-border rounded overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left cursor-pointer hover:bg-primary/5 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-sm border border-border flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${faction.color}) 0%, hsl(${faction.color} / 0.4) 100%)`,
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg uppercase tracking-[0.1em] text-primary truncate">
            {faction.name}
          </p>
          {faction.commodities !== undefined && (
            <p className="text-sm text-muted-foreground font-body">
              Commodities: {faction.commodities}
            </p>
          )}
        </div>
        <div className="text-muted-foreground flex-shrink-0">
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
              {faction.abilities && faction.abilities.length > 0 && (
                <FactionDetail icon={<Swords className="h-4 w-4" />} label="Abilities">
                  <ul className="space-y-2">
                    {faction.abilities.map((a, i) => (
                      <li key={i} className="text-sm">{a}</li>
                    ))}
                  </ul>
                </FactionDetail>
              )}

              {faction.factionTech && faction.factionTech.length > 0 && (
                <FactionDetail icon={<Zap className="h-4 w-4" />} label="Faction Technologies">
                  <div className="flex flex-wrap gap-2">
                    {faction.factionTech.map((t) => (
                      <TechChip key={t.name} tech={t} onClick={() => onDetailClick({ kind: "tech", tech: t, faction })} />
                    ))}
                  </div>
                </FactionDetail>
              )}

              {faction.agent && (
                <FactionDetail icon={<User className="h-4 w-4" />} label="Agent">
                  <p className="text-sm"><span className="font-semibold text-primary">{faction.agent.name}</span> — {faction.agent.description}</p>
                </FactionDetail>
              )}

              {faction.commander && (
                <FactionDetail icon={<Crown className="h-4 w-4" />} label="Commander">
                  <p className="text-sm"><span className="font-semibold text-primary">{faction.commander.name}</span> — {faction.commander.description}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">Unlock: {faction.commander.unlock}</p>
                </FactionDetail>
              )}

              {faction.hero && (
                <FactionDetail icon={<Star className="h-4 w-4" />} label="Hero">
                  <p className="text-sm"><span className="font-semibold text-primary">{faction.hero.name}</span> — {faction.hero.description}</p>
                </FactionDetail>
              )}

              {faction.promissoryNote && (
                <FactionDetail icon={<FileText className="h-4 w-4" />} label="Promissory Note">
                  <p className="text-sm">{faction.promissoryNote}</p>
                </FactionDetail>
              )}

              {faction.startingUnits && (
                <FactionDetail icon={<Shield className="h-4 w-4" />} label="Starting Units">
                  <div className="flex flex-wrap gap-2">
                    {parseUnitsFromString(faction.startingUnits).map((unitName) => {
                      const refKey = Object.keys(UNIT_REFERENCE).find((k) => unitName.toLowerCase().includes(k.toLowerCase()));
                      if (refKey) {
                        return (
                          <button
                            key={unitName}
                            onClick={(e) => { e.stopPropagation(); onDetailClick({ kind: "unit", name: refKey, description: UNIT_REFERENCE[refKey] }); }}
                            className="px-2.5 py-1 rounded text-xs font-body font-medium transition-all duration-200 border cursor-pointer hover:scale-105 active:scale-95 border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/40 bg-muted/20"
                          >
                            {unitName}
                          </button>
                        );
                      }
                      return <span key={unitName} className="px-2.5 py-1 rounded text-xs font-body text-muted-foreground">{unitName}</span>;
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{faction.startingUnits}</p>
                </FactionDetail>
              )}

              {faction.startingTech && faction.startingTech.length > 0 && (
                <FactionDetail icon={<Cpu className="h-4 w-4" />} label="Starting Tech">
                  <div className="flex flex-wrap gap-2">
                    {faction.startingTech.map((t) => {
                      const genTech = GENERIC_TECH[t];
                      if (genTech) {
                        const color = TECH_TYPE_COLORS[genTech.type] || "0 0% 50%";
                        return (
                          <button
                            key={t}
                            onClick={(e) => { e.stopPropagation(); onDetailClick({ kind: "generic_tech", name: t, type: genTech.type, description: genTech.description }); }}
                            className="px-2.5 py-1 rounded text-xs font-body font-medium transition-all duration-200 border cursor-pointer hover:scale-105 active:scale-95"
                            style={{
                              borderColor: `hsl(${color} / 0.4)`,
                              color: `hsl(${color})`,
                              background: `hsl(${color} / 0.1)`,
                            }}
                          >
                            {t}
                          </button>
                        );
                      }
                      return <span key={t} className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/20">{t}</span>;
                    })}
                  </div>
                </FactionDetail>
              )}
              {faction.startingTech && faction.startingTech.length === 0 && (
                <FactionDetail icon={<Cpu className="h-4 w-4" />} label="Starting Tech">
                  <p className="text-sm text-muted-foreground italic">None</p>
                </FactionDetail>
              )}

              {faction.commodities !== undefined && (
                <FactionDetail icon={<Package className="h-4 w-4" />} label="Commodities">
                  <p className="text-sm">{faction.commodities}</p>
                </FactionDetail>
              )}

              {faction.strategyTip && (
                <FactionDetail icon={<Lightbulb className="h-4 w-4" />} label="Strategy Tip">
                  <p className="text-sm italic text-muted-foreground">{faction.strategyTip}</p>
                </FactionDetail>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FactionGuide = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [showPok, setShowPok] = useState(true);
  const [detailDialog, setDetailDialog] = useState<DetailDialogData | null>(null);

  const { ti4: mergedTi4, pok: mergedPok } = useMergedFactions();

  const factions = useMemo(() => {
    const all = [...mergedTi4, ...(showPok ? mergedPok : [])];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.shortName.toLowerCase().includes(q) ||
        f.abilities?.some((a) => a.toLowerCase().includes(q)) ||
        f.factionTech?.some((t) => t.name.toLowerCase().includes(q)) ||
        f.agent?.name.toLowerCase().includes(q) ||
        f.commander?.name.toLowerCase().includes(q) ||
        f.hero?.name.toLowerCase().includes(q) ||
        f.strategyTip?.toLowerCase().includes(q)
    );
  }, [search, showPok, mergedTi4, mergedPok]);

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Faction Guide
          </h1>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">
            {factions.length} factions
          </p>
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        <div className="glass imperial-border rounded p-4 mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search factions, abilities, technologies, agents..."
              className="pl-10 bg-background/50 border-border font-body"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPok}
                onChange={(e) => setShowPok(e.target.checked)}
                className="rounded border-border"
              />
              <span className="font-body text-sm text-muted-foreground">Include Prophecy of Kings</span>
            </label>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <TechTree />
        </div>

        <div className="space-y-3">
          {factions.map((faction) => (
            <FactionGuideCard
              key={faction.name}
              faction={faction}
              onDetailClick={setDetailDialog}
            />
          ))}
          {factions.length === 0 && (
            <p className="text-center text-muted-foreground font-body text-base py-8">No factions match your search.</p>
          )}
        </div>

        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="font-display text-sm uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="glass imperial-border max-w-md">
          {detailDialog && (() => {
            if (detailDialog.kind === "tech") {
              const { tech, faction } = detailDialog;
              const color = TECH_TYPE_COLORS[tech.type] || "0 0% 50%";
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-display uppercase tracking-[0.15em] border"
                        style={{
                          borderColor: `hsl(${color} / 0.4)`,
                          color: `hsl(${color})`,
                          background: `hsl(${color} / 0.15)`,
                        }}
                      >
                        {TECH_TYPE_LABELS[tech.type] || tech.type}
                      </span>
                      <span className="text-xs text-muted-foreground font-body">{faction.shortName}</span>
                    </div>
                    <DialogTitle className="font-display text-xl uppercase tracking-[0.1em]" style={{ color: `hsl(${color})` }}>
                      {tech.name}
                    </DialogTitle>
                    {tech.prerequisites && (
                      <DialogDescription className="font-body text-xs text-muted-foreground">
                        Prerequisites: {tech.prerequisites.split("").map((c, i) => {
                          const preReqColor = TECH_TYPE_COLORS[
                            c === "G" ? "green" : c === "B" ? "blue" : c === "Y" ? "yellow" : c === "R" ? "red" : "unit"
                          ];
                          return (
                            <span
                              key={i}
                              className="inline-block w-4 h-4 rounded-full mx-0.5 align-middle border"
                              style={{ background: `hsl(${preReqColor} / 0.3)`, borderColor: `hsl(${preReqColor} / 0.6)` }}
                            />
                          );
                        })}
                      </DialogDescription>
                    )}
                  </DialogHeader>
                  <div className="mt-2">
                    <p className="text-sm font-body text-foreground leading-relaxed">{tech.description}</p>
                  </div>
                </>
              );
            }

            if (detailDialog.kind === "generic_tech") {
              const { name, type, description } = detailDialog;
              const color = TECH_TYPE_COLORS[type] || "0 0% 50%";
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-display uppercase tracking-[0.15em] border"
                        style={{
                          borderColor: `hsl(${color} / 0.4)`,
                          color: `hsl(${color})`,
                          background: `hsl(${color} / 0.15)`,
                        }}
                      >
                        {TECH_TYPE_LABELS[type] || type}
                      </span>
                      <span className="text-xs text-muted-foreground font-body">Starting Tech</span>
                    </div>
                    <DialogTitle className="font-display text-xl uppercase tracking-[0.1em]" style={{ color: `hsl(${color})` }}>
                      {name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Technology details</DialogDescription>
                  </DialogHeader>
                  <div className="mt-2">
                    <p className="text-sm font-body text-foreground leading-relaxed">{description}</p>
                  </div>
                </>
              );
            }

            if (detailDialog.kind === "unit") {
              const { name, description } = detailDialog;
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-display uppercase tracking-[0.15em] border border-muted-foreground/40 text-muted-foreground bg-muted/20">
                        Unit
                      </span>
                    </div>
                    <DialogTitle className="font-display text-xl uppercase tracking-[0.1em] text-foreground">
                      {name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Unit details</DialogDescription>
                  </DialogHeader>
                  <div className="mt-2">
                    <p className="text-sm font-body text-foreground leading-relaxed">{description}</p>
                  </div>
                </>
              );
            }

            return null;
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FactionGuide;

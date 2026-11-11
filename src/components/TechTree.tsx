import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TECH_TREE, UNIT_UPGRADES, type TechTreeNode } from "@/data/techTree";

const TECH_TYPE_COLORS: Record<string, string> = {
  green: "120 60% 40%",
  blue: "210 70% 55%",
  yellow: "45 90% 50%",
  red: "0 70% 50%",
};

const TECH_TYPE_LABELS: Record<string, string> = {
  green: "Biotic",
  blue: "Propulsion",
  yellow: "Cybernetic",
  red: "Warfare",
};

const PREREQ_MAP: Record<string, string> = {
  G: "green",
  B: "blue",
  Y: "yellow",
  R: "red",
};

const TechNode = ({ tech, onClick }: { tech: TechTreeNode; onClick: () => void }) => {
  const color = TECH_TYPE_COLORS[tech.type];
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded border transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
      style={{
        borderColor: `hsl(${color} / 0.3)`,
        background: `hsl(${color} / 0.08)`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-body font-medium" style={{ color: `hsl(${color})` }}>
          {tech.name}
        </span>
        {tech.prerequisites && (
          <div className="flex gap-0.5 flex-shrink-0">
            {tech.prerequisites.split("").map((c, i) => {
              const preColor = TECH_TYPE_COLORS[PREREQ_MAP[c] || "green"];
              return (
                <span
                  key={i}
                  className="inline-block w-3 h-3 rounded-full border"
                  style={{ background: `hsl(${preColor} / 0.4)`, borderColor: `hsl(${preColor} / 0.7)` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
};

const TechColumn = ({
  type,
  techs,
  onSelect,
}: {
  type: string;
  techs: TechTreeNode[];
  onSelect: (tech: TechTreeNode) => void;
}) => {
  const color = TECH_TYPE_COLORS[type];
  const tier1 = techs.filter((t) => t.tier === 1);
  const tier2 = techs.filter((t) => t.tier === 2);
  const tier3 = techs.filter((t) => t.tier === 3);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-center py-1.5 rounded text-xs font-display uppercase tracking-[0.15em] border"
        style={{
          borderColor: `hsl(${color} / 0.4)`,
          color: `hsl(${color})`,
          background: `hsl(${color} / 0.15)`,
        }}
      >
        {TECH_TYPE_LABELS[type]}
      </div>

      {[tier1, tier2, tier3].map((tierTechs, tierIdx) => (
        <div key={tierIdx} className="space-y-1.5">
          {tierTechs.map((tech) => (
            <TechNode key={tech.name} tech={tech} onClick={() => onSelect(tech)} />
          ))}
          {tierIdx < 2 && (
            <div className="flex justify-center py-0.5">
              <div className="w-px h-3" style={{ background: `hsl(${color} / 0.3)` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const TechTree = () => {
  const [expanded, setExpanded] = useState(false);
  const [selectedTech, setSelectedTech] = useState<TechTreeNode | null>(null);
  const [showUnits, setShowUnits] = useState(false);

  const types = ["green", "blue", "yellow", "red"] as const;

  return (
    <>
      <motion.div layout className="glass imperial-border rounded overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 flex items-center gap-4 text-left cursor-pointer hover:bg-primary/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-sm border border-border flex-shrink-0 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg uppercase tracking-[0.1em] text-primary">
              Technology Tree
            </p>
            <p className="text-sm text-muted-foreground font-body">
              All generic & unit upgrade technologies
            </p>
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
              <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                {/* Tab toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowUnits(false)}
                    className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-[0.1em] border transition-colors ${
                      !showUnits
                        ? "border-primary/40 text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Tech Tree
                  </button>
                  <button
                    onClick={() => setShowUnits(true)}
                    className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-[0.1em] border transition-colors ${
                      showUnits
                        ? "border-primary/40 text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Unit Upgrades
                  </button>
                </div>

                {!showUnits ? (
                  <div className="grid grid-cols-2 gap-3">
                    {types.map((type) => (
                      <TechColumn
                        key={type}
                        type={type}
                        techs={TECH_TREE.filter((t) => t.type === type)}
                        onSelect={setSelectedTech}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {UNIT_UPGRADES.map((tech) => (
                      <TechNode key={tech.name} tech={tech} onClick={() => setSelectedTech(tech)} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Detail dialog */}
      <Dialog open={!!selectedTech} onOpenChange={() => setSelectedTech(null)}>
        <DialogContent className="glass imperial-border max-w-md">
          {selectedTech && (() => {
            const color = TECH_TYPE_COLORS[selectedTech.type];
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
                      {TECH_TYPE_LABELS[selectedTech.type]}
                    </span>
                    <span className="text-xs text-muted-foreground font-body">Tier {selectedTech.tier}</span>
                  </div>
                  <DialogTitle className="font-display text-xl uppercase tracking-[0.1em]" style={{ color: `hsl(${color})` }}>
                    {selectedTech.name}
                  </DialogTitle>
                  {selectedTech.prerequisites && (
                    <DialogDescription className="font-body text-xs text-muted-foreground">
                      Prerequisites: {selectedTech.prerequisites.split("").map((c, i) => {
                        const preColor = TECH_TYPE_COLORS[PREREQ_MAP[c] || "green"];
                        return (
                          <span
                            key={i}
                            className="inline-block w-4 h-4 rounded-full mx-0.5 align-middle border"
                            style={{ background: `hsl(${preColor} / 0.3)`, borderColor: `hsl(${preColor} / 0.6)` }}
                          />
                        );
                      })}
                    </DialogDescription>
                  )}
                  {!selectedTech.prerequisites && (
                    <DialogDescription className="sr-only">Technology details</DialogDescription>
                  )}
                </DialogHeader>
                <div className="mt-2">
                  <p className="text-sm font-body text-foreground leading-relaxed">{selectedTech.description}</p>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TechTree;

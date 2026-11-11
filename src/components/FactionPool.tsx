import { TI4_FACTIONS, POK_FACTIONS, type Faction } from "@/data/factions";

interface FactionPoolProps {
  includePok: boolean;
  onIncludePokChange: (v: boolean) => void;
  excludedFactions: Set<string>;
  onToggleFaction: (name: string) => void;
}

const FactionPool = ({
  includePok,
  onIncludePokChange,
  excludedFactions,
  onToggleFaction,
}: FactionPoolProps) => {
  const FactionChip = ({ faction }: { faction: Faction }) => {
    const excluded = excludedFactions.has(faction.name);
    return (
      <button
        onClick={() => onToggleFaction(faction.name)}
        className={`px-3 py-1.5 rounded text-base font-body font-medium transition-all duration-200 border ${
          excluded
            ? "opacity-25 border-border bg-muted text-muted-foreground line-through"
            : "border-border bg-secondary text-secondary-foreground hover:opacity-80"
        }`}
        style={
          !excluded
            ? { borderColor: `hsl(${faction.color} / 0.35)`, color: `hsl(${faction.color})` }
            : undefined
        }
      >
        {faction.name}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
          Faction Pool
        </h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-muted-foreground font-body">
            Prophecy of Kings
          </span>
          <button
            onClick={() => onIncludePokChange(!includePok)}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              includePok ? "bg-primary" : "bg-muted"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-transform ${
                includePok ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {TI4_FACTIONS.map((f) => (
          <FactionChip key={f.name} faction={f} />
        ))}
        {includePok &&
          POK_FACTIONS.map((f) => (
            <FactionChip key={f.name} faction={f} />
          ))}
      </div>
      <p className="text-xs text-muted-foreground font-body italic">
        Click to exclude or include factions
      </p>
    </div>
  );
};

export default FactionPool;

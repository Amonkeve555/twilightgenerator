import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Faction } from "@/data/factions";

interface FactionCardProps {
  playerName: string;
  faction: Faction;
  index: number;
}

const FactionCard = ({ playerName, faction, index }: FactionCardProps) => {
  const navigate = useNavigate();

  const openGuide = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/factions?search=${encodeURIComponent(faction.name)}`);
  };

  return (
    <motion.div
      // Card "flips" into view like a revealed token, with a flash of the faction colour
      initial={{ opacity: 0, rotateY: -95, scale: 0.85 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ delay: index * 0.18, type: "spring", stiffness: 110, damping: 14 }}
      style={{ transformPerspective: 900, boxShadow: `0 0 28px -10px hsl(${faction.color} / 0.55)` }}
      className="glass imperial-border rounded p-5 relative overflow-hidden group sheen card-lift"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0.7 }}
        animate={{ opacity: 0 }}
        transition={{ delay: index * 0.18 + 0.25, duration: 0.9, ease: "easeOut" }}
        style={{ background: `radial-gradient(circle at 30% 50%, hsl(${faction.color} / 0.55), transparent 70%)` }}
      />
      {/* Top accent bar with faction color */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] faction-bar"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(${faction.color}), transparent)`,
          backgroundSize: "200% 100%",
        }}
      />

      {/* Corner accents */}
      <div
        className="absolute top-0 left-0 w-4 h-4 border-t border-l opacity-40"
        style={{ borderColor: `hsl(${faction.color})` }}
      />
      <div
        className="absolute top-0 right-0 w-4 h-4 border-t border-r opacity-40"
        style={{ borderColor: `hsl(${faction.color})` }}
      />

      <div className="relative z-10">
        <p className="text-muted-foreground text-base font-body uppercase tracking-[0.15em] mb-1">
          {playerName}
        </p>
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-display text-lg sm:text-xl font-bold tracking-wide leading-tight break-words flex-1 min-w-0"
            style={{
              color: `hsl(${faction.color})`,
              textShadow: `0 0 12px hsl(${faction.color} / 0.4)`,
            }}
          >
            {faction.name}
          </h3>
          <button
            onClick={openGuide}
            className="p-1.5 rounded hover:bg-secondary/80 transition-colors opacity-60 hover:opacity-100 flex-shrink-0"
            title="View faction details"
          >
            <Info className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 rounded"
        style={{ backgroundColor: `hsl(${faction.color})` }}
      />
    </motion.div>
  );
};

export default FactionCard;

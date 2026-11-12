import { randomId } from "@/lib/uuid";
import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Faction } from "@/data/factions";
import type { PlayerResult, GameRecord } from "@/types/gameHistory";

interface ResultsEntryProps {
  assignments: { player: string; faction: Faction }[];
  onSave: (game: GameRecord) => void;
  onSkip: () => void;
}

const ResultsEntry = ({ assignments, onSave, onSkip }: ResultsEntryProps) => {
  const [results, setResults] = useState<{ vp: string; rank: string }[]>(
    assignments.map((_, i) => ({ vp: "", rank: String(i + 1) }))
  );

  const updateResult = (index: number, field: "vp" | "rank", value: string) => {
    setResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    const players: PlayerResult[] = assignments.map((a, i) => ({
      player: a.player,
      faction: a.faction,
      vp: parseInt(results[i].vp) || 0,
      rank: parseInt(results[i].rank) || i + 1,
    }));

    const game: GameRecord = {
      id: randomId(),
      date: new Date().toISOString(),
      players,
    };

    onSave(game);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
          Record Results
        </h3>
      </div>

      <div className="glass imperial-border rounded p-4 space-y-3">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-muted-foreground text-xs font-body uppercase tracking-widest px-1">
          <span>Player / Faction</span>
          <span className="w-16 text-center">VP</span>
          <span className="w-16 text-center">Rank</span>
          <span className="w-8" />
        </div>
        <div className="imperial-divider" />

        {assignments.map((a, i) => (
          <div
            key={a.faction.name}
            className="grid grid-cols-[1fr_auto_auto] gap-2 items-center"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: `hsl(${a.faction.color})` }}
              />
              <div className="min-w-0">
                <p className="font-display text-xs text-primary truncate">
                  {a.player}
                </p>
                <p
                  className="text-[10px] font-body truncate"
                  style={{ color: `hsl(${a.faction.color})` }}
                >
                  {a.faction.shortName}
                </p>
              </div>
            </div>
            <Input
              type="number"
              min={0}
              max={20}
              value={results[i].vp}
              onChange={(e) => updateResult(i, "vp", e.target.value)}
              placeholder="VP"
              className="w-16 h-8 text-center bg-input border-border font-body text-sm text-foreground focus:border-primary/40 rounded"
            />
            <Input
              type="number"
              min={1}
              max={assignments.length}
              value={results[i].rank}
              onChange={(e) => updateResult(i, "rank", e.target.value)}
              placeholder="#"
              className="w-16 h-8 text-center bg-input border-border font-body text-sm text-foreground focus:border-primary/40 rounded"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onSkip}
          className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
        >
          Skip
        </Button>
        <Button
          onClick={handleSave}
          size="sm"
          className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
        >
          <Save className="mr-2 h-3 w-3" />
          Save Game
        </Button>
      </div>
    </motion.div>
  );
};

export default ResultsEntry;

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Info, Sparkles } from "lucide-react";
import type { Faction } from "@/data/factions";
import { cn } from "@/lib/utils";
import FactionDetailDialog from "@/components/FactionDetailDialog";
import { Button } from "@/components/ui/button";

interface FactionPickerProps {
  factions: Faction[];
  takenFactions: Map<string, string>; // faction name -> player name
  forbiddenFaction?: string | null; // user's last played faction (if no-repeat)
  forbiddenRelaxed?: boolean; // if true, forbidden is shown but still clickable
  onSelect: (faction: Faction) => void;
  disabled?: boolean;
  pendingFaction?: string | null; // name of faction currently being claimed
  showRandomPickButton?: boolean;
  randomPickLabel?: string;
}

const FactionPicker = ({
  factions,
  takenFactions,
  forbiddenFaction,
  forbiddenRelaxed,
  onSelect,
  disabled,
  pendingFaction,
  showRandomPickButton,
  randomPickLabel = "Davidovo tlačítko",
}: FactionPickerProps) => {
  const [preview, setPreview] = useState<Faction | null>(null);
  const isClaiming = !!pendingFaction;

  const handleConfirm = (faction: Faction) => {
    setPreview(null);
    onSelect(faction);
  };

  const eligibleForRandom = factions.filter((f) => {
    if (takenFactions.has(f.name)) return false;
    if (forbiddenFaction === f.name && !forbiddenRelaxed) return false;
    return true;
  });

  const handleRandomPick = () => {
    if (eligibleForRandom.length === 0) return;
    const choice = eligibleForRandom[Math.floor(Math.random() * eligibleForRandom.length)];
    onSelect(choice);
  };

  return (
    <>
      {showRandomPickButton && (
        <div className="flex flex-col items-center gap-2 mb-4">
          <Button
            onClick={handleRandomPick}
            disabled={disabled || isClaiming || eligibleForRandom.length === 0}
            size="lg"
            className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-8 py-5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {randomPickLabel}
          </Button>
          <p className="font-body text-xs text-muted-foreground text-center">
            Picks a random faction for you from the available pool.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {factions.map((f) => {
          const takenBy = takenFactions.get(f.name);
          const isTaken = !!takenBy;
          const isForbidden = forbiddenFaction === f.name && !forbiddenRelaxed;
          const isPending = pendingFaction === f.name;
          const isDisabled = disabled || isClaiming || isTaken || isForbidden;

          return (
            <motion.button
              key={f.name}
              whileHover={!isDisabled ? { scale: 1.02 } : undefined}
              whileTap={!isDisabled ? { scale: 0.98 } : undefined}
              onClick={() => !isDisabled && setPreview(f)}
              disabled={isDisabled}
              aria-busy={isPending}
              className={cn(
                "relative glass imperial-border rounded p-4 text-left transition-all",
                isPending
                  ? "border-primary/80 ring-2 ring-primary/40 cursor-wait"
                  : isDisabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:border-primary/60 cursor-pointer"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-sm border border-border flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${f.color}) 0%, hsl(${f.color} / 0.4) 100%)`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="font-display text-sm sm:text-base uppercase tracking-[0.08em] text-primary leading-tight break-words"
                    title={f.name}
                  >
                    {f.name}
                  </p>
                  {isPending && (
                    <p className="font-body text-xs text-primary mt-0.5">Claiming...</p>
                  )}
                  {!isPending && isTaken && (
                    <p className="font-body text-xs text-muted-foreground truncate mt-0.5">
                      Taken by {takenBy}
                    </p>
                  )}
                  {!isPending && isForbidden && !isTaken && (
                    <p className="font-body text-xs text-destructive mt-0.5">
                      Played last game
                    </p>
                  )}
                  {!isPending && forbiddenFaction === f.name && forbiddenRelaxed && !isTaken && (
                    <p className="font-body text-xs text-amber-400 mt-0.5">
                      Repeat allowed
                    </p>
                  )}
                </div>
                {isPending ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                ) : (
                  !isDisabled && (
                    <Info className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                  )
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <FactionDetailDialog
        faction={preview}
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null); }}
        onConfirm={handleConfirm}
        confirmLabel="Pick this Faction"
        confirmDisabled={isClaiming}
      />
    </>
  );
};

export default FactionPicker;

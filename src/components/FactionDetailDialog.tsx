import { Info, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Faction } from "@/data/factions";

interface FactionDetailDialogProps {
  faction: Faction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, shows a confirm button that calls this with the faction. */
  onConfirm?: (faction: Faction) => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

const techTypeColors: Record<string, string> = {
  green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  blue: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  yellow: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  red: "bg-red-500/20 text-red-300 border-red-500/40",
  unit: "bg-primary/20 text-primary border-primary/40",
};

const FactionDetailDialog = ({
  faction,
  open,
  onOpenChange,
  onConfirm,
  confirmLabel = "Confirm Pick",
  confirmDisabled,
}: FactionDetailDialogProps) => {
  if (!faction) return null;
  const c = faction.color;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass imperial-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div
            className="absolute top-0 left-0 right-0 h-[2px] -mx-6 -mt-6"
            style={{
              background: `linear-gradient(90deg, transparent, hsl(${c}), transparent)`,
            }}
          />
          <DialogTitle
            className="font-display text-xl tracking-wide pt-2 leading-tight break-words"
            style={{
              color: `hsl(${c})`,
              textShadow: `0 0 12px hsl(${c} / 0.4)`,
            }}
          >
            {faction.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {faction.abilities && faction.abilities.length > 0 && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-2 flex items-center gap-2">
                <Info className="h-3 w-3" /> Faction Abilities
              </h3>
              <ul className="space-y-1.5 list-disc pl-5 text-foreground/90">
                {faction.abilities.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          {faction.startingUnits && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Starting Units
              </h3>
              <p className="text-foreground/90">{faction.startingUnits}</p>
            </section>
          )}

          {faction.startingTech && faction.startingTech.length > 0 && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Starting Tech
              </h3>
              <p className="text-foreground/90">
                {faction.startingTech.join(", ")}
              </p>
            </section>
          )}

          {faction.commodities !== undefined && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Commodities
              </h3>
              <p className="text-foreground/90">{faction.commodities}</p>
            </section>
          )}

          {faction.factionTech && faction.factionTech.length > 0 && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-2">
                Faction Technology
              </h3>
              <ul className="space-y-2">
                {faction.factionTech.map((t) => (
                  <li key={t.name}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {t.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={techTypeColors[t.type] ?? ""}
                      >
                        {t.type}
                      </Badge>
                      {t.prerequisites && (
                        <span className="text-xs text-muted-foreground">
                          Prereq: {t.prerequisites}
                        </span>
                      )}
                    </div>
                    <p className="text-foreground/80 text-xs mt-0.5">
                      {t.description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {faction.agent && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Agent
              </h3>
              <p>
                <span className="font-semibold">{faction.agent.name}</span> —{" "}
                <span className="text-foreground/80">
                  {faction.agent.description}
                </span>
              </p>
            </section>
          )}

          {faction.commander && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Commander
              </h3>
              <p>
                <span className="font-semibold">{faction.commander.name}</span>{" "}
                —{" "}
                <span className="text-foreground/80">
                  {faction.commander.description}
                </span>
              </p>
              <p className="text-xs text-muted-foreground italic mt-0.5">
                Unlock: {faction.commander.unlock}
              </p>
            </section>
          )}

          {faction.hero && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Hero
              </h3>
              <p>
                <span className="font-semibold">{faction.hero.name}</span> —{" "}
                <span className="text-foreground/80">
                  {faction.hero.description}
                </span>
              </p>
            </section>
          )}

          {faction.promissoryNote && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Promissory Note
              </h3>
              <p className="text-foreground/90">{faction.promissoryNote}</p>
            </section>
          )}

          {faction.strategyTip && (
            <section>
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-1">
                Strategy Tip
              </h3>
              <p className="italic text-muted-foreground">
                {faction.strategyTip}
              </p>
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="font-display text-xs uppercase tracking-[0.15em]"
          >
            Close
          </Button>
          {onConfirm && (
            <Button
              size="sm"
              disabled={confirmDisabled}
              onClick={() => onConfirm(faction)}
              className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
            >
              <Check className="mr-2 h-3 w-3" />
              {confirmLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FactionDetailDialog;

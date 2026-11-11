import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { resolveDisplayColor } from "@/lib/playerColors";
import type { GameRecord } from "@/types/gameHistory";

export interface EditResultsRow {
  vp: number;
  rank: number;
  displayColor: string | null;
}

interface EditResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: GameRecord | null;
  onSave: (updates: EditResultsRow[]) => Promise<void> | void;
}

const EditResultsDialog = ({
  open,
  onOpenChange,
  game,
  onSave,
}: EditResultsDialogProps) => {
  const [rows, setRows] = useState<
    { vp: string; rank: string; displayColor: string | null }[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (game) {
      setRows(
        game.players.map((p) => ({
          vp: String(p.vp),
          rank: String(p.rank),
          displayColor: p.displayColor ?? null,
        }))
      );
    }
  }, [game]);

  if (!game) return null;

  const updateField = (
    i: number,
    field: "vp" | "rank",
    value: string
  ) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const updateColor = (i: number, value: string | null) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], displayColor: value };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: EditResultsRow[] = rows.map((r) => ({
        vp: Math.max(0, parseInt(r.vp) || 0),
        rank: Math.max(1, parseInt(r.rank) || 1),
        displayColor: r.displayColor,
      }));
      await onSave(updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass imperial-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow text-center">
            Edit Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-muted-foreground text-xs font-body uppercase tracking-widest px-1">
            <span>Player / Faction</span>
            <span className="w-16 text-center">VP</span>
            <span className="w-16 text-center">Rank</span>
          </div>
          <div className="imperial-divider" />

          {game.players.map((p, i) => {
            const swatchColor = resolveDisplayColor(
              p.faction.color,
              rows[i]?.displayColor
            );
            return (
              <div
                key={(p.playerId ?? p.player) + p.faction.name}
                className="space-y-2"
              >
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: `hsl(${swatchColor})` }}
                    />
                    <div className="min-w-0">
                      <p className="font-display text-xs text-primary truncate">
                        {p.player}
                      </p>
                      <p
                        className="text-[10px] font-body truncate"
                        style={{ color: `hsl(${swatchColor})` }}
                      >
                        {p.faction.shortName}
                      </p>
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={rows[i]?.vp ?? ""}
                    onChange={(e) => updateField(i, "vp", e.target.value)}
                    className="w-16 h-8 text-center bg-input border-border font-body text-sm text-foreground focus:border-primary/40 rounded"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={game.players.length}
                    value={rows[i]?.rank ?? ""}
                    onChange={(e) => updateField(i, "rank", e.target.value)}
                    className="w-16 h-8 text-center bg-input border-border font-body text-sm text-foreground focus:border-primary/40 rounded"
                  />
                </div>
                <ColorSwatchPicker
                  value={rows[i]?.displayColor ?? null}
                  factionDefault={p.faction.color}
                  onChange={(v) => updateColor(i, v)}
                  size="sm"
                  className="pl-5"
                />
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            disabled={saving}
            className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
          >
            <Save className="mr-2 h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditResultsDialog;

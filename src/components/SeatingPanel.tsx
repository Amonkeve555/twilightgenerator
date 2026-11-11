import { useMemo, useState } from "react";
import { Shuffle, Eraser, ChevronDown, ChevronUp, Armchair } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MapSetupHex, { type SeatOccupant } from "@/components/MapSetupHex";
import { MAP_SETUPS, getHomeSeats, getHomeSeatsFromSetup } from "@/data/mapSetups";
import { setupForLobby, type CustomMap } from "@/lib/customMap";
import { supabase } from "@/integrations/supabase/client";
import type { LobbyPlayerRow } from "@/hooks/useLobby";
import type { Faction } from "@/data/factions";

type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;

interface Props {
  lobbyId: string;
  players: LobbyPlayerRow[];
  isHost: boolean;
  /** Max players from lobby settings — used as the seating template size */
  playerCount: number;
  /** Optional custom map override */
  customMap?: CustomMap | null;
}

function clampCount(n: number): PlayerCount {
  if (n <= 3) return 3;
  if (n >= 8) return 8;
  return n as PlayerCount;
}

const SeatingPanel = ({ lobbyId, players, isHost, playerCount, customMap }: Props) => {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeSeat, setActiveSeat] = useState<number | null>(null);

  const count = clampCount(playerCount);
  const setup = useMemo(() => setupForLobby(customMap, count), [customMap, count]);
  const seatOrder = useMemo(
    () => (customMap ? getHomeSeatsFromSetup(setup) : getHomeSeats(count)),
    [customMap, setup, count],
  );

  // Build seat -> occupant map from players
  const seats = useMemo(() => {
    const m: Record<number, SeatOccupant> = {};
    for (const p of players) {
      const sp = p as LobbyPlayerRow & { seat_index?: number | null };
      if (sp.seat_index === null || sp.seat_index === undefined) continue;
      const chosen = p.chosen_faction as Faction | null;
      const assigned = (p.assigned_factions as Faction[] | null) ?? null;
      const f = chosen ?? (assigned && assigned.length === 1 ? assigned[0] : null);
      m[sp.seat_index] = {
        playerId: p.id,
        playerName: p.player_name,
        factionColor: f?.color ?? null,
        factionName: f?.name,
      };
    }
    return m;
  }, [players]);

  const unseatedPlayers = useMemo(
    () =>
      players.filter((p) => {
        const sp = p as LobbyPlayerRow & { seat_index?: number | null };
        return sp.seat_index === null || sp.seat_index === undefined;
      }),
    [players]
  );

  const assign = async (playerId: string, seatIndex: number | null) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("assign_seat", {
      p_lobby_id: lobbyId,
      p_player_id: playerId,
      p_seat_index: seatIndex as number,
    });
    setBusy(false);
    if (error) {
      toast.error("Failed to assign seat");
      console.error(error);
      return;
    }
    const result = data as { success?: boolean; error?: string };
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setActiveSeat(null);
  };

  const shuffle = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("shuffle_seats", {
      p_lobby_id: lobbyId,
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error("Failed to shuffle seats");
      return;
    }
    toast.success("Seats randomized");
  };

  const clear = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("clear_seats", {
      p_lobby_id: lobbyId,
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error("Failed to clear seats");
      return;
    }
    toast.success("Seats cleared");
  };

  const handleSeatClick = (seatIndex: number) => {
    if (!isHost) return;
    setActiveSeat(seatIndex);
  };

  const seatedCount = Object.keys(seats).length;

  return (
    <div className="glass imperial-border rounded p-4 md:p-6 space-y-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <Armchair className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow">
            Table Seating
          </h2>
          <span className="font-body text-xs text-muted-foreground">
            {seatedCount}/{count} seated
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          <div className="rounded bg-secondary/30 p-2 md:p-3">
            <MapSetupHex
              setup={setup}
              seats={seats}
              seatOrder={seatOrder}
              onSeatClick={isHost ? handleSeatClick : undefined}
              neutral
            />
          </div>

          {isHost && (
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={shuffle}
                disabled={busy || players.length === 0}
                className="font-display text-xs uppercase tracking-[0.15em] border-primary/40 text-primary hover:bg-primary/10"
              >
                <Shuffle className="mr-2 h-3 w-3" />
                Shuffle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clear}
                disabled={busy || seatedCount === 0}
                className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
              >
                <Eraser className="mr-2 h-3 w-3" />
                Clear
              </Button>
            </div>
          )}

          {isHost && (
            <Dialog
              open={activeSeat !== null}
              onOpenChange={(o) => { if (!o) setActiveSeat(null); }}
            >
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="font-display text-sm uppercase tracking-[0.2em] text-primary">
                    Seat {activeSeat !== null ? activeSeat + 1 : ""}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {activeSeat !== null && seats[activeSeat] && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start font-body text-sm"
                      onClick={() => assign(seats[activeSeat].playerId, null)}
                      disabled={busy}
                    >
                      Clear this seat ({seats[activeSeat].playerName})
                    </Button>
                  )}
                  {unseatedPlayers.length === 0 && activeSeat !== null && !seats[activeSeat] && (
                    <p className="font-body text-xs text-muted-foreground">
                      All players are already seated.
                    </p>
                  )}
                  {unseatedPlayers.map((p) => (
                    <Button
                      key={p.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start font-body text-sm"
                      onClick={() => activeSeat !== null && assign(p.id, activeSeat)}
                      disabled={busy}
                    >
                      Seat {p.player_name}
                    </Button>
                  ))}
                  {players
                    .filter((p) => {
                      const sp = p as LobbyPlayerRow & { seat_index?: number | null };
                      return (
                        sp.seat_index !== null &&
                        sp.seat_index !== undefined &&
                        sp.seat_index !== activeSeat
                      );
                    })
                    .map((p) => (
                      <Button
                        key={p.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start font-body text-xs text-muted-foreground"
                        onClick={() => activeSeat !== null && assign(p.id, activeSeat)}
                        disabled={busy}
                      >
                        Swap with {p.player_name}
                      </Button>
                    ))}
                </div>
              </DialogContent>
            </Dialog>
          )}

          <p className="font-body text-xs text-muted-foreground/70 text-center italic">
            {isHost
              ? "Click a home system on the map to seat a player. Seats are saved with the game."
              : "Only the host can change seating."}
          </p>
        </>
      )}
    </div>
  );
};

export default SeatingPanel;

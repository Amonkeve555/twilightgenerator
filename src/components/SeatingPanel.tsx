import { useMemo, useState } from "react";
import { Shuffle, Eraser, ChevronDown, ChevronUp, Armchair, EyeOff } from "lucide-react";
import { isLocked } from "@/lib/lobbyLock";
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
import { buildSeats, formatRevealDate } from "@/lib/reveal";

type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;

interface Props {
  lobbyId: string;
  players: LobbyPlayerRow[];
  isHost: boolean;
  /** Max players from lobby settings — used as the seating template size */
  playerCount: number;
  /** Optional custom map override */
  customMap?: CustomMap | null;
  /** Game day reached / game started — seating is public */
  revealed: boolean;
  gameDate?: string | null;
  /** The viewer's own player row id (null if they haven't joined) */
  myPlayerId?: string | null;
}

function clampCount(n: number): PlayerCount {
  if (n <= 3) return 3;
  if (n >= 8) return 8;
  return n as PlayerCount;
}

const SeatingPanel = ({ lobbyId, players, isHost, playerCount, customMap, revealed, gameDate, myPlayerId }: Props) => {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeSeat, setActiveSeat] = useState<number | null>(null);

  const count = clampCount(playerCount);
  const setup = useMemo(() => setupForLobby(customMap, count), [customMap, count]);
  const seatOrder = useMemo(
    () => (customMap ? getHomeSeatsFromSetup(setup) : getHomeSeats(count)),
    [customMap, setup, count],
  );

  // Seat -> occupant map. Until the game-day reveal a player sees only their own seat.
  const seats = useMemo(
    () => buildSeats(players, { revealed, isHost, viewerPlayerId: myPlayerId }),
    [players, revealed, isHost, myPlayerId],
  );
  const hiddenFromMe = !revealed && !isHost;
  // Players choose their own seat until the pick lock (the host seats anyone, any time).
  const canPickOwn = !isHost && !!myPlayerId && !revealed && !isLocked(gameDate);
  const mySeat = useMemo(() => {
    const me = players.find((p) => p.id === myPlayerId);
    return me?.seat_index ?? null;
  }, [players, myPlayerId]);
  const [pickSeat, setPickSeat] = useState<number | null>(null);
  const revealLabel = formatRevealDate(gameDate);

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

  const pickMySeat = async (seatIndex: number | null) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("pick_my_seat", {
      p_lobby_id: lobbyId,
      p_seat_index: seatIndex,
    });
    setBusy(false);
    setPickSeat(null);
    const err = error ? "failed" : (data as { error?: string } | null)?.error;
    if (err) {
      toast.error(
        err === "seat_taken"
          ? "Someone already sits there — pick another seat"
          : err === "locked"
          ? "Seats are locked (within 3 days of the game)"
          : "Couldn't save your seat",
      );
      if (error) console.error(error);
      return;
    }
    toast.success(seatIndex === null ? "You left your seat" : `You're in seat ${seatIndex + 1}`);
  };

  const handleSeatClick = (seatIndex: number) => {
    if (isHost) setActiveSeat(seatIndex);
    else if (canPickOwn) setPickSeat(seatIndex);
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
            {hiddenFromMe
              ? mySeat !== null
                ? `you: seat ${mySeat + 1}`
                : "secret"
              : `${seatedCount}/${count} seated`}
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
          {!revealed && (
            <p className="font-body text-xs text-amber-400/90 text-center flex items-center justify-center gap-1.5">
              <EyeOff className="h-3 w-3" />
              {isHost
                ? `Only you can see the seating. Everyone sees it on game day${revealLabel ? ` (${revealLabel})` : ""}.`
                : `You see only your own seat. Everyone's seats are revealed on game day${revealLabel ? ` (${revealLabel})` : ""}.`}
            </p>
          )}
          <div className={`rounded bg-secondary/30 p-2 md:p-3 ${hiddenFromMe && !canPickOwn ? "opacity-60" : ""}`}>
            <MapSetupHex
              setup={setup}
              seats={seats}
              seatOrder={seatOrder}
              onSeatClick={isHost || canPickOwn ? handleSeatClick : undefined}
              neutral
              hiddenSeats={hiddenFromMe}
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

          {canPickOwn && (
            <Dialog open={pickSeat !== null} onOpenChange={(o) => { if (!o) setPickSeat(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="font-display text-sm uppercase tracking-[0.2em] text-primary">
                    Seat {pickSeat !== null ? pickSeat + 1 : ""}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {pickSeat !== null && pickSeat === mySeat ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-body text-sm"
                      onClick={() => pickMySeat(null)}
                      disabled={busy}
                    >
                      Leave this seat
                    </Button>
                  ) : (
                    <>
                      <p className="font-body text-xs text-muted-foreground">
                        Other players' seats are secret, so this one may already be taken.
                      </p>
                      <Button
                        size="sm"
                        className="w-full font-display text-xs uppercase tracking-[0.15em] glow-primary bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => pickSeat !== null && pickMySeat(pickSeat)}
                        disabled={busy}
                      >
                        {mySeat !== null ? `Move here from seat ${mySeat + 1}` : "Sit here"}
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          <p className="font-body text-xs text-muted-foreground/70 text-center italic">
            {isHost
              ? "Click a home system on the map to seat a player. Seats are saved with the game."
              : canPickOwn
              ? "Tap a home system to choose your seat. You can change it until picks lock."
              : !myPlayerId
              ? "Join the lobby to choose a seat."
              : revealed
              ? "Only the host can change seating."
              : "Seats are locked. Only the host can change seating now."}
          </p>
        </>
      )}
    </div>
  );
};

export default SeatingPanel;

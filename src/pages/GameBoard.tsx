import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Eraser, Flag, Play, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MapSetupHex, { type SeatOccupant } from "@/components/MapSetupHex";
import TileControlLeaderboard from "@/components/TileControlLeaderboard";
import GameTimer from "@/components/GameTimer";
import { getHomeSeats, getHomeSeatsFromSetup } from "@/data/mapSetups";
import { setupForLobby } from "@/lib/customMap";
import { useLobby } from "@/hooks/useLobby";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isRevealed, buildSeats } from "@/lib/reveal";
import type { Faction } from "@/data/factions";

type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;

function clampCount(n: number): PlayerCount {
  if (n <= 3) return 3;
  if (n >= 8) return 8;
  return n as PlayerCount;
}

const GameBoard = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { lobby, players, loading, error } = useLobby(code);
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [resultData, setResultData] = useState<Map<string, { vp: string; rank: string }>>(new Map());
  const [saving, setSaving] = useState(false);

  const isHost = !!user && lobby?.host_user_id === user.id;
  const isCompleted = lobby?.status === "completed";
  const isEnded = !!lobby?.ended_at || isCompleted;
  const canEdit = isHost && !isEnded;
  const canEnterScores = isHost && isEnded && !isCompleted;

  const playerCount = clampCount(lobby?.settings?.max_players ?? 6);
  const setup = useMemo(() => setupForLobby(lobby?.custom_map ?? null, playerCount), [lobby?.custom_map, playerCount]);
  const seatOrder = useMemo(
    () => (lobby?.custom_map ? getHomeSeatsFromSetup(setup) : getHomeSeats(playerCount)),
    [lobby?.custom_map, setup, playerCount],
  );
  const tileControl = (lobby?.tile_control ?? {}) as Record<string, number>;

  const revealed = isRevealed(lobby);
  const myPlayerId = players.find((p) => p.user_id === user?.id)?.id ?? null;
  const seats = useMemo(() => buildSeats(players, { revealed, isHost, viewerPlayerId: myPlayerId }), [players, revealed, isHost, myPlayerId]);
  // Before game day, hide chosen races (and seats, for non-hosts) from the leaderboard too.
  const visiblePlayers = useMemo(
    () =>
      revealed
        ? players
        : players.map((p) => ({ ...p, chosen_faction: null, seat_index: isHost ? p.seat_index : null })),
    [players, revealed, isHost]
  );

  const seatIndices = useMemo(
    () =>
      players
        .map((p) => p.seat_index)
        .filter((s): s is number => typeof s === "number")
        .sort((a, b) => a - b),
    [players]
  );

  // All non-hyperlane tiles are claimable.
  const totalClaimableTiles = useMemo(
    () => setup.cells.filter((c) => c.role !== "hyperlane").length,
    [setup]
  );

  const onTileClick = async (q: number, r: number, currentSeat: number | undefined) => {
    if (!canEdit || !lobby || seatIndices.length === 0) {
      if (!isHost && !isCompleted) toast.error("Only the host can claim tiles.");
      return;
    }
    // Cycle: undefined -> seatIndices[0] -> ... -> last -> undefined
    let nextSeat: number | null;
    if (currentSeat === undefined) {
      nextSeat = seatIndices[0];
    } else {
      const idx = seatIndices.indexOf(currentSeat);
      if (idx === -1 || idx === seatIndices.length - 1) {
        nextSeat = null;
      } else {
        nextSeat = seatIndices[idx + 1];
      }
    }

    setBusy(true);
    const { data, error: err } = await supabase.rpc("set_tile_control", {
      p_lobby_id: lobby.id,
      p_q: q,
      p_r: r,
      p_seat_index: nextSeat,
    });
    setBusy(false);
    if (err || (data as { error?: string })?.error) {
      toast.error("Failed to update tile");
      console.error(err);
    }
  };

  const onClearAll = async () => {
    if (!canEdit || !lobby) return;
    if (!confirm("Clear all tile claims on the board?")) return;
    setBusy(true);
    const { error: err } = await supabase.rpc("clear_tile_control", {
      p_lobby_id: lobby.id,
    });
    setBusy(false);
    if (err) {
      toast.error("Failed to clear board");
      return;
    }
    toast.success("Board cleared");
  };

  const onStartGame = async () => {
    if (!isHost || !lobby || lobby.started_at) return;
    if (!revealed && !confirm("Start the game now? This reveals everyone's race and the seating.")) return;
    setBusy(true);
    const { data, error: err } = await supabase.rpc("start_game", { p_lobby_id: lobby.id });
    setBusy(false);
    if (err) {
      toast.error("Failed to start game");
      console.error(err);
      return;
    }
    const result = data as { success?: boolean; error?: string };
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Game started!");
  };

  const onEndGame = async () => {
    if (!isHost || !lobby || isEnded) return;
    if (!confirm("End the game? Tile control will be locked and you'll record final scores.")) return;
    setBusy(true);
    const { error: err } = await supabase.rpc("end_game", { p_lobby_id: lobby.id });
    setBusy(false);
    if (err) {
      toast.error("Failed to end game");
      console.error(err);
      return;
    }
    toast.success("Game ended — record the scores below.");
  };

  const updateResult = (playerId: string, field: "vp" | "rank", value: string) => {
    // Allow only digits, max 3 chars (VPs realistically <=20, ranks <=8)
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 3);
    setResultData((prev) => {
      const next = new Map(prev);
      const existing = next.get(playerId) ?? { vp: "", rank: "" };
      next.set(playerId, { ...existing, [field]: sanitized });
      return next;
    });
  };

  const saveResults = async () => {
    if (!isHost || !lobby) return;
    // Validate: every player must have a rank; VP optional but must be numeric if present
    const ranks: number[] = [];
    for (const p of players) {
      const data = resultData.get(p.id);
      const rankStr = data?.rank ?? "";
      if (!rankStr) {
        toast.error(`Missing rank for ${p.player_name}`);
        return;
      }
      const rank = parseInt(rankStr, 10);
      if (Number.isNaN(rank) || rank < 1 || rank > players.length) {
        toast.error(`Invalid rank for ${p.player_name}`);
        return;
      }
      ranks.push(rank);
    }

    setSaving(true);
    const results = players.map((p) => {
      const data = resultData.get(p.id);
      const vp = data?.vp ? parseInt(data.vp, 10) : null;
      return {
        player_id: p.id,
        vp: vp !== null && !Number.isNaN(vp) ? vp : null,
        rank: parseInt(data?.rank ?? "", 10),
      };
    });
    // One transaction: all results + game marked completed, or nothing.
    const { data, error: err } = await supabase.rpc("finish_game", {
      p_lobby_id: lobby.id,
      p_results: results,
    });
    setSaving(false);
    if (err || (data as { error?: string } | null)?.error) {
      toast.error("Failed to save results — nothing was saved, please try again");
      console.error(err ?? data);
      return;
    }
    toast.success("Results saved!");
  };

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <p className="font-display text-primary text-glow">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="min-h-screen relative">
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="font-display text-destructive">{error || "Game not found"}</p>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="font-display text-xs uppercase tracking-[0.15em]"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Game Board
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <code className="font-body text-sm text-primary bg-secondary px-3 py-1 rounded">
              {code}
            </code>
          </div>
          {lobby.started_at && (
            <div className="flex justify-center mt-3">
              <GameTimer startedAt={lobby.started_at} endedAt={lobby.ended_at} />
            </div>
          )}
          {isHost && !lobby.started_at && (
            <div className="flex justify-center mt-4">
              <Button
                onClick={onStartGame}
                disabled={busy}
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-8 py-5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Play className="mr-2 h-4 w-4" />
                {busy ? "Starting..." : "Start Game"}
              </Button>
            </div>
          )}
          <div className="imperial-divider w-48 mx-auto mt-4" />
          <p className="font-body text-xs text-muted-foreground mt-3">
            {canEdit
              ? "Click any tile to cycle its controller through the seated players."
              : isCompleted
              ? "Game completed — board is read-only."
              : isEnded
              ? "Game ended — tile control is locked. Record final scores below."
              : "Only the host can claim tiles."}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass imperial-border rounded p-3 md:p-5"
          >
            <MapSetupHex
              setup={setup}
              seats={seats}
              seatOrder={seatOrder}
              tileControl={tileControl}
              onTileClick={canEdit ? onTileClick : undefined}
              hiddenSeats={!revealed && !isHost}
            />
            {canEdit && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearAll}
                  disabled={busy || Object.keys(tileControl).length === 0}
                  className="font-display text-xs uppercase tracking-[0.15em] border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Eraser className="mr-2 h-3 w-3" />
                  Clear Board
                </Button>
                {lobby.started_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onEndGame}
                    disabled={busy}
                    className="font-display text-xs uppercase tracking-[0.15em] border-primary/60 text-primary hover:bg-primary/10"
                  >
                    <Flag className="mr-2 h-3 w-3" />
                    End Game
                  </Button>
                )}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <TileControlLeaderboard
              players={visiblePlayers}
              tileControl={tileControl}
              totalClaimableTiles={totalClaimableTiles}
            />
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/lobby/${code}`)}
                className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              >
                <ArrowLeft className="mr-2 h-3 w-3" />
                Back to Lobby
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Scores entry / final standings */}
        {(canEnterScores || isCompleted) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass imperial-border rounded p-5 mt-6"
          >
            <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow text-center mb-4 flex items-center justify-center gap-2">
              <Trophy className="h-4 w-4" />
              {isCompleted ? "Final Standings" : "Record Final Scores"}
            </h2>

            {canEnterScores ? (
              <div className="space-y-3">
                {players.map((p) => {
                  const chosen = p.chosen_faction as Faction | null;
                  const data = resultData.get(p.id) ?? { vp: "", rank: "" };
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded bg-secondary/50 border border-border space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        {chosen && (
                          <div
                            className="w-7 h-7 rounded-sm border border-border flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, hsl(${chosen.color}) 0%, hsl(${chosen.color} / 0.4) 100%)`,
                            }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-display text-base text-primary truncate">{p.player_name}</p>
                          {chosen && (
                            <p className="text-xs font-body text-muted-foreground truncate">{chosen.name}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-body text-xs text-muted-foreground">VP</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={data.vp}
                            onChange={(e) => updateResult(p.id, "vp", e.target.value)}
                            maxLength={3}
                            className="bg-input border-border font-body text-foreground text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="font-body text-xs text-muted-foreground">Rank</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={data.rank}
                            onChange={(e) => updateResult(p.id, "rank", e.target.value)}
                            maxLength={2}
                            className="bg-input border-border font-body text-foreground text-sm h-8"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={saveResults}
                    disabled={saving}
                    size="lg"
                    className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-5 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Results"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[...players]
                  .filter((p) => p.rank != null)
                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                  .map((p) => {
                    const chosen = p.chosen_faction as Faction | null;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-display text-lg text-primary w-6 text-center">
                            {p.rank}
                          </span>
                          {chosen && (
                            <div
                              className="w-6 h-6 rounded-sm border border-border flex-shrink-0"
                              style={{
                                background: `linear-gradient(135deg, hsl(${chosen.color}) 0%, hsl(${chosen.color} / 0.4) 100%)`,
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-display text-base text-primary truncate">{p.player_name}</p>
                            {chosen && (
                              <p className="text-xs font-body text-muted-foreground truncate">{chosen.name}</p>
                            )}
                          </div>
                        </div>
                        <span className="font-display text-base text-primary tabular-nums">
                          {p.vp ?? 0} VP
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;

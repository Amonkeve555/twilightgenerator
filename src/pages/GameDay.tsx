import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StarField from "@/components/StarField";
import FactionCard from "@/components/FactionCard";
import GameTimer from "@/components/GameTimer";
import MapSetupHex, { type SeatOccupant } from "@/components/MapSetupHex";
import TileControlLeaderboard from "@/components/TileControlLeaderboard";
import { getHomeSeats, getHomeSeatsFromSetup } from "@/data/mapSetups";
import { setupForLobby } from "@/lib/customMap";
import { supabase } from "@/integrations/supabase/client";
import { useLobby, type LobbySettings } from "@/hooks/useLobby";
import { useAuth } from "@/hooks/useAuth";
import type { Faction } from "@/data/factions";

type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;
function clampCount(n: number): PlayerCount {
  if (n <= 3) return 3;
  if (n >= 8) return 8;
  return n as PlayerCount;
}

type GameDayPhase = "choose" | "results";

const GameDay = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { lobby, players, loading, error } = useLobby(inviteCode);
  const { user } = useAuth();
  const [phase, setPhase] = useState<GameDayPhase>("choose");
  const [resultData, setResultData] = useState<Map<string, { vp: string; rank: string }>>(new Map());
  const [saving, setSaving] = useState(false);

  const settings = lobby?.settings as LobbySettings | undefined;
  const picksPerPlayer = settings?.picks_per_player ?? 1;
  const isHost = !!user && lobby?.host_user_id === user.id;

  const playerCount = clampCount(settings?.max_players ?? players.length ?? 6);
  const setup = useMemo(() => setupForLobby(lobby?.custom_map ?? null, playerCount), [lobby?.custom_map, playerCount]);
  const seatOrder = useMemo(
    () => (lobby?.custom_map ? getHomeSeatsFromSetup(setup) : getHomeSeats(playerCount)),
    [lobby?.custom_map, setup, playerCount],
  );
  const tileControl = (lobby?.tile_control ?? {}) as Record<string, number>;
  const seats = useMemo(() => {
    const m: Record<number, SeatOccupant> = {};
    for (const p of players) {
      if (p.seat_index === null || p.seat_index === undefined) continue;
      const chosen = p.chosen_faction as Faction | null;
      const assigned = (p.assigned_factions as Faction[] | null) ?? null;
      const f = chosen ?? (assigned && assigned.length === 1 ? assigned[0] : null);
      m[p.seat_index] = {
        playerId: p.id,
        playerName: p.player_name,
        factionColor: f?.color ?? null,
        factionName: f?.name,
      };
    }
    return m;
  }, [players]);
  const totalClaimableTiles = useMemo(
    () => setup.cells.filter((c) => c.role !== "hyperlane").length,
    [setup]
  );

  // Auto-start the clock if host enters Game Day without explicitly starting.
  useEffect(() => {
    if (!lobby || !isHost) return;
    if (lobby.started_at || lobby.status === "completed") return;
    supabase.rpc("start_game", { p_lobby_id: lobby.id });
  }, [lobby?.id, lobby?.started_at, lobby?.status, isHost]);

  const myPlayer = players.find((p) => p.user_id === user?.id);
  const myFactions = (myPlayer?.assigned_factions as unknown as Faction[]) ?? [];
  const hasChosen = !!myPlayer?.chosen_faction;

  const chooseFaction = async (faction: Faction) => {
    if (!myPlayer) return;
    await supabase
      .from("lobby_players")
      .update({ chosen_faction: JSON.parse(JSON.stringify(faction)) })
      .eq("id", myPlayer.id);
  };

  const allChosen = players.every((p) => p.chosen_faction != null);

  const updateResult = (playerId: string, field: "vp" | "rank", value: string) => {
    setResultData((prev) => {
      const next = new Map(prev);
      const existing = next.get(playerId) ?? { vp: "", rank: "" };
      next.set(playerId, { ...existing, [field]: value });
      return next;
    });
  };

  const saveResults = async () => {
    setSaving(true);
    for (const p of players) {
      const data = resultData.get(p.id);
      if (data) {
        await supabase
          .from("lobby_players")
          .update({
            vp: data.vp ? parseInt(data.vp) : null,
            rank: data.rank ? parseInt(data.rank) : null,
          })
          .eq("id", p.id);
      }
    }
    // Stamp ended_at via RPC (host-only) before marking completed
    await supabase.rpc("end_game", { p_lobby_id: lobby!.id });
    await supabase
      .from("lobbies")
      .update({ status: "completed" })
      .eq("id", lobby!.id);
    setSaving(false);
    navigate(`/lobby/${inviteCode}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <StarField />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <p className="font-display text-primary text-glow">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="min-h-screen relative">
        <StarField />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="font-display text-destructive">{error || "Lobby not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Game Day
          </h1>
          <p className="font-display text-sm uppercase tracking-[0.4em] text-muted-foreground">
            {inviteCode}
          </p>
          {lobby.started_at && (
            <div className="flex justify-center mt-3">
              <GameTimer startedAt={lobby.started_at} endedAt={lobby.ended_at} />
            </div>
          )}
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        {phase === "choose" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Faction Choice (if multi-pick and hasn't chosen) */}
            {picksPerPlayer > 1 && myPlayer && !hasChosen && (
              <div className="glass imperial-border rounded p-6 space-y-4">
                 <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow text-center">
                  Choose Your Faction
                </h2>
                <div className="grid gap-3">
                  {myFactions.map((f) => (
                    <motion.button
                      key={f.name}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => chooseFaction(f)}
                      className="w-full glass imperial-border rounded p-4 text-left transition-all hover:border-primary/60 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-sm border border-border flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, hsl(${f.color}) 0%, hsl(${f.color} / 0.4) 100%)`,
                          }}
                        />
                        <p className="font-display text-base uppercase tracking-[0.1em] text-primary">
                          {f.name}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Show chosen faction */}
            {hasChosen && myPlayer && (
              <div className="glass imperial-border rounded p-6 text-center">
                <p className="font-body text-base text-muted-foreground mb-2">Your chosen faction:</p>
                <FactionCard
                  playerName={myPlayer.player_name}
                  faction={myPlayer.chosen_faction as unknown as Faction}
                  index={0}
                />
              </div>
            )}

            {/* For single-pick, auto-choose */}
            {picksPerPlayer === 1 && myPlayer && !hasChosen && myFactions.length === 1 && (
              <div className="glass imperial-border rounded p-6 text-center">
                <p className="font-body text-base text-muted-foreground mb-2">Your faction:</p>
                <FactionCard playerName={myPlayer.player_name} faction={myFactions[0]} index={0} />
                <Button
                  onClick={() => chooseFaction(myFactions[0])}
                  className="mt-4 font-display text-sm uppercase tracking-[0.2em] glow-primary bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Confirm Faction
                </Button>
              </div>
            )}

            {/* All players' status */}
            <div className="glass imperial-border rounded p-6 space-y-3">
              <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow">
                All Players
              </h2>
              {players.map((p) => {
                const chosen = p.chosen_faction as unknown as Faction | null;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border">
                    <div>
                       <p className="font-display text-lg text-primary">{p.player_name}</p>
                      {chosen && (
                         <span className="text-sm font-body px-2 py-0.5 rounded border border-border" style={{ background: `hsl(${chosen.color} / 0.2)` }}>
                           {chosen.name}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-body ${chosen ? "text-green-400" : "text-muted-foreground"}`}>
                      {chosen ? "Ready" : "Choosing..."}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Proceed to results */}
            {allChosen && isHost && (
              <div className="flex justify-center">
                <Button
                  onClick={() => setPhase("results")}
                  size="lg"
                  className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Trophy className="mr-2 h-5 w-5" />
                  Record Results
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {phase === "results" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass imperial-border rounded p-3 md:p-5">
              <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow text-center mb-4">
                Final Map
              </h2>
              <MapSetupHex
                setup={setup}
                seats={seats}
                seatOrder={seatOrder}
                tileControl={tileControl}
                compact
              />
              <div className="mt-4">
                <TileControlLeaderboard
                  players={players}
                  tileControl={tileControl}
                  totalClaimableTiles={totalClaimableTiles}
                />
              </div>
            </div>
            <div className="glass imperial-border rounded p-6 space-y-4">
              <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow text-center">
                Game Results
              </h2>
              {players.map((p) => {
                const chosen = p.chosen_faction as unknown as Faction | null;
                const data = resultData.get(p.id) ?? { vp: "", rank: "" };
                return (
                  <div key={p.id} className="p-3 rounded bg-secondary/50 border border-border space-y-2">
                    <div className="flex items-center gap-3">
                      {chosen && (
                        <div
                          className="w-8 h-8 rounded-sm border border-border flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, hsl(${chosen.color}) 0%, hsl(${chosen.color} / 0.4) 100%)`,
                          }}
                        />
                      )}
                      <div>
                         <p className="font-display text-lg text-primary">{p.player_name}</p>
                         <p className="text-sm font-body text-muted-foreground">{chosen?.name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-body text-sm text-muted-foreground">VP</label>
                        <Input
                          type="number"
                          value={data.vp}
                          onChange={(e) => updateResult(p.id, "vp", e.target.value)}
                          className="bg-input border-border font-body text-foreground text-sm h-8"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="font-body text-sm text-muted-foreground">Rank</label>
                        <Input
                          type="number"
                          value={data.rank}
                          onChange={(e) => updateResult(p.id, "rank", e.target.value)}
                          className="bg-input border-border font-body text-foreground text-sm h-8"
                          min={1}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={saveResults}
                disabled={saving}
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 h-5 w-5" />
                {saving ? "Saving..." : "Save Results"}
              </Button>
            </div>
          </motion.div>
        )}

        <div className="flex justify-center gap-3 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/lobby/${inviteCode}`)}
            className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            <ArrowLeft className="mr-2 h-3 w-3" />
            Back to Lobby
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GameDay;

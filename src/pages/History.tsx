import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, Trophy, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import EditResultsDialog from "@/components/EditResultsDialog";
import HistoryMiniMap from "@/components/HistoryMiniMap";
import { formatDurationShort } from "@/components/GameTimer";
import { useGameHistory } from "@/hooks/useGameHistory";
import { useOnlineGameHistory } from "@/hooks/useOnlineGameHistory";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import type { GameRecord } from "@/types/gameHistory";
import { resolveDisplayColor } from "@/lib/playerColors";
import type { EditResultsRow } from "@/components/EditResultsDialog";
import tiEmblem from "@/assets/ti-emblem.png";

const History = () => {
  const navigate = useNavigate();
  const { history, deleteGame, updateGame, clearHistory } = useGameHistory();
  const { games: onlineGames, loading: onlineLoading, refetch: refetchOnline } = useOnlineGameHistory();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [editing, setEditing] = useState<GameRecord | null>(null);

  const canEditOnline = (g: GameRecord) =>
    !!user && (isAdmin || g.hostUserId === user.id);

  const handleSaveEdit = async (updates: EditResultsRow[]) => {
    if (!editing) return;
    const isOnline = editing.id.startsWith("online-");
    if (isOnline) {
      const lobbyId = editing.id.replace(/^online-/, "");
      const payload = editing.players.map((p, i) => ({
        player_id: p.playerId,
        vp: updates[i].vp,
        rank: updates[i].rank,
        display_color: updates[i].displayColor,
      }));
      const { data, error } = await supabase.rpc("update_lobby_results", {
        p_lobby_id: lobbyId,
        p_results: payload,
      });
      if (error) {
        toast.error("Failed to save results");
        console.error(error);
        return;
      }
      const result = data as { success?: boolean; error?: string };
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Results updated");
      refetchOnline();
    } else {
      updateGame(editing.id, updates);
      toast.success("Results updated");
    }
  };

  const allGames = useMemo(() => {
    const map = new Map();
    for (const g of history) map.set(g.id, g);
    for (const g of onlineGames) map.set(g.id, g);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [history, onlineGames]);

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <img
            src={tiEmblem}
            alt="Twilight Imperium Emblem"
            className="w-16 h-16 mx-auto mb-3 drop-shadow-[0_0_15px_hsl(42_85%_55%/0.3)]"
          />
          <div className="imperial-divider w-48 mx-auto mb-4" />
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Game History
          </h1>
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        <div className="flex justify-between items-center mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            <ArrowLeft className="mr-2 h-3 w-3" />
            Back
          </Button>
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              className="font-display text-xs uppercase tracking-[0.15em] border-border text-destructive hover:text-destructive hover:border-destructive/40"
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Clear Local
            </Button>
          )}
        </div>

        {onlineLoading && allGames.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass imperial-border rounded p-10 text-center"
          >
            <p className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground">
              Loading history…
            </p>
          </motion.div>
        ) : allGames.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass imperial-border rounded p-10 text-center"
          >
            <Trophy className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground">
              No games recorded yet
            </p>
            <p className="font-body text-xs text-muted-foreground mt-2">
              Complete a draft and save results to see them here
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {allGames.map((game, gi) => {
              const isOnline = game.id.startsWith("online-");
              const sortedPlayers = [...game.players].sort((a, b) => a.rank - b.rank);
              const winner = sortedPlayers[0];
              const dateStr = new Date(game.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.08 }}
                  className="glass imperial-border rounded p-5 relative overflow-hidden group"
                >
                  {/* Top accent */}
                  {winner && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{
                        background: `linear-gradient(90deg, transparent, hsl(${resolveDisplayColor(winner.faction.color, winner.displayColor)}), transparent)`,
                      }}
                    />
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">
                        {dateStr}
                        {game.startedAt && game.endedAt && (
                          <span className="ml-2 text-primary/80">
                            · {formatDurationShort(game.startedAt, game.endedAt)}
                          </span>
                        )}
                      </p>
                      {winner && (
                        <p className="font-display text-sm text-primary text-glow flex items-center gap-1 mt-1">
                          <Trophy className="h-3 w-3" />
                          {winner.player} — {winner.faction.shortName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {(!isOnline || canEditOnline(game)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(game)}
                          className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Edit results"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {!isOnline && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteGame(game.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete game"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="imperial-divider mb-3" />

                  {/* Results table */}
                  <div className="space-y-1">
                    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center text-[10px] font-body uppercase tracking-widest text-muted-foreground px-1">
                      <span className="w-6 text-center">#</span>
                      <span>Player / Faction</span>
                      <span className="w-10 text-center">VP</span>
                      <span className="w-6" />
                    </div>
                    {sortedPlayers.map((p) => {
                      const c = resolveDisplayColor(p.faction.color, p.displayColor);
                      return (
                        <div
                          key={p.player + p.faction.name}
                          className={`grid grid-cols-[auto_1fr_auto] gap-2 items-center py-1 px-1 rounded ${
                            p.rank === 1 ? "bg-primary/5" : ""
                          }`}
                        >
                          <span className="w-6 text-center font-display text-xs text-muted-foreground">
                            {p.rank}
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: `hsl(${c})` }}
                            />
                            <span className="font-body text-sm text-foreground truncate">
                              {p.player}
                            </span>
                            <span
                              className="font-body text-xs truncate"
                              style={{ color: `hsl(${c} / 0.7)` }}
                            >
                              {p.faction.shortName}
                            </span>
                          </div>
                          <span className="w-10 text-center font-display text-xs text-primary">
                            {p.vp}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {game.playerCount && game.players.some((p) => p.seatIndex != null) && (
                    <>
                      <div className="imperial-divider my-3" />
                      <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                        Table Seating
                      </p>
                      <HistoryMiniMap
                        players={game.players}
                        playerCount={game.playerCount}
                        tileControl={game.tileControl ?? null}
                      />
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <EditResultsDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        game={editing}
        onSave={handleSaveEdit}
      />
    </div>
  );
};

export default History;

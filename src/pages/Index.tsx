import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Scroll, Users, Gamepad2, BookOpen, Bot, BarChart3, Clock, Check, Trophy, Shield, Hexagon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import tiEmblem from "@/assets/ti-emblem.png";
import { Button } from "@/components/ui/button";
import StarField from "@/components/StarField";
import PlayerSetup from "@/components/PlayerSetup";
import FactionPool from "@/components/FactionPool";
import TokenGrid from "@/components/TokenGrid";
import FactionCard from "@/components/FactionCard";
import ResultsEntry from "@/components/ResultsEntry";
import { useGameHistory } from "@/hooks/useGameHistory";
import { TI4_FACTIONS, POK_FACTIONS, type Faction } from "@/data/factions";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/sessionId";
import type { LobbySettings } from "@/hooks/useLobby";
import UserMenu from "@/components/UserMenu";
import ClaimGuestDataDialog from "@/components/ClaimGuestDataDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatGameDate, formatTimeUntilLock, isLocked } from "@/lib/lobbyLock";

interface ActiveLobby {
  id: string;
  invite_code: string;
  host_name: string;
  status: string;
  created_at: string;
  game_date: string | null;
  settings: LobbySettings;
  role: "host" | "player" | "—";
  player_count: number;
}

function formatHoursUntil(gameDate: string | null): string {
  if (!gameDate) return "—";
  const diffMs = new Date(gameDate).getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${minutes}m`;
  }
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return `${days}d ${remH}h`;
}

type Phase = "menu" | "setup" | "draft" | "choose" | "reveal";

const Index = () => {
  const navigate = useNavigate();
  const { history, addGame } = useGameHistory();
  const { isAdmin } = useIsAdmin();
  const [players, setPlayers] = useState(["Player 1", "Player 2", "Player 3"]);
  const [includePok, setIncludePok] = useState(false);
  const [excludedFactions, setExcludedFactions] = useState<Set<string>>(new Set());
  const [picksPerPlayer, setPicksPerPlayer] = useState(1);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [activeLobbies, setActiveLobbies] = useState<ActiveLobby[]>([]);
  const [lobbiesLoading, setLobbiesLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>("menu");
  const [tokenMapping, setTokenMapping] = useState<Map<number, Faction>>(new Map());
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentPickCount, setCurrentPickCount] = useState(0);
  const [playerTokens, setPlayerTokens] = useState<Map<number, number>>(new Map());
  const [choosingPlayerIndex, setChoosingPlayerIndex] = useState(0);
  const [finalAssignments, setFinalAssignments] = useState<{ player: string; faction: Faction }[]>([]);

  useEffect(() => {
    const fetchActiveLobbies = async () => {
      const sessionId = getSessionId();

      const { data: allLobbies } = await supabase
        .from("lobbies")
        .select("*")
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (!allLobbies || allLobbies.length === 0) {
        setActiveLobbies([]);
        setLobbiesLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data: myMemberships } = user
        ? await supabase
            .from("lobby_players")
            .select("lobby_id")
            .or(`user_id.eq.${user.id},session_id.eq.${sessionId}`)
        : await supabase.from("lobby_players").select("lobby_id").eq("session_id", sessionId);

      const joinedSet = new Set((myMemberships ?? []).map((m) => m.lobby_id));

      const lobbyIds = allLobbies.map((l) => l.id);
      const { data: counts } = await supabase
        .from("lobby_players")
        .select("lobby_id")
        .in("lobby_id", lobbyIds);

      const countMap: Record<string, number> = {};
      (counts ?? []).forEach((c) => {
        countMap[c.lobby_id] = (countMap[c.lobby_id] ?? 0) + 1;
      });

      const merged: ActiveLobby[] = allLobbies.map((l) => {
        const isHost = (user && l.host_user_id === user.id) || l.host_session_id === sessionId;
        return {
          ...l,
          settings: l.settings as unknown as LobbySettings,
          role: isHost ? "host" as const : joinedSet.has(l.id) ? "player" as const : "—" as const,
          player_count: countMap[l.id] ?? 0,
        };
      });

      setActiveLobbies(merged);
      setLobbiesLoading(false);
    };
    fetchActiveLobbies();
  }, []);

  const availableFactions = useMemo(() => {
    return [...TI4_FACTIONS, ...(includePok ? POK_FACTIONS : [])].filter(
      (f) => !excludedFactions.has(f.name)
    );
  }, [includePok, excludedFactions]);

  const canStart = availableFactions.length >= players.length * picksPerPlayer;

  const startDraft = useCallback(() => {
    const shuffled = [...availableFactions].sort(() => Math.random() - 0.5);
    const mapping = new Map<number, Faction>();
    shuffled.forEach((f, i) => mapping.set(i + 1, f));

    setTokenMapping(mapping);
    setPlayerTokens(new Map());
    setCurrentPlayerIndex(0);
    setCurrentPickCount(0);
    setChoosingPlayerIndex(0);
    setFinalAssignments([]);
    setPhase("draft");
  }, [availableFactions]);

  const selectToken = useCallback(
    (tokenId: number) => {
      const nextTokens = new Map(playerTokens);
      nextTokens.set(tokenId, currentPlayerIndex);
      setPlayerTokens(nextTokens);

      const newPickCount = currentPickCount + 1;

      if (newPickCount >= picksPerPlayer) {
        // This player is done picking
        if (currentPlayerIndex + 1 >= players.length) {
          // All players done
          if (picksPerPlayer === 1) {
            // Skip choose phase, go straight to reveal
            const assignments: { player: string; faction: Faction }[] = [];
            players.forEach((name, pIdx) => {
              for (const [tId, ownerIdx] of nextTokens.entries()) {
                if (ownerIdx === pIdx) {
                  const faction = tokenMapping.get(tId);
                  if (faction) assignments.push({ player: name, faction });
                  break;
                }
              }
            });
            setTimeout(() => {
              setFinalAssignments(assignments);
              setPhase("reveal");
            }, 400);
          } else {
            setTimeout(() => {
              setChoosingPlayerIndex(0);
              setPhase("choose");
            }, 400);
          }
        } else {
          setCurrentPlayerIndex((prev) => prev + 1);
          setCurrentPickCount(0);
        }
      } else {
        setCurrentPickCount(newPickCount);
      }
    },
    [currentPlayerIndex, currentPickCount, picksPerPlayer, players, playerTokens, tokenMapping]
  );

  const getPlayerFactions = useCallback(
    (playerIndex: number): { tokenId: number; faction: Faction }[] => {
      const result: { tokenId: number; faction: Faction }[] = [];
      for (const [tId, ownerIdx] of playerTokens.entries()) {
        if (ownerIdx === playerIndex) {
          const faction = tokenMapping.get(tId);
          if (faction) result.push({ tokenId: tId, faction });
        }
      }
      return result;
    },
    [playerTokens, tokenMapping]
  );

  const chooseFaction = useCallback(
    (faction: Faction) => {
      const newAssignments = [...finalAssignments, { player: players[choosingPlayerIndex], faction }];
      setFinalAssignments(newAssignments);

      if (choosingPlayerIndex + 1 >= players.length) {
        setTimeout(() => setPhase("reveal"), 400);
      } else {
        setChoosingPlayerIndex((prev) => prev + 1);
      }
    },
    [choosingPlayerIndex, players, finalAssignments]
  );

  const reset = useCallback(() => {
    setPhase("menu");
    setPlayerTokens(new Map());
    setFinalAssignments([]);
    setCurrentPlayerIndex(0);
    setCurrentPickCount(0);
    setChoosingPlayerIndex(0);
    setResultsSaved(false);
  }, []);

  const toggleFaction = useCallback((name: string) => {
    setExcludedFactions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen relative">
      <StarField />
      <ClaimGuestDataDialog />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <div className="flex justify-end mb-4">
          <UserMenu />
        </div>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <img
            src={tiEmblem}
            alt="Twilight Imperium Emblem"
            className="w-24 h-24 md:w-28 md:h-28 mx-auto mb-4 drop-shadow-[0_0_15px_hsl(42_85%_55%/0.3)]"
          />
          <div className="imperial-divider w-48 mx-auto mb-4" />
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Twilight Imperium
          </h1>
          <p className="font-display text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Race Randomizer
          </p>
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        <AnimatePresence mode="wait">
          {phase === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => setPhase("setup")}
                  size="lg"
                  className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Create Local Game
                </Button>
                <Button
                  onClick={() => navigate("/create")}
                  size="lg"
                  variant="outline"
                  className="font-display text-sm uppercase tracking-[0.2em] px-8 py-6 border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                >
                  <Users className="mr-2 h-5 w-5" />
                  Create Online Lobby
                </Button>
              </div>
              {/* Active Lobbies Table */}
              <div className="w-full mt-4">
                <div className="imperial-divider w-32 mx-auto mb-4" />
                <h2 className="font-display text-sm uppercase tracking-[0.3em] text-primary text-glow text-center mb-4">
                  Active Lobbies
                </h2>
                {lobbiesLoading ? (
                  <p className="text-center font-body text-muted-foreground text-sm">Loading...</p>
                ) : activeLobbies.length === 0 ? (
                  <div className="glass imperial-border rounded p-4 text-center">
                    <p className="font-body text-sm text-muted-foreground">No active lobbies. Create one to get started!</p>
                  </div>
                ) : (
                  <div className="glass imperial-border rounded overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground text-left px-4 py-3">Game</th>
                          <th className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground text-left px-4 py-3">When</th>
                          <th className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground text-center px-4 py-3">Players</th>
                          <th className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground text-center px-4 py-3">Status</th>
                          <th className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground text-right px-4 py-3">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeLobbies.map((l) => (
                          <tr
                            key={l.id}
                            onClick={() => navigate(`/lobby/${l.invite_code}`)}
                            className="border-b border-border/50 last:border-0 hover:bg-primary/5 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3">
                              <p className="font-display text-sm text-primary">{l.host_name}'s game</p>
                              <code className="font-body text-xs text-muted-foreground">{l.invite_code}</code>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-body text-sm text-muted-foreground">{formatGameDate(l.game_date)}</p>
                              {l.game_date ? (
                                <>
                                  <p className="font-body text-xs text-muted-foreground/70">
                                    Game in {formatHoursUntil(l.game_date)}
                                  </p>
                                  {isLocked(l.game_date) ? (
                                    <p className="font-body text-xs text-amber-400">Locked</p>
                                  ) : (
                                    <p className="font-body text-xs text-amber-400/80">
                                      Locks in {formatTimeUntilLock(l.game_date)}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="font-body text-xs text-muted-foreground/70">no date</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-body text-sm text-muted-foreground flex items-center justify-center gap-1">
                                <Users className="h-3 w-3" />
                                {l.player_count}/{l.settings.max_players}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                                {l.status === "ready" ? (
                                  <Check className="h-3.5 w-3.5 text-green-400" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                                )}
                                {l.status === "ready" ? "Ready" : "Waiting"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-xs font-body uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
                                {l.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Navigation Links */}
              <div className="w-full mt-4">
                <div className="imperial-divider w-32 mx-auto mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/factions")}
                    className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40 py-4"
                  >
                    <BookOpen className="mr-2 h-3.5 w-3.5" />
                    Faction Guide
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/rules")}
                    className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40 py-4"
                  >
                    <Bot className="mr-2 h-3.5 w-3.5" />
                    Rules Assistant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/history")}
                    className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40 py-4"
                  >
                    <Scroll className="mr-2 h-3.5 w-3.5" />
                    Game History{history.length > 0 ? ` (${history.length})` : ""}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/stats")}
                    className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40 py-4"
                  >
                    <BarChart3 className="mr-2 h-3.5 w-3.5" />
                    Stats
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/map-setup")}
                    className="col-span-2 font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40 py-4"
                  >
                    <Hexagon className="mr-2 h-3.5 w-3.5" />
                    Map Editor
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/users")}
                      className="col-span-2 font-display text-xs uppercase tracking-[0.15em] border-primary/40 text-primary hover:bg-primary/10 hover:border-primary py-4"
                    >
                      <Shield className="mr-2 h-3.5 w-3.5" />
                      User Administration
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="glass imperial-border rounded p-6 space-y-6 mb-6">
                <PlayerSetup
                  players={players}
                  onPlayersChange={setPlayers}
                  picksPerPlayer={picksPerPlayer}
                  onPicksPerPlayerChange={setPicksPerPlayer}
                />
                <div className="imperial-divider" />
                <FactionPool
                  includePok={includePok}
                  onIncludePokChange={setIncludePok}
                  excludedFactions={excludedFactions}
                  onToggleFaction={toggleFaction}
                />
              </div>

              <div className="flex flex-col items-center gap-3">
                <Button
                  onClick={startDraft}
                  disabled={!canStart}
                  size="lg"
                  className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Start Draft
                </Button>
                {!canStart && (
                  <p className="text-destructive text-sm font-body">
                    Not enough factions ({availableFactions.length}) for {players.length} players × {picksPerPlayer} picks = {players.length * picksPerPlayer} needed
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPhase("menu")}
                  className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                >
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Back
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "draft" && (
            <motion.div
              key="draft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center glass imperial-border rounded p-4">
                 <p className="text-muted-foreground text-base font-body uppercase tracking-[0.15em] mb-1">
                  Selecting token
                </p>
                <p className="font-display text-xl text-primary text-glow">
                  {players[currentPlayerIndex]}
                </p>
                 <p className="text-muted-foreground text-base font-body mt-1">
                  Pick {currentPickCount + 1} of {picksPerPlayer} · Player {currentPlayerIndex + 1} of {players.length}
                </p>
              </div>

              <TokenGrid
                totalTokens={availableFactions.length}
                takenTokens={playerTokens}
                players={players}
                onSelectToken={selectToken}
              />

              <div className="text-center">
                <Button variant="outline" size="sm" onClick={reset} className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40">
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Restart
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center glass imperial-border rounded p-4">
                <p className="text-muted-foreground text-base font-body uppercase tracking-[0.15em] mb-1">
                  Choose thy faction
                </p>
                <p className="font-display text-xl text-primary text-glow">
                  {players[choosingPlayerIndex]}
                </p>
                <p className="text-muted-foreground text-base font-body mt-1">
                  Player {choosingPlayerIndex + 1} of {players.length}
                </p>
              </div>

              <div className="grid gap-3">
                {getPlayerFactions(choosingPlayerIndex).map(({ faction }) => (
                  <motion.button
                    key={faction.name}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => chooseFaction(faction)}
                    className="w-full glass imperial-border rounded p-4 text-left transition-all hover:border-primary/60 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-sm border border-border flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, hsl(${faction.color}) 0%, hsl(${faction.color} / 0.4) 100%)`,
                        }}
                      />
                      <div>
                        <p className="font-display text-base uppercase tracking-[0.1em] text-primary">
                          {faction.name}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="text-center">
                <Button variant="outline" size="sm" onClick={reset} className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40">
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Restart
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "reveal" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h2 className="font-display text-base uppercase tracking-[0.3em] text-primary text-glow text-center">
                Assignments Revealed
              </h2>
              <div className="imperial-divider w-32 mx-auto" />
              <div className="grid gap-3">
                {finalAssignments.map((a, i) => (
                  <FactionCard
                    key={a.faction.name}
                    playerName={a.player}
                    faction={a.faction}
                    index={i}
                  />
                ))}
              </div>

              {!resultsSaved && (
                <>
                  <div className="imperial-divider w-32 mx-auto" />
                  <ResultsEntry
                    assignments={finalAssignments}
                    onSave={(game) => {
                      addGame(game);
                      setResultsSaved(true);
                    }}
                    onSkip={() => setResultsSaved(true)}
                  />
                </>
              )}

              <div className="flex justify-center gap-3 pt-4">
                <Button onClick={reset} size="lg" className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90">
                  <RotateCcw className="mr-2 h-5 w-5" />
                  New Game
                </Button>
                {resultsSaved && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate("/history")}
                    className="font-display text-sm uppercase tracking-[0.2em] px-6 py-6 border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                  >
                    <Scroll className="mr-2 h-5 w-5" />
                    History
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;

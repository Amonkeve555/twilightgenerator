import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Clock, ArrowLeft, Trash2, UserMinus, RotateCcw, Map as MapIcon, Pencil, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SeatingPanel from "@/components/SeatingPanel";
import GameDayReveal from "@/components/GameDayReveal";
import GameTimer from "@/components/GameTimer";
import { supabase } from "@/integrations/supabase/client";
import { useLobby, type LobbySettings } from "@/hooks/useLobby";
import { useAuth } from "@/hooks/useAuth";
import { getSessionId } from "@/lib/sessionId";
import { isLocked, formatGameDate } from "@/lib/lobbyLock";
import LockBanner from "@/components/LockBanner";
import EditGameDateDialog from "@/components/EditGameDateDialog";
import { isRevealed, getOptions, formatRevealDate } from "@/lib/reveal";
import { EyeOff } from "lucide-react";
import type { Faction } from "@/data/factions";

const LobbyView = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { lobby, players, loading, error } = useLobby(inviteCode);
  const [copied, setCopied] = useState(false);
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [starting, setStarting] = useState(false);
  const { user } = useAuth();
  const sessionId = useState(() => getSessionId())[0];

  const settings = lobby?.settings as LobbySettings | undefined;
  const picksPerPlayer = settings?.picks_per_player ?? 1;
  const draftMode = settings?.draft_mode ?? "token";
  const isFreeMode = draftMode === "free" || draftMode === "free_no_repeat";
  const isHost = !!user && lobby?.host_user_id === user.id;
  const locked = isLocked(lobby?.game_date);
  const revealed = isRevealed(lobby);
  const allPicked = players.length >= (settings?.max_players ?? 99) &&
    players.every((p) =>
      isFreeMode ? p.chosen_faction != null : (p.token_picks?.length ?? 0) >= picksPerPlayer
    );

  const draftModeLabel: Record<string, string> = {
    token: "Token Draft",
    token_no_repeat: "Token Draft · No Repeat",
    free: "Free Pick",
    free_no_repeat: "Free Pick · No Repeat",
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deleteLobby = async () => {
    if (!lobby || !confirm("Delete this lobby? This cannot be undone.")) return;
    setDeleting(true);
    await supabase.from("lobbies").delete().eq("id", lobby.id);
    navigate("/");
  };

  const kickPlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Kick ${playerName} from the lobby?`)) return;
    await supabase.from("lobby_players").delete().eq("id", playerId);
  };

  const resetDraft = async () => {
    if (!lobby) return;
    if (!confirm("Reset all draft picks? Players will need to pick again. Token mappings will be re-randomized.")) return;
    setResetting(true);
    const { data, error: err } = await supabase.rpc("reset_lobby_draft", {
      p_lobby_id: lobby.id,
    });
    setResetting(false);
    if (err) {
      toast.error("Failed to reset draft");
      console.error(err);
      return;
    }
    const result = data as { success?: boolean; error?: string };
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Draft reset");
  };

  const startGame = async () => {
    if (!lobby) return;
    if (!revealed && !confirm("Start the game now? This reveals everyone's race and the seating.")) return;
    setStarting(true);
    const { data, error: err } = await supabase.rpc("start_game", { p_lobby_id: lobby.id });
    setStarting(false);
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
          <p className="font-display text-destructive">{error || "Lobby not found"}</p>
          <Button variant="outline" onClick={() => navigate("/")} className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const inLobby = players.some((p) => p.user_id === user?.id || p.session_id === sessionId);
  const myPlayer = players.find((p) => p.user_id === user?.id) ?? players.find((p) => p.session_id === sessionId) ?? null;
  const myPicksDone = isFreeMode
    ? !!myPlayer?.chosen_faction
    : (myPlayer?.token_picks?.length ?? 0) >= picksPerPlayer;
  const needsToPick = !!myPlayer && !myPicksDone && !lobby?.started_at;

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Game Lobby
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <code className="font-body text-sm text-primary bg-secondary px-3 py-1 rounded">{inviteCode}</code>
            <Button variant="outline" size="icon" onClick={copyLink} className="h-7 w-7 border-border text-muted-foreground hover:text-primary hover:border-primary/40">
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {lobby?.game_date ? (
            <p className="font-body text-base text-muted-foreground mt-2 flex items-center justify-center gap-2 flex-wrap">
              <span>
                Game date: <span className="text-primary">{formatGameDate(lobby.game_date)}</span>
              </span>
              {isHost && !locked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDateOpen(true)}
                  className="h-7 px-2 border-border text-muted-foreground hover:text-primary hover:border-primary/40 font-body text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </p>
          ) : (
            isHost && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDateOpen(true)}
                  className="border-primary/50 text-primary hover:border-primary font-display text-xs uppercase tracking-[0.15em]"
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Set Game Date
                </Button>
              </div>
            )
          )}
          {lobby?.game_date && (
            <div className="max-w-xl mx-auto mt-4">
              <LockBanner gameDate={lobby.game_date} />
            </div>
          )}
          {lobby?.started_at && (
            <div className="flex justify-center mt-3">
              <GameTimer startedAt={lobby.started_at} endedAt={lobby.ended_at} />
            </div>
          )}
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="glass imperial-border rounded p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground font-body text-base flex-wrap">
              <Users className="h-4 w-4" />
              <span>{players.length}/{settings?.max_players} players</span>
              <span className="mx-2">·</span>
              <span>{draftModeLabel[draftMode] ?? "Token Draft"}</span>
              {!isFreeMode && (
                <>
                  <span className="mx-2">·</span>
                  <span>{picksPerPlayer} pick{picksPerPlayer > 1 ? "s" : ""} each</span>
                </>
              )}
            </div>
            {/* Fills up as players join; shimmers while the table is still filling */}
            <div className="mt-3 h-1.5 rounded-full bg-secondary/70 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${players.length < (settings?.max_players ?? 0) ? "gold-bar-live" : ""}`}
                style={{ background: "linear-gradient(90deg, hsl(var(--gold-dark)), hsl(var(--primary)), hsl(var(--gold-light)))", backgroundSize: "200% 100%" }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (players.length / Math.max(1, settings?.max_players ?? 1)) * 100)}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 18 }}
              />
            </div>
          </div>

          <div className="glass imperial-border rounded p-6 space-y-3">
            <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow mb-4">
              Players
            </h2>
            {players.length === 0 ? (
              <p className="text-center font-body text-sm text-muted-foreground flex items-center justify-center gap-2">
                <span className="live-dot live-dot-gold" aria-hidden="true" />
                Waiting for players to join...
              </p>
            ) : (
              <AnimatePresence initial={false}>
              {players.map((p, i) => {
                const hasPicked = isFreeMode
                  ? p.chosen_faction != null
                  : (p.token_picks?.length ?? 0) >= picksPerPlayer;
                const chosen = p.chosen_faction as unknown as Faction | null;
                const options = isFreeMode && chosen ? [chosen] : getOptions(p);
                const isMe = p.id === myPlayer?.id;
                // Choice is visible to the player themself, and to everyone once revealed.
                const choiceVisible = revealed || isMe;
                const hasChoice = options.length > 1 && !!chosen;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -24, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 24, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 24, delay: i * 0.04 }}
                    className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border card-lift"
                    style={p.display_color ? { boxShadow: `inset 3px 0 0 hsl(${p.display_color})` } : undefined}
                  >
                    <div>
                      <p className="font-display text-lg text-primary">{p.player_name}</p>
                      {hasPicked && options.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {options.map((f) => {
                            const isChosen = choiceVisible && chosen?.name === f.name;
                            const dimmed = choiceVisible && hasChoice && !isChosen;
                            return (
                              <span
                                key={f.name}
                                className={`text-sm font-body px-2 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity ${
                                  isChosen && options.length > 1 ? "border-primary text-primary" : "border-border"
                                } ${dimmed ? "opacity-40 line-through" : ""}`}
                                style={{ background: `hsl(${f.color} / 0.2)` }}
                                onClick={() => navigate(`/factions?search=${encodeURIComponent(f.name)}`)}
                                title={isChosen && options.length > 1 ? "Playing this race" : "View faction details"}
                              >
                                {f.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {hasPicked && options.length > 1 && (
                        <p className="font-body text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {revealed ? (
                            chosen ? <>Playing <span className="text-primary">{chosen.name}</span></> : "Hasn't chosen yet"
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" />
                              {chosen
                                ? isMe ? `You're playing ${chosen.name} · hidden from others` : "Race chosen · revealed on game day"
                                : isMe ? "You haven't chosen your race yet" : "Still deciding"}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPicked ? (
                        <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
                          <Check className="h-4 w-4 text-green-400 drop-shadow-[0_0_6px_hsl(140_70%_50%/0.7)]" />
                        </motion.span>
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
                      )}
                      {isHost && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => kickPlayer(p.id, p.player_name)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title={`Kick ${p.player_name}`}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              </AnimatePresence>
            )}
          </div>

          <GameDayReveal lobbyId={lobby.id} players={players} revealed={revealed} />

          <SeatingPanel
            lobbyId={lobby.id}
            players={players}
            isHost={isHost}
            playerCount={settings?.max_players ?? 6}
            customMap={lobby.custom_map}
            revealed={revealed}
            gameDate={lobby.game_date}
          />

          {isHost && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/lobby/${inviteCode}/map-editor`)}
                className="font-display text-xs uppercase tracking-[0.2em] border-primary/40 text-primary hover:bg-primary/10"
              >
                <MapIcon className="mr-2 h-3 w-3" />
                {lobby.custom_map ? "Edit custom map" : "Build custom map"}
              </Button>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            {!inLobby && !isHost && (
              <Button
                onClick={() => navigate(`/join/${inviteCode}`)}
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Join This Lobby
              </Button>
            )}
            {needsToPick && (
              <Button
                onClick={() => navigate(`/join/${inviteCode}`)}
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Resume Picking Your Faction
              </Button>
            )}
            {myPlayer && myPicksDone && !locked && !lobby?.started_at && (
              <Button
                onClick={() => navigate(`/join/${inviteCode}`)}
                variant="outline"
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] px-8 py-5 border-primary/40 text-primary hover:bg-primary/10"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Change My Faction
              </Button>
            )}
            <Button
              onClick={() => navigate(`/game/${inviteCode}`)}
              variant="outline"
              size="lg"
              className="font-display text-sm uppercase tracking-[0.2em] px-8 py-5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <MapIcon className="mr-2 h-4 w-4" />
              Open Game Board
            </Button>
            {allPicked && isHost && !lobby?.started_at && (
              <Button
                onClick={startGame}
                disabled={starting}
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {starting ? "Starting..." : "Start Game"}
              </Button>
            )}
            {allPicked && !revealed && lobby?.game_date && (
              <p className="font-body text-sm text-muted-foreground text-center flex items-center gap-1.5">
                <EyeOff className="h-3.5 w-3.5" />
                Races and seating are revealed on game day ({formatRevealDate(lobby.game_date)})
              </p>
            )}
            {allPicked && revealed && (
              <Button
                onClick={() => navigate(`/lobby/${inviteCode}/gameday`)}
                size="lg"
                variant={lobby?.started_at ? "default" : "outline"}
                className={
                  lobby?.started_at
                    ? "font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
                    : "font-display text-sm uppercase tracking-[0.2em] px-8 py-5 border-primary/40 text-primary hover:bg-primary/10"
                }
              >
                Game Day →
              </Button>
            )}
            <div className="flex gap-3 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              >
                <ArrowLeft className="mr-2 h-3 w-3" />
                Home
              </Button>
              {isHost && (
                <>
                  {!locked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetDraft}
                      disabled={resetting}
                      className="font-display text-xs uppercase tracking-[0.15em] border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    >
                      <RotateCcw className="mr-2 h-3 w-3" />
                      {resetting ? "Resetting..." : "Reset Draft"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deleteLobby}
                    disabled={deleting}
                    className="font-display text-xs uppercase tracking-[0.15em] border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    {deleting ? "Deleting..." : "Delete Lobby"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      {lobby && isHost && (
        <EditGameDateDialog
          lobbyId={lobby.id}
          currentDate={lobby.game_date}
          open={editDateOpen}
          onOpenChange={setEditDateOpen}
        />
      )}
    </div>
  );
};

export default LobbyView;

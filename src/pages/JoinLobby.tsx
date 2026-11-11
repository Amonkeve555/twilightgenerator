import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import StarField from "@/components/StarField";
import TokenGrid from "@/components/TokenGrid";
import FactionCard from "@/components/FactionCard";
import FactionPicker from "@/components/FactionPicker";
import FactionDetailDialog from "@/components/FactionDetailDialog";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/sessionId";
import { useLobby, type LobbySettings } from "@/hooks/useLobby";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getLastPlayedFactionVsOpponents } from "@/lib/lastPlayedFaction";
import { isLocked, formatGameDate } from "@/lib/lobbyLock";
import LockBanner from "@/components/LockBanner";
import type { Faction } from "@/data/factions";

type JoinPhase = "intro" | "pick" | "done";

const JoinLobby = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { lobby, players, loading, error } = useLobby(inviteCode);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [phase, setPhase] = useState<JoinPhase>("intro");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [tokenPicks, setTokenPicks] = useState<number[]>([]);
  const [assignedFactions, setAssignedFactions] = useState<Faction[]>([]);
  const [joining, setJoining] = useState(false);
  const [forbiddenTokens, setForbiddenTokens] = useState<Set<number>>(new Set());
  const [lastFactionName, setLastFactionName] = useState<string | null>(null);
  const [pendingFaction, setPendingFaction] = useState<string | null>(null);
  const [revealedFaction, setRevealedFaction] = useState<Faction | null>(null);
  const sessionId = useMemo(() => getSessionId(), []);
  const existingPlayer = players.find((p) => p.user_id === user?.id) ?? players.find((p) => p.session_id === sessionId);

  const settings = lobby?.settings as LobbySettings | undefined;
  const totalTokens = settings?.factions?.length ?? 0;
  const picksPerPlayer = settings?.picks_per_player ?? 1;
  const draftMode = settings?.draft_mode ?? "token";
  const isFreeMode = draftMode === "free" || draftMode === "free_no_repeat";
  const isNoRepeat = draftMode === "free_no_repeat" || draftMode === "token_no_repeat";
  const locked = isLocked(lobby?.game_date);

  const takenTokens = useMemo(() => {
    const map = new Map<number, number>();
    players.forEach((p, pIdx) => {
      p.token_picks?.forEach((t) => map.set(t, pIdx));
    });
    return map;
  }, [players]);

  const takenFactions = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((p) => {
      const cf = p.chosen_faction as unknown as Faction | null;
      if (cf?.name) map.set(cf.name, p.player_name);
    });
    // Optimistically include pending claim by current player
    if (pendingFaction && profile?.nickname && !map.has(pendingFaction)) {
      map.set(pendingFaction, profile.nickname);
    }
    return map;
  }, [players, pendingFaction, profile?.nickname]);

  const isFull = players.length >= (settings?.max_players ?? 99);
  const existingPlayerPicksDone = existingPlayer
    ? isFreeMode
      ? !!existingPlayer.chosen_faction
      : (existingPlayer.token_picks?.length ?? 0) >= picksPerPlayer
    : false;
  const effectivePhase: JoinPhase = existingPlayer
    ? existingPlayerPicksDone
      ? "done"
      : "pick"
    : phase;

  // Resume in-progress pick — re-sync whenever the player row changes
  useEffect(() => {
    if (!existingPlayer) return;
    const picks = existingPlayer.token_picks ?? [];
    const factions = (existingPlayer.assigned_factions as unknown as Faction[]) ?? [];
    setPlayerId(existingPlayer.id);
    setTokenPicks(picks);
    setAssignedFactions(factions);
    const isDone = isFreeMode
      ? !!existingPlayer.chosen_faction
      : picks.length >= picksPerPlayer;
    setPhase((prev) => {
      // Never get stuck on "done" if picks are actually incomplete
      if (!isDone) return "pick";
      // Don't bounce a finished player back from "done" view
      if (prev === "done") return "done";
      return "done";
    });
  }, [existingPlayer, picksPerPlayer, isFreeMode]);

  // If the player started as a guest on this device, link that row to their account before resuming.
  useEffect(() => {
    if (!user || !existingPlayer || existingPlayer.user_id || existingPlayer.session_id !== sessionId) return;

    supabase
      .from("lobby_players")
      .update({ user_id: user.id })
      .eq("id", existingPlayer.id)
      .is("user_id", null)
      .then(({ error: err }) => {
        if (err) console.error("Failed to claim existing player row", err);
      });
  }, [existingPlayer, sessionId, user]);

  // Fetch user's last played faction vs current authenticated opponents (for no-repeat modes)
  useEffect(() => {
    if (!isNoRepeat || !user || !lobby) {
      setLastFactionName(null);
      return;
    }
    const opponentIds = players
      .map((p) => p.user_id)
      .filter((uid): uid is string => !!uid && uid !== user.id);
    if (opponentIds.length === 0) {
      setLastFactionName(null);
      return;
    }
    let cancelled = false;
    getLastPlayedFactionVsOpponents(user.id, opponentIds).then((name) => {
      if (!cancelled) setLastFactionName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [isNoRepeat, user, lobby, players]);

  // Fetch forbidden tokens for token_no_repeat mode
  useEffect(() => {
    if (draftMode !== "token_no_repeat" || !lobby || !playerId) {
      setForbiddenTokens(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .rpc("get_forbidden_tokens", { p_lobby_id: lobby.id })
      .then(({ data }) => {
        if (cancelled) return;
        const arr = (data as number[] | null) ?? [];
        setForbiddenTokens(new Set(arr));
      });
    return () => {
      cancelled = true;
    };
  }, [draftMode, lobby, playerId, players]);

  const joinLobby = async () => {
    if (!lobby || !user || !profile?.nickname) return;
    setJoining(true);
    const { data, error: err } = await supabase
      .from("lobby_players")
      .insert({
        lobby_id: lobby.id,
        session_id: sessionId,
        user_id: user.id,
        player_name: profile.nickname,
      })
      .select("id")
      .single();
    setJoining(false);
    if (err) {
      console.error(err);
      toast.error(err.message);
      return;
    }
    setPlayerId(data.id);
    setPhase("pick");
  };

  const selectToken = useCallback(
    async (tokenId: number) => {
      if (!lobby || !playerId) return;
      if (forbiddenTokens.has(tokenId)) {
        toast.error("That token maps to the faction you played last game");
        return;
      }
      const { data, error: err } = await supabase.rpc("claim_token", {
        p_lobby_id: lobby.id,
        p_player_id: playerId,
        p_token_id: tokenId,
      });
      if (err) {
        toast.error("Failed to claim token");
        console.error(err);
        return;
      }
      const result = data as { success?: boolean; error?: string; faction?: Faction };
      if (result.error) { toast.error(result.error); return; }
      const newPicks = [...tokenPicks, tokenId];
      setTokenPicks(newPicks);
      if (result.faction) {
        setAssignedFactions((prev) => [...prev, result.faction as Faction]);
        setRevealedFaction(result.faction as Faction);
      }
      if (newPicks.length >= picksPerPlayer) setPhase("done");
    },
    [lobby, tokenPicks, playerId, picksPerPlayer, forbiddenTokens]
  );

  const selectFaction = useCallback(
    async (faction: Faction) => {
      if (!lobby || !playerId) return;
      if (pendingFaction) return; // prevent double-click while a claim is in flight
      setPendingFaction(faction.name);
      const { data, error: err } = await supabase.rpc("claim_faction", {
        p_lobby_id: lobby.id,
        p_player_id: playerId,
        p_faction: JSON.parse(JSON.stringify(faction)),
      });
      if (err) {
        toast.error("Failed to claim faction");
        console.error(err);
        setPendingFaction(null);
        return;
      }
      const result = data as { success?: boolean; error?: string };
      if (result.error) {
        const msg =
          result.error === "already_taken"
            ? "That faction was just taken"
            : result.error === "previous_faction"
            ? "You played that faction last game"
            : result.error;
        toast.error(msg);
        setPendingFaction(null);
        return;
      }
      setTokenPicks([0]);
      setAssignedFactions([faction]);
      setPendingFaction(null);
      setPhase("done");
    },
    [lobby, playerId, pendingFaction]
  );

  const changePick = useCallback(async () => {
    if (!playerId || !lobby) return;
    if (locked) {
      toast.error("Picks are locked (within 3 days of game)");
      return;
    }
    const { data, error: err } = await supabase.rpc("clear_player_pick", { p_player_id: playerId });
    if (err) {
      toast.error("Failed to clear pick");
      console.error(err);
      return;
    }
    const result = data as { success?: boolean; error?: string };
    if (result?.error) {
      toast.error(result.error === "locked" ? "Picks are locked (within 3 days of game)" : result.error);
      return;
    }
    setTokenPicks([]);
    setAssignedFactions([]);
    setPhase("pick");
  }, [playerId, lobby, locked]);

  // For free_no_repeat: relax forbidden if no other faction is available
  const freeForbiddenRelaxed = useMemo(() => {
    if (draftMode !== "free_no_repeat" || !lastFactionName) return false;
    const pool = settings?.factions ?? [];
    const otherAvailable = pool.some(
      (f) => f.name !== lastFactionName && !takenFactions.has(f.name)
    );
    return !otherAvailable;
  }, [draftMode, lastFactionName, settings, takenFactions]);


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
          <Button variant="outline" onClick={() => navigate("/")} className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const playerName = profile?.nickname ?? "Player";

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Join Game
          </h1>
          <p className="font-display text-sm uppercase tracking-[0.4em] text-muted-foreground">
            Lobby {inviteCode}
          </p>
          {lobby?.game_date && (
            <p className="font-body text-base text-muted-foreground mt-2">
              Game date: <span className="text-primary">{formatGameDate(lobby.game_date)}</span>
            </p>
          )}
          {lobby?.game_date && (
            <div className="mt-4">
              <LockBanner gameDate={lobby.game_date} />
            </div>
          )}
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        {effectivePhase === "intro" && !existingPlayer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {isFull ? (
              <div className="glass imperial-border rounded p-6 text-center">
                <p className="font-display text-destructive">Lobby is full ({settings?.max_players} players)</p>
              </div>
            ) : (
              <div className="glass imperial-border rounded p-6 space-y-4 text-center">
                <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow">
                  Joining as
                </h2>
                <p className="font-display text-2xl text-primary">{playerName}</p>
                <p className="font-body text-base text-muted-foreground">
                  {players.length}/{settings?.max_players} players joined · {picksPerPlayer} pick{picksPerPlayer > 1 ? "s" : ""} per player
                </p>
                <Button
                  onClick={joinLobby}
                  disabled={joining}
                  className="w-full font-display text-sm uppercase tracking-[0.2em] glow-primary bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {joining ? "Joining..." : "Join Game"}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {effectivePhase === "pick" && existingPlayer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="text-center glass imperial-border rounded p-4">
              <p className="text-muted-foreground text-base font-body uppercase tracking-[0.15em] mb-1">
                {isFreeMode ? "Choose your faction" : "Selecting tokens"}
              </p>
              <p className="font-display text-xl text-primary text-glow">{playerName}</p>
              {!isFreeMode && (
                <p className="text-muted-foreground text-base font-body mt-1">
                  Pick {tokenPicks.length + 1} of {picksPerPlayer}
                </p>
              )}
              {isNoRepeat && lastFactionName && (
                <p className="text-amber-400 text-sm font-body mt-2">
                  No-repeat: {lastFactionName} blocked (last game)
                </p>
              )}
            </div>
            {locked ? (
              <div className="glass imperial-border rounded p-6 text-center space-y-2">
                <p className="font-display text-base uppercase tracking-[0.2em] text-amber-400">
                  Picks Locked
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  The lobby is within 3 days of the game date. A faction will be auto-assigned shortly.
                </p>
              </div>
            ) : isFreeMode ? (
              <FactionPicker
                factions={settings?.factions ?? []}
                takenFactions={takenFactions}
                forbiddenFaction={draftMode === "free_no_repeat" ? lastFactionName : null}
                forbiddenRelaxed={freeForbiddenRelaxed}
                onSelect={selectFaction}
                pendingFaction={pendingFaction}
                showRandomPickButton
              />
            ) : (
              <TokenGrid
                totalTokens={totalTokens}
                takenTokens={takenTokens}
                players={players.map((p) => p.player_name)}
                onSelectToken={selectToken}
                forbiddenTokens={forbiddenTokens}
              />
            )}
          </motion.div>
        )}

        {effectivePhase === "done" && existingPlayer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="font-display text-base uppercase tracking-[0.3em] text-primary text-glow text-center">
              Your Assigned Factions
            </h2>
            <div className="imperial-divider w-32 mx-auto" />
            <div className="grid gap-3">
              {assignedFactions.map((f, i) => (
                <FactionCard key={f.name} playerName={playerName} faction={f} index={i} />
              ))}
            </div>
            {picksPerPlayer > 1 && (
              <p className="text-center font-body text-base text-muted-foreground">
                You'll choose which faction to play on game day
              </p>
            )}

            {playerId && assignedFactions[0] && (
              <div className="glass imperial-border rounded p-4 space-y-3">
                <p className="font-display text-xs uppercase tracking-[0.2em] text-primary text-center">
                  Choose your player color
                </p>
                <p className="text-center font-body text-xs text-muted-foreground">
                  Used in lobby and history. Defaults to faction color.
                </p>
                <div className="flex justify-center">
                  <ColorSwatchPicker
                    value={
                      players.find((p) => p.id === playerId)?.display_color ?? null
                    }
                    factionDefault={assignedFactions[0].color}
                    onChange={async (val) => {
                      const { error: err } = await supabase
                        .from("lobby_players")
                        .update({ display_color: val })
                        .eq("id", playerId);
                      if (err) toast.error("Failed to save color");
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              {!locked && (
                <Button
                  onClick={changePick}
                  variant="outline"
                  className="font-display text-xs uppercase tracking-[0.2em] border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                >
                  Change Pick
                </Button>
              )}
              <Button onClick={() => navigate(`/lobby/${inviteCode}`)} className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90">
                View Lobby
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <FactionDetailDialog
        faction={revealedFaction}
        open={!!revealedFaction}
        onOpenChange={(o) => { if (!o) setRevealedFaction(null); }}
      />
    </div>
  );
};

export default JoinLobby;

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameRecord, PlayerResult } from "@/types/gameHistory";
import type { Faction } from "@/data/factions";

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { ts: number; games: GameRecord[] }>();

async function fetchHistoryForUser(userId: string): Promise<GameRecord[]> {
  const [hostedRes, playedRes] = await Promise.all([
    supabase
      .from("lobbies")
      .select("id")
      .eq("host_user_id", userId)
      .eq("status", "completed"),
    supabase.from("lobby_players").select("lobby_id").eq("user_id", userId),
  ]);

  const lobbyIdSet = new Set<string>([
    ...(hostedRes.data ?? []).map((l) => l.id),
    ...(playedRes.data ?? []).map((r) => r.lobby_id),
  ]);
  if (lobbyIdSet.size === 0) return [];

  const lobbyIds = Array.from(lobbyIdSet);
  const [lobbiesRes, playersRes] = await Promise.all([
    supabase
      .from("lobbies")
      .select("*")
      .in("id", lobbyIds)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase.from("lobby_players").select("*").in("lobby_id", lobbyIds),
  ]);

  const lobbies = lobbiesRes.data;
  const players = playersRes.data;
  if (!lobbies || !players) return [];

  const playersByLobby = new Map<string, typeof players>();
  for (const p of players) {
    const arr = playersByLobby.get(p.lobby_id) || [];
    arr.push(p);
    playersByLobby.set(p.lobby_id, arr);
  }

  return lobbies
    .map((lobby) => {
      const lobbyPlayers = playersByLobby.get(lobby.id) || [];
      const playersWithResults = lobbyPlayers.filter(
        (p) => p.chosen_faction && p.rank !== null
      );
      if (playersWithResults.length === 0) return null;

      const playerResults: PlayerResult[] = playersWithResults.map((p) => ({
        player: p.player_name,
        faction: p.chosen_faction as unknown as Faction,
        vp: p.vp ?? 0,
        rank: p.rank!,
        playerId: p.id,
        displayColor: (p as { display_color?: string | null }).display_color ?? null,
        seatIndex: (p as { seat_index?: number | null }).seat_index ?? null,
      }));

      const lobbySettings = (lobby as { settings?: { max_players?: number } }).settings;
      const playerCount = lobbySettings?.max_players ?? lobbyPlayers.length;

      const tileControl = ((lobby as { tile_control?: unknown }).tile_control ?? null) as
        | Record<string, number>
        | null;

      return {
        id: `online-${lobby.id}`,
        date: lobby.created_at,
        players: playerResults,
        hostUserId: lobby.host_user_id ?? undefined,
        playerCount,
        tileControl,
        startedAt: ((lobby as { started_at?: string | null }).started_at) ?? null,
        endedAt: ((lobby as { ended_at?: string | null }).ended_at) ?? null,
      };
    })
    .filter(Boolean) as GameRecord[];
}

export function useOnlineGameHistory() {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setGames([]);
      setLoading(false);
      return;
    }

    const cached = cache.get(user.id);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setGames(cached.games);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchHistoryForUser(user.id);
    cache.set(user.id, { ts: Date.now(), games: result });
    setGames(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);

  return { games, loading, refetch };
}

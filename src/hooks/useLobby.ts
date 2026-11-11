import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isLocked } from "@/lib/lobbyLock";
import type { Faction } from "@/data/factions";

export type DraftMode = "token" | "token_no_repeat" | "free" | "free_no_repeat";

export interface LobbySettings {
  factions: Faction[];
  picks_per_player: number;
  max_players: number;
  draft_mode?: DraftMode;
}

export interface LobbyRow {
  id: string;
  invite_code: string;
  host_session_id: string;
  host_user_id: string | null;
  host_name: string;
  
  settings: LobbySettings;
  status: string;
  token_mapping: Record<string, Faction> | null;
  tile_control: Record<string, number> | null;
  custom_map: import("@/lib/customMap").CustomMap | null;
  started_at: string | null;
  ended_at: string | null;
  game_date: string | null;
  created_at: string;
}

export interface LobbyPlayerRow {
  id: string;
  lobby_id: string;
  session_id: string;
  user_id: string | null;
  player_name: string;
  token_picks: number[] | null;
  assigned_factions: Faction[] | null;
  chosen_faction: Faction | null;
  vp: number | null;
  rank: number | null;
  joined_at: string;
  display_color: string | null;
  seat_index: number | null;
}

export function useLobby(inviteCode: string | undefined) {
  const [lobby, setLobby] = useState<LobbyRow | null>(null);
  const [players, setPlayers] = useState<LobbyPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLobby = useCallback(async () => {
    if (!inviteCode) return;
    
    const { data, error: err } = await supabase
      .from("lobbies")
      .select("*")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setError("Lobby not found");
      setLoading(false);
      return;
    }

    setLobby({
      ...data,
      settings: data.settings as unknown as LobbySettings,
      token_mapping: data.token_mapping as unknown as Record<string, Faction> | null,
      tile_control: ((data as { tile_control?: unknown }).tile_control as Record<string, number> | null) ?? {},
      custom_map: ((data as { custom_map?: unknown }).custom_map as import("@/lib/customMap").CustomMap | null) ?? null,
      started_at: ((data as { started_at?: string | null }).started_at) ?? null,
      ended_at: ((data as { ended_at?: string | null }).ended_at) ?? null,
      game_date: ((data as { game_date?: string | null }).game_date) ?? null,
    });
    setError(null);
  }, [inviteCode]);

  const fetchPlayers = useCallback(async () => {
    if (!lobby) return;
    
    const { data } = await supabase
      .from("lobby_players")
      .select("*")
      .eq("lobby_id", lobby.id)
      .order("joined_at", { ascending: true });

    if (data) {
      setPlayers(
        data.map((p) => ({
          ...p,
          assigned_factions: p.assigned_factions as unknown as Faction[] | null,
          chosen_faction: p.chosen_faction as unknown as Faction | null,
        }))
      );
    }
    setLoading(false);
  }, [lobby]);

  useEffect(() => {
    fetchLobby();
  }, [fetchLobby]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Real-time subscriptions
  useEffect(() => {
    if (!lobby) return;

    const channel = supabase
      .channel(`lobby-${lobby.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobby_players", filter: `lobby_id=eq.${lobby.id}` },
        () => fetchPlayers()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lobbies", filter: `id=eq.${lobby.id}` },
        () => fetchLobby()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobby?.id, fetchPlayers, fetchLobby]);

  // Auto-assign random factions once we enter the lock window (3 days before game_date)
  const autoAssignedRef = useRef(false);
  useEffect(() => {
    if (!lobby) return;
    if (autoAssignedRef.current) return;
    if (!isLocked(lobby.game_date)) return;
    const settings = lobby.settings;
    const draftMode = settings?.draft_mode ?? "token";
    const isFreeMode = draftMode === "free" || draftMode === "free_no_repeat";
    const picksPerPlayer = settings?.picks_per_player ?? 1;
    const incomplete = players.some((p) =>
      isFreeMode ? !p.chosen_faction : (p.token_picks?.length ?? 0) < picksPerPlayer
    );
    if (!incomplete) return;
    autoAssignedRef.current = true;
    supabase.rpc("auto_assign_missing_factions", { p_lobby_id: lobby.id }).then(({ error: err }) => {
      if (err) {
        console.error("auto_assign_missing_factions", err);
        autoAssignedRef.current = false;
      }
    });
  }, [lobby, players]);

  return { lobby, players, loading, error, refetch: fetchPlayers };
}

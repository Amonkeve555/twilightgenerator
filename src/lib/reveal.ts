/**
 * Game-day reveal rules.
 *
 * Before game day, everyone can see the factions each player *could* play
 * (their drafted options), but not which one they actually chose, and not
 * where they sit. On game day (or once the host starts the game) both the
 * chosen factions and the seating are revealed to everyone.
 */
import type { Faction } from "@/data/factions";
import type { LobbyPlayerRow, LobbyRow } from "@/hooks/useLobby";
import type { SeatOccupant } from "@/components/MapSetupHex";

type RevealLobby = Pick<LobbyRow, "game_date" | "started_at" | "ended_at" | "status">;

/** Start of the game day in the viewer's local time zone. */
export function getRevealTime(gameDate: string | null | undefined): Date | null {
  if (!gameDate) return null;
  const d = new Date(gameDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isRevealed(lobby: RevealLobby | null | undefined, now: Date = new Date()): boolean {
  if (!lobby) return false;
  if (lobby.started_at || lobby.ended_at || lobby.status === "completed") return true;
  const reveal = getRevealTime(lobby.game_date);
  return !!reveal && now.getTime() >= reveal.getTime();
}

/** The factions a player can choose from (public from the start). */
export function getOptions(p: LobbyPlayerRow): Faction[] {
  return ((p.assigned_factions as Faction[] | null) ?? []).filter(Boolean);
}

/**
 * The faction to show publicly for a player.
 * Before the reveal this is only known when the player has a single option
 * (so the option *is* the pick); otherwise it stays hidden.
 */
export function getVisibleFaction(p: LobbyPlayerRow, revealed: boolean): Faction | null {
  const chosen = (p.chosen_faction as Faction | null) ?? null;
  const options = getOptions(p);
  if (revealed) return chosen ?? (options.length === 1 ? options[0] : null);
  return options.length === 1 ? options[0] : null;
}

/**
 * Seat -> occupant map for the hex overlay.
 * Until the reveal, a player sees their own seat and which other seats are
 * taken (not by whom); the host sees everyone. Nobody sees a hidden faction
 * choice on the map.
 */
export function buildSeats(
  players: LobbyPlayerRow[],
  opts: { revealed: boolean; isHost: boolean; viewerPlayerId?: string | null },
): Record<number, SeatOccupant> {
  const m: Record<number, SeatOccupant> = {};
  // Before the reveal a player sees who sits only in their own seat; the host sees all.
  const onlyMine = !opts.revealed && !opts.isHost;
  for (const p of players) {
    if (p.seat_index === null || p.seat_index === undefined) continue;
    if (onlyMine && p.id !== opts.viewerPlayerId) {
      // Show that the seat is taken, but not by whom.
      m[p.seat_index] = { playerId: "", playerName: "Taken", factionColor: null, anonymous: true };
      continue;
    }
    const f = getVisibleFaction(p, opts.revealed);
    m[p.seat_index] = {
      playerId: p.id,
      playerName: p.player_name,
      factionColor: f?.color ?? p.display_color ?? null,
      factionName: f?.name,
    };
  }
  return m;
}

export function formatRevealDate(gameDate: string | null | undefined): string | null {
  const r = getRevealTime(gameDate);
  if (!r) return null;
  return r.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

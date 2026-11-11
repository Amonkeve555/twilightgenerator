import type { Faction } from "@/data/factions";

export interface PlayerResult {
  player: string;
  faction: Faction;
  vp: number;
  rank: number;
  /** lobby_players.id — present only for online games */
  playerId?: string;
  /** Optional override HSL color string (e.g. "42 85% 55%"). */
  displayColor?: string | null;
  /** 0-based seat index referencing the home-system order returned by getHomeSeats. */
  seatIndex?: number | null;
}

export interface GameRecord {
  id: string;
  date: string; // ISO string
  players: PlayerResult[];
  /** lobby host user id — present only for online games */
  hostUserId?: string;
  /** Player count at game time (for rendering the seating mini-map) */
  playerCount?: number;
  /** Map of "q,r" -> seat_index for tile control at game end */
  tileControl?: Record<string, number> | null;
  /** ISO timestamp when host pressed Start Game */
  startedAt?: string | null;
  /** ISO timestamp when results were saved */
  endedAt?: string | null;
}

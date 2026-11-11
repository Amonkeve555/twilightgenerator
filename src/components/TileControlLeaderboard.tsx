import { useMemo } from "react";
import { Crown } from "lucide-react";
import type { LobbyPlayerRow } from "@/hooks/useLobby";
import type { Faction } from "@/data/factions";

const PLAYER_COLORS = [
  "hsl(42 85% 55%)",
  "hsl(0 75% 60%)",
  "hsl(195 80% 55%)",
  "hsl(135 55% 50%)",
  "hsl(280 65% 65%)",
  "hsl(25 85% 55%)",
  "hsl(330 70% 60%)",
  "hsl(220 70% 65%)",
];

interface Props {
  players: LobbyPlayerRow[];
  tileControl: Record<string, number>;
  totalClaimableTiles: number;
}

const TileControlLeaderboard = ({ players, tileControl, totalClaimableTiles }: Props) => {
  const seated = useMemo(
    () =>
      players.filter(
        (p) => p.seat_index !== null && p.seat_index !== undefined
      ),
    [players]
  );

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const seat of Object.values(tileControl)) {
      if (typeof seat !== "number") continue;
      map.set(seat, (map.get(seat) ?? 0) + 1);
    }
    return map;
  }, [tileControl]);

  const rows = useMemo(() => {
    return seated
      .map((p) => {
        const seat = p.seat_index!;
        const chosen = (p.chosen_faction as Faction | null) ?? null;
        const assigned = (p.assigned_factions as Faction[] | null) ?? null;
        const f = chosen ?? (assigned && assigned.length === 1 ? assigned[0] : null);
        const color = f?.color
          ? `hsl(${f.color})`
          : PLAYER_COLORS[seat] ?? PLAYER_COLORS[0];
        return {
          id: p.id,
          seat,
          name: p.player_name,
          factionName: f?.name ?? "—",
          color,
          tiles: counts.get(seat) ?? 0,
        };
      })
      .sort((a, b) => b.tiles - a.tiles || a.seat - b.seat);
  }, [seated, counts]);

  const leaderTiles = rows[0]?.tiles ?? 0;

  return (
    <div className="glass imperial-border rounded p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base uppercase tracking-[0.2em] text-primary text-glow">
          Tile Control
        </h2>
        <span className="font-body text-xs text-muted-foreground">
          {Object.keys(tileControl).length}/{totalClaimableTiles} tiles claimed
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground text-center italic">
          Assign seats in the lobby to start tracking tile control.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const pct =
              totalClaimableTiles > 0
                ? Math.round((r.tiles / totalClaimableTiles) * 100)
                : 0;
            const isLeader = r.tiles > 0 && r.tiles === leaderTiles;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 p-2 rounded bg-secondary/40 border border-border"
              >
                <span
                  className="inline-block w-5 h-5 rounded-sm border border-border shrink-0"
                  style={{ background: r.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm text-primary truncate">
                      Seat {r.seat + 1} · {r.name}
                    </span>
                    {isLeader && (
                      <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="font-body text-xs text-muted-foreground truncate">
                    {r.factionName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg text-primary leading-none">
                    {r.tiles}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {pct}%
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TileControlLeaderboard;

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MAP_SETUPS, getHomeSeats } from "@/data/mapSetups";
import type { PlayerResult } from "@/types/gameHistory";
import { resolveDisplayColor } from "@/lib/playerColors";

type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;

interface Props {
  players: PlayerResult[];
  playerCount: number;
  tileControl?: Record<string, number> | null;
}

function clampCount(n: number): PlayerCount {
  if (n <= 3) return 3;
  if (n >= 8) return 8;
  return n as PlayerCount;
}

function axialToPixel(q: number, r: number, size: number) {
  const x = size * 1.5 * q;
  const y = size * Math.sqrt(3) * (r + q / 2);
  return { x, y };
}

function hexPoints(cx: number, cy: number, size: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

const HistoryMiniMap = ({ players, playerCount, tileControl }: Props) => {
  const count = clampCount(playerCount);
  const setup = MAP_SETUPS[count];
  const seatOrder = useMemo(() => getHomeSeats(count), [count]);
  const HEX_SIZE = 14;

  const seatedPlayers = players.filter(
    (p) => p.seatIndex !== null && p.seatIndex !== undefined
  );

  const { viewBox } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    setup.cells.forEach((c) => {
      const { x, y } = axialToPixel(c.q, c.r, HEX_SIZE);
      const w = HEX_SIZE * Math.sqrt(3);
      const h = HEX_SIZE * 2;
      minX = Math.min(minX, x - w / 2);
      maxX = Math.max(maxX, x + w / 2);
      minY = Math.min(minY, y - h / 2);
      maxY = Math.max(maxY, y + h / 2);
    });
    const pad = 4;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    };
  }, [setup]);

  // Don't render if no seating data and no tile control
  const hasTileControl = !!tileControl && Object.keys(tileControl).length > 0;
  if (seatedPlayers.length === 0 && !hasTileControl) return null;

  const seatMap = new Map<number, PlayerResult>();
  for (const p of seatedPlayers) seatMap.set(p.seatIndex!, p);

  const homeCoordToSeat = new Map<string, number>();
  seatOrder.forEach((c, i) => homeCoordToSeat.set(`${c.q},${c.r}`, i));

  return (
    <TooltipProvider delayDuration={100}>
      <svg
        viewBox={viewBox}
        className="w-full h-auto"
        style={{ maxHeight: 180 }}
        role="img"
        aria-label={`Seating map for ${count}-player game`}
      >
        {setup.cells.map((c, i) => {
          const { x, y } = axialToPixel(c.q, c.r, HEX_SIZE);
          const seatIdx = homeCoordToSeat.get(`${c.q},${c.r}`);
          const occupant = seatIdx !== undefined ? seatMap.get(seatIdx) : undefined;

          let fill = "hsl(220 30% 12% / 0.35)";
          let stroke = "hsl(220 25% 30% / 0.4)";
          let strokeWidth = 0.8;
          let dash: string | undefined;

          // Tile control override (any non-hyperlane cell)
          const tcSeat =
            tileControl && c.role !== "hyperlane"
              ? tileControl[`${c.q},${c.r}`]
              : undefined;
          if (typeof tcSeat === "number") {
            const owner = seatMap.get(tcSeat);
            const colorHsl = owner
              ? resolveDisplayColor(owner.faction.color, owner.displayColor)
              : "220 25% 50%";
            fill = `hsl(${colorHsl} / 0.6)`;
            stroke = `hsl(${colorHsl})`;
            strokeWidth = c.role === "mecatol" ? 1.5 : 1.2;
          } else if (c.role === "mecatol") {
            fill = "hsl(190 70% 45% / 0.35)";
            stroke = "hsl(190 80% 60%)";
            strokeWidth = 1.5;
          } else if (c.role === "home") {
            if (occupant) {
              const c2 = resolveDisplayColor(
                occupant.faction.color,
                occupant.displayColor
              );
              fill = `hsl(${c2} / 0.6)`;
              stroke = `hsl(${c2})`;
              strokeWidth = 1.5;
            } else {
              fill = "hsl(220 25% 25% / 0.4)";
              stroke = "hsl(220 25% 45% / 0.5)";
              strokeWidth = 1;
            }
          } else if (c.role === "hyperlane") {
            fill = "hsl(280 50% 35% / 0.3)";
            stroke = "hsl(280 65% 65% / 0.7)";
            dash = "2 1.5";
          }

          const tip =
            c.role === "mecatol"
              ? "Mecatol Rex"
              : c.role === "home"
              ? occupant
                ? `Seat ${seatIdx! + 1} — ${occupant.player} · ${occupant.faction.shortName}`
                : `Seat ${(seatIdx ?? 0) + 1} — empty`
              : null;

          const polygon = (
            <polygon
              points={hexPoints(x, y, HEX_SIZE - 0.8)}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
            />
          );

          if (!tip) {
            return <g key={i}>{polygon}</g>;
          }

          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <g style={{ cursor: "default" }}>
                  {polygon}
                  {c.role === "home" && seatIdx !== undefined && (
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fontFamily="Cinzel, serif"
                      fontSize={10}
                      fontWeight={700}
                      fill="hsl(0 0% 98%)"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {seatIdx + 1}
                    </text>
                  )}
                </g>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-body text-xs">
                {tip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </svg>
    </TooltipProvider>
  );
};

export default HistoryMiniMap;

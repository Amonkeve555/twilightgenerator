import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HexCell, MapSetup } from "@/data/mapSetups";
import { ROLE_LABELS } from "@/data/mapSetups";

// Player accent colors (HSL strings) — distinct hues, themed to fit the imperial palette.
const PLAYER_COLORS = [
  "hsl(42 85% 55%)",   // gold (P1)
  "hsl(0 75% 60%)",    // red (P2)
  "hsl(195 80% 55%)",  // cyan (P3)
  "hsl(135 55% 50%)",  // green (P4)
  "hsl(280 65% 65%)",  // purple (P5)
  "hsl(25 85% 55%)",   // orange (P6)
  "hsl(330 70% 60%)",  // pink (P7)
  "hsl(220 70% 65%)",  // blue (P8)
];

export interface SeatOccupant {
  playerId: string;
  playerName: string;
  /** HSL string fragment, e.g. "42 85% 55%" — used as faction color */
  factionColor?: string | null;
  factionName?: string;
  /** Someone sits here but who is secret until game day (shown as "taken"). */
  anonymous?: boolean;
}

interface Props {
  setup: MapSetup;
  /** Map of seat_index -> occupant for seating overlay (optional) */
  seats?: Record<number, SeatOccupant>;
  /** Ordered home cells (use getHomeSeats); when present + seats given, draws seat numbers + occupants */
  seatOrder?: HexCell[];
  /** Click handler for a home seat (only fires when seatOrder is provided) */
  onSeatClick?: (seatIndex: number, occupant?: SeatOccupant) => void;
  /** Compact mode for thumbnails (smaller hexes, no labels other than seat) */
  compact?: boolean;
  /** Map of "q,r" -> seat_index for tile-control overlay (game board mode) */
  tileControl?: Record<string, number>;
  /** Click handler for any tile (game board mode). Receives q, r and current owner seat. */
  onTileClick?: (q: number, r: number, currentSeat: number | undefined) => void;
  /** Editor mode: render uniform neutral styling without seat numbers, tile numbers, or per-player colors. */
  neutral?: boolean;
  /** Render a faint snap grid of empty hexes within `range` axial distance of origin, behind real tiles. */
  gridGuide?: { range: number };
}

// Flat-top hex axial -> pixel
function axialToPixel(q: number, r: number, size: number) {
  const x = size * 1.5 * q;
  const y = size * Math.sqrt(3) * (r + q / 2);
  return { x, y };
}

function hexPoints(cx: number, cy: number, size: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i); // flat-top
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

const MapSetupHex = ({ setup, seats, seatOrder, onSeatClick, compact, tileControl, onTileClick, neutral, gridGuide }: Props) => {
  const HEX_SIZE = compact ? 18 : 34;

  // Map from "q,r" -> seat_index for quick lookup
  const seatIndexByCoord = useMemo(() => {
    const m = new Map<string, number>();
    if (seatOrder) seatOrder.forEach((c, i) => m.set(`${c.q},${c.r}`, i));
    return m;
  }, [seatOrder]);

  const guideCoords = useMemo(() => {
    if (!gridGuide) return [] as Array<{ q: number; r: number }>;
    const taken = new Set(setup.cells.map((c) => `${c.q},${c.r}`));
    const out: Array<{ q: number; r: number }> = [];
    const R = gridGuide.range;
    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > R) continue;
        if (taken.has(`${q},${r}`)) continue;
        out.push({ q, r });
      }
    }
    return out;
  }, [gridGuide, setup]);

  const { cells, viewBox } = useMemo(() => {
    const cells = setup.cells;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const consider = (q: number, r: number) => {
      const { x, y } = axialToPixel(q, r, HEX_SIZE);
      const w = HEX_SIZE * Math.sqrt(3);
      const h = HEX_SIZE * 2;
      minX = Math.min(minX, x - w / 2);
      maxX = Math.max(maxX, x + w / 2);
      minY = Math.min(minY, y - h / 2);
      maxY = Math.max(maxY, y + h / 2);
    };
    cells.forEach((c) => consider(c.q, c.r));
    guideCoords.forEach((c) => consider(c.q, c.r));
    if (!isFinite(minX)) {
      minX = -HEX_SIZE; maxX = HEX_SIZE; minY = -HEX_SIZE; maxY = HEX_SIZE;
    }
    const pad = 8;
    const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
    return { cells, viewBox: vb };
  }, [setup, guideCoords, HEX_SIZE]);

  const seatColor = (seatIdx: number): string => {
    const occ = seats?.[seatIdx];
    if (occ?.factionColor) return `hsl(${occ.factionColor})`;
    return PLAYER_COLORS[seatIdx] ?? PLAYER_COLORS[0];
  };

  const tileControlSeat = (c: HexCell): number | undefined => {
    if (!tileControl) return undefined;
    const v = tileControl[`${c.q},${c.r}`];
    return typeof v === "number" ? v : undefined;
  };

  const homeColorOverride = (c: HexCell): string | undefined => {
    if (c.role !== "home") return undefined;
    const seatIdx = seatIndexByCoord.get(`${c.q},${c.r}`);
    if (seatIdx === undefined) return undefined;
    const occ = seats?.[seatIdx];
    if (occ?.factionColor) return `hsl(${occ.factionColor})`;
    return undefined;
  };

  const cellStyle = (c: HexCell) => {
    if (neutral) {
      if (c.role === "hyperlane") {
        return {
          fill: "hsl(280 50% 35% / 0.35)",
          stroke: "hsl(280 65% 65%)",
          strokeWidth: 1.5,
          strokeDasharray: "3 2",
        };
      }
      if (c.role === "mecatol") {
        return {
          fill: "hsl(190 70% 45% / 0.3)",
          stroke: "hsl(190 80% 60%)",
          strokeWidth: 2,
        };
      }
      if (c.role === "home") {
        const seatIdx = seatIndexByCoord.get(`${c.q},${c.r}`);
        if (seatIdx !== undefined && seats?.[seatIdx]?.anonymous) {
          // Taken by someone else (identity secret): greyed out.
          return {
            fill: "hsl(220 10% 28% / 0.6)",
            stroke: "hsl(220 10% 50%)",
            strokeWidth: 1.5,
            strokeDasharray: "4 3",
          };
        }
        return {
          fill: "hsl(42 70% 45% / 0.35)",
          stroke: "hsl(42 85% 55%)",
          strokeWidth: 2.5,
        };
      }
      return {
        fill: "hsl(220 25% 22% / 0.5)",
        stroke: "hsl(220 25% 50% / 0.6)",
        strokeWidth: 1.25,
      };
    }
    // Tile-control overlay (game board mode) — applies to any non-hyperlane tile.
    const tcSeat = tileControlSeat(c);
    if (tcSeat !== undefined && c.role !== "hyperlane") {
      const color = seatColor(tcSeat);
      // Mecatol keeps its distinct cyan ring even when claimed.
      if (c.role === "mecatol") {
        return {
          fill: `${color.replace(")", " / 0.55)")}`,
          stroke: "hsl(190 80% 70%)",
          strokeWidth: 2.5,
        };
      }
      return {
        fill: `${color.replace(")", " / 0.6)")}`,
        stroke: color,
        strokeWidth: 2,
      };
    }

    switch (c.role) {
      case "mecatol":
        return {
          fill: "hsl(190 70% 45% / 0.3)",
          stroke: "hsl(190 80% 60%)",
          strokeWidth: 2.5,
        };
      case "home": {
        const overrideColor = homeColorOverride(c);
        const color = overrideColor ?? (PLAYER_COLORS[(c.player ?? 1) - 1] ?? PLAYER_COLORS[0]);
        return {
          fill: `${color.replace(")", " / 0.55)")}`,
          stroke: color,
          strokeWidth: 2.5,
        };
      }
      case "slice": {
        if (seatOrder || tileControl) {
          return {
            fill: "hsl(220 25% 25% / 0.5)",
            stroke: "hsl(220 25% 50% / 0.6)",
            strokeWidth: 1.25,
          };
        }
        const color = PLAYER_COLORS[(c.player ?? 1) - 1] ?? PLAYER_COLORS[0];
        return {
          fill: `${color.replace(")", " / 0.18)")}`,
          stroke: `${color.replace(")", " / 0.6)")}`,
          strokeWidth: 1.25,
        };
      }
      case "equidistant":
        return {
          fill: "hsl(220 25% 25% / 0.5)",
          stroke: "hsl(220 25% 50% / 0.6)",
          strokeWidth: 1.25,
        };
      case "home-option":
        return {
          fill: "hsl(135 60% 45% / 0.4)",
          stroke: "hsl(135 70% 55%)",
          strokeWidth: 2,
        };
      case "blue":
        return {
          fill: "hsl(210 70% 45% / 0.45)",
          stroke: "hsl(210 80% 65%)",
          strokeWidth: 1.5,
        };
      case "red":
        return {
          fill: "hsl(0 65% 40% / 0.45)",
          stroke: "hsl(0 75% 60%)",
          strokeWidth: 1.5,
        };
      case "hyperlane":
        return {
          fill: "hsl(280 50% 35% / 0.45)",
          stroke: "hsl(280 65% 65%)",
          strokeWidth: 1.5,
          strokeDasharray: "3 2",
        };
      default:
        return {
          fill: "hsl(220 30% 12% / 0.4)",
          stroke: "hsl(220 25% 35% / 0.4)",
          strokeWidth: 1,
        };
    }
  };

  const cellLabel = (c: HexCell) => {
    if (neutral) {
      if (c.role === "home") {
        const seatIdx = seatIndexByCoord.get(`${c.q},${c.r}`);
        if (seatIdx !== undefined) return `${seatIdx + 1}`;
      }
      if (c.label) return c.label.length > 10 ? c.label.slice(0, 10) + "…" : c.label;
      return "";
    }
    if (c.role === "mecatol") return compact ? "" : "MR";
    if (c.role === "home") {
      const seatIdx = seatIndexByCoord.get(`${c.q},${c.r}`);
      if (seatIdx !== undefined) {
        return `${seatIdx + 1}`;
      }
      return compact ? "" : `P${c.player}`;
    }
    if (compact) return c.label ? "" : "";
    if (c.label) return c.label.length > 10 ? c.label.slice(0, 10) + "…" : c.label;
    if (c.role === "slice") return seatOrder ? "" : `${c.player}`;
    if (c.role === "hyperlane") return "HL";
    return "";
  };

  const subLabel = (c: HexCell) => {
    if (compact || c.role !== "home") return "";
    const seatIdx = seatIndexByCoord.get(`${c.q},${c.r}`);
    if (seatIdx === undefined) return "";
    const occ = seats?.[seatIdx];
    if (!occ) return "open";
    if (occ.anonymous) return "taken";
    return occ.playerName.length > 8 ? occ.playerName.slice(0, 8) + "…" : occ.playerName;
  };

  const tooltipText = (c: HexCell) => {
    const base = ROLE_LABELS[c.role];
    if (c.role === "home") {
      const seatIdx = seatIndexByCoord.get(`${c.q},${c.r}`);
      if (seatIdx !== undefined) {
        const occ = seats?.[seatIdx];
        if (occ?.anonymous) return `Seat ${seatIdx + 1} — taken (revealed on game day)`;
        if (occ) {
          return `Seat ${seatIdx + 1} — ${occ.playerName}${occ.factionName ? ` · ${occ.factionName}` : ""}`;
        }
        return `Seat ${seatIdx + 1} — open`;
      }
      return `Player ${c.player} — ${base}`;
    }
    if (c.role === "slice") return `Player ${c.player} — Slice tile`;
    return base;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full overflow-hidden">
        <svg
          viewBox={viewBox}
          className="w-full h-auto"
          style={{ maxHeight: compact ? "260px" : "70vh" }}
          role="img"
          aria-label={`Twilight Imperium ${setup.players}-player map setup`}
        >
          {guideCoords.map((g, i) => {
            const { x, y } = axialToPixel(g.q, g.r, HEX_SIZE);
            return (
              <polygon
                key={`guide-${i}`}
                points={hexPoints(x, y, HEX_SIZE - 2)}
                fill="hsl(220 30% 12% / 0.15)"
                stroke="hsl(220 25% 45% / 0.35)"
                strokeWidth={1}
                strokeDasharray="2 3"
                style={{ cursor: onTileClick ? "pointer" : "default" }}
                onClick={onTileClick ? () => onTileClick(g.q, g.r, undefined) : undefined}
              />
            );
          })}
          {cells.map((c, i) => {
            const { x, y } = axialToPixel(c.q, c.r, HEX_SIZE);
            const style = cellStyle(c);
            const label = cellLabel(c);
            const sub = subLabel(c);
            const seatIdx = c.role === "home" ? seatIndexByCoord.get(`${c.q},${c.r}`) : undefined;
            const isClickableSeat = seatIdx !== undefined && !!onSeatClick;
            const isClickableTile =
              !!onTileClick && c.role !== "hyperlane" && !isClickableSeat;
            const handleClick = isClickableSeat
              ? () => onSeatClick!(seatIdx!, seats?.[seatIdx!])
              : isClickableTile
              ? () => onTileClick!(c.q, c.r, tileControlSeat(c))
              : undefined;
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <g
                    style={{ cursor: isClickableSeat || isClickableTile ? "pointer" : "default" }}
                    onClick={handleClick}
                  >
                    <polygon
                      points={hexPoints(x, y, HEX_SIZE - 1.5)}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      strokeDasharray={style.strokeDasharray}
                      style={{ transition: "all 200ms" }}
                    />
                    {label && (
                      <text
                        x={x}
                        y={sub ? y - 1 : y + 4}
                        textAnchor="middle"
                        fontFamily="Cinzel, serif"
                        fontSize={
                          compact
                            ? 9
                            : c.role === "home" || c.role === "mecatol"
                            ? 14
                            : 11
                        }
                        fontWeight={c.role === "home" || c.role === "mecatol" ? 700 : 500}
                        fill={
                          c.role === "mecatol"
                            ? "hsl(190 90% 80%)"
                            : c.role === "home"
                            ? "hsl(0 0% 98%)"
                            : c.role === "hyperlane"
                            ? "hsl(280 70% 80%)"
                            : "hsl(220 15% 75%)"
                        }
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {label}
                      </text>
                    )}
                    {sub && (
                      <text
                        x={x}
                        y={y + 12}
                        textAnchor="middle"
                        fontFamily="Rajdhani, sans-serif"
                        fontSize={10}
                        fontWeight={500}
                        fill="hsl(0 0% 95% / 0.85)"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {sub}
                      </text>
                    )}
                  </g>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-body text-xs">
                  {tooltipText(c)}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </svg>
      </div>
    </TooltipProvider>
  );
};

export default MapSetupHex;

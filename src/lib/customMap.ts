import {
  MAP_SETUPS,
  type HexCell,
  type HexRole,
  type MapSetup,
} from "@/data/mapSetups";

export interface CustomMapCell {
  q: number;
  r: number;
  kind: HexRole;
  seat?: number;
  label?: string;
}

export interface CustomMap {
  rings: number;
  cells: CustomMapCell[];
}

type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Build a MapSetup from a custom layout. Players is informational only — the
 * shape of the grid is fully determined by `cells`.
 */
export function customMapToSetup(custom: CustomMap, players: PlayerCount): MapSetup {
  const cells: HexCell[] = custom.cells.map((c) => ({
    q: c.q,
    r: c.r,
    role: c.kind,
    player: c.seat !== undefined ? c.seat + 1 : undefined,
    label: c.label,
  }));
  return {
    players,
    rings: custom.rings,
    cells,
    notes: "Custom map.",
  };
}

/** Return the MapSetup to use for a lobby, preferring a custom map if present. */
export function setupForLobby(
  custom: CustomMap | null | undefined,
  playerCount: PlayerCount,
): MapSetup {
  if (custom && Array.isArray(custom.cells) && custom.cells.length > 0) {
    return customMapToSetup(custom, playerCount);
  }
  return MAP_SETUPS[playerCount];
}

/** Generate a blank N-ring grid (all `empty`, plus Mecatol at center). */
export function blankCustomMap(rings: number): CustomMap {
  const cells: CustomMapCell[] = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = -rings; r <= rings; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > rings) continue;
      cells.push({
        q,
        r,
        kind: q === 0 && r === 0 ? "mecatol" : "empty",
      });
    }
  }
  return { rings, cells };
}

/** Empty canvas — no cells, just a guide grid in the editor. */
export function freeCanvasMap(): CustomMap {
  return { rings: 6, cells: [] };
}

/** Convert an existing MapSetup into a CustomMap (for "load template" button). */
export function setupToCustomMap(setup: MapSetup): CustomMap {
  return {
    rings: setup.rings,
    cells: setup.cells.map((c) => ({
      q: c.q,
      r: c.r,
      kind: c.role,
      seat: c.player !== undefined ? c.player - 1 : undefined,
      label: c.label,
    })),
  };
}

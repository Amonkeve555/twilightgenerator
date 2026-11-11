// Official Twilight Imperium 4 (Living Rules + Prophecy of Kings) setup templates.
// Coordinates use axial (q, r) with Mecatol Rex at (0, 0).
// Roles describe what each slot is — actual system tiles are placed by players per the rules.

export type HexRole =
  | "mecatol"
  | "home"
  | "home-option"
  | "equidistant"
  | "slice"
  | "hyperlane"
  | "blue"
  | "red"
  | "empty";

export interface HexCell {
  q: number;
  r: number;
  role: HexRole;
  player?: number; // 1-based home/slice owner
  label?: string; // optional override
}

export interface MapSetup {
  players: 3 | 4 | 5 | 6 | 7 | 8;
  rings: number; // 3 for standard, 4 for 7p/8p PoK extended
  cells: HexCell[];
  notes: string;
}

// Helper: generate the 6 cells of a ring at radius `r` (cube/axial ring algorithm)
// We won't use this at runtime — instead we transcribe official positions explicitly.

// =====================================================================================
// Standard 3-ring map (3p, 4p, 5p, 6p)
// Ring 1 (6 tiles): adjacent to Mecatol
// Ring 2 (12 tiles)
// Ring 3 (18 tiles): outer edge — home systems sit here
// =====================================================================================

// Ring 3 positions (18 hexes) in clockwise order starting from "top":
// We use pointy-top hex axial coordinates. The 6 corners of ring 3 are
// at distance 3 from center along the 6 cardinal hex directions.
// Directions (axial): NE(+1,-1), E(+1,0)... we'll be explicit.

// Corner positions on ring 3 (the 6 "points" of the outer hexagon):
const R3_CORNERS: Array<[number, number]> = [
  [0, -3], // N
  [3, -3], // NE
  [3, 0],  // SE
  [0, 3],  // S
  [-3, 3], // SW
  [-3, 0], // NW
];

// All 18 ring-3 cells in clockwise order starting from N corner:
// Between each pair of corners are 2 edge tiles.
const R3_ALL: Array<[number, number]> = [
  [0, -3],  // N corner
  [1, -3],
  [2, -3],
  [3, -3],  // NE corner
  [3, -2],
  [3, -1],
  [3, 0],   // SE corner
  [2, 1],
  [1, 2],
  [0, 3],   // S corner
  [-1, 3],
  [-2, 3],
  [-3, 3],  // SW corner
  [-3, 2],
  [-3, 1],
  [-3, 0],  // NW corner
  [-2, -1],
  [-1, -2],
];

// All 12 ring-2 cells:
const R2_ALL: Array<[number, number]> = [
  [0, -2],  // N
  [1, -2],
  [2, -2],  // NE
  [2, -1],
  [2, 0],   // SE
  [1, 1],
  [0, 2],   // S
  [-1, 2],
  [-2, 2],  // SW
  [-2, 1],
  [-2, 0],  // NW
  [-1, -1],
];

// All 6 ring-1 cells (adjacent to Mecatol):
const R1_ALL: Array<[number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

// Build a standard 3-ring shell (all cells "empty" by default; Mecatol at center).
function standardShell(): HexCell[] {
  const cells: HexCell[] = [{ q: 0, r: 0, role: "mecatol" }];
  R1_ALL.forEach(([q, r]) => cells.push({ q, r, role: "empty" }));
  R2_ALL.forEach(([q, r]) => cells.push({ q, r, role: "empty" }));
  R3_ALL.forEach(([q, r]) => cells.push({ q, r, role: "empty" }));
  return cells;
}

// Mark a cell at (q,r) with a given role/player. Mutates list.
function mark(
  cells: HexCell[],
  q: number,
  r: number,
  role: HexRole,
  player?: number
) {
  const c = cells.find((x) => x.q === q && x.r === r);
  if (c) {
    c.role = role;
    if (player !== undefined) c.player = player;
  }
}

// =====================================================================================
// 6-PLAYER MAP — standard 3-ring, homes at the 6 corners
// Each player gets a 3-tile slice (the 2 ring-3 edge tiles between corners + 2 ring-2 +
// 1 ring-1). Per Living Rules: 5 systems per slice (home + 3 in front + 1 shared adjacent
// pair). For visualization we mark home + the 3 slice tiles directly in front of it
// and the 2 equidistants between adjacent homes.
// =====================================================================================
function build6p(): MapSetup {
  const cells = standardShell();

  // Homes: 6 corners of ring 3
  const homes: Array<[number, number, number]> = [
    [0, -3, 1],  // N
    [3, -3, 2],  // NE
    [3, 0, 3],   // SE
    [0, 3, 4],   // S
    [-3, 3, 5],  // SW
    [-3, 0, 6],  // NW
  ];
  homes.forEach(([q, r, p]) => mark(cells, q, r, "home", p));

  // Slices: 3 tiles per player (the ring-3 edge tile + 2 ring-2 tiles in front of home).
  // Player 1 (N): in front are [1,-3], [-1,-2 already...] -- we use the edge ring-3
  // tiles flanking the home + the ring-2 tile between Mecatol and home.
  const slices: Array<[number, number, number]> = [
    // P1 (N home 0,-3): flanking r3 [1,-3] & [-1,-2] are edge; r2 in front [0,-2]
    [1, -3, 1], [-1, -2, 1], [0, -2, 1],
    // P2 (NE home 3,-3): flanking [2,-3] & [3,-2]; r2 [2,-2]
    [2, -3, 2], [3, -2, 2], [2, -2, 2],
    // P3 (SE home 3,0): flanking [3,-1] & [2,1]; r2 [2,0]
    [3, -1, 3], [2, 1, 3], [2, 0, 3],
    // P4 (S home 0,3): flanking [1,2] & [-1,3]; r2 [0,2]
    [1, 2, 4], [-1, 3, 4], [0, 2, 4],
    // P5 (SW home -3,3): flanking [-2,3] & [-3,2]; r2 [-2,2]
    [-2, 3, 5], [-3, 2, 5], [-2, 2, 5],
    // P6 (NW home -3,0): flanking [-3,1] & [-2,-1]; r2 [-2,0]
    [-3, 1, 6], [-2, -1, 6], [-2, 0, 6],
  ];
  slices.forEach(([q, r, p]) => mark(cells, q, r, "slice", p));

  // Equidistants: ring-1 tiles + remaining ring-2 tiles between slices
  const equis: Array<[number, number]> = [
    // ring 1 — all 6 are equidistant
    [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0],
    // ring 2 — between slices
    [1, -2], [2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1],
  ];
  equis.forEach(([q, r]) => mark(cells, q, r, "equidistant"));

  return {
    players: 6,
    rings: 3,
    cells,
    notes: "Standard 3-ring map. 6 homes at the corners, 3-tile slice per player, equidistant systems shared between neighbors.",
  };
}

// =====================================================================================
// 4-PLAYER MAP — standard 3-ring, homes at 4 of the 6 corners (E/W & N/S omitted in
// favor of a balanced layout). Per Living Rules base 4p uses a balanced 4-corner setup.
// We use N, E (pseudo SE), S, W (pseudo NW) — actually per official: NE, SE, SW, NW.
// =====================================================================================
function build4p(): MapSetup {
  const cells = standardShell();

  const homes: Array<[number, number, number]> = [
    [3, -3, 1],  // NE
    [3, 0, 2],   // SE (acts as E)
    [-3, 3, 3],  // SW
    [-3, 0, 4],  // NW (acts as W)
  ];
  homes.forEach(([q, r, p]) => mark(cells, q, r, "home", p));

  // Each player gets a wider slice of ~5 systems (front 3 in slice).
  const slices: Array<[number, number, number]> = [
    // P1 NE: r3 [2,-3],[3,-2]; r2 [2,-2]; plus front tiles [1,-2],[2,-1]
    [2, -3, 1], [3, -2, 1], [2, -2, 1], [1, -2, 1], [2, -1, 1],
    // P2 SE: r3 [3,-1],[2,1]; r2 [2,0]; [1,1],[0,2-sub] -- careful, use [2,1] already in r3
    [3, -1, 2], [2, 1, 2], [2, 0, 2], [1, 1, 2],
    // P3 SW: r3 [-2,3],[-3,2]; r2 [-2,2]; [-1,2],[-2,1]
    [-2, 3, 3], [-3, 2, 3], [-2, 2, 3], [-1, 2, 3], [-2, 1, 3],
    // P4 NW: r3 [-3,1],[-2,-1]; r2 [-2,0]; [-1,-1]
    [-3, 1, 4], [-2, -1, 4], [-2, 0, 4], [-1, -1, 4],
  ];
  slices.forEach(([q, r, p]) => mark(cells, q, r, "slice", p));

  // Equidistants — ring 1 and remaining ring-3 corners (N & S) + neighbors
  const equis: Array<[number, number]> = [
    [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0],
    [0, -3], [1, -3], [-1, -2],   // around N
    [0, 3], [-1, 3], [1, 2],      // around S
    [0, -2], [0, 2],
  ];
  equis.forEach(([q, r]) => mark(cells, q, r, "equidistant"));

  // Remaining outer corners are potential home positions (rulebook green hexes)
  mark(cells, 0, -3, "home-option");
  mark(cells, 0, 3, "home-option");

  return {
    players: 4,
    rings: 3,
    cells,
    notes: "Standard 3-ring map with 4 homes (NE, SE, SW, NW). Wider slices per player; N and S regions are equidistant/shared.",
  };
}

// =====================================================================================
// 3-PLAYER MAP — homes at 3 alternating corners (N, SE, SW)
// =====================================================================================
function build3p(): MapSetup {
  const cells = standardShell();

  const homes: Array<[number, number, number]> = [
    [0, -3, 1],  // N
    [3, 0, 2],   // SE
    [-3, 3, 3],  // SW
  ];
  homes.forEach(([q, r, p]) => mark(cells, q, r, "home", p));

  const slices: Array<[number, number, number]> = [
    // P1 N: surrounding r3 + r2 wedge
    [1, -3, 1], [-1, -2, 1], [0, -2, 1], [1, -2, 1], [-1, -1, 1], [2, -3, 1],
    // P2 SE: wedge
    [3, -1, 2], [2, 1, 2], [2, 0, 2], [3, -2, 2], [2, -1, 2], [1, 1, 2],
    // P3 SW: wedge
    [-2, 3, 3], [-3, 2, 3], [-2, 2, 3], [-3, 1, 3], [-2, 1, 3], [-1, 2, 3],
  ];
  slices.forEach(([q, r, p]) => mark(cells, q, r, "slice", p));

  const equis: Array<[number, number]> = [
    [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0],
    [3, -3], [-3, 0], [0, 3],
    [2, -2], [-2, 0], [0, 2],
    [1, 2], [-1, 3], [-2, -1], [-2, 3],
  ];
  equis.forEach(([q, r]) => mark(cells, q, r, "equidistant"));

  // Remaining outer corners are potential home positions (rulebook green hexes)
  mark(cells, 3, -3, "home-option");
  mark(cells, 0, 3, "home-option");
  mark(cells, -3, 0, "home-option");

  return {
    players: 3,
    rings: 3,
    cells,
    notes: "Standard 3-ring map with 3 homes (N, SE, SW). Generous wedge per player and large equidistant zones between.",
  };
}

// =====================================================================================
// 5-PLAYER MAP — 5 homes spaced around the 3-ring map (one corner becomes an
// equidistant region per the official 5p layout).
// =====================================================================================
function build5p(): MapSetup {
  const cells = standardShell();

  const homes: Array<[number, number, number]> = [
    [0, -3, 1],
    [3, -3, 2],
    [3, 0, 3],
    [0, 3, 4],
    [-3, 0, 5],
  ];
  homes.forEach(([q, r, p]) => mark(cells, q, r, "home", p));

  const slices: Array<[number, number, number]> = [
    // P1 N
    [1, -3, 1], [-1, -2, 1], [0, -2, 1],
    // P2 NE
    [2, -3, 2], [3, -2, 2], [2, -2, 2],
    // P3 SE
    [3, -1, 3], [2, 1, 3], [2, 0, 3],
    // P4 S
    [1, 2, 4], [-1, 3, 4], [0, 2, 4],
    // P5 NW
    [-3, 1, 5], [-2, -1, 5], [-2, 0, 5],
  ];
  slices.forEach(([q, r, p]) => mark(cells, q, r, "slice", p));

  // SW corner unused -> equidistant region
  const equis: Array<[number, number]> = [
    [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0],
    [1, -2], [2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1],
    [-3, 3], [-2, 3], [-3, 2], [-2, 2],
  ];
  equis.forEach(([q, r]) => mark(cells, q, r, "equidistant"));

  // Remaining outer corner is a potential home position (rulebook green hex)
  mark(cells, -3, 3, "home-option");

  return {
    players: 5,
    rings: 3,
    cells,
    notes: "Standard 3-ring map with 5 homes. The SW region is a shared equidistant zone.",
  };
}

// =====================================================================================
// 7-PLAYER & 8-PLAYER MAPS — Prophecy of Kings extended map (4 rings + hyperlane tiles)
// These use the official PoK warp/hyperlane skeleton. We render an extended outer ring
// and mark the hyperlane positions; precise hyperlane orientations are a visual hint.
// =====================================================================================

// Build all axial coordinates within a given ring count (0..N inclusive).
function ringsUpTo(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let q = -n; q <= n; q++) {
    for (let r = -n; r <= n; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= n) {
        out.push([q, r]);
      }
    }
  }
  return out;
}

function build7p(): MapSetup {
  const cells: HexCell[] = ringsUpTo(4).map(([q, r]) => ({
    q,
    r,
    role: q === 0 && r === 0 ? "mecatol" : "empty",
  }));

  // 7 homes spread around ring 3 corners + one outer position (per PoK 7p layout)
  const homes: Array<[number, number, number]> = [
    [0, -3, 1],
    [3, -3, 2],
    [3, 0, 3],
    [2, 2, 4],
    [-1, 4, 5],   // pushed to ring 4
    [-3, 3, 6],
    [-3, 0, 7],
  ];
  homes.forEach(([q, r, p]) => mark(cells, q, r, "home", p));

  // Hyperlane fixed tiles on the unused outer ring-4 hexes (PoK uses hyperlanes to
  // connect the asymmetric layout).
  const hyperlanes: Array<[number, number]> = [
    [0, -4], [4, -4], [4, 0], [4, -2], [-4, 4], [-4, 0], [-4, 2], [2, -4], [0, 4],
  ];
  hyperlanes.forEach(([q, r]) => mark(cells, q, r, "hyperlane"));

  // Mark inner ring 1 as equidistant
  R1_ALL.forEach(([q, r]) => mark(cells, q, r, "equidistant"));

  // Slice front tiles — 2 per home (ring 2 in front of each home)
  const slices: Array<[number, number, number]> = [
    [0, -2, 1], [1, -2, 1],
    [2, -2, 2], [3, -2, 2],
    [2, 0, 3], [2, -1, 3],
    [1, 1, 4], [2, 1, 4],
    [-1, 3, 5], [0, 3, 5],
    [-2, 3, 6], [-2, 2, 6],
    [-2, 0, 7], [-2, -1, 7],
  ];
  slices.forEach(([q, r, p]) => mark(cells, q, r, "slice", p));

  return {
    players: 7,
    rings: 4,
    cells,
    notes: "Prophecy of Kings 7-player extended map. Uses fixed hyperlane tiles on the outer ring to connect 7 asymmetric home positions.",
  };
}

function build8p(): MapSetup {
  const cells: HexCell[] = ringsUpTo(4).map(([q, r]) => ({
    q,
    r,
    role: q === 0 && r === 0 ? "mecatol" : "empty",
  }));

  // 8 homes evenly spread around ring 3 + 4 corners pushed to ring 4 per PoK 8p layout
  const homes: Array<[number, number, number]> = [
    [0, -4, 1],   // N (ring 4)
    [3, -3, 2],   // NE
    [4, -2, 3],   // E (ring 4)
    [3, 0, 4],    // SE
    [0, 4, 5],    // S (ring 4)
    [-3, 3, 6],   // SW
    [-4, 2, 7],   // W (ring 4)
    [-3, 0, 8],   // NW
  ];
  homes.forEach(([q, r, p]) => mark(cells, q, r, "home", p));

  // Hyperlane fixed tiles on the remaining ring-4 hexes
  const hyperlanes: Array<[number, number]> = [
    [1, -4], [2, -4], [3, -4], [4, -4], [4, -3],
    [4, -1], [4, 0], [3, 1], [2, 2], [1, 3],
    [-1, 4], [-2, 4], [-3, 4], [-4, 4], [-4, 3],
    [-4, 1], [-4, 0], [-3, -1], [-2, -2], [-1, -3],
  ];
  hyperlanes.forEach(([q, r]) => mark(cells, q, r, "hyperlane"));

  // Inner ring equidistant
  R1_ALL.forEach(([q, r]) => mark(cells, q, r, "equidistant"));

  // Slice front tiles per home
  const slices: Array<[number, number, number]> = [
    [0, -3, 1], [0, -2, 1],
    [2, -3, 2], [2, -2, 2],
    [3, -2, 3], [2, -1, 3],
    [3, -1, 4], [2, 0, 4],
    [0, 3, 5], [0, 2, 5],
    [-2, 3, 6], [-2, 2, 6],
    [-3, 2, 7], [-2, 1, 7],
    [-3, 1, 8], [-2, 0, 8],
  ];
  slices.forEach(([q, r, p]) => mark(cells, q, r, "slice", p));

  return {
    players: 8,
    rings: 4,
    cells,
    notes: "Prophecy of Kings 8-player extended map. Uses fixed hyperlane tiles on the outer ring to connect 8 home positions.",
  };
}

export const MAP_SETUPS: Record<3 | 4 | 5 | 6 | 7 | 8, MapSetup> = {
  3: build3p(),
  4: build4p(),
  5: build5p(),
  6: build6p(),
  7: build7p(),
  8: build8p(),
};

/**
 * Returns the home-system cells for a given player count, ordered clockwise
 * starting from the topmost (smallest r, then smallest q) home. The index in
 * this array is the canonical `seat_index` stored on lobby_players.
 */
export function getHomeSeats(players: 3 | 4 | 5 | 6 | 7 | 8): HexCell[] {
  const homes = MAP_SETUPS[players].cells.filter((c) => c.role === "home");
  // Sort clockwise around (0,0): use angle from center.
  return homes.slice().sort((a, b) => {
    // Convert axial -> pixel-ish coords for angle comparison
    const ax = a.q + a.r / 2;
    const ay = a.r;
    const bx = b.q + b.r / 2;
    const by = b.r;
    const angA = Math.atan2(ay, ax);
    const angB = Math.atan2(by, bx);
    // Rotate so that "top" (negative y) is angle 0, going clockwise
    const norm = (ang: number) => {
      // atan2 returns -PI..PI; we want top (-PI/2) -> 0, increasing CW
      let v = ang + Math.PI / 2;
      if (v < 0) v += Math.PI * 2;
      return v;
    };
    return norm(angA) - norm(angB);
  });
}

export const ROLE_LABELS: Record<HexRole, string> = {
  mecatol: "Mecatol Rex",
  home: "Home System",
  "home-option": "Potential Home System",
  equidistant: "Equidistant System",
  slice: "Player Slice",
  hyperlane: "Hyperlane (fixed tile)",
  blue: "Planet System",
  red: "Anomaly / Empty",
  empty: "Empty",
};

/** Like getHomeSeats but works on any MapSetup (e.g. a custom one). */
export function getHomeSeatsFromSetup(setup: MapSetup): HexCell[] {
  const homes = setup.cells.filter((c) => c.role === "home");
  return homes.slice().sort((a, b) => {
    const ax = a.q + a.r / 2;
    const ay = a.r;
    const bx = b.q + b.r / 2;
    const by = b.r;
    const angA = Math.atan2(ay, ax);
    const angB = Math.atan2(by, bx);
    const norm = (ang: number) => {
      let v = ang + Math.PI / 2;
      if (v < 0) v += Math.PI * 2;
      return v;
    };
    return norm(angA) - norm(angB);
  });
}


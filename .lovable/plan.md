## Goal
When recording final results, display the game map with each tile colored by the player who controls it, so the host can see territorial control while entering VP / rank.

## Where it shows up
Two screens have a "Record Results" UI today. Both will get the map:

1. **GameDay page** (`src/pages/GameDay.tsx`) — `phase === "results"` block.
2. **GameBoard page** (`src/pages/GameBoard.tsx`) — `Record Final Scores` / `Final Standings` block.

## Implementation

- Reuse `MapSetupHex` (already supports `tileControl` and player coloring) in compact, read-only mode (no `onTileClick`).
- Pull `lobby.custom_map`, `lobby.tile_control`, `players` (already loaded in both pages via `useLobby`).
- Add a small `<MapSetupHex compact setup={lobby.custom_map} seats={...} seatOrder={playerOrder} tileControl={tileControl} />` block above the result inputs, wrapped in the same `glass imperial-border` card style.
- If `lobby.custom_map` is null, fall back to the standard map setup for the player count (same logic GameBoard uses).
- Add a small legend row showing each player's name + color swatch + tile count, mirroring `TileControlLeaderboard` but condensed (or simply embed `TileControlLeaderboard` underneath the map).

## Out of scope
- No editing of tile control on the results screen (read-only view).
- No changes to history records — `HistoryMiniMap` already shows tile control on the History page.

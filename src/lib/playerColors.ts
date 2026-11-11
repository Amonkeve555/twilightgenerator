// HSL strings (without the `hsl()` wrapper) so they can be interpolated
// into existing `hsl(${color})` template literals throughout the app.
export const PLAYER_COLOR_PALETTE: { name: string; value: string }[] = [
  { name: "Imperial Gold", value: "42 85% 55%" },
  { name: "Crimson", value: "0 75% 55%" },
  { name: "Azure", value: "210 80% 55%" },
  { name: "Emerald", value: "150 65% 45%" },
  { name: "Violet", value: "275 70% 60%" },
  { name: "Cyan", value: "185 75% 50%" },
  { name: "Magenta", value: "320 75% 60%" },
  { name: "Orange", value: "25 90% 55%" },
  { name: "Slate", value: "220 15% 60%" },
  { name: "Lime", value: "85 70% 50%" },
];

/** Resolve the color to display: override wins, fall back to faction color. */
export function resolveDisplayColor(
  factionColor: string,
  override?: string | null
): string {
  return override && override.trim().length > 0 ? override : factionColor;
}

/**
 * Unbiased Fisher–Yates shuffle (returns a new array).
 *
 * Don't use `arr.sort(() => Math.random() - 0.5)`: it is heavily biased —
 * items tend to stay near their original position, so the same token numbers
 * kept mapping to the same races game after game.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

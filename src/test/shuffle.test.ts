import { describe, it, expect } from "vitest";
import { shuffle } from "@/lib/shuffle";

describe("shuffle", () => {
  it("keeps every item exactly once and doesn't touch the input", () => {
    const input = Array.from({ length: 24 }, (_, i) => i);
    const out = shuffle(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it("puts each race on each token with about equal chance (no positional bias)", () => {
    const N = 24;
    const RUNS = 60_000;
    const counts = Array.from({ length: N }, () => new Array(N).fill(0));
    const items = Array.from({ length: N }, (_, i) => i);
    for (let r = 0; r < RUNS; r++) shuffle(items).forEach((item, pos) => counts[item][pos]++);
    const expected = RUNS / N; // 2500
    // The old sort(() => Math.random() - 0.5) put race #1 on token 1 ~2.5x too often.
    for (const row of counts) for (const c of row) expect(Math.abs(c - expected) / expected).toBeLessThan(0.15);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { randomId } from "@/lib/uuid";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses crypto.randomUUID when available", () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it("still works on insecure (http) pages where crypto.randomUUID is missing", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    expect(typeof crypto.randomUUID).toBe("undefined");
    const ids = new Set(Array.from({ length: 50 }, () => randomId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});

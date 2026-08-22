/**
 * Unit coverage for plugin.ts's discount roll and its flag gating. No live
 * game is needed here - discountRoll is a pure function of (rng, cost), and
 * register()'s only job is "install it when the toggle is on, touch nothing
 * otherwise" - so a fake Rng and a fake host stand in for the real ones.
 */
import { describe, expect, it, vi } from "vitest";
import plugin, { discountRoll } from "./plugin.js";

type DiscountHandler = (ctx: { rng: { oneIn: (n: number) => boolean }; cost: number }) => number;

interface FakeHost {
  stores: { setDiscountRoll: (handler: DiscountHandler) => void };
}

/** Extracts the handler register() installs, or null if it installed nothing. */
function installedHandler(flags: Record<string, boolean>): DiscountHandler | null {
  let installed: DiscountHandler | null = null;
  const host: FakeHost = { stores: { setDiscountRoll: (h) => (installed = h) } };
  plugin.register(host, { flags });
  return installed;
}

describe("hooks", () => {
  it("always returns an empty ModHooks - the seam is register(), not a per-turn hook", () => {
    expect(plugin.hooks({ flags: {} })).toEqual({});
    expect(plugin.hooks({ flags: { "feature-restoration.discounts": true } })).toEqual({});
  });
});

describe("register - flag gating", () => {
  it("installs nothing when the toggle is off (the default)", () => {
    expect(installedHandler({})).toBeNull();
    expect(installedHandler({ "feature-restoration.discounts": false })).toBeNull();
  });

  it("installs the discount roll when the toggle is on", () => {
    expect(installedHandler({ "feature-restoration.discounts": true })).toBe(discountRoll);
  });
});

describe("discountRoll - mass_produce's discount arm (Angband 3.0.6)", () => {
  it("never discounts an item under 5 gold, and draws no RNG at all", () => {
    const oneIn = vi.fn(() => true);
    expect(discountRoll({ rng: { oneIn }, cost: 4 })).toBe(0);
    expect(oneIn).not.toHaveBeenCalled();
  });

  it("checks the tiers in order, at their documented odds, stopping at the first hit", () => {
    const cases: Array<{ hits: number; expected: number; odds: number[] }> = [
      { hits: 1, expected: 10, odds: [25] },
      { hits: 2, expected: 25, odds: [25, 50] },
      { hits: 3, expected: 50, odds: [25, 50, 150] },
      { hits: 4, expected: 75, odds: [25, 50, 150, 300] },
      { hits: 5, expected: 90, odds: [25, 50, 150, 300, 500] },
    ];
    for (const { hits, expected, odds } of cases) {
      const oneIn = vi.fn((n: number) => n === odds[odds.length - 1]);
      expect(discountRoll({ rng: { oneIn }, cost: 100 })).toBe(expected);
      expect(oneIn.mock.calls.map((c) => c[0])).toEqual(odds);
      expect(hits).toBe(odds.length);
    }
  });

  it("returns 0 when every roll misses, having checked all five tiers", () => {
    const oneIn = vi.fn((_n: number) => false);
    expect(discountRoll({ rng: { oneIn }, cost: 100 })).toBe(0);
    expect(oneIn.mock.calls.map((c) => c[0])).toEqual([25, 50, 150, 300, 500]);
  });
});

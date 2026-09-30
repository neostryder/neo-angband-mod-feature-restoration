/**
 * "Restore classic uncursing" (section classic-uncurse).
 *
 * 4.0's Remove Curse walked every worn item, lifted every eligible curse and
 * never made anything fragile; the strong form also lifted heavy curses and a
 * permanent curse never came off. The same section restores 4.0's one-in-four
 * chance for an enchant to break a curse, halved for artifacts.
 *
 * The pure functions are driven directly against a fake core and a seeded Rng,
 * the same way plugin.test.ts drives discountRoll and spikeDoor, so the odds and
 * the band boundaries are asserted without a live game.
 */

import { describe, expect, it, vi } from "vitest";
import { Rng } from "@rpgm-tools/neo-angband-core";
import plugin from "./plugin.js";
import {
  classicRemoveCurseHandler,
  enchantCurseBreak,
  hasBreakableCurse,
  LIGHT_MAX_POWER,
  PERMA_POWER,
  uncurseOne,
  type ClassicCore,
  type CurseDataLike,
  type CurseLike,
  type UncurseObjectLike,
} from "./src/classic-uncurse.js";

/* ------------------------------------------------------------------ *
 * Fakes
 * ------------------------------------------------------------------ */

interface FakeObject extends UncurseObjectLike {
  flags: Set<string>;
}

/** An object with a curse at each index; index 0 is the unused slot. */
function fakeObject(powers: number[]): FakeObject {
  return {
    number: 1,
    weight: 10,
    curses: [null, ...powers.map((power) => ({ power, timeout: 0 }))],
    flags: new Set<string>(),
  };
}

/** A fake core whose curse removal mirrors core's own (no fragility path). */
function fakeCore(strength = 0): ClassicCore {
  return {
    removeObjectCurse(...[obj, pick, message, env]: Parameters<ClassicCore["removeObjectCurse"]>) {
      const c = (obj.curses as (CurseDataLike | null)[])[pick];
      if (!c || !c.power) return false;
      c.power = 0;
      c.timeout = 0;
      if (message && env) env.msg(`The ${env.curses[pick]?.name ?? ""} curse is removed!`);
      return true;
    },
    objectWeightOne(obj: Parameters<ClassicCore["objectWeightOne"]>[0]) {
      return obj.weight;
    },
    effectCalculateValue: () => strength,
    PN: { COMBINE: 1 },
  } as unknown as ClassicCore;
}

/** Curse names for indices 1..n, matching the fake objects. */
const CURSE_TABLE: readonly (CurseLike | null)[] = [
  null,
  { name: "weakness" },
  { name: "vulnerability" },
  { name: "dullness" },
];

/* ------------------------------------------------------------------ *
 * uncurseOne - the 4.0 tiers
 * ------------------------------------------------------------------ */

describe("uncurseOne - remove_curse_aux (Angband 4.0.5, effects.c L720-747)", () => {
  it("lifts a light curse and reports its weight delta", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 0, 0]);
    const deltas: number[] = [];
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, false, (d) => deltas.push(d))).toBe(1);
    expect(obj.curses?.[1]?.power).toBe(0);
    expect(deltas).toEqual([0]);
  });

  it("leaves a heavy curse alone without the heavy form, and never makes the item fragile", () => {
    const obj = fakeObject([0, LIGHT_MAX_POWER + 1, 0]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, false)).toBe(0);
    expect(obj.curses?.[2]?.power).toBe(LIGHT_MAX_POWER + 1);
    expect(obj.flags.has("FRAGILE")).toBe(false);
  });

  it("lifts a heavy curse with the heavy form", () => {
    const obj = fakeObject([0, 99, 0]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, true)).toBe(1);
    expect(obj.curses?.[2]?.power).toBe(0);
  });

  it("never lifts a permanent curse, heavy form or not", () => {
    const obj = fakeObject([0, 0, PERMA_POWER]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, true)).toBe(0);
    expect(obj.curses?.[3]?.power).toBe(PERMA_POWER);
  });

  it("lifts every eligible curse on the object in one call", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 60, PERMA_POWER]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, true)).toBe(2);
    expect(obj.curses?.[3]?.power).toBe(PERMA_POWER);
  });

  it("announces each lifted curse when a message sink is given", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 0, 0]);
    const messages: string[] = [];
    uncurseOne(fakeCore(), CURSE_TABLE, obj, false, undefined, (t) => messages.push(t));
    expect(messages).toEqual(["The weakness curse is removed!"]);
  });
});

/* ------------------------------------------------------------------ *
 * enchantCurseBreak - enchant_curse (Angband 4.0.5, effects.c L1717-1737)
 * ------------------------------------------------------------------ */

describe("enchantCurseBreak - the enchant curse break", () => {
  it("knows a breakable curse from a permanent one, and never breaks a permanent one", () => {
    expect(hasBreakableCurse(fakeObject([0, 0, 0]))).toBe(false);
    expect(hasBreakableCurse(fakeObject([0, 0, PERMA_POWER]))).toBe(false);
    expect(hasBreakableCurse(fakeObject([LIGHT_MAX_POWER, 0, 0]))).toBe(true);
  });

  it("breaks one curse in four on an ordinary item", () => {
    const trials = 200_000;
    const rng = new Rng(20_260_930);
    let hits = 0;
    for (let i = 0; i < trials; i++) if (enchantCurseBreak(rng, false)) hits++;
    expect(hits / trials).toBeGreaterThan(0.24);
    expect(hits / trials).toBeLessThan(0.26);
  });

  it("breaks one curse in eight on an artifact (the artifact resist halves it)", () => {
    const trials = 200_000;
    const rng = new Rng(20_260_930);
    let hits = 0;
    for (let i = 0; i < trials; i++) if (enchantCurseBreak(rng, true)) hits++;
    expect(hits / trials).toBeGreaterThan(0.115);
    expect(hits / trials).toBeLessThan(0.135);
  });
});

/* ------------------------------------------------------------------ *
 * classicRemoveCurseHandler - the worn-item walk
 * ------------------------------------------------------------------ */

function fakeCtx(strength: number) {
  const light = fakeObject([LIGHT_MAX_POWER, 0, 0]);
  const heavy = fakeObject([0, 80, 0]);
  const store = new Map<number, UncurseObjectLike>([
    [1, light],
    [2, heavy],
  ]);
  const messages: string[] = [];
  const state = {
    rng: new Rng(1),
    chunk: { depth: 1 },
    gear: { store },
    actor: {
      player: {
        equipment: [1, 2],
        upkeep: { totalWeight: 0, notice: 0 },
      },
    },
    updateBonuses: vi.fn(),
  };
  const ctx = {
    env: {
      game: { state, item: { reg: { curses: CURSE_TABLE } } },
      messages: { msg: (t: string) => messages.push(t) },
    },
  };
  return { ctx, light, heavy, messages, state };
}

describe("classicRemoveCurseHandler", () => {
  it("lifts light curses off every worn item and leaves heavy ones", () => {
    const { ctx, light, heavy, messages } = fakeCtx(LIGHT_MAX_POWER);
    classicRemoveCurseHandler(fakeCore(LIGHT_MAX_POWER))(ctx as never);
    expect(light.curses?.[1]?.power).toBe(0);
    expect(heavy.curses?.[2]?.power).toBe(80);
    expect(messages).toEqual(["The weakness curse is removed!", "The air around your body glows blue for a moment..."]);
  });

  it("lifts heavy curses too once the strength passes the light band", () => {
    const { ctx, heavy, messages } = fakeCtx(LIGHT_MAX_POWER + 1);
    classicRemoveCurseHandler(fakeCore(LIGHT_MAX_POWER + 1))(ctx as never);
    expect(heavy.curses?.[2]?.power).toBe(0);
    expect(messages).not.toContain("The air around your body glows blue for a moment...");
  });

  it("says nothing and changes nothing when no curse is eligible", () => {
    const { ctx, light, heavy, messages } = fakeCtx(0);
    light.curses![1] = { power: 0, timeout: 0 };
    classicRemoveCurseHandler(fakeCore(0))(ctx as never);
    expect(heavy.curses?.[2]?.power).toBe(80);
    expect(messages).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * register - flag gating
 * ------------------------------------------------------------------ */

function fakeHost() {
  const registered = new Map<number | string, { handler: unknown }>();
  return {
    registered,
    effects: {
      register(code: number | string, def: { handler: unknown }) {
        registered.set(code, def);
      },
    },
    stores: { setDiscountRoll: vi.fn() },
    commands: { register: vi.fn(), setVerb: vi.fn() },
  };
}

const EF = { REMOVE_CURSE: 47, ENCHANT: 48 };

describe("register - classic-uncurse flag gating", () => {
  it("installs nothing when the toggle is off (the default)", () => {
    const host = fakeHost();
    plugin.register(host, { flags: {}, core: { EF } as never });
    expect(host.registered.size).toBe(0);
  });

  it("replaces both effect handlers when the toggle is on", () => {
    const host = fakeHost();
    plugin.register(host, {
      flags: { "feature-restoration.classic-uncurse": true },
      core: { EF } as never,
    });
    expect([...host.registered.keys()].sort()).toEqual([EF.REMOVE_CURSE, EF.ENCHANT]);
    expect(host.registered.get(EF.REMOVE_CURSE)?.handler).toBeTypeOf("function");
    expect(host.registered.get(EF.ENCHANT)?.handler).toBeTypeOf("function");
  });
});

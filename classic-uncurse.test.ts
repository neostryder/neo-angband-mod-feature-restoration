/**
 * "Restore classic uncursing" (section classic-uncurse).
 *
 * 4.0's Remove Curse walked every worn item and lifted every curse on an item it
 * could uncurse, never making anything fragile; the strong form also took items
 * with heavy curses, and an item with a permanent curse was never touched. The
 * same section restores 4.0's one-in-four chance for each enchant attempt to
 * break a curse, halved for artifacts.
 *
 * The pure functions are driven directly against a fake core and a seeded Rng,
 * the same way plugin.test.ts drives discountRoll and spikeDoor, so the odds and
 * the band boundaries are asserted without a live game.
 */

import { describe, expect, it, vi } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import { ENCH_TOAC, ENCH_TOBOTH, ENCH_TODAM, ENCH_TOHIT, enchant, objectNew, OF, Rng, TMD } from "@rpgm-tools/neo-angband-core";
import plugin from "./plugin.js";
import { bind } from "./test/game.js";
import {
  classicEnchant,
  classicRemoveCurseHandler,
  enchantCurseBreak,
  enchantCurseBreakHandler,
  hasBreakableCurse,
  isHeavySource,
  LIGHT_MAX_POWER,
  PERMA_POWER,
  uncurseOne,
  type ClassicCore,
  type CurseLike,
  type EnchantObjectLike,
  type UncurseObjectLike,
} from "./src/classic-uncurse.js";

/* ------------------------------------------------------------------ *
 * Fakes
 * ------------------------------------------------------------------ */

type FakeObject = EnchantObjectLike;

const { game: fixtureGame } = bind([]);
const fixtureKind = fixtureGame.objects.kinds.find((kind) => kind?.name === "& Dagger~")!;

/** An object with a curse at each index; index 0 is the unused slot. */
function fakeObject(powers: number[]): FakeObject {
  const obj = objectNew(fixtureKind);
  obj.number = 1;
  obj.weight = 10;
  obj.curses = [{ power: 0, timeout: 0 }, ...powers.map((power) => ({ power, timeout: 0 }))];
  obj.tval = 1;
  return obj;
}

/**
 * A fake core whose curse removal mirrors core's own, including dropping the
 * curse array once the last curse goes (no fragility path).
 */
let cachedFakeCore: ClassicCore | null = null;
function fakeCore(): ClassicCore {
  if (cachedFakeCore) return cachedFakeCore;
  cachedFakeCore = {
    ...core,
    removeObjectCurse(...[obj, pick, message, env]: Parameters<ClassicCore["removeObjectCurse"]>) {
      const c = obj.curses?.[pick];
      if (!c || !c.power) return false;
      c.power = 0;
      c.timeout = 0;
      if (!obj.curses?.some((d) => d?.power)) obj.curses = null;
      if (message && env) env.msg(`The ${env.curses[pick]?.name ?? ""} curse is removed!`);
      return true;
    },
    objectWeightOne(obj: Parameters<ClassicCore["objectWeightOne"]>[0]) {
      return obj.weight;
    },
    requestForEffect: () => ({ prompt: "", reject: "", tester: () => true, mode: { equip: true } }),
    describeObject: () => "Dagger",
    objectIsCarried: () => true,
    tvalIsAmmo: () => false,
  };
  return cachedFakeCore;
}

/** Remove Curse's dice in each form (object.txt). */
const LIGHT_DICE = { base: 20, dice: 1, sides: 20, mBonus: 0 };
const HEAVY_DICE = { base: 50, dice: 1, sides: 50, mBonus: 0 };

/** Curse names for indices 1..n, matching the fake objects. */
const fixtureCurse = fixtureGame.objects.curses.find((curse) => curse !== null)!;
const CURSE_TABLE: readonly (CurseLike | null)[] = [
  null,
  { ...fixtureCurse, name: "weakness" },
  { ...fixtureCurse, name: "vulnerability" },
  { ...fixtureCurse, name: "dullness" },
];

/* ------------------------------------------------------------------ *
 * uncurseOne - the 4.0 tiers
 * ------------------------------------------------------------------ */

describe("uncurseOne - remove_curse_aux (Angband 4.0.5, effects.c L720-747)", () => {
  it("lifts a light curse and reports its weight delta", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 0, 0]);
    const deltas: number[] = [];
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, false, (d) => deltas.push(d))).toBe(1);
    expect(obj.curses).toBeNull();
    expect(deltas).toEqual([0]);
  });

  it("leaves a heavy curse alone without the heavy form, and never makes the item fragile", () => {
    const obj = fakeObject([0, LIGHT_MAX_POWER + 1, 0]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, false)).toBe(0);
    expect(obj.curses?.[2]?.power).toBe(LIGHT_MAX_POWER + 1);
    expect(obj.flags.has(OF.FRAGILE)).toBe(false);
  });

  it("lifts a heavy curse with the heavy form", () => {
    const obj = fakeObject([0, 99, 0]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, true)).toBe(1);
    expect(obj.curses).toBeNull();
  });

  it("never lifts a permanent curse, heavy form or not", () => {
    const obj = fakeObject([0, 0, PERMA_POWER]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, true)).toBe(0);
    expect(obj.curses?.[3]?.power).toBe(PERMA_POWER);
  });

  it("lifts every curse on an item in one call, the last one dropping the curse list", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 60, 0]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, true)).toBe(2);
    expect(obj.curses).toBeNull();
  });

  it("skips an item whose worst curse is heavy under the light form, light curse and all", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 60, 0]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, false)).toBe(0);
    expect(obj.curses?.[1]?.power).toBe(LIGHT_MAX_POWER);
  });

  it("skips an item with a permanent curse whole, even its light curse", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 0, PERMA_POWER]);
    expect(uncurseOne(fakeCore(), CURSE_TABLE, obj, true)).toBe(0);
    expect(obj.curses?.[1]?.power).toBe(LIGHT_MAX_POWER);
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
    expect(hasBreakableCurse(fakeObject([LIGHT_MAX_POWER, 0, PERMA_POWER]))).toBe(false);
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

function fakeCtx(value: typeof LIGHT_DICE, blind = 0) {
  const light = fakeObject([LIGHT_MAX_POWER, 0, 0]);
  const heavy = fakeObject([0, 80, 0]);
  const store = new Map<number, UncurseObjectLike>([
    [1, light],
    [2, heavy],
  ]);
  const messages: string[] = [];
  const timed: number[] = [];
  timed[TMD.BLIND] = blind;
  const state = {
    rng: new Rng(1),
    chunk: { depth: 1 },
    gear: { store },
    actor: {
      player: {
        equipment: [1, 2],
        upkeep: { totalWeight: 0, notice: 0 },
        timed,
      },
    },
    updateBonuses: vi.fn(),
  };
  const ctx = {
    value,
    ident: false,
    env: {
      game: { state, item: { reg: { curses: CURSE_TABLE } } },
      messages: { msg: (t: string) => messages.push(t) },
    },
  };
  return { ctx, light, heavy, messages, state };
}

describe("classicRemoveCurseHandler", () => {
  it("lifts light curses off every worn item and leaves heavy ones, in 4.0's words", () => {
    const { ctx, light, heavy, messages } = fakeCtx(LIGHT_DICE);
    classicRemoveCurseHandler(fakeCore())(ctx as never);
    expect(light.curses).toBeNull();
    expect(heavy.curses?.[2]?.power).toBe(80);
    expect(messages).toEqual(["The air around your body glows blue for a moment..."]);
    expect(ctx.ident).toBe(true);
  });

  it("says 4.0's blind line when the player cannot see", () => {
    const { ctx, messages } = fakeCtx(LIGHT_DICE, 5);
    classicRemoveCurseHandler(fakeCore())(ctx as never);
    expect(messages).toEqual(["You feel as if someone is watching over you."]);
  });

  it("lifts heavy curses too under the strong form, silently", () => {
    const { ctx, light, heavy, messages } = fakeCtx(HEAVY_DICE);
    classicRemoveCurseHandler(fakeCore())(ctx as never);
    expect(light.curses).toBeNull();
    expect(heavy.curses).toBeNull();
    expect(messages).toEqual([]);
    expect(ctx.ident).toBe(true);
  });

  it("says nothing, changes nothing and learns nothing when the light form lifts nothing", () => {
    const { ctx, light, heavy, messages } = fakeCtx(LIGHT_DICE);
    light.curses = null;
    classicRemoveCurseHandler(fakeCore())(ctx as never);
    expect(heavy.curses?.[2]?.power).toBe(80);
    expect(messages).toEqual([]);
    expect(ctx.ident).toBe(false);
  });

  it("identifies the strong form even when it lifts nothing", () => {
    const { ctx, light, heavy } = fakeCtx(HEAVY_DICE);
    light.curses = null;
    heavy.curses = null;
    classicRemoveCurseHandler(fakeCore())(ctx as never);
    expect(ctx.ident).toBe(true);
  });

  it("takes its form from the source's dice, never from a roll", () => {
    /* A 35+d30 source can roll past 40, and must stay on the light form on
     * every use, as 4.0's Staff of Remove Curse did. */
    const staff = { base: 35, dice: 1, sides: 30, mBonus: 0 };
    for (let i = 0; i < 20; i++) {
      const { ctx, heavy } = fakeCtx(staff);
      classicRemoveCurseHandler(fakeCore())(ctx as never);
      expect(heavy.curses?.[2]?.power).toBe(80);
    }
    expect(isHeavySource(staff)).toBe(false);
    expect(isHeavySource(LIGHT_DICE)).toBe(false);
    expect(isHeavySource(HEAVY_DICE)).toBe(true);
    /* Dispel Curse, 4.0's REMOVE_ALL_CURSE spell, rolls $B+d50 at any level. */
    expect(isHeavySource({ base: 25, dice: 1, sides: 50, mBonus: 0 })).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * classicEnchant and the enchant handler - enchant (effects.c L1765-1800)
 * ------------------------------------------------------------------ */

/** An Rng that answers from a script, recording every call. */
function scriptedRng(answers: number[]) {
  const calls: string[] = [];
  const next = (): number => {
    if (answers.length === 0) throw new Error("scripted Rng ran out");
    return answers.shift()!;
  };
  return {
    calls,
    randint0: (n: number) => (calls.push(`randint0(${n})`), next()),
    randint1: (n: number) => (calls.push(`randint1(${n})`), next()),
  };
}

describe("classicEnchant - 4.0's per-attempt curse break", () => {
  it("rolls a curse break after every score roll, interleaved as enchant2 was", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 0, 0]);
    obj.toH = 15;
    obj.toD = 15;
    /* Two attempts at both bonuses: each score roll fails (1 <= 990) and each
     * curse roll misses (99 >= 25) until the fourth, which breaks the curse. */
    const rng = scriptedRng([1, 99, 1, 99, 1, 99, 1, 0]);
    const broken: string[] = [];
    const res = classicEnchant(fakeCore(), rng, obj, 2, ENCH_TOBOTH, (o) => {
      broken.push("break");
      uncurseOne(fakeCore(), CURSE_TABLE, o, true);
    });
    expect(res).toBe(true);
    expect(rng.calls).toEqual([
      "randint1(1000)", "randint0(100)",
      "randint1(1000)", "randint0(100)",
      "randint1(1000)", "randint0(100)",
      "randint1(1000)", "randint0(100)",
    ]);
    expect(broken).toEqual(["break"]);
    expect(obj.curses).toBeNull();
  });

  it("gives *Enchant Weapon* on a cursed weapon a chance per attempt, about 82 percent at three", () => {
    const trials = 20_000;
    const rng = new Rng(20_260_930);
    let breaks = 0;
    for (let i = 0; i < trials; i++) {
      const obj = fakeObject([LIGHT_MAX_POWER, 0, 0]);
      obj.toH = 16;
      obj.toD = 16;
      classicEnchant(fakeCore(), rng, obj, 3, ENCH_TOBOTH, (o) => uncurseOne(fakeCore(), CURSE_TABLE, o, true));
      if (!obj.curses) breaks++;
    }
    /* 1 - 0.75^6 = 0.822 */
    expect(breaks / trials).toBeGreaterThan(0.81);
    expect(breaks / trials).toBeLessThan(0.835);
  });

  it("never rolls for, or breaks, a curse on an item that also has a permanent one", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 0, PERMA_POWER]);
    obj.toA = 15;
    const rng = scriptedRng([1, 1, 1]);
    const res = classicEnchant(fakeCore(), rng, obj, 3, ENCH_TOAC, () => {
      throw new Error("no break expected");
    });
    expect(res).toBe(false);
    expect(rng.calls).toEqual(["randint1(1000)", "randint1(1000)", "randint1(1000)"]);
    expect(obj.curses?.[1]?.power).toBe(LIGHT_MAX_POWER);
  });

  it("draws exactly as core's enchant on an uncursed item", () => {
    for (const eflag of [ENCH_TOHIT, ENCH_TODAM, ENCH_TOAC, ENCH_TOBOTH]) {
      for (const number of [1, 3]) {
        const ours = fakeObject([]);
        ours.curses = null;
        ours.number = number;
        ours.toH = 4;
        ours.toD = 6;
        ours.toA = 8;
        const theirs = { ...ours, artifact: null };
        const rngA = new Rng(77);
        const rngB = new Rng(77);
        const state = {
          rng: rngB,
          actor: { player: { upkeep: { notice: 0 } } },
        };
        const a = classicEnchant(fakeCore(), rngA, ours, 5, eflag, () => {});
        const b = enchant(state as never, theirs as never, 5, eflag);
        expect(a).toBe(b);
        expect([ours.toH, ours.toD, ours.toA]).toEqual([theirs.toH, theirs.toD, theirs.toA]);
        expect(rngA.randint0(1_000_000)).toBe(rngB.randint0(1_000_000));
      }
    }
  });
});

function fakeEnchantCtx(obj: FakeObject | null, subtype: number, answers: number[] = []) {
  const messages: string[] = [];
  const state = {
    rng: { ...scriptedRng(answers), randcalc: () => 1 },
    chunk: { depth: 1 },
    gear: { store: new Map<number, UncurseObjectLike>() },
    actor: { player: { equipment: [], upkeep: { totalWeight: 0, notice: 0 } } },
    updateBonuses: vi.fn(),
  };
  const ctx = {
    value: { base: 1, dice: 0, sides: 0, mBonus: 0 },
    subtype,
    ident: false,
    env: {
      game: { state, item: { getItem: () => obj, reg: { curses: CURSE_TABLE } } },
      messages: { msg: (t: string) => messages.push(t) },
    },
  };
  return { ctx, messages, state };
}

describe("enchantCurseBreakHandler", () => {
  it("uses the scroll up when the enchantment fails, as 4.0 and 4.2 both did", () => {
    const obj = fakeObject([]);
    obj.curses = null;
    obj.toA = 15;
    const { ctx, messages } = fakeEnchantCtx(obj, ENCH_TOAC, [1]);
    expect(enchantCurseBreakHandler(fakeCore())(ctx as never)).toBe(true);
    expect(obj.toA).toBe(15);
    expect(messages).toEqual(["Your Dagger glows brightly!", "The enchantment failed."]);
  });

  it("keeps the scroll when no item is chosen", () => {
    const { ctx } = fakeEnchantCtx(null, ENCH_TOAC);
    expect(enchantCurseBreakHandler(fakeCore())(ctx as never)).toBe(false);
  });

  it("breaks the curse with 4.0's line alone, and counts the break as success", () => {
    const obj = fakeObject([LIGHT_MAX_POWER, 60, 0]);
    obj.toA = 15;
    const { ctx, messages, state } = fakeEnchantCtx(obj, ENCH_TOAC, [1, 0]);
    expect(enchantCurseBreakHandler(fakeCore())(ctx as never)).toBe(true);
    expect(obj.curses).toBeNull();
    expect(messages).toEqual(["Your Dagger glows brightly!", "The curse is broken!"]);
    expect(state.actor.player.upkeep.notice).toBe(1);
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

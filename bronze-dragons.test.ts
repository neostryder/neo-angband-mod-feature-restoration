/**
 * "Restore the bronze dragons" (section bronze-dragons).
 *
 * Five pieces restore together: the CONFUSION projection (projection.json), the
 * BR_CONF monster spell and its message type (monster_spell.json,
 * message_type.json), six monsters (monster.json), Bronze Dragon Scale Mail
 * (object.json), and the two handlers in src/confusion.ts that plugin.ts installs
 * through registry:projection. This file checks that they bind together, that the
 * handlers follow Angband 3.2.0's GF_CONFUSION rules, and that plugin.ts installs
 * them only while the section's flag is on.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MON_MSG, MON_TMD, RF, TMD } from "@rpgm-tools/neo-angband-core";
import plugin from "./plugin.js";
import { BRONZE_BREATHERS, CONFUSION, confuseMonster, confusePlayer, type MonProjectCtxLike } from "./src/confusion.js";
import { bind } from "./test/game.js";

const CORE = { TMD, MON_TMD, RF, MON_MSG } as const;

/** An Rng whose rolls come from a list, so a test states the exact dice. */
function rolls(...values: number[]) {
  const queue = [...values];
  const next = () => {
    const v = queue.shift();
    if (v === undefined) throw new Error("ran out of scripted rolls");
    return v;
  };
  return { randint0: next, randint1: next };
}

function monCtx(name: string, noConf: boolean, dam: number, r: number, dice: number[]): MonProjectCtxLike {
  return {
    rng: rolls(...dice),
    r,
    seen: true,
    mon: { race: { name, flags: { has: (f: number) => noConf && f === RF.NO_CONF } } },
    dam,
    obvious: false,
    hurtMsg: -1,
    monTimed: [],
  };
}

describe("the bronze dragons bind", () => {
  it("with the projection, spell, monsters and armour together", () => {
    const { game } = bind(["bronze-dragons"]);
    const races = game.monsters.races as unknown as Array<{ name: string } | null>;
    for (const name of BRONZE_BREATHERS) expect(races.some((r) => r?.name === name), name).toBe(true);
    const armour = game.objects.kinds.find((k) => k?.name === "Bronze Dragon Scale Mail~");
    expect(armour).toBeDefined();
    const projections = game.projections as unknown as Array<{ name: string } | null>;
    expect(projections.some((p) => p?.name === "confusion")).toBe(true);
  });

  it("names every monster that breathes confusion in BRONZE_BREATHERS, and nothing else", () => {
    const mod = JSON.parse(readFileSync(new URL("./monster.json", import.meta.url), "utf8")) as {
      sections: Record<string, { records?: { name: string; spells?: string[] }[] }>;
    };
    const breathers = Object.values(mod.sections)
      .flatMap((s) => s.records ?? [])
      .filter((r) => (r.spells ?? []).some((line) => line.split(" | ").includes("BR_CONF")))
      .map((r) => r.name);
    expect(new Set(breathers)).toEqual(BRONZE_BREATHERS);
  });
});

describe("confusion on the player (3.2.0 spells1.c:3580)", () => {
  it("confuses for 1d20+10 turns, through core's own protection check", () => {
    const calls: unknown[] = [];
    confusePlayer(CORE)({ rng: rolls(7), incTimed: (...args) => (calls.push(args), true) });
    expect(calls).toEqual([[TMD.CONFUSED, 17, true]]);
  });
});

describe("confusion on a monster (3.2.0 spells1.c:2345)", () => {
  it("confuses an ordinary monster for (10 + 1d15 + r) / (r + 1) turns at full damage", () => {
    const ctx = monCtx("cave orc", false, 60, 1, [9]);
    confuseMonster(CORE, BRONZE_BREATHERS)(ctx);
    expect(ctx.monTimed[MON_TMD.CONF]).toBe(Math.trunc((10 + 9 + 1) / 2));
    expect(ctx.dam).toBe(60);
    expect(ctx.obvious).toBe(true);
  });

  it("halves the damage to a NO_CONF monster, which resists somewhat", () => {
    const ctx = monCtx("stone troll", true, 60, 0, [3]);
    confuseMonster(CORE, BRONZE_BREATHERS)(ctx);
    expect(ctx.dam).toBe(30);
    expect(ctx.hurtMsg).toBe(MON_MSG.RESIST_SOMEWHAT);
  });

  it("cuts a confusion breather's damage to dam * 2 / (1d6 + 6)", () => {
    const ctx = monCtx("mature bronze dragon", true, 60, 0, [3, 4]);
    confuseMonster(CORE, BRONZE_BREATHERS)(ctx);
    expect(ctx.dam).toBe(Math.trunc(120 / 10));
    expect(ctx.hurtMsg).toBe(MON_MSG.RESIST);
  });
});

describe("plugin.ts", () => {
  function host() {
    const set: Record<string, string[]> = { player: [], mon: [] };
    return {
      set,
      host: {
        projections: {
          player: { set: (code: string) => set.player!.push(code) },
          mon: { set: (code: string) => set.mon!.push(code) },
        },
        stores: { setDiscountRoll: () => {} },
        commands: { register: () => {}, setVerb: () => {} },
      },
    };
  }

  it("installs both confusion handlers while the section's flag is on", () => {
    const h = host();
    plugin.register(h.host as never, { flags: { "feature-restoration.bronze-dragons": true }, core: CORE } as never);
    expect(h.set).toEqual({ player: [CONFUSION], mon: [CONFUSION] });
  });

  it("installs nothing while it is off", () => {
    const h = host();
    plugin.register(h.host as never, { flags: {}, core: CORE } as never);
    expect(h.set).toEqual({ player: [], mon: [] });
  });
});

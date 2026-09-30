/**
 * "Restore sticky curses" (section sticky-curses).
 *
 * 4.0 pinned a cursed item until its curse was lifted; 4.2's curses are runes
 * that come off freely. This section patches the STICKY flag onto the 4.2
 * curses that answer to 4.0's cursed egos, and nothing else, and restores the
 * cursed rings, the Amulet of DOOM and the Staff of Slowness as ordinary kinds
 * carrying those curses at the 4.0 tiers (light at 40, permanent at 100).
 *
 * The tests below read the real composed-and-bound game, so a flag name the
 * engine does not know, a curse name that does not exist, or a record that
 * collides with core fails here with the game's own error.
 */

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { OF } from "@rpgm-tools/neo-angband-core";
import { recordKey } from "@rpgm-tools/neo-angband-mod-sdk";
import { bind } from "./test/game.js";

const require = createRequire(import.meta.url);

type Game = ReturnType<typeof bind>["game"];
type Kind = Game["objects"]["kinds"][number];

/** The 4.2 curses that answer to 4.0's cursed egos and items, and no others. */
const STICKY_CURSES = [
  "vulnerability",
  "teleportation",
  "dullness",
  "sickliness",
  "enveloping",
  "irritation",
  "weakness",
  "clumsiness",
  "slowness",
  "annoyance",
].sort();

/** The restored item kinds and the curses each carries, by name. */
const RESTORED: Array<{ name: string; type: string; curses: Array<[string, number]> }> = [
  { name: "Woe", type: "ring", curses: [["teleportation", 40], ["dullness", 40]] },
  { name: "Weakness", type: "ring", curses: [["weakness", 40]] },
  { name: "Stupidity", type: "ring", curses: [["dullness", 40]] },
  { name: "Aggravate Monster", type: "ring", curses: [["irritation", 40]] },
  { name: "DOOM", type: "amulet", curses: [["sickliness", 100], ["dullness", 100]] },
  { name: "Slowness", type: "staff", curses: [] },
];

const TV_NAME: Record<string, string> = { ring: "RING", amulet: "AMULET", staff: "STAFF" };
const tvalOf = (type: string): number => {
  const { TV } = require("@rpgm-tools/neo-angband-core") as { TV: Record<string, number> };
  return TV[TV_NAME[type] ?? type.toUpperCase()]!;
};

function kind(game: Game, name: string, type: string): Kind | undefined {
  return game.objects.kinds.find((k) => k?.name === name && k.tval === tvalOf(type));
}

/** The names of every bound curse carrying STICKY, sorted. */
function stickyNames(game: Game): string[] {
  return game.objects.curses
    .filter((c) => c && c.obj.flags.has(OF.STICKY))
    .map((c) => (c as { name: string }).name)
    .sort();
}

/** The power this kind gives a named curse, 0 when it does not carry it. */
function cursePower(game: Game, k: Kind, name: string): number {
  const idx = game.objects.curses.findIndex((c) => c?.name === name);
  return idx > 0 ? ((k.curses as number[] | null)?.[idx] ?? 0) : 0;
}

describe("sticky-curses", () => {
  it("leaves every core curse free while the section is off", () => {
    expect(stickyNames(bind([]).game)).toEqual([]);
  });

  it("pins STICKY onto exactly the listed curses and no other", () => {
    expect(stickyNames(bind(["sticky-curses"]).game)).toEqual(STICKY_CURSES);
  });

  it("binds every restored item as a kind of its own type", () => {
    const { game } = bind(["sticky-curses"]);
    for (const r of RESTORED) {
      expect(kind(game, r.name, r.type), `${r.type} ${r.name}`).toBeDefined();
    }
  });

  it("carries the right curse at the right power on every restored item", () => {
    const { game } = bind(["sticky-curses"]);
    for (const r of RESTORED) {
      const k = kind(game, r.name, r.type)!;
      const carried = (r.curses.length > 0 ? r.curses : []).map(([name]) => name).sort();
      const actual = game.objects.curses
        .map((c, i) => ({ c, i }))
        .filter(({ i }) => i > 0 && ((k.curses as number[] | null)?.[i] ?? 0) > 0)
        .map(({ c }) => (c as { name: string }).name)
        .sort();
      expect(actual, `${r.type} ${r.name}`).toEqual(carried);
      for (const [name, power] of r.curses) {
        expect(cursePower(game, k, name), `${r.name} ${name}`).toBe(power);
      }
    }
  });

  it("uses only the light (40) and permanent (100) power bands", () => {
    const { game } = bind(["sticky-curses"]);
    for (const r of RESTORED) {
      const k = kind(game, r.name, r.type)!;
      for (const [name, power] of r.curses) {
        expect([40, 100], `${r.name} ${name}`).toContain(power);
        expect(cursePower(game, k, name), `${r.name} ${name}`).toBe(power);
      }
    }
  });

  it("makes the Staff of Slowness slow whoever uses it", () => {
    const k = kind(bind(["sticky-curses"]).game, "Slowness", "staff")!;
    expect((k.effect as Array<{ eff: string; type?: string }>)[0]).toMatchObject({
      eff: "TIMED_INC",
      type: "SLOW",
    });
  });

  it("collides with nothing core ships", () => {
    const core = (
      require("@rpgm-tools/neo-angband-content/pack/object.json") as {
        records: Array<{ name: string; type: string }>;
      }
    ).records;
    const mod = require("./object.json") as {
      sections: Record<string, { records: Array<{ name: string; type: string }> }>;
    };
    for (const r of mod.sections["sticky-curses"]!.records) {
      expect(
        core.some((c) => c.type === r.type && c.name === r.name),
        `${r.type} ${r.name}`,
      ).toBe(false);
      expect(recordKey("object", r)).toBeTruthy();
    }
  });
});

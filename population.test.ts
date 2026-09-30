/**
 * Fast checks on the population harness itself.
 *
 * The full report is `pnpm population`, which generates hundreds of levels per
 * section and is far too slow for `pnpm test`. These tests run the same code on
 * a handful of levels and pin the two properties the report depends on: the
 * counts are reproducible from a seed, and a section's records are the only
 * records that turning that section on adds.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bind } from "./test/game.js";
import { bootLevel, type CorePack } from "@rpgm-tools/neo-angband-core";
import { BANDS, countBand, sectionRecords, seedFor, type Band, type BandCounts } from "./tools/population.js";

const SMALL_BAND: Band = { label: "probe", min: 5, max: 6 };
const SMALL_SEEDS = 2;

function serialize(counts: BandCounts): string {
  const entries = (m: Map<number, number>): string =>
    [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(",");
  return [
    counts.monsterTotal,
    counts.objectTotal,
    counts.wearableTotal,
    counts.wearableSticky,
    entries(counts.monsterByRidx),
    entries(counts.objectByKidx),
  ].join("|");
}

describe("population harness", () => {
  it("counts the same levels identically from the same seed", () => {
    const game = bind(["monsters-4-1", "sticky-curses"]).game;
    const first = countBand(game, SMALL_BAND, SMALL_SEEDS);
    const second = countBand(game, SMALL_BAND, SMALL_SEEDS);
    expect(serialize(second)).toBe(serialize(first));
  });

  it("generates a different level from a different seed at the same depth", () => {
    const game = bind(["monsters-4-1"]).game;
    const level = (k: number): string => {
      const { monsters, objects } = bootLevel({} as CorePack, { seed: seedFor(10, k), depth: 10, registries: game });
      return [monsters.map((m) => m.mon.race.ridx).join(","), objects.map((o) => o.obj.kind.kidx).join(",")].join("|");
    };
    expect(seedFor(10, 0)).not.toBe(seedFor(10, 1));
    expect(level(1)).not.toBe(level(0));
    expect(level(0)).toBe(level(0));
  });

  it("attributes a section's records to the section that declares them", () => {
    const monster = JSON.parse(readFileSync(new URL("./monster.json", import.meta.url), "utf8")) as {
      sections: Record<string, { records?: Array<{ name: string }> }>;
    };
    const object = JSON.parse(readFileSync(new URL("./object.json", import.meta.url), "utf8")) as {
      sections: Record<string, { records?: Array<{ name: string }> }>;
    };
    const names = (records: Array<{ name: string }> | undefined): string[] =>
      (records ?? []).map((r) => r.name).sort();

    for (const section of ["monsters-4-1", "monsters-3x", "bronze-dragons"]) {
      expect(sectionRecords(section).monsters.slice().sort(), section).toEqual(
        names(monster.sections[section]?.records),
      );
    }
    for (const section of ["junk", "sticky-curses", "classic-potions", "spike-doors"]) {
      expect(sectionRecords(section).objects.slice().sort(), section).toEqual(
        names(object.sections[section]?.records),
      );
    }
  });

  it("adds nothing for a section that has no monster or object records", () => {
    expect(sectionRecords("teleport-other")).toEqual({ monsters: [], objects: [] });
    expect(sectionRecords("flavors")).toEqual({ monsters: [], objects: [] });
  });

  it("does not leak one section's records into another", () => {
    const monster = sectionRecords("monsters-4-1").monsters;
    const object = sectionRecords("sticky-curses").objects;
    expect(monster.some((n) => object.includes(n))).toBe(false);

    const junk = sectionRecords("junk").objects;
    const potions = sectionRecords("classic-potions").objects;
    expect(junk.some((n) => potions.includes(n))).toBe(false);
  });

  it("covers the assignment's depth bands", () => {
    expect(BANDS.map((b) => b.label)).toEqual(["1-5", "6-10", "11-20", "21-30", "31-40", "41-60", "61-100"]);
  });
});

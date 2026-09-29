/**
 * Every section that adds records converted from an upstream release by
 * tools/convert-records.mjs.
 *
 * The converter compiles each record with 4.2.6's own gamedata spec, which
 * catches a directive 4.2.6 does not have. What it cannot catch, and what this
 * file checks through the real composition and bindCore:
 *
 * - a flag, effect or projection name the engine does not know;
 * - a record whose name and type collide with one core already ships;
 * - a "restored" record that is really a 4.2 record under a new name. Upstream
 *   renamed more items than it cut (Shadow Cloak is the Elven Cloak, the Sleep
 *   Monster wand is the Hold Monster wand), and a renamed record comes back as a
 *   duplicate with the same level, weight and cost.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { TV } from "@rpgm-tools/neo-angband-core";
import { bind } from "./test/game.js";

const require = createRequire(import.meta.url);

interface ObjectRecord {
  name: string;
  type: string;
  level: number;
  weight: number;
  cost: number;
  [key: string]: unknown;
}

const OBJECT_SECTIONS = ["classic-devices", "classic-potions", "classic-equipment", "classic-dangers"];
const MOD = JSON.parse(readFileSync(new URL("./object.json", import.meta.url), "utf8")) as {
  sections: Record<string, { records?: ObjectRecord[] }>;
};
const CORE = (require("@rpgm-tools/neo-angband-content/pack/object.json") as { records: ObjectRecord[] }).records;

/** A pack type name ("hard armor") as its TV constant; two constants differ from their names. */
const TV_NAME: Record<string, string> = { digger: "DIGGING", "dragon armor": "DRAG_ARMOR" };
const tvalOf = (type: string): number =>
  (TV as Record<string, number>)[TV_NAME[type] ?? type.toUpperCase().replace(/ /g, "_")]!;

/** What a rename keeps: level, weight, cost, dice, armour and effects. */
const signature = (r: ObjectRecord): string =>
  JSON.stringify([
    r.type, r.level, r.weight, r.cost,
    (r["attack"] as { hd?: string } | undefined)?.hd ?? null,
    (r["armor"] as { ac?: number } | undefined)?.ac ?? null,
    ((r["effect"] as { eff: string; type?: string }[] | undefined) ?? []).map((e) => `${e.eff}:${e.type ?? ""}`),
  ]);

const restored = (section: string): ObjectRecord[] => MOD.sections[section]?.records ?? [];

describe.each(OBJECT_SECTIONS)("section %s", (section) => {
  it("has records", () => {
    expect(restored(section).length).toBeGreaterThan(0);
  });

  it("binds, and every record becomes an object kind of its own type", () => {
    const { game } = bind([section]);
    for (const r of restored(section)) {
      const kind = game.objects.kinds.find(
        (k) => k?.name === r.name && k.tval === tvalOf(r.type),
      );
      expect(kind, `${r.type} ${r.name}`).toBeDefined();
    }
  });

  it("collides with nothing core ships", () => {
    for (const r of restored(section)) {
      expect(CORE.some((c) => c.type === r.type && c.name === r.name), `${r.type} ${r.name}`).toBe(false);
    }
  });

  it("is not a 4.2 record under another name", () => {
    for (const r of restored(section)) {
      const twin = CORE.find((c) => signature(c) === signature(r));
      expect(twin?.name, `${r.type} ${r.name}`).toBeUndefined();
    }
  });
});

describe("all converted sections together", () => {
  it("bind at once, with no name repeated within a type", () => {
    const all = OBJECT_SECTIONS.flatMap(restored);
    const keys = all.map((r) => `${r.type}|${r.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(() => bind(OBJECT_SECTIONS)).not.toThrow();
  });
});

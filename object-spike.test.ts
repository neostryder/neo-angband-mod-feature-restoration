/**
 * "Restore door spiking" (section spike-doors) - the content half. The command
 * that consumes this item is covered by plugin.test.ts; this file checks only
 * the `object.json` record itself: that it is filed under the right section,
 * that it does not collide with anything core already ships, and that its
 * numbers match the ones this mod's README cites from Angband 3.4.1
 * (2012-10-18, the last official release with a spike command) - `lib/edit/object.txt`
 * at that tag, `N:1:& Iron Spike~` through `D:` inclusive.
 *
 * WHAT THIS FILE TESTS, and what it deliberately does not. That a `records`
 * entry under a section reaches the composed game is the SDK's behaviour and
 * is tested there. What can actually be wrong HERE: a `type` this port does
 * not recognise as a tval, a name that collides with something core already
 * defines under the same tval (silently colliding refs), or a field that has
 * quietly drifted from the historical record this mod cites.
 */

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { recordKey } from "@rpgm-tools/neo-angband-mod-sdk";

import objectContrib from "./object.json";
import manifest from "./manifest.json";
import { IRON_SPIKE_NAME } from "./plugin.js";

const require = createRequire(import.meta.url);

interface ObjectRecord {
  name: string;
  type: string;
  graphics: { glyph: string; color: string };
  level: number;
  weight: number;
  cost: number;
  alloc: { common: number; minmax: string };
  flags: string[];
  [key: string]: unknown;
}

interface PackFile {
  records: ObjectRecord[];
}

function corePack(): PackFile {
  return require("@rpgm-tools/neo-angband-content/pack/object.json") as PackFile;
}

/** The published content version, so a pending core release names itself below. */
const CONTENT_VERSION = (
  require("@rpgm-tools/neo-angband-content/package.json") as { version: string }
).version;

type Contrib = { sections: Record<string, { records: ObjectRecord[] }> };
const CONTRIB = objectContrib as unknown as Contrib;
const RECORDS = CONTRIB.sections["spike-doors"]!.records;
const SPIKE = RECORDS.find((r) => r.name === IRON_SPIKE_NAME)!;

describe("spike-doors object record", () => {
  it("declares the section this mod's plugin.ts gates the command on", () => {
    const ids = (manifest.sections ?? []).map((s: { id: string }) => s.id);
    expect(ids).toContain("spike-doors");
    expect(Object.keys(CONTRIB.sections)).toEqual(["spike-doors"]);

    const section = manifest.sections!.find((s) => s.id === "spike-doors")!;
    expect(section.flag).toBe("feature-restoration.spike-doors");
  });

  it("contributes exactly one record, named IRON_SPIKE_NAME", () => {
    expect(RECORDS).toHaveLength(1);
    expect(SPIKE).toBeDefined();
    expect(SPIKE.name).toBe(IRON_SPIKE_NAME);
  });

  it("plugin.ts's own lookup string matches this record's name exactly, markup included", () => {
    // findSpike (plugin.ts) matches a pack object by kind.name === IRON_SPIKE_NAME,
    // and a bound kind's name is the record's own `name` field verbatim
    // (core's obj/bind.ts bindKinds: `name: rec.name`). If this drifts, the
    // command silently stops finding the item it is supposed to consume.
    expect(IRON_SPIKE_NAME).toBe(SPIKE.name);
  });

  it("the ref this mod writes does not collide with anything core already ships", () => {
    const ref = `feature-restoration:${recordKey("object", SPIKE)}`;
    const collision = corePack().records.find(
      (r) => `core:${recordKey("object", r)}` === `core:${recordKey("object", SPIKE)}`,
    );
    expect(
      collision,
      `core ${CONTENT_VERSION} already ships an object keyed "${recordKey("object", SPIKE)}" - ` +
        "this mod's Iron Spike would collide with it.",
    ).toBeUndefined();
    expect(ref).toBe(`feature-restoration:flask--iron-spike`);
  });

  it("borrows the 'flask' tval - the closest existing class to the removed TV_SPIKE - and stays a plain, non-magical consumable", () => {
    // Angband dropped TV_SPIKE itself before this port's 4.2.6 baseline (see
    // README, "Restore door spiking"), so this mod's Iron Spike has to live
    // under a real, currently-existing tval rather than one of its own -
    // shipping a new record needs no capability; minting a new item CLASS
    // would. `flask` was picked because Flask of Oil is core's own nearest
    // real precedent: a small, stackable, single-purpose consumable with no
    // weapon or armour semantics to collide with.
    expect(SPIKE.type).toBe("flask");
    const coreFlasks = corePack().records.filter((r) => r.type === "flask");
    expect(
      coreFlasks.length,
      "core no longer has any 'flask' tval records - the tval this mod borrows may have been renamed or removed.",
    ).toBeGreaterThan(0);
  });

  it("carries no combat modifiers and no magic - a plain consumable, exactly as Angband 3.4.1 shipped it", () => {
    expect(SPIKE.flags).toEqual(["EASY_KNOW"]);
    expect(SPIKE["attack"]).toEqual({ hd: "1d1", "to-h": "0", "to-d": "0" });
    expect(SPIKE["armor"]).toEqual({ ac: 0, "to-a": "0" });
  });

  /* Angband 3.4.1's lib/edit/object.txt: N:1:& Iron Spike~ / W:1:0:2:1 (depth:
   * rarity:weight:cost) / A:20:1 to 40 (commonness:min-to-max). Weight and
   * cost are tenth-pounds and gold respectively in both the historical record
   * and this port's schema (confirmed against core's own Flask of Oil, whose
   * weight of 20 matches its real 2.0 lb). */
  it("weight, cost and level match Angband 3.4.1's own record", () => {
    expect(SPIKE.weight).toBe(2);
    expect(SPIKE.cost).toBe(1);
    expect(SPIKE.level).toBe(1);
  });

  it("allocation matches Angband 3.4.1's own A: line (commonness 20, levels 1 to 40)", () => {
    expect(SPIKE.alloc).toEqual({ common: 20, minmax: "1 to 40" });
  });
});

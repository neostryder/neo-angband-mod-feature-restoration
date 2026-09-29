/**
 * "Restore seven ring and amulet flavors" (section flavors).
 *
 * Upstream commit e08ed1dcb ("Add some fixed artifact flavors", 2013-10-04)
 * commented out seven random flavors so their index slots could become fixed
 * flavors for artifacts: Ruby (28) became Narya, Sapphire (29) Vilya, Mithril
 * (40) Nenya, Bronze (52) Carlammas and Golden (55) the Necklace of the Dwarves,
 * while the Amber (44) and Coral (46) slots went to the Elfstone and the
 * Evenstar. The section adds the seven back as random flavors under new indices,
 * with the colours they had before that commit, so an unknown ring can once
 * again look like one of the Three.
 */

import { describe, expect, it } from "vitest";
import { TV } from "@rpgm-tools/neo-angband-core";
import { bind } from "./test/game.js";

type Flavor = { fidx: number; tval: number; sval: number; dAttr: string; text: string };
const flavorsOf = (on: string[]): Flavor[] =>
  (bind(on).game.objects.flavors as unknown as Array<Flavor | null>).filter((f): f is Flavor => f !== null);

/** The seven lines as they stood in lib/edit/flavor.txt before e08ed1dcb. */
const BEFORE_2013 = {
  ring: [["Red", "Ruby"], ["Blue", "Sapphire"], ["Light Blue", "Mithril"]],
  amulet: [["Yellow", "Amber"], ["White", "Coral"], ["Light Umber", "Bronze"], ["Yellow", "Golden"]],
};

describe("the seven flavors", () => {
  it("are random flavors of their own, with their pre-2013 colours", () => {
    const base = new Set(flavorsOf([]).map((f) => f.fidx));
    const added = flavorsOf(["flavors"]).filter((f) => !base.has(f.fidx));
    const pick = (tval: number) => added.filter((f) => f.tval === tval).map((f) => [f.dAttr, f.text]);
    expect(pick(TV.RING)).toEqual(BEFORE_2013.ring);
    expect(pick(TV.AMULET)).toEqual(BEFORE_2013.amulet);
    for (const f of added) expect(f.sval, f.text).toBe(0);
  });

  it("share their names with the artifact flavors they gave way to", () => {
    const rings = flavorsOf(["flavors"]).filter((f) => f.tval === TV.RING);
    for (const name of ["Ruby", "Sapphire", "Mithril"]) {
      const fixed = rings.filter((f) => f.text === name && f.sval !== 0);
      const random = rings.filter((f) => f.text === name && f.sval === 0);
      expect([fixed.length, random.length], name).toEqual([1, 1]);
    }
  });

  it("take indices no core flavor uses", () => {
    const core = new Set(flavorsOf([]).map((f) => f.fidx));
    const added = flavorsOf(["flavors"]).filter((f) => !core.has(f.fidx));
    expect(added.map((f) => f.fidx)).toEqual([303, 304, 305, 306, 307, 308, 309]);
  });
});

/**
 * "Restore the of Fury weapon ego" (section fury).
 *
 * 4.2.6's ego_item.txt still carries the whole "of Fury" record in 4.2 syntax.
 * Upstream switched it off in June 2011 (d65dfe355, "Merge Timo's item changes")
 * by commenting out its three `type:` lines and nothing else, so the record binds
 * but no weapon can ever carry it. The section sets those three types back.
 *
 * The balance check uses the game's own item-power rating (obj-power.c
 * object_power): a Long Sword made at level 60, rolled with each weapon ego
 * over fixed seeds. Fury lands just under (Defender), the strongest 4.2 weapon
 * ego, and it is also the rarest (commonness 2 from depth 50, against
 * Defender's 10 from depth 10), which is the trade the record already makes.
 */

import { describe, expect, it } from "vitest";
import { egoApplyMagic, objectPower, objectPrep, Rng, TV } from "@rpgm-tools/neo-angband-core";
import { bind } from "./test/game.js";

type Game = ReturnType<typeof bind>["game"];
type Ego = Game["objects"]["egos"][number];

function fury(game: Game): Ego {
  return game.objects.egos.find((e) => e?.name === "of Fury")!;
}

function possible(ego: Ego): number[] {
  const poss = ego.possItems as unknown as Set<number> | number[];
  return poss instanceof Set ? [...poss] : [...poss];
}

/** Mean object power of a level-60 Long Sword carrying this ego, over fixed seeds. */
function meanPower(game: Game, ego: Ego): number {
  const reg = game.objects;
  const kind = reg.kinds.find((k) => k.name === "& Long Sword~")!;
  const seeds = 400;
  let sum = 0;
  for (let s = 1; s <= seeds; s++) {
    const rng = new Rng(s);
    const obj = objectPrep(rng, reg, game.constants, kind, 60, "randomise");
    (obj as { ego: Ego }).ego = ego;
    egoApplyMagic(rng, reg, obj, 60);
    sum += objectPower(reg, obj);
  }
  return sum / seeds;
}

describe("of Fury", () => {
  it("can appear on no weapon in the base game", () => {
    expect(possible(fury(bind([]).game))).toEqual([]);
  });

  it("can appear on every sword, polearm and hafted weapon once the section is on", () => {
    const { game } = bind(["fury"]);
    const tvals = new Set<number>([TV.SWORD, TV.POLEARM, TV.HAFTED]);
    const expected = game.objects.kinds
      .filter((k) => k && tvals.has(k.tval) && k.allocProb > 0)
      .map((k) => k.kidx)
      .sort((a, b) => a - b);
    const extraAttacks = game.objects.egos.find((e) => e?.name === "of Extra Attacks")!;
    expect(possible(fury(game)).sort((a, b) => a - b)).toEqual(possible(extraAttacks).sort((a, b) => a - b));
    expect(expected.length).toBeGreaterThan(20);
    expect(expected.every((k) => possible(fury(game)).includes(k))).toBe(true);
  });

  it("keeps 4.2.6's own numbers: commonness 2 from depth 50", () => {
    const ego = fury(bind(["fury"]).game);
    expect([ego.allocProb, ego.allocMin, ego.allocMax]).toEqual([2, 50, 127]);
  });

  it("rates below (Defender) and above of Extra Attacks in the game's item-power rating", () => {
    const { game } = bind(["fury"]);
    const byName = (n: string) => game.objects.egos.find((e) => e?.name === n)!;
    const furyPower = meanPower(game, fury(game));
    expect(furyPower).toBeLessThan(meanPower(game, byName("(Defender)")));
    expect(furyPower).toBeGreaterThan(meanPower(game, byName("of Extra Attacks")));
  });
});

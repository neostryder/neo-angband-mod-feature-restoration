/**
 * The "(Shattered)" and "(Blasted)" egos (section sticky-curses).
 *
 * 3.5.1's ego_item.txt kept two broken-item records, "Destroyed Weapon" and
 * "Destroyed Body Armor", that no 4.x curse replaced. They carry rarity 0 and no
 * type lines, so the generator never rolls them; only the removed Curse Weapon
 * and Curse Armour scrolls made them. They come back as egos in 4.2's own
 * "of Backbiting" shape (commonness 0, negative combat values) plus a curse that
 * fits the item. The tests bind the real composed game.
 */

import { describe, expect, it } from "vitest";
import { OF, TV } from "@rpgm-tools/neo-angband-core";
import { bind } from "./test/game.js";

type Game = ReturnType<typeof bind>["game"];
type Ego = Game["objects"]["egos"][number];

const ego = (game: Game, name: string): Ego | undefined => game.objects.egos.find((e) => e?.name === name);

function possible(e: Ego): number[] {
  const poss = e.possItems as unknown as Set<number> | number[];
  return [...poss];
}

/** The tvals of every kind the ego can go on, sorted and de-duplicated. */
function tvalsOf(game: Game, e: Ego): number[] {
  const kinds = game.objects.kinds;
  return [...new Set(possible(e).map((kidx) => kinds[kidx]!.tval))].sort((a, b) => a - b);
}

function curseNames(game: Game, e: Ego): Array<[string, number]> {
  const curses = (e as unknown as { curses: number[] | null }).curses;
  return game.objects.curses
    .map((c, i) => [c, i] as const)
    .filter(([, i]) => i > 0 && (curses?.[i] ?? 0) > 0)
    .map(([c, i]) => [(c as { name: string }).name, curses![i]!]);
}

/** The lowest and highest value a parsed dice expression can roll. */
function range(r: unknown): { lo: number; hi: number } {
  const v = r as { base: number; dice: number; sides: number };
  return { lo: v.base + v.dice, hi: v.base + v.dice * v.sides };
}

describe("(Shattered) and (Blasted)", () => {
  it("do not exist while the section is off", () => {
    const { game } = bind([]);
    expect(ego(game, "(Shattered)")).toBeUndefined();
    expect(ego(game, "(Blasted)")).toBeUndefined();
  });

  it("bind with the section on, at commonness 0 from depth 1 to 80", () => {
    const { game } = bind(["sticky-curses"]);
    for (const name of ["(Shattered)", "(Blasted)"]) {
      const e = ego(game, name)!;
      expect(e, name).toBeDefined();
      expect([e.allocProb, e.allocMin, e.allocMax], name).toEqual([0, 1, 80]);
    }
  });

  it("(Shattered) goes on melee weapons only, and takes 1 to 5 from to-hit and to-dam", () => {
    const { game } = bind(["sticky-curses"]);
    const e = ego(game, "(Shattered)")!;
    expect(tvalsOf(game, e)).toEqual([TV.DIGGING, TV.HAFTED, TV.POLEARM, TV.SWORD].sort((a, b) => a - b));
    expect(range(e.toH)).toEqual({ lo: -5, hi: -1 });
    expect(range(e.toD)).toEqual({ lo: -5, hi: -1 });
    expect(range(e.toA)).toEqual({ lo: 0, hi: 0 });
    expect(curseNames(game, e)).toEqual([["air swing", 40]]);
  });

  it("pin their item the way 3.0.9's cursed (Shattered) and (Blasted) did", () => {
    const { game } = bind(["sticky-curses"]);
    for (const name of ["(Shattered)", "(Blasted)"]) {
      for (const [curse] of curseNames(game, ego(game, name)!)) {
        const c = game.objects.curses.find((x) => x?.name === curse)!;
        expect(c.obj.flags.has(OF.STICKY), `${name} ${curse}`).toBe(true);
      }
    }
  });

  it("(Blasted) goes on body armour only, and takes 1 to 10 from to-ac", () => {
    const { game } = bind(["sticky-curses"]);
    const e = ego(game, "(Blasted)")!;
    expect(tvalsOf(game, e)).toEqual([TV.SOFT_ARMOR, TV.HARD_ARMOR, TV.DRAG_ARMOR].sort((a, b) => a - b));
    expect(range(e.toA)).toEqual({ lo: -10, hi: -1 });
    expect(range(e.toH)).toEqual({ lo: 0, hi: 0 });
    expect(range(e.toD)).toEqual({ lo: 0, hi: 0 });
    expect(curseNames(game, e)).toEqual([["vulnerability", 40]]);
  });
});


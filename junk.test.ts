/**
 * "Restore junk items" (section junk).
 *
 * Angband 3.4.1 still had the dungeon junk - empty bottles, shards, sticks,
 * bones, skeletons, a filthy rag and broken weapons - under item classes
 * Angband later dropped. This section declares the three classes in tval.json
 * (junk, skeleton, bottle) and the records under them.
 *
 * The tests bind the real composed game, so an undeclared class, an unknown
 * flag or a colliding name fails here with the game's own error. The class
 * predicates are asked through tvalInClass: a declared class answers "no" to
 * every question until a mod wires one, which is exactly what junk needs.
 */

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { tvalFindIdx, tvalInClass, tvals, IgnoreSettings } from "@rpgm-tools/neo-angband-core";
import { bind } from "./test/game.js";
// @ts-expect-error The test imports the handwritten source module.
import plugin from "./plugin.ts";

const require = createRequire(import.meta.url);

type Game = ReturnType<typeof bind>["game"];

const MOD = require("./object.json") as {
  sections: Record<string, { records: Array<{ name: string; type: string }> }>;
};
const JUNK = MOD.sections["junk"]!.records;

/** Every junk class and the record names that use it. */
const CLASSES: Record<string, string[]> = {
  bottle: ["& Empty Bottle~"],
  junk: ["& Shard~ of Pottery", "& Broken Stick~"],
  skeleton: [
    "& Broken Skull~",
    "& Broken Bone~",
    "& Canine Skeleton~",
    "& Rodent Skeleton~",
    "& Human Skeleton~",
    "& Dwarf Skeleton~",
    "& Elf Skeleton~",
    "& Gnome Skeleton~",
  ],
};

function kindNamed(game: Game, name: string): Game["objects"]["kinds"][number] | undefined {
  return game.objects.kinds.find((k) => k?.name === name);
}

describe("junk", () => {
  it("ignores the junk, skeleton and bottle kinds for a new character with junk on", () => {
    const { game } = bind(["junk"]);
    const ignore = new IgnoreSettings();
    const hook = plugin.hooks({
      flags: { "feature-restoration.junk": true },
      core: { tvalFindIdx } as NonNullable<Parameters<typeof plugin.hooks>[0]["core"]>,
    }).newCharacter;
    expect(hook).toBeTypeOf("function");
    hook!({ ignore }, game);
    const modClass = new Set(Object.keys(CLASSES).map((c) => tvalFindIdx(c)));
    const ignored = game.objects.kinds.filter((k) => k && ignore.kindIsIgnoredAware(k.kidx));
    expect(ignored.map((k) => k!.name).sort()).toEqual(Object.values(CLASSES).flat().sort());
    for (const k of ignored) {
      expect(modClass.has(k!.tval), k!.name).toBe(true);
      expect(ignore.kindIsIgnoredUnaware(k!.kidx), k!.name).toBe(true);
    }
    /* The rag and broken weapons sit in Angband's own armour and sword
     * classes, whose kinds the ignore menus never offer. */
    for (const name of ["& Filthy Rag~", "& Broken Dagger~", "& Broken Sword~"]) {
      expect(ignore.kindIsIgnoredAware(kindNamed(game, name)!.kidx), name).toBe(false);
    }
  });

  it("lists the three classes in the ignore menus so a player can undo the ignore", () => {
    bind(["junk"]);
    const listed = tvals.ignoreCategories();
    expect(listed.map((c) => c.desc)).toEqual(["Junk", "Skeletons", "Bottles"]);
    expect(listed.map((c) => c.tval)).toEqual(["junk", "skeleton", "bottle"].map((c) => tvalFindIdx(c)));
  });

  it("leaves new characters' ignore settings empty when junk is off", () => {
    const { game } = bind([]);
    const ignore = new IgnoreSettings();
    const hook = plugin.hooks({ flags: { "feature-restoration.junk": false } }).newCharacter;
    expect(hook).toBeUndefined();
    expect(game.objects.kinds.some((k) => k && ignore.kindIsIgnoredAware(k.kidx))).toBe(false);
  });

  it("binds at once, with every record reaching the game", () => {
    const { game } = bind(["junk"]);
    for (const r of JUNK) {
      expect(kindNamed(game, r.name), r.name).toBeDefined();
    }
  });

  it("declares the junk, skeleton and bottle classes", () => {
    bind(["junk"]);
    for (const name of Object.keys(CLASSES)) {
      expect(tvalFindIdx(name), name).toBeGreaterThanOrEqual(0);
    }
  });

  it("files every record under its own declared class", () => {
    const { game } = bind(["junk"]);
    for (const [cls, names] of Object.entries(CLASSES)) {
      const tval = tvalFindIdx(cls);
      for (const name of names) {
        expect(kindNamed(game, name)?.tval, name).toBe(tval);
      }
    }
  });

  it("answers no to wearable, flavoured and usable for every junk class", () => {
    bind(["junk"]);
    for (const name of Object.keys(CLASSES)) {
      const tval = tvalFindIdx(name);
      expect(tvalInClass("tvalIsWearable", tval), name).toBe(false);
      expect(tvalInClass("tvalCanHaveFlavor", tval), name).toBe(false);
      expect(tvalInClass("tvalIsUseable", tval), name).toBe(false);
    }
  });

  it("turns every record off with the section", () => {
    const { game } = bind([]);
    for (const r of JUNK) {
      expect(kindNamed(game, r.name), r.name).toBeUndefined();
    }
    for (const name of Object.keys(CLASSES)) {
      expect(tvalFindIdx(name), name).toBe(-1);
    }
  });

  it("gives every record a low allocation", () => {
    for (const r of JUNK) {
      expect((r as { alloc?: { common?: number } }).alloc?.common, r.name).toBe(1);
    }
  });

  it("keeps 3.0.9's own numbers for the rag and the broken weapons", () => {
    const byName = (name: string) => JUNK.find((r) => r.name === name) as unknown as Record<string, unknown>;
    expect(byName("& Filthy Rag~")).toMatchObject({ level: 0, weight: 20, cost: 1, attack: { hd: "0d0" }, armor: { ac: 1, "to-a": "-1" } });
    expect(byName("& Broken Dagger~")).toMatchObject({ level: 0, weight: 5, cost: 1, attack: { hd: "1d1", "to-h": "-2", "to-d": "-4" } });
    expect(byName("& Broken Sword~")).toMatchObject({ level: 0, weight: 30, cost: 2, attack: { hd: "1d2", "to-h": "-2", "to-d": "-4" } });
  });

  it("collides with nothing core ships", () => {
    const core = (
      require("@rpgm-tools/neo-angband-content/pack/object.json") as {
        records: Array<{ name: string; type: string }>;
      }
    ).records;
    for (const r of JUNK) {
      expect(
        core.some((c) => c.type === r.type && c.name === r.name),
        `${r.type} ${r.name}`,
      ).toBe(false);
    }
  });
});

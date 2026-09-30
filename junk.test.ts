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
import { tvalFindIdx, tvalInClass, IgnoreSettings } from "@rpgm-tools/neo-angband-core";
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
  it("ignores all 14 kinds when a new character starts with junk enabled", () => {
    const { game } = bind(["junk"]);
    const ignore = new IgnoreSettings();
    const hook = plugin.hooks({
      flags: { "feature-restoration.junk": true },
      core: { tvalFindIdx } as NonNullable<Parameters<typeof plugin.hooks>[0]["core"]>,
    }).newCharacter;
    expect(hook).toBeTypeOf("function");
    hook!({ ignore }, game);
    for (const r of JUNK) {
      const kind = game.objects.kinds.find((k) => k?.name === r.name && k.tval === tvalFindIdx(r.type))!;
      expect(ignore.kindIsIgnoredAware(kind.kidx), r.name).toBe(true);
      expect(ignore.kindIsIgnoredUnaware(kind.kidx), r.name).toBe(true);
    }
    expect(JUNK).toHaveLength(14);
    expect(game.objects.kinds.filter((k) => k && !JUNK.some((r) => r.name === k.name && tvalFindIdx(r.type) === k.tval))
      .some((k) => k && ignore.kindIsIgnoredAware(k.kidx))).toBe(false);
  });

  it("leaves new characters' ignore settings empty when junk is off", () => {
    const { game } = bind([]);
    const ignore = new IgnoreSettings();
    const hook = plugin.hooks({ flags: { "feature-restoration.junk": false } }).newCharacter;
    expect(hook).toBeUndefined();
    hook?.({ ignore }, game);
    expect(game.objects.kinds.some((k) => k && ignore.kindIsIgnoredAware(k.kidx))).toBe(false);
    expect(game.objects.kinds.some((k) => k && ignore.kindIsIgnoredUnaware(k.kidx))).toBe(false);
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

/**
 * Every section that adds monsters converted from an upstream release.
 *
 * Binding is where a monster record can fail: a spell, flag, blow or base name
 * the engine does not know, or a friends line naming a monster that is not
 * there. Each section is bound alone, so a group that names another group's
 * monsters fails here rather than only when both happen to be on.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { bind } from "./test/game.js";

const require = createRequire(import.meta.url);

interface MonsterRecord {
  name: string;
  depth: number;
  [key: string]: unknown;
}

const MONSTER_SECTIONS = ["monsters-4-1", "monsters-3x"];
const MOD = JSON.parse(readFileSync(new URL("./monster.json", import.meta.url), "utf8")) as {
  sections: Record<string, { records?: MonsterRecord[] }>;
};
const CORE = (require("@rpgm-tools/neo-angband-content/pack/monster.json") as { records: MonsterRecord[] }).records;
const restored = (section: string): MonsterRecord[] => MOD.sections[section]?.records ?? [];

type Race = { name: string; rarity: number; friends: { race: unknown }[]; drops: { tval: string; sval: string | null }[] };
const racesOf = (game: ReturnType<typeof bind>["game"]): Race[] =>
  (game.monsters.races as unknown as Array<Race | null>).filter((r): r is Race => r !== null);

describe.each(MONSTER_SECTIONS)("section %s", (section) => {
  it("binds on its own, and every record becomes a race", () => {
    const { game } = bind([section]);
    const races = game.monsters.races as unknown as Array<{ name: string } | null>;
    for (const r of restored(section)) {
      expect(races.some((x) => x?.name === r.name), r.name).toBe(true);
    }
  });

  it("keeps every friends line, with each one naming a real monster", () => {
    const races = racesOf(bind([section]).game);
    for (const r of restored(section)) {
      const bound = races.find((x) => x.name === r.name)!;
      const wanted = ((r["friends"] as unknown[]) ?? []).length;
      expect(bound.friends.length, r.name).toBe(wanted);
      for (const f of bound.friends) expect(f.race, r.name).toBeTruthy();
    }
  });

  it("drops no item by a name the game does not have", () => {
    const { game } = bind([section]);
    for (const race of racesOf(game).filter((x) => restored(section).some((r) => r.name === x.name))) {
      for (const d of race.drops.filter((x) => x.sval !== null)) {
        const kind = game.objects.kinds.find((k) => k?.name === d.sval);
        expect(kind, `${race.name} drops ${d.sval}`).toBeDefined();
      }
    }
  });

  it("collides with no monster core ships", () => {
    const core = new Set(CORE.map((c) => c.name.toLowerCase()));
    for (const r of restored(section)) expect(core.has(r.name.toLowerCase()), r.name).toBe(false);
  });
});

describe("monsters-4-1 alongside their 4.2 successors", () => {
  const list = JSON.parse(readFileSync(new URL("./tools/restore/monsters-4-1.json", import.meta.url), "utf8")) as {
    records: { name: string; twin?: string }[];
  };
  const twins = list.records.filter((r) => r.twin !== undefined);

  it("pairs 25 restored monsters with the 4.2 monster that took their place", () => {
    expect(twins).toHaveLength(25);
  });

  it("halves how often each member of a pair appears, only while the section is on", () => {
    const off = racesOf(bind([]).game);
    const on = racesOf(bind(["monsters-4-1"]).game);
    for (const { name, twin } of twins) {
      const before = off.find((r) => r.name === twin)!.rarity;
      expect(on.find((r) => r.name === twin)!.rarity, twin).toBe(before * 2);
      expect(on.find((r) => r.name === name)!.rarity, name).toBeGreaterThanOrEqual(2);
    }
  });
});

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  EF, MON_GROUP, MON_TMD, OBJ_NOTICE, OF, PY_SPELL, TMD, MonAllocTable, gearAdd, getLore, loc, los, monsterIsVisible,
  objectPrep, placeNewMonsterLive, processPlayer, squareIsOpenLive, squareIsSeen, squareIsView, startGame,
  requestForEffect, spellByIndex, updateMonsters,
  type CoreRegistries, type GameObject, type GameState, type Monster,
} from "@rpgm-tools/neo-angband-core";
import { bindBooks, compose, gamePack, modManifest } from "./test/game.js";
import monsterData from "./monster.json";

const require = createRequire(import.meta.url);
const original = require("@rpgm-tools/neo-angband-content/pack/class.json").records as Array<{
  name: string; magic?: unknown; book?: Array<{ name: string }>;
}>;
const prices = JSON.parse(readFileSync(new URL("./tools/classic-book-prices.json", import.meta.url), "utf8")) as
  Record<string, Array<{ book: string; spell: string; level: number; mana: number; fail: number; exp: number }>>;
const groups = [
  { section: "classic-arcane-books", names: ["Mage", "Rogue", "Ranger"] },
  { section: "classic-prayer-books", names: ["Priest", "Paladin"] },
] as const;
const targetSpells: Record<string, readonly string[]> = {
  Mage: ["Lesser Recharging", "Identify Rune", "Greater Recharging", "Elemental Brand", "Banishment"],
  Rogue: ["Lesser Recharging", "Identify Rune", "Enchant Armor", "Enchant Weapon", "Greater Recharging", "Elemental Brand"],
  Ranger: ["Lesser Recharging", "Identify Rune", "Enchant Armor", "Enchant Weapon", "Greater Recharging", "Elemental Brand"],
  Priest: ["Scare Monster", "Remove Curse", "Resist Heat and Cold", "Perception", "Probing",
    "Recharging", "Dispel Curse", "Enchant Weapon", "Enchant Armour", "Elemental Brand"],
  Paladin: ["Scare Monster", "Remove Curse", "Resist Heat and Cold", "Perception", "Probing",
    "Recharging", "Enchant Weapon", "Enchant Armour", "Elemental Brand"],
};

function spellTarget(state: GameState, registry: CoreRegistries, name: string) {
  let item: GameObject | null = null;
  let monster: Monster | null = null;
  const args: Record<string, unknown> = {};
  if (["Scare Monster", "Probing", "Banishment"].includes(name)) {
    const race = registry.monsters.races.find((entry) => entry?.name === "filthy street urchin")!;
    const start = state.actor.grid;
    const grid = [loc(start.x + 1, start.y), loc(start.x - 1, start.y),
      loc(start.x, start.y + 1), loc(start.x, start.y - 1)]
      .find((candidate) => squareIsOpenLive(state, candidate) && squareIsView(state.chunk, candidate)
        && squareIsSeen(state.chunk, candidate) && los(state.chunk, start, candidate));
    expect(grid, `${name} needs an open visible square`).toBeDefined();
    expect(placeNewMonsterLive(state, grid!, race, false, false,
      { index: 0, role: MON_GROUP.LEADER }, { table: new MonAllocTable(registry.monsters.races) })).toBe(true);
    monster = state.monsters.find((entry) => entry?.grid.x === grid!.x && entry.grid.y === grid!.y)!;
    expect(monster).toBeDefined();
    updateMonsters(state, true);
    if (name === "Probing") {
      expect(monsterIsVisible(monster), "Probing requires a visible monster").toBe(true);
      expect(getLore(state.lore, race).allKnown).toBe(false);
    }
    if (name === "Banishment") args["tgtsymbol"] = race.dChar;
    if (name === "Scare Monster") {
      args["dir"] = grid!.x > start.x ? 6 : grid!.x < start.x ? 4 : grid!.y > start.y ? 2 : 8;
    }
  }
  if (["Lesser Recharging", "Greater Recharging", "Recharging", "Identify Rune", "Perception",
    "Enchant Armor", "Enchant Armour", "Enchant Weapon", "Elemental Brand",
    "Remove Curse", "Dispel Curse"].includes(name)) {
    const tval = name.includes("Recharging") ? "wand" : name === "Identify Rune" || name === "Perception" ? "ring"
      : name.includes("Curse") || name.includes("Armor") || name.includes("Armour") ? "soft armor"
        : name === "Elemental Brand" && state.actor.player.cls.name !== "Priest"
          && state.actor.player.cls.name !== "Paladin" ? "shot" : "sword";
    const kind = registry.objects.kinds.find((entry) =>
      entry && entry.name.toLowerCase().includes(tval === "wand" ? "magic missile"
        : tval === "ring" ? "protection" : tval === "soft armor" ? "robe"
          : tval === "shot" ? "shot" : "dagger"))!;
    expect(kind, `${name} needs a ${tval}`).toBeDefined();
    item = objectPrep(state.rng, registry.objects, registry.constants, kind, 1, "average");
    item.notice |= OBJ_NOTICE.ASSESSED;
    if (name.includes("Recharging")) item.pval = 0;
    if (name === "Identify Rune" || name === "Perception") item.flags.on(OF.FREE_ACT);
    if (name === "Dispel Curse" || name === "Remove Curse") {
      const curse = registry.objects.curses.findIndex((entry, index) => index > 0 && entry);
      item.curses = Array.from({ length: registry.objects.curses.length }, () => ({ power: 0, timeout: 0 }));
      item.curses[curse] = { power: 1, timeout: 0 };
      state.actor.player.objKnown.curses[curse] = 1;
    }
    const handle = gearAdd(state.gear, item);
    if (name === "Dispel Curse" || name === "Remove Curse") {
      expect(requestForEffect(EF.REMOVE_CURSE, 0, state)?.tester(item),
        `${name} requires a known removable curse`).toBe(true);
    }
    if (name === "Elemental Brand" && (state.actor.player.cls.name === "Priest"
      || state.actor.player.cls.name === "Paladin")) {
      const slot = state.actor.player.body.slots.findIndex((entry) => entry.type === "WEAPON");
      state.actor.player.equipment[slot] = handle;
      state.gear.pack.splice(state.gear.pack.indexOf(handle), 1);
    } else {
      args["tgtitem"] = { handle };
    }
  }
  return { args, item, monster };
}

describe("classic spellbooks", () => {
  it("locks both book sections at birth and leaves them off by default", () => {
    const sections = (modManifest() as unknown as { sections: Array<{ id: string; default: boolean; lockedAtBirth?: boolean }> }).sections;
    for (const { section } of groups) {
      expect(sections.find((entry) => entry.id === section)).toMatchObject({
        default: false, lockedAtBirth: true,
      });
    }
  });

  for (const { section, names } of groups) {
    it(`${section} composes and binds every restored spell`, () => {
      const { composed, players } = bindBooks([section]);
      const records = composed.records["class"] as Array<{
        name: string; magic?: { books: number }; book?: Array<{
          name: string; spells: number; spell: Array<{ name: string; level: number; mana: number; fail: number; exp: number }>;
        }>; equip?: Array<{ tval: string; sval: string }>; stats?: { int: number; wis: number };
      }>;
      for (const name of names) {
        const cls = records.find((entry) => entry.name === name)!;
        expect(cls.magic?.books).toBe(9);
        expect(cls.book).toHaveLength(9);
        for (const book of cls.book!) expect(book.spells, `${name}: ${book.name} spell count`).toBe(book.spell.length);
        expect(cls.equip).toContainEqual(expect.objectContaining({ sval: cls.book![0]!.name }));
        const rows = cls.book!.flatMap((book) => book.spell.map((spell) => ({ book: book.name, spell: spell.name,
          level: spell.level, mana: spell.mana, fail: spell.fail, exp: spell.exp })));
        expect(rows).toEqual(prices[name]);
        expect(players.classByName(name)?.magic?.books).toHaveLength(9);
      }
      for (const name of original.filter((cls) => !(names as readonly string[]).includes(cls.name)).map((cls) => cls.name)) {
        if (name === "Priest" || name === "Paladin" || name === "Mage" || name === "Rogue" || name === "Ranger") {
          expect(records.find((entry) => entry.name === name)?.book).toEqual(original.find((cls) => cls.name === name)?.book);
        }
      }
      if (section === "classic-arcane-books") expect(records.find((entry) => entry.name === "Ranger")?.stats?.int).toBe(2);
    });
  }

  it("the independent chassis changes no books", () => {
    const records = compose(["classic-class-chassis"]).records["class"] as Array<{
      name: string; exp?: number; book?: unknown;
    }>;
    for (const [name, exp] of Object.entries({ Mage: 30, Priest: 20, Rogue: 25, Ranger: 30, Paladin: 35 })) {
      const cls = records.find((entry) => entry.name === name)!;
      expect(cls.exp).toBe(exp);
      expect(cls.book).toEqual(original.find((entry) => entry.name === name)?.book);
    }
    expect(bindBooks(["classic-class-chassis"]).players.classes.length).toBeGreaterThan(5);
  });

  it("the seven restored book-dropping monsters have valid generic drops with books on and off", () => {
    const droppers = (monsterData.sections["monsters-4-1"].records as Array<{
      name: string; "drop-base"?: Array<{ tval: string }>;
    }>).filter((record) => record["drop-base"]?.some((drop) => drop.tval.endsWith(" book")));
    expect(droppers).toHaveLength(7);
    for (const on of [[], ["classic-arcane-books", "classic-prayer-books"]] as const) {
      const { game, players } = bindBooks(["monsters-4-1", ...on]);
      for (const { name, "drop-base": expected } of droppers) {
        const race = game.monsters.races.find((entry) => entry?.name === name)!;
        expect(race.drops.map((drop) => drop.tval)).toEqual(
          expect.arrayContaining(expected!.map((drop) => drop.tval)),
        );
        for (const { tval } of expected!) {
          const cls = tval === "magic book" ? "Mage" : "Priest";
          const books = players.classByName(cls)!.magic.books;
          expect(books).toHaveLength(on.length ? 9 : 5);
          expect(books[0]?.tval).toBe(tval);
        }
      }
    }
  });

  it("starts each classic caster with its first book with the sections on and off", () => {
    for (const { section, names } of groups) {
      for (const enabled of [false, true]) {
        const pack = gamePack(enabled ? [section] : []).pack;
        for (const name of names) {
          const { state } = startGame(pack, { seed: 73, depth: 1, className: name });
          const player = state.actor.player;
          expect(player.cls.magic.books).toHaveLength(enabled ? 9 : original.find((cls) => cls.name === name)!.book!.length);
          expect(state.gear.pack.some((handle) => {
            const obj = state.gear.store.get(handle);
            return obj?.kind.name === player.cls.magic.books[0]?.name;
          }), `${name} starting book`).toBe(true);
        }
      }
    }
  });

  it("casts every historical spell through the game cast command", () => {
    let completed = 0;
    let targeted = 0;
    for (const { section, names } of groups) {
      const pack = gamePack([section]).pack;
      for (const name of names) {
        for (let index = 0; index < prices[name]!.length; index++) {
          const { state, registry, booted } = startGame(pack, { seed: 73, depth: 1, className: name });
          const player = state.actor.player;
          player.lev = 50;
          player.csp = 1000;
          player.msp = 1000;
          player.spellFlags[index] = PY_SPELL.LEARNED;
          const spell = prices[name]![index]!.spell;
          expect(spellByIndex(player.cls, index)?.name, `${name}: spell index ${index}`).toBe(spell);
          const needsTarget = targetSpells[name]!.includes(spell);
          const target = needsTarget ? spellTarget(state, booted.registries, spell) : null;
          const itemBefore = target?.item && {
            pval: target.item.pval, number: target.item.number, toA: target.item.toA,
            toH: target.item.toH, toD: target.item.toD,
            curse: target.item.curses?.map((entry) => entry.power),
          };
          if (spell === "Identify Rune" || spell === "Perception") {
            expect(player.objKnown.flags.has(OF.FREE_ACT), `${name}: ${spell} rune starts unknown`).toBe(false);
            expect(requestForEffect(EF.IDENTIFY, 0, state)?.tester(target!.item!)).toBe(true);
          }
          const commands = [{ code: "cast", args: { spell: index, dir: 6, tgtdir: 6, ...target?.args } }];
          state.nextCommand = () => commands.shift() ?? null;
          const energy = processPlayer(state, registry).energyUsed;
          expect(energy, `${name}: ${spell}`).toBe(state.z.moveEnergy);
          completed++;
          if (needsTarget) {
            targeted++;
            expect((player.spellFlags[index] ?? 0) & PY_SPELL.WORKED, `${name}: ${spell} worked`).toBeTruthy();
            if (spell === "Banishment") {
              expect(state.monsters.includes(target!.monster!), `${name}: ${spell} banished monster`).toBe(false);
            } else if (spell === "Scare Monster") {
              expect(target!.monster!.mTimed[MON_TMD.FEAR], `${name}: ${spell} scared monster`).toBeGreaterThan(0);
            } else if (spell === "Probing") {
              expect(getLore(state.lore, target!.monster!.race).allKnown, `${name}: ${spell} probed monster`).toBe(true);
            } else if (spell === "Resist Heat and Cold") {
              expect(player.timed[TMD.OPP_COLD]).toBeGreaterThan(0);
              expect(player.timed[TMD.OPP_FIRE]).toBeGreaterThan(0);
            } else if (spell === "Identify Rune" || spell === "Perception") {
              expect(player.objKnown.flags.has(OF.FREE_ACT), `${name}: ${spell} identified rune`).toBe(true);
            } else if (spell === "Dispel Curse" || spell === "Remove Curse") {
              expect(target!.item!.curses?.map((entry) => entry.power)).not.toEqual(itemBefore!.curse);
            } else if (spell === "Elemental Brand") {
              expect(target!.item!.ego, `${name}: ${spell} branded item`).not.toBeNull();
            } else if (spell.includes("Recharging")) {
              expect([target!.item!.pval, target!.item!.number],
                `${name}: ${spell} recharged or destroyed wand`).not.toEqual([itemBefore!.pval, itemBefore!.number]);
            } else if (spell.includes("Enchant")) {
              expect([target!.item!.toA, target!.item!.toH, target!.item!.toD]).not.toEqual(
                [itemBefore!.toA, itemBefore!.toH, itemBefore!.toD]);
            }
          }
        }
      }
    }
    expect(completed).toBe(254);
    expect(targeted).toBe(36);
  }, 120000);

  it("prices same-named spells at the current pack's mana and failure rate", () => {
    const current = new Map(original.filter((cls) => Object.hasOwn(prices, cls.name)).flatMap((cls) =>
      (cls.book as Array<{ spell: Array<{ name: string; mana: number; fail: number }> }> | undefined ?? [])
        .flatMap((book) => book.spell.map((spell) => [spell.name, spell] as const))));
    for (const entries of Object.values(prices)) {
      for (const row of entries) {
        const same = current.get(row.spell);
        if (same) expect([row.mana, row.fail], row.spell).toEqual([same.mana, same.fail]);
      }
    }
  });
});

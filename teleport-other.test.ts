/**
 * "Restore Teleport Other" (section teleport-other).
 *
 * Angband used to give every spellcasting class a way to teleport a monster away.
 * Angband 4.2.6 kept it for the Mage and the Rogue and dropped it for the Priest,
 * the Paladin and the Ranger. This section adds it back to those three, at a level,
 * mana cost and fail rate consistent with the copies core already ships.
 *
 * WHAT THIS FILE TESTS, and what it deliberately does not. That a `fieldPatches`
 * entry keyed by a record ref reaches the composed game is the SDK's behaviour and
 * is tested there (mod-sdk loader.test.ts and patch.test.ts). Re-asserting it here
 * would test the SDK twice and this mod's data zero times.
 *
 * What can actually be wrong HERE: a book index that does not point at the book this
 * mod thinks it does, a spell shape core's own effect system would reject, a `spells`
 * count left out of step with the array it counts, or restoring a class that already
 * has the spell (double-teaching it). All four are checked against the REAL, PUBLISHED
 * core pack - not a hand-written mirror of it.
 */

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { recordKey } from "@rpgm-tools/neo-angband-mod-sdk";

import classContrib from "./class.json";
import manifest from "./manifest.json";

const require = createRequire(import.meta.url);

interface SpellRecord {
  name: string;
  level: number;
  mana: number;
  fail: number;
  exp: number;
  effect: unknown[];
  desc: string[];
}

interface BookRecord {
  name: string;
  spells: number;
  spell: SpellRecord[];
}

interface ClassRecord {
  name: string;
  book: BookRecord[];
  [key: string]: unknown;
}

interface PackFile {
  records: ClassRecord[];
}

function corePack(): PackFile {
  return require("@rpgm-tools/neo-angband-content/pack/class.json") as PackFile;
}

/** The published content version, so a pending core release names itself below. */
const CONTENT_VERSION = (
  require("@rpgm-tools/neo-angband-content/package.json") as { version: string }
).version;

type FieldOp = { op: string; path: string; value: unknown };
type Contrib = {
  sections: Record<string, { fieldPatches: Record<string, FieldOp[]> }>;
};

const CONTRIB = classContrib as unknown as Contrib;
const PATCHES = CONTRIB.sections["teleport-other"]!.fieldPatches;

/**
 * The three rows this section restores, spelled as (class name, the book this mod
 * targets by INDEX, and the level/mana/fail/exp it gives that class). The book index
 * is asserted against the book's own NAME below, so a core release that reorders a
 * class's books fails here instead of silently patching the wrong one.
 */
const ROWS = [
  { className: "Priest", bookIndex: 2, bookName: "[Healing and Sanctuary]", level: 20, mana: 10, fail: 30, exp: 15 },
  { className: "Paladin", bookIndex: 1, bookName: "[Healing and Sanctuary]", level: 22, mana: 10, fail: 30, exp: 15 },
  { className: "Ranger", bookIndex: 1, bookName: "[Nature Craft]", level: 23, mana: 10, fail: 30, exp: 20 },
] as const;

/** The Mage's own Teleport Other, so this mod's copies can be checked against it. */
function existingTeleportOther(className: string): SpellRecord {
  const cls = corePack().records.find((c) => c.name === className)!;
  for (const book of cls.book) {
    const found = book.spell.find((s) => s.name === "Teleport Other");
    if (found) return found;
  }
  throw new Error(`${className} has no Teleport Other to compare against`);
}

describe("teleport-other", () => {
  it("declares the section the contributions are filed under", () => {
    const ids = (manifest.sections ?? []).map((s: { id: string }) => s.id);
    expect(ids).toContain("teleport-other");
    expect(Object.keys(CONTRIB.sections)).toEqual(["teleport-other"]);
  });

  it("patches exactly the three classes it names, and no others", () => {
    expect(Object.keys(PATCHES).sort()).toEqual(["core:paladin", "core:priest", "core:ranger"]);
  });

  it("the Mage and the Rogue keep their own Teleport Other, untouched by this mod", () => {
    for (const className of ["Mage", "Rogue"]) {
      expect(() => existingTeleportOther(className)).not.toThrow();
    }
  });

  for (const row of ROWS) {
    const ref = `core:${recordKey("class", { name: row.className })}`;
    const label = row.className;

    it(`${label} - the ref this mod writes resolves to that class in core`, () => {
      const cls = corePack().records.find((c) => c.name === row.className)!;
      expect(cls).toBeDefined();
      expect(ref).toBe(`core:${recordKey("class", cls)}`);
      expect(Object.keys(PATCHES)).toContain(ref);
    });

    it(`${label} - core does not already teach this class Teleport Other`, () => {
      const cls = corePack().records.find((c) => c.name === row.className)!;
      const already = cls.book.some((b) => b.spell.some((s) => s.name === "Teleport Other"));
      expect(
        already,
        `${label} already has Teleport Other in a published core release - this ` +
          `restoration is stale and its section should be retired or re-targeted.`,
      ).toBe(false);
    });

    it(`${label} - targets the book this mod believes it does, by name`, () => {
      const cls = corePack().records.find((c) => c.name === row.className)!;
      const book = cls.book[row.bookIndex];
      expect(
        book?.name,
        `${label}'s book ${String(row.bookIndex)} is not "${row.bookName}" in core ` +
          `${CONTENT_VERSION} - the class's books were reordered upstream and this mod's ` +
          `path needs to move with them.`,
      ).toBe(row.bookName);
    });

    it(`${label} - appends after the book's existing spells without renumbering them`, () => {
      const cls = corePack().records.find((c) => c.name === row.className)!;
      const book = cls.book[row.bookIndex]!;
      const ops = PATCHES[ref]!;
      const spellOp = ops.find((o) => o.path === `book.${String(row.bookIndex)}.spell.${String(book.spell.length)}`);
      const countOp = ops.find((o) => o.path === `book.${String(row.bookIndex)}.spells`);
      expect(
        spellOp,
        `${label}'s book has ${String(book.spell.length)} spells in core ${CONTENT_VERSION}; this mod's ` +
          `spell.${String(book.spell.length)} op is missing, so a spell was added or removed upstream and ` +
          `this mod's append index is now stale (or wrong).`,
      ).toBeDefined();
      expect(countOp?.value).toBe(book.spell.length + 1);
    });

    it(`${label} - the restored spell matches the level/mana/fail/exp this mod declares`, () => {
      const ops = PATCHES[ref]!;
      const spellOp = ops.find((o) => o.path.includes(".spell."))!;
      const spell = spellOp.value as SpellRecord;
      expect(spell.name).toBe("Teleport Other");
      expect(spell.level).toBe(row.level);
      expect(spell.mana).toBe(row.mana);
      expect(spell.fail).toBe(row.fail);
      expect(spell.exp).toBe(row.exp);
    });

    it(`${label} - the restored spell's effect is identical to the Mage's own copy`, () => {
      const ops = PATCHES[ref]!;
      const spellOp = ops.find((o) => o.path.includes(".spell."))!;
      const spell = spellOp.value as SpellRecord;
      const mage = existingTeleportOther("Mage");
      expect(spell.effect).toEqual(mage.effect);
      expect(spell.desc).toEqual(mage.desc);
    });
  }
});

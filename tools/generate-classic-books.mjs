import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const content = dirname(require.resolve("@rpgm-tools/neo-angband-content/package.json"));
const { compileGamedata } = await import(pathToFileURL(join(content, "dist/records.js")).href);
const { classSpec } = await import(pathToFileURL(join(content, "dist/specs/init.js")).href);
const source = resolve(root, "../../../neo-angband/reference/lib/gamedata/old_class.txt");
const old = compileGamedata(readFileSync(source, "utf8"), classSpec).records;
const current = require("@rpgm-tools/neo-angband-content/pack/class.json").records;
const output = JSON.parse(readFileSync(join(root, "class.json"), "utf8"));

const casters = ["Mage", "Priest", "Rogue", "Ranger", "Paladin"];
const spells = (cls) => cls.book.flatMap((book) => book.spell);
const median = (values) => {
  if (!values.length) throw new Error("No matching spells for pricing");
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};
const band = (level) => level < 15 ? 0 : level < 30 ? 1 : 2;
const matches = (prior, now) => {
  const own = new Map(spells(now).map((spell) => [spell.name, spell]));
  return spells(prior).flatMap((spell) => {
    const match = own.get(spell.name);
    return match ? [{ old: spell, now: match }] : [];
  });
};
const modernByName = new Map(
  current.filter((cls) => casters.includes(cls.name)).flatMap((cls) =>
    spells(cls).map((spell) => [spell.name, spell])),
);
const price = (cls, now) => {
  const pairs = matches(cls, now);
  const shifts = pairs.map(({ old: before, now: after }) => after.level - before.level);
  const ratio = (items) => median(items.map(({ old: before, now: after }) => after.mana / Math.max(1, before.mana)));
  const failShift = (items) => median(items.map(({ old: before, now: after }) => after.fail - before.fail));
  const rows = [];
  const books = cls.book.map((book) => ({
    ...book,
    spells: book.spell.length,
    spell: book.spell.map((spell) => {
      const matched = modernByName.get(spell.name);
      const group = pairs.filter(({ old: before }) => band(before.level) === band(spell.level));
      const sample = group.length ? group : pairs;
      const level = Math.max(1, spell.level + median(shifts));
      const mana = matched?.mana ?? Math.max(1, Math.round(spell.mana * ratio(sample)));
      const fail = matched?.fail ?? Math.max(0, Math.min(95, spell.fail + failShift(sample)));
      rows.push({ book: book.name, spell: spell.name, level, mana, fail, exp: spell.exp });
      return { ...spell, level, mana, fail };
    }),
  }));
  return { books, rows };
};

const table = {};
const sections = {
  "classic-arcane-books": { fieldPatches: {} },
  "classic-prayer-books": { fieldPatches: {} },
  "classic-class-chassis": { fieldPatches: {} },
};
for (const name of casters) {
  const prior = old.find((cls) => cls.name === name);
  const now = current.find((cls) => cls.name === name);
  if (!prior || !now) throw new Error(`Missing class ${name}`);
  const { books, rows } = price(prior, now);
  const ref = `core:${name.toLowerCase()}`;
  const section = sections[name === "Priest" || name === "Paladin" ? "classic-prayer-books" : "classic-arcane-books"];
  const first = books[0].name;
  section.fieldPatches[ref] = [
    { op: "set", path: "magic", value: prior.magic },
    { op: "set", path: "book", value: books },
    { op: "set", path: "equip", value: now.equip.map((item) =>
      item.tval.endsWith(" book") ? { ...item, tval: prior.book[0].tval, sval: first } : item) },
  ];
  if (name === "Ranger") section.fieldPatches[ref].push({ op: "set", path: "stats", value: prior.stats });
  const chassis = ["skill-disarm-phys", "skill-disarm-magic", "skill-device", "skill-save",
    "skill-stealth", "skill-search", "skill-melee", "skill-shoot", "skill-throw", "skill-dig",
    "hitdie", "exp"];
  sections["classic-class-chassis"].fieldPatches[ref] = chassis.map((key) =>
    ({ op: "set", path: key, value: prior[key] }));
  table[name] = rows;
}

for (const [id, section] of Object.entries(sections)) output.sections[id] = section;
writeFileSync(join(root, "class.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(join(root, "tools/classic-book-prices.json"), `${JSON.stringify(table, null, 2)}\n`);

const art = JSON.parse(readFileSync(join(root, "tools/art.json"), "utf8"));
const report = JSON.parse(readFileSync(join(root, "tools/art-report.json"), "utf8"));
const books = art.filter((entry) => Object.values(table).some((rows) =>
  rows.some((row) => row.book === entry.name)));
if (books.length !== 18) throw new Error(`Expected 18 historical books, found ${books.length}`);
const itemArt = books.map((entry) => {
  const source = report[entry.slug];
  if (!source || Object.keys(source.packs).length !== 5) throw new Error(`Missing art for ${entry.name}`);
  const prayer = old.find((cls) => cls.name === "Priest").book.some((book) => book.name === entry.name);
  const historical = old.find((cls) => cls.name === (prayer ? "Priest" : "Mage")).book
    .find((book) => book.name === entry.name);
  if (!historical) throw new Error(`Missing historical book ${entry.name}`);
  return {
    kind: `core:${prayer ? "prayer-book" : "magic-book"}:${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    packs: {
      ...source.packs,
      ...(historical.quality === "dungeon" ? { shockbolt: source.packs.gervais } : {}),
    },
  };
});
const manifestPath = join(root, "manifest.json");
const manifest = readFileSync(manifestPath, "utf8");
const start = manifest.indexOf('  "restoredItemArt": [\n') + '  "restoredItemArt": [\n'.length;
const end = manifest.indexOf('    {\n      "kind": "feature-restoration:flask:iron-spike"', start);
if (start < 25 || end < start) throw new Error("Cannot locate restored item art in manifest");
const entries = itemArt.map((item) => JSON.stringify(item, null, 2).split("\n").map((line) => `    ${line}`).join("\n")).join(",\n");
writeFileSync(manifestPath, manifest.slice(0, start) + entries + ",\n" + manifest.slice(end));

const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const heading = "### Classic spellbook prices\n";
const following = "### Restore store discounts";
const begin = readme.indexOf(heading);
const finish = readme.indexOf(following);
if (finish < 0 || (begin >= 0 && begin > finish)) throw new Error("Cannot locate README price table");
const rows = Object.entries(table).flatMap(([name, entries]) => entries.map((row) =>
  `| ${name} | ${row.book} | ${row.spell} | ${row.level} | ${row.mana} | ${row.fail}% | ${row.exp} |`));
const section = `${heading}\nThe historical books replace the current class books when their birth-locked section is on. Every caster starts with the first town book. The optional class chassis changes experience penalties, skills and hit dice independently. Nine books take more pack space than the current set.\n\nThe historical class file supplies each spell's effects and experience. A same-named current spell supplies mana and failure chance. For other spells, the generator uses the median mana ratio and median failure change among that class's matched spells in the same level band (levels 1-14, 15-29 or 30 and above). If a band has no matches, it uses all matches for that class. It adjusts each historical level by that class's median matched level change, with a minimum of level 1. Run \`node tools/generate-classic-books.mjs\` to regenerate the class records and this table from the historical class file and the installed content pack.\n\n| Class | Book | Spell | Level | Mana | Fail | XP |\n|---|---|---|---:|---:|---:|---:|\n${rows.join("\n")}\n\n`;
writeFileSync(readmePath, readme.slice(0, begin >= 0 ? begin : finish) + section + readme.slice(finish));

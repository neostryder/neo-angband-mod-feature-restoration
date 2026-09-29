#!/usr/bin/env node
/**
 * Turn records cut from upstream Angband back into records this mod can ship.
 *
 *   node tools/convert-records.mjs           write the converted records
 *   node tools/convert-records.mjs --check   fail if any written file is stale
 *
 * WHAT IT READS. Every `tools/restore/*.json` list names a section, the gamedata
 * file its records go into, and the records themselves. A record is taken from one
 * of two places:
 *
 *   { "name": "jackal", "tag": "4.1.3" }       a record at an upstream release tag,
 *                                               read with `git show` from a local
 *                                               clone of angband/angband
 *   { "name": "...", "from": "mature blue dragon" }
 *                                               a record of the 4.2.6 content pack,
 *                                               used as the starting point for one
 *                                               that has no usable historical numbers
 *
 * and then shaped by the entry's own fields: `rename`, `patch` (fields merged over
 * the compiled record), `remove` (fields deleted) and `replace` (text substitutions
 * applied to the 4.2-format text before it is compiled).
 *
 * HOW. A 4.x record (4.0.0 onwards) is already in the `name:`/`type:` text format,
 * with a handful of directives renamed since. A 3.x record (`N:`/`G:`/`I:` ...) is
 * translated line by line. Either way the result is 4.2.6-format text, and it is
 * compiled by the content package's own compileGamedata with 4.2.6's own file spec.
 * A directive 4.2.6 does not have fails there, loudly, rather than turning into a
 * field the game silently ignores.
 *
 * WHERE THE CLONE IS. $ANGBAND_UPSTREAM, or ../_angband/angband-upstream beside this
 * repository. Only this tool needs it; the game never does.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileGamedata, gamedataSpecs } from "@rpgm-tools/neo-angband-content";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LISTS = join(ROOT, "tools", "restore");
const UPSTREAM = process.env.ANGBAND_UPSTREAM ?? join(ROOT, "..", "_angband", "angband-upstream");
const CHECK = process.argv.includes("--check");

const spec = (name) => {
  const s = gamedataSpecs.find((x) => x.name === name);
  if (!s) throw new Error(`no gamedata spec named ${name}`);
  return s;
};

const corePack = (name) =>
  require(`@rpgm-tools/neo-angband-content/pack/${name}.json`).records;

/* ---------------------------------------------------------------- upstream */

const shown = new Map();
function show(tag, path) {
  const key = `${tag}:${path}`;
  if (!shown.has(key)) {
    if (!existsSync(UPSTREAM)) throw new Error(`no upstream clone at ${UPSTREAM}; set ANGBAND_UPSTREAM`);
    shown.set(key, execFileSync("git", ["-C", UPSTREAM, "show", key], { encoding: "utf8", maxBuffer: 64 << 20 }));
  }
  return shown.get(key);
}

const isV3 = (tag) => tag.startsWith("v3") || tag.startsWith("3.");
const sourcePath = (tag, file) => (isV3(tag) ? `lib/edit/${file}.txt` : `lib/gamedata/${file}.txt`);

/** One record's lines from an upstream file, by name, comments dropped. */
function recordLines(tag, file, name, type) {
  const lines = show(tag, sourcePath(tag, file)).split(/\r?\n/);
  const start = isV3(tag) ? /^N:\d+:(.*)$/ : /^name:(?:\d+:)?(.*)$/;
  const blocks = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = start.exec(line);
    if (m) {
      current = m[1] === name ? [] : null;
      if (current) blocks.push(current);
    }
    if (current && line !== "" && !line.startsWith("#")) current.push(line);
  }
  /* Several tvals can share a name (a Trap Location rod and staff), so an entry
   * may name its type; 3.x records carry it as a number on the I: line. */
  const matches = type === undefined ? blocks : blocks.filter((b) => blockType(b, tag) === type);
  if (matches.length !== 1) throw new Error(`${tag} ${file}: ${matches.length} records named "${name}"${type ? ` of type ${type}` : ""}`);
  return matches[0];
}

function blockType(block, tag) {
  if (isV3(tag)) {
    const i = block.find((l) => l.startsWith("I:"));
    return i ? TVAL_3X[Number(i.split(":")[1])] : undefined;
  }
  return block.find((l) => l.startsWith("type:"))?.slice(5);
}

/* ---------------------------------------------------------------- 4.x text */

/**
 * 4.0 and 4.1 object records put level, weight and cost on one `properties:` line
 * and armour and attack on one `combat:` line; 4.2 split both. Names lost their
 * numeric index at 4.1.
 */
function from4x(lines, file) {
  const out = [];
  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    if (key === "name") {
      out.push(`name:${line.replace(/^name:(?:\d+:)?/, "")}`);
    } else if (file === "object" && key === "properties") {
      const [level, weight, cost] = rest;
      out.push(`level:${level}`, `weight:${weight}`, `cost:${cost}`);
    } else if (file === "object" && key === "combat") {
      const [ac, dice, toh, tod, toa] = rest;
      out.push(`attack:${dice}:${toh}:${tod}`, `armor:${ac}:${toa}`);
    } else {
      out.push(line);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- 3.x text */

/** 3.x numeric tvals (defines.h / tvalsval.h) to 4.2 tval names. */
const TVAL_3X = {
  5: "flask", 7: "chest", 16: "shot", 17: "arrow", 18: "bolt", 19: "bow", 20: "digger",
  21: "hafted", 22: "polearm", 23: "sword", 30: "boots", 31: "gloves", 32: "helm",
  33: "crown", 34: "shield", 35: "cloak", 36: "soft armor", 37: "hard armor",
  38: "dragon armor", 39: "light", 40: "amulet", 45: "ring", 55: "staff", 65: "wand",
  66: "rod", 70: "scroll", 75: "potion", 77: "flask", 80: "food", 90: "magic book",
  91: "prayer book",
};

/** Object flags a 3.x pval applied to, which 4.2 writes as `values:NAME[n]`. */
const PVAL_FLAGS = new Set([
  "STR", "INT", "WIS", "DEX", "CON", "STEALTH", "SEARCH", "INFRA", "TUNNEL",
  "SPEED", "BLOWS", "SHOTS", "MIGHT", "LIGHT",
]);

/** 3.x object flags with no 4.2 meaning: display hints and the old curse flags. */
const DROP_OBJECT_FLAGS = new Set([
  "SHOW_MODS", "SHOW_DICE", "HIDE_TYPE", "EASY_KNOW", "CHR",
  "LIGHT_CURSE", "HEAVY_CURSE", "PERMA_CURSE",
]);

/** 4.2 tvals whose records carry attack and armor lines. */
const COMBAT_TVALS = new Set([
  "shot", "arrow", "bolt", "bow", "digger", "hafted", "polearm", "sword", "boots",
  "gloves", "helm", "crown", "shield", "cloak", "soft armor", "hard armor",
  "dragon armor", "light", "wand", "rod", "staff",
]);

function objectFrom3x(lines) {
  const out = [];
  let tval = "";
  let pval = 0;
  const flags = [];
  const values = [];
  const desc = [];
  let level = 0;
  for (const line of lines) {
    const [key, ...f] = line.split(":");
    switch (key) {
      case "N":
        out.push(`name:${f.slice(1).join(":")}`);
        break;
      case "G":
        out.push(`graphics:${f[0]}:${f[1]}`);
        break;
      case "I":
        tval = TVAL_3X[Number(f[0])];
        if (!tval) throw new Error(`3.x tval ${f[0]} has no 4.2 equivalent`);
        out.push(`type:${tval}`);
        pval = Number(f[2] ?? 0);
        break;
      case "W":
        level = Number(f[0]);
        out.push(`level:${f[0]}`, `weight:${f[2]}`, `cost:${f[3]}`);
        break;
      case "A": {
        if (f[1] !== undefined && / to /.test(f[1])) {
          out.push(`alloc:${f[0]}:${f[1]}`);
        } else {
          /* 3.0's "depth/rarity" pairs. 3.1 folded them into one range; the first
           * depth becomes the minimum and the rarity scales 4.2's usual 20. */
          const [depth, rarity] = f[0].split("/").map(Number);
          out.push(`alloc:${Math.max(1, Math.round(20 / rarity))}:${depth} to 100`);
        }
        break;
      }
      case "P":
        if (COMBAT_TVALS.has(tval)) out.push(`attack:${f[1]}:${f[2]}:${f[3]}`, `armor:${f[0]}:${f[4]}`);
        break;
      case "C":
        out.push(`charges:${f[0]}`);
        break;
      case "M":
        out.push(`pile:${f[0]}:${f[1]}`);
        break;
      case "F":
        for (const flag of f.join(":").split("|").map((s) => s.trim()).filter(Boolean)) {
          if (PVAL_FLAGS.has(flag)) values.push(`${flag}[${pval}]`);
          else if (!DROP_OBJECT_FLAGS.has(flag)) flags.push(flag);
        }
        break;
      case "D":
        desc.push(f.join(":"));
        break;
      default:
        /* E: effects are rebuilt by hand in the restore list: 3.x effects were
         * hard-coded by sval and share few names with 4.2's effect table. */
        break;
    }
  }
  if (!out.some((l) => l.startsWith("alloc:"))) void level;
  if (flags.length) out.push(`flags:${flags.join(" | ")}`);
  if (values.length) out.push(`values:${values.join(" | ")}`);
  for (const d of desc) out.push(`desc:${d}`);
  return out;
}

/** 3.x glyphs to the 4.2 monster base that draws them. */
const BASE_BY_GLYPH = { p: "person", h: "humanoid", A: "ainu", d: "dragon", D: "ancient dragon", F: "dragon fly" };

/** 3.x monster flags 4.2 dropped or moved elsewhere. */
const DROP_MONSTER_FLAGS = new Set(["FORCE_MAXHP", "FORCE_SLEEP", "FRIENDS", "ESCORT", "ESCORTS", "CHAR_MULTI", "RES_TELE"]);
const MONSTER_FLAG_RENAMES = { RES_PLAS: "IM_PLASMA", RES_CONFU: "NO_CONF" };
const SPELL_RENAMES = { CAUSE_1: "WOUND", CAUSE_2: "WOUND", CAUSE_3: "WOUND", CAUSE_4: "WOUND", ARROW_1: "ARROW", ARROW_2: "ARROW", ARROW_3: "BOLT", ARROW_4: "BOLT", BO_ICEE: "BO_ICE", S_ANGEL: "S_AINU" };
const INNATE = /^(BR_|BOULDER|SHRIEK|ARROW|BOLT|SHOT|SPIT)/;
const BLOW_EFFECT_RENAMES = { UN_BONUS: "DISENCHANT", UN_POWER: "DRAIN_CHARGES" };

function monsterFrom3x(lines) {
  const out = [];
  const flags = [];
  const spells = [];
  const desc = [];
  let freq = 0;
  let glyph = "";
  let base = "";
  for (const line of lines) {
    const [key, ...f] = line.split(":");
    switch (key) {
      case "N":
        out.push(`name:${f.slice(1).join(":")}`);
        break;
      case "T":
        base = f[0];
        break;
      case "G":
        glyph = f[0];
        if (f[1]) out.push(`color:${f[1]}`);
        break;
      case "C":
        out.push(`color:${f[0]}`);
        break;
      case "I": {
        const [speed, hp, vision, ac, alertness] = f;
        out.push(`speed:${speed}`, `hit-points:${/d/.test(hp) ? hp.split("d").reduce((a, b) => Number(a) * (Number(b) + 1) / 2) : hp}`);
        out.push(`hearing:${vision}`, `armor-class:${ac}`, `sleepiness:${alertness}`);
        break;
      }
      case "W":
        out.push(`depth:${f[0]}`, `rarity:${f[1]}`, `experience:${f[3]}`);
        break;
      case "B": {
        const effect = BLOW_EFFECT_RENAMES[f[1]] ?? f[1];
        out.push(["blow", f[0], effect, f[2]].filter((x) => x !== undefined && x !== "").join(":"));
        break;
      }
      case "F":
        for (const flag of f.join(":").split("|").map((s) => s.trim()).filter(Boolean)) {
          if (DROP_MONSTER_FLAGS.has(flag)) continue;
          if (flag === "HAS_LIGHT") out.push("light:1");
          else flags.push(MONSTER_FLAG_RENAMES[flag] ?? flag);
        }
        break;
      case "S":
        for (const s of f.join(":").split("|").map((x) => x.trim()).filter(Boolean)) {
          const m = /^1_IN_(\d+)$/.exec(s);
          if (m) freq = Number(m[1]);
          else spells.push(SPELL_RENAMES[s] ?? s);
        }
        break;
      case "D":
        desc.push(f.join(":"));
        break;
      case "friends":
        out.push(line);
        break;
      default:
        break;
    }
  }
  out.splice(1, 0, `base:${base || BASE_BY_GLYPH[glyph] || "person"}`);
  if (glyph && !base) out.splice(2, 0, `glyph:${glyph}`);
  if (flags.length) out.push(`flags:${flags.join(" | ")}`);
  if (spells.length) {
    const innate = spells.filter((s) => INNATE.test(s));
    if (innate.length) out.push(`innate-freq:${freq}`);
    if (innate.length < spells.length) out.push(`spell-freq:${freq}`);
    out.push(`spells:${[...new Set(spells)].join(" | ")}`);
  }
  for (const d of desc) out.push(`desc:${d}`);
  return out;
}

/* ---------------------------------------------------------------- one entry */

function convert(file, entry) {
  let record;
  if (entry.from !== undefined) {
    const found = corePack(file).filter((r) => r.name === entry.from);
    if (found.length !== 1) throw new Error(`core ${file}: ${found.length} records named "${entry.from}"`);
    record = structuredClone(found[0]);
    record.name = entry.name;
  } else {
    const lines = recordLines(entry.tag, file, entry.name, entry.type);
    let text;
    if (!isV3(entry.tag)) text = from4x(lines, file);
    else if (file === "object") text = objectFrom3x(lines);
    else if (file === "monster") text = monsterFrom3x(lines);
    else throw new Error(`no 3.x translation for ${file}`);
    text = text.join("\n");
    for (const [from, to] of entry.replace ?? []) {
      if (!text.includes(from)) throw new Error(`${entry.name}: replace target not found: ${from}`);
      text = text.split(from).join(to);
    }
    for (const [from, to] of Object.entries(SPELL_RENAMES)) text = text.replace(new RegExp(`\\b${from}\\b`, "g"), to);
    const compiled = compileGamedata(`${text}\n`, spec(file)).records;
    if (compiled.length !== 1) throw new Error(`${entry.name}: compiled to ${compiled.length} records`);
    record = compiled[0];
    /* A spell list may now name one spell twice (CAUSE_2 and CAUSE_3 both became WOUND). */
    if (Array.isArray(record.spells)) record.spells = [...new Set(record.spells.flatMap((s) => s.split(" | ")))];
  }
  if (entry.rename !== undefined) record.name = entry.rename;
  for (const key of entry.remove ?? []) delete record[key];
  Object.assign(record, entry.patch ?? {});
  /* `alloc_common` keeps a record's historical depth range and only changes how
   * often it appears. */
  if (entry.alloc_common !== undefined) record.alloc = { ...record.alloc, common: entry.alloc_common };
  return record;
}

/* ---------------------------------------------------------------- main */

const outputs = new Map(); // file -> Map(section -> records[])
for (const f of readdirSync(LISTS).filter((f) => f.endsWith(".json")).sort()) {
  const list = JSON.parse(readFileSync(join(LISTS, f), "utf8"));
  if (!outputs.has(list.file)) outputs.set(list.file, new Map());
  const bySection = outputs.get(list.file);
  const records = bySection.get(list.section) ?? [];
  for (const entry of list.records) {
    try {
      records.push(convert(list.file, entry));
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }
  bySection.set(list.section, records);
}

let stale = 0;
for (const [file, bySection] of outputs) {
  const path = join(ROOT, `${file}.json`);
  const current = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { sections: {} };
  const next = structuredClone(current);
  next.sections ??= {};
  for (const [section, records] of bySection) {
    next.sections[section] = { ...(next.sections[section] ?? {}), records };
  }
  const text = `${JSON.stringify(next, null, 2)}\n`;
  const old = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (text === old) continue;
  if (CHECK) {
    console.error(`${file}.json is stale; run node tools/convert-records.mjs`);
    stale++;
  } else {
    writeFileSync(path, text);
    console.log(`${file}.json: ${[...bySection].map(([s, r]) => `${s} ${r.length}`).join(", ")}`);
  }
}
if (stale) process.exit(1);

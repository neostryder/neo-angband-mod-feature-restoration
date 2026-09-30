/**
 * Population and balance harness for this mod's sections.
 *
 * Adding monsters changes the mix a level draws from, and adding items changes
 * the drop tables. This tool turns "does this section unbalance the game" into
 * numbers. It generates a fixed set of levels for each depth band, once with
 * every section off and once with a single section on, counts the monster races
 * and object kinds that came out, and writes tools/population-report.md.
 *
 * The level set is every depth in a band at a fixed number of seeds per depth,
 * so the same command reproduces the same report. A generated record is
 * attributed to a section by its bound index: composition appends a section's
 * records after core's, so a race or kind in that appended range came from the
 * section that is on, and artifact dummy kinds sit above it.
 *
 * Run with `pnpm population`. The fast test in population.test.ts exercises a
 * handful of levels; this file's default run is the full report.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  bootLevel,
  tvalIsWearable,
  OF,
  type CorePack,
  type CoreRegistries,
  type Curse,
  type GameObject,
  type MonsterRace,
} from "@rpgm-tools/neo-angband-core";
import { bind, compose, ROOT, sectionIds } from "../test/game.js";

/** One depth band the harness samples. */
export interface Band {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

/** The bands the assignment names, each covering every depth in its range. */
export const BANDS: readonly Band[] = [
  { label: "1-5", min: 1, max: 5 },
  { label: "6-10", min: 6, max: 10 },
  { label: "11-20", min: 11, max: 20 },
  { label: "21-30", min: 21, max: 30 },
  { label: "31-40", min: 31, max: 40 },
  { label: "41-60", min: 41, max: 60 },
  { label: "61-100", min: 61, max: 100 },
];

/** Levels per band = depths in the band times this. Fixed, so the report repeats. */
export const DEFAULT_SEEDS_PER_DEPTH = 5;

/** bootLevel reads the pack only when no registries are supplied; this one is unused. */
const EMPTY_PACK = {} as CorePack;

/** A fixed seed per depth and sample index, so every run generates the same levels. */
export function seedFor(depth: number, k: number): number {
  return depth * 101 + k * 7919 + 1;
}

/** Per-band tallies, keyed by bound record index so duplicate names cannot merge. */
export interface BandCounts {
  monsterTotal: number;
  objectTotal: number;
  monsterByRidx: Map<number, number>;
  objectByKidx: Map<number, number>;
  wearableTotal: number;
  wearableSticky: number;
}

function emptyBandCounts(): BandCounts {
  return {
    monsterTotal: 0,
    objectTotal: 0,
    monsterByRidx: new Map(),
    objectByKidx: new Map(),
    wearableTotal: 0,
    wearableSticky: 0,
  };
}

function bump(map: Map<number, number>, key: number): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Whether the object carries at least one curse whose template grants STICKY. */
export function hasStickyCurse(obj: GameObject, curses: readonly (Curse | null)[]): boolean {
  if (!obj.curses) return false;
  for (let i = 1; i < curses.length; i++) {
    if ((obj.curses[i]?.power ?? 0) > 0 && curses[i]?.obj.flags.has(OF.STICKY)) return true;
  }
  return false;
}

/** Generate every level in a band and tally the races and kinds that came out. */
export function countBand(game: CoreRegistries, band: Band, seedsPerDepth: number): BandCounts {
  const counts = emptyBandCounts();
  for (let depth = band.min; depth <= band.max; depth++) {
    for (let k = 0; k < seedsPerDepth; k++) {
      const level = bootLevel(EMPTY_PACK, { seed: seedFor(depth, k), depth, registries: game });
      for (const placed of level.monsters) {
        counts.monsterTotal++;
        bump(counts.monsterByRidx, placed.mon.race.ridx);
      }
      for (const placed of level.objects) {
        const obj = placed.obj;
        counts.objectTotal++;
        bump(counts.objectByKidx, obj.kind.kidx);
        if (tvalIsWearable(obj.tval)) {
          counts.wearableTotal++;
          if (hasStickyCurse(obj, game.objects.curses)) counts.wearableSticky++;
        }
      }
    }
  }
  return counts;
}

/** The monster and object records a section appends, by name. */
export interface SectionRecords {
  monsters: string[];
  objects: string[];
}

function recordName(r: unknown): string {
  if (typeof r === "object" && r !== null && "name" in r) {
    const name = (r as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "";
}

function appendedNames(coreLength: number, records: unknown[], file: string): string[] {
  if (records.length < coreLength) throw new Error(`${file} lost records when a section was enabled`);
  return records.slice(coreLength).map(recordName);
}

/** Read the records a section adds by diffing its composition against core alone. */
export function sectionRecords(section: string): SectionRecords {
  const off = compose([]);
  const on = compose([section]);
  const offMon = (off.records["monster"] ?? []).length;
  const offObj = (off.records["object"] ?? []).length;
  return {
    monsters: appendedNames(offMon, on.records["monster"] ?? [], "monster"),
    objects: appendedNames(offObj, on.records["object"] ?? [], "object"),
  };
}

/** One section's run: its bound registries and its tallies per band. */
export interface SectionRun {
  id: string;
  game: CoreRegistries;
  bands: Map<string, BandCounts>;
}

export interface HarnessResult {
  bands: readonly Band[];
  seedsPerDepth: number;
  coreMonsterCount: number;
  coreObjectCount: number;
  baseline: CoreRegistries;
  baselineBands: Map<string, BandCounts>;
  sections: SectionRun[];
}

/** Generate the baseline and every one-section-on run. */
export function runHarness(seedsPerDepth: number = DEFAULT_SEEDS_PER_DEPTH): HarnessResult {
  const base = bind([]);
  const baselineBands = new Map<string, BandCounts>();
  for (const band of BANDS) baselineBands.set(band.label, countBand(base.game, band, seedsPerDepth));

  const sections: SectionRun[] = [];
  for (const id of sectionIds()) {
    const { game } = bind([id]);
    const bands = new Map<string, BandCounts>();
    for (const band of BANDS) bands.set(band.label, countBand(game, band, seedsPerDepth));
    sections.push({ id, game, bands });
  }

  return {
    bands: BANDS,
    seedsPerDepth,
    coreMonsterCount: base.game.monsters.races.length,
    coreObjectCount: base.game.objects.ordinaryKindCount,
    baseline: base.game,
    baselineBands,
    sections,
  };
}

/** Sum per-band tallies into one tally, for shares that pool every band. */
function pool(bands: Map<string, BandCounts>): BandCounts {
  const out = emptyBandCounts();
  for (const c of bands.values()) {
    out.monsterTotal += c.monsterTotal;
    out.objectTotal += c.objectTotal;
    out.wearableTotal += c.wearableTotal;
    out.wearableSticky += c.wearableSticky;
    for (const [k, v] of c.monsterByRidx) out.monsterByRidx.set(k, (out.monsterByRidx.get(k) ?? 0) + v);
    for (const [k, v] of c.objectByKidx) out.objectByKidx.set(k, (out.objectByKidx.get(k) ?? 0) + v);
  }
  return out;
}

function pct(part: number, total: number, digits = 2): string {
  if (total === 0) return "-";
  return `${((100 * part) / total).toFixed(digits)}%`;
}

function raceName(game: CoreRegistries, ridx: number): string {
  return game.monsters.races[ridx]?.name ?? `race #${ridx}`;
}

function kindName(game: CoreRegistries, kidx: number): string {
  return game.objects.kinds[kidx]?.name ?? `kind #${kidx}`;
}

interface DropRow {
  name: string;
  base: number;
  on: number;
  drop: number;
}

function shareDrops(
  baseline: BandCounts,
  on: BandCounts,
  file: "monster" | "object",
  coreCount: number,
  nameOf: (index: number) => string,
): DropRow[] {
  const baseMap = file === "monster" ? baseline.monsterByRidx : baseline.objectByKidx;
  const onMap = file === "monster" ? on.monsterByRidx : on.objectByKidx;
  const baseTotal = file === "monster" ? baseline.monsterTotal : baseline.objectTotal;
  const onTotal = file === "monster" ? on.monsterTotal : on.objectTotal;
  const rows: DropRow[] = [];
  for (let index = 0; index < coreCount; index++) {
    const name = nameOf(index);
    /* <player>, <pile> and the other placeholder records are not real races or kinds. */
    if (name.startsWith("<")) continue;
    const b = baseTotal === 0 ? 0 : (baseMap.get(index) ?? 0) / baseTotal;
    const o = onTotal === 0 ? 0 : (onMap.get(index) ?? 0) / onTotal;
    if (b - o <= 0) continue;
    rows.push({ name, base: b, on: o, drop: b - o });
  }
  rows.sort((a, b) => b.drop - a.drop);
  return rows.slice(0, 4);
}

interface TwinPair {
  restored: string;
  replacement: string;
}

function twinPairs(): TwinPair[] {
  const path = join(ROOT, "tools", "restore", "monsters-4-1.json");
  const list = JSON.parse(readFileSync(path, "utf8")) as { records: Array<{ name: string; twin?: string }> };
  return list.records
    .filter((r): r is { name: string; twin: string } => typeof r.twin === "string")
    .map((r) => ({ restored: r.name, replacement: r.twin }));
}

function ridxOf(game: CoreRegistries, name: string): number {
  return game.monsters.races.find((r) => r.name === name)?.ridx ?? -1;
}

/** Render the full markdown report from a harness run. */
export function renderReport(result: HarnessResult): string {
  const lines: string[] = [];
  const bands = result.bands;
  const levelsPerBand = bands.map((b) => b.max - b.min + 1).reduce((a, b) => a + b, 0) * result.seedsPerDepth;
  const pooledBaseline = pool(result.baselineBands);

  lines.push("# Population and balance report");
  lines.push("");
  lines.push("Generated by `pnpm population` (`tools/population.ts`).");
  lines.push("");
  lines.push("## Method");
  lines.push("");
  lines.push(`- Bands: ${bands.map((b) => b.label).join(", ")}.`);
  lines.push(
    `- Levels: every depth in each band, ${result.seedsPerDepth} fixed seeds per depth (${levelsPerBand} levels in total per run).`,
  );
  lines.push(`- Baseline: every section off. Then one section on at a time, ${result.sections.length} sections.`);
  lines.push(
    "- A generated monster or object is counted by its race or kind. A record comes from a section when its bound index is at or above the core record count and below that section's own record count: composition appends a section's records after core's, and artifact dummy kinds sit above them.",
  );
  lines.push(
    "- A share is the section's records divided by all records generated in that band while the section is on. A drop is a core record's baseline share minus its share with the section on.",
  );
  lines.push("");

  lines.push("## Generated per band");
  lines.push("");
  lines.push("| band | levels | monsters | objects | wearable |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const band of bands) {
    const c = result.baselineBands.get(band.label);
    const levels = (band.max - band.min + 1) * result.seedsPerDepth;
    lines.push(
      `| ${band.label} | ${levels} | ${c?.monsterTotal ?? 0} | ${c?.objectTotal ?? 0} | ${c?.wearableTotal ?? 0} |`,
    );
  }
  lines.push("");

  const table = (file: "monster" | "object"): void => {
    const label = file === "monster" ? "monsters" : "objects";
    lines.push(`## Share of generated ${label} that come from each section`);
    lines.push("");
    lines.push(`| section | ${bands.map((b) => b.label).join(" | ")} |`);
    lines.push(`| --- | ${bands.map(() => "---").join(" | ")} |`);
    for (const section of result.sections) {
      const cells = bands.map((band) => {
        const c = section.bands.get(band.label);
        if (!c) return "-";
        const total = file === "monster" ? c.monsterTotal : c.objectTotal;
        const core = file === "monster" ? result.coreMonsterCount : result.coreObjectCount;
        const top = file === "monster" ? section.game.monsters.races.length : section.game.objects.ordinaryKindCount;
        let fromSection = 0;
        const map = file === "monster" ? c.monsterByRidx : c.objectByKidx;
        for (const [index, n] of map) if (index >= core && index < top) fromSection += n;
        return pct(fromSection, total);
      });
      lines.push(`| ${section.id} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  };
  table("monster");
  table("object");

  lines.push("## Largest share drops among 4.2 records");
  lines.push("");
  lines.push("Pooled over every band. Rows are the four core records whose share fell the most.");
  lines.push("");
  lines.push(
    "A section that adds no monster records can still move the monster mix, because monsters and objects draw from one RNG stream and a new object kind shifts it. The large drops track the section's own records; the small ones are that stream shift.",
  );
  lines.push("");
  for (const file of ["monster", "object"] as const) {
    lines.push(`### ${file === "monster" ? "Monster races" : "Object kinds"}`);
    lines.push("");
    lines.push("| section | record | baseline | section on | drop |");
    lines.push("| --- | --- | --- | --- | --- |");
    const core = file === "monster" ? result.coreMonsterCount : result.coreObjectCount;
    const nameOf = (index: number): string =>
      file === "monster" ? raceName(result.baseline, index) : kindName(result.baseline, index);
    for (const section of result.sections) {
      const rows = shareDrops(pooledBaseline, pool(section.bands), file, core, nameOf);
      if (rows.length === 0) {
        lines.push(`| ${section.id} | (none) | - | - | - |`);
        continue;
      }
      for (const row of rows) {
        lines.push(
          `| ${section.id} | ${row.name} | ${pct(row.base, 1, 3)} | ${pct(row.on, 1, 3)} | ${pct(row.drop, 1, 3)} |`,
        );
      }
    }
    lines.push("");
  }

  lines.push("## Sticky curses (sticky-curses)");
  lines.push("");
  lines.push("Share of generated wearable items per band that carry at least one sticky curse.");
  lines.push("");
  const sticky = result.sections.find((s) => s.id === "sticky-curses");
  lines.push("| band | wearable items | sticky-cursed | share |");
  lines.push("| --- | --- | --- | --- |");
  for (const band of bands) {
    const c = sticky?.bands.get(band.label);
    lines.push(
      `| ${band.label} | ${c?.wearableTotal ?? 0} | ${c?.wearableSticky ?? 0} | ${pct(c?.wearableSticky ?? 0, c?.wearableTotal ?? 0, 3)} |`,
    );
  }
  lines.push("");

  lines.push("## monsters-4-1 restored/replacement pairs");
  lines.push("");
  lines.push(
    "Each row pools every band. `replacement off` is the 4.2 monster's count with the section off; `replacement on` and `restored on` are the counts with it on. An exact pair has the same depth, speed, hit points and effective rarity.",
  );
  lines.push("");
  const fourOne = result.sections.find((s) => s.id === "monsters-4-1");
  const pooledFourOne = fourOne ? pool(fourOne.bands) : emptyBandCounts();
  const pairs = twinPairs();
  const exactRatios: number[] = [];
  const cleanRatios: number[] = [];
  const outliers: string[] = [];
  const namedFriends: string[] = [];
  const allRaces = fourOne?.game.monsters.races ?? result.baseline.monsters.races;
  const isNamedFriend = (race: MonsterRace): boolean =>
    allRaces.some((r) => r.friends.some((f) => f.race === race));
  lines.push("| restored | 4.2 replacement | exact | replacement off | replacement on | restored on | replacement/off | restored/off |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const pair of pairs) {
    const baseIdx = ridxOf(result.baseline, pair.replacement);
    const onIdx = ridxOf(fourOne?.game ?? result.baseline, pair.replacement);
    const restoredIdx = ridxOf(fourOne?.game ?? result.baseline, pair.restored);
    const replOff = baseIdx < 0 ? 0 : (pooledBaseline.monsterByRidx.get(baseIdx) ?? 0);
    const replOn = onIdx < 0 ? 0 : (pooledFourOne.monsterByRidx.get(onIdx) ?? 0);
    const restoredOn = restoredIdx < 0 ? 0 : (pooledFourOne.monsterByRidx.get(restoredIdx) ?? 0);
    const replRace = fourOne?.game.monsters.races[onIdx];
    const restoredRace = fourOne?.game.monsters.races[restoredIdx];
    const exact =
      replRace !== undefined &&
      restoredRace !== undefined &&
      replRace.level === restoredRace.level &&
      replRace.speed === restoredRace.speed &&
      replRace.avgHp === restoredRace.avgHp &&
      replRace.rarity === restoredRace.rarity;
    const replRatio = replOff === 0 ? undefined : replOn / replOff;
    const restoredRatio = replOff === 0 ? undefined : restoredOn / replOff;
    if (exact) {
      if (replRatio !== undefined) exactRatios.push(replRatio);
      if (restoredRatio !== undefined) exactRatios.push(restoredRatio);
      const grouped = replRace !== undefined && isNamedFriend(replRace);
      if (grouped) {
        namedFriends.push(pair.replacement);
      } else {
        if (replRatio !== undefined) cleanRatios.push(replRatio);
        if (restoredRatio !== undefined) cleanRatios.push(restoredRatio);
      }
      const far = (x: number | undefined): boolean => x !== undefined && (x < 0.3 || x > 0.7);
      if (far(replRatio) || far(restoredRatio)) {
        outliers.push(
          `${pair.restored} vs ${pair.replacement} (replacement/off ${replRatio?.toFixed(3) ?? "-"}, restored/off ${restoredRatio?.toFixed(3) ?? "-"})`,
        );
      }
    }
    lines.push(
      `| ${pair.restored} | ${pair.replacement} | ${exact ? "yes" : "no"} | ${replOff} | ${replOn} | ${restoredOn} | ${replRatio === undefined ? "-" : replRatio.toFixed(3)} | ${restoredRatio === undefined ? "-" : restoredRatio.toFixed(3)} |`,
    );
  }
  lines.push("");
  if (exactRatios.length > 0) {
    const mean = exactRatios.reduce((a, b) => a + b, 0) / exactRatios.length;
    lines.push(
      `Exact pairs: ${exactRatios.length / 2} pairs, mean ratio ${mean.toFixed(3)} (each member should be near 0.5).`,
    );
  }
  if (cleanRatios.length > 0) {
    const mean = cleanRatios.reduce((a, b) => a + b, 0) / cleanRatios.length;
    lines.push(
      `Exact pairs whose replacement is not a named friend: ${cleanRatios.length / 2} pairs, mean ratio ${mean.toFixed(3)}.`,
    );
  }
  if (outliers.length > 0) {
    lines.push("");
    lines.push("Pairs whose ratios are far from 0.5:");
    for (const o of outliers) lines.push(`- ${o}`);
  }
  if (namedFriends.length > 0) {
    lines.push("");
    lines.push(
      `Replacements another monster names as a friend, so group placement inflates them beyond their allocation weight: ${namedFriends.join(", ")}.`,
    );
  }
  lines.push("");

  lines.push("## Out of line");
  lines.push("");
  const flagged: string[] = [];
  for (const section of result.sections) {
    const monsterTop = section.game.monsters.races.length;
    const objectTop = section.game.objects.ordinaryKindCount;
    for (const band of bands) {
      const c = section.bands.get(band.label);
      if (!c) continue;
      const core = result.coreMonsterCount;
      let monFrom = 0;
      for (const [index, n] of c.monsterByRidx) if (index >= core && index < monsterTop) monFrom += n;
      const monShare = c.monsterTotal === 0 ? 0 : monFrom / c.monsterTotal;
      let objFrom = 0;
      for (const [index, n] of c.objectByKidx)
        if (index >= result.coreObjectCount && index < objectTop) objFrom += n;
      const objShare = c.objectTotal === 0 ? 0 : objFrom / c.objectTotal;
      if (monShare > 1 / 3) flagged.push(`${section.id} supplies ${pct(monFrom, c.monsterTotal)} of band ${band.label} monsters`);
      if (objShare > 1 / 3) flagged.push(`${section.id} supplies ${pct(objFrom, c.objectTotal)} of band ${band.label} objects`);
    }
  }
  if (flagged.length === 0) {
    lines.push("No section supplies more than a third of a band's monsters or objects.");
  } else {
    for (const f of flagged) lines.push(`- ${f}`);
  }
  lines.push("");

  return lines.join("\n");
}

/** Write tools/population-report.md. */
export function main(): void {
  const result = runHarness();
  const report = renderReport(result);
  writeFileSync(join(ROOT, "tools", "population-report.md"), report, { encoding: "utf8" });
  process.stdout.write(`population-report.md written (${result.sections.length} sections)\n`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();

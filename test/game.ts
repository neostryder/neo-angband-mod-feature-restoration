/**
 * Core plus this mod, composed and bound the way the game does it.
 *
 * A test that only reads this mod's JSON can check a record's numbers, but not
 * whether the game accepts it. This helper runs the real pipeline instead: the
 * published content pack and this repository's files go through the mod SDK's
 * composeContentPacks with a chosen set of sections switched on, and the result
 * goes through core's bindCore. A record with an unknown flag, a monster naming
 * a base that does not exist, or a patch on a ref that is not there fails here
 * with the game's own error.
 *
 * The GamePack mapping mirrors packages/web/src/pack.ts loadGamePack in the
 * game's repository, since that is the loader a player runs.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindCore, bindPlayer, registerBookKinds, type CoreRegistries, type GamePack, type PlayerPackRecords } from "@rpgm-tools/neo-angband-core";
import { composeContentPacks, type ComposedContent } from "@rpgm-tools/neo-angband-mod-sdk";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORE_DIR = dirname(require.resolve("@rpgm-tools/neo-angband-content/pack/manifest.json"));

type Json = Record<string, unknown>;
interface Loaded {
  manifest: Json & { id: string };
  files: Record<string, Json>;
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json;
}

let corePack: Loaded | null = null;
function core(): Loaded {
  if (corePack) return corePack;
  const manifest = readJson(join(CORE_DIR, "manifest.json")) as Loaded["manifest"];
  const files: Record<string, Json> = {};
  for (const f of manifest["files"] as string[]) files[f.replace(/\.json$/, "")] = readJson(join(CORE_DIR, f));
  corePack = { manifest, files };
  return corePack;
}

/** Every gamedata file this repository ships, by the names core's pack uses. */
export function modFiles(): Record<string, Json> {
  /* message_type and tval are files core itself does not ship but a pack may. */
  const names = new Set([...Object.keys(core().files), "message_type", "tval"]);
  const files: Record<string, Json> = {};
  for (const f of readdirSync(ROOT)) {
    const stem = f.replace(/\.json$/, "");
    if (f.endsWith(".json") && names.has(stem)) files[stem] = readJson(join(ROOT, f));
  }
  return files;
}

export function modManifest(): Loaded["manifest"] {
  return readJson(join(ROOT, "manifest.json")) as Loaded["manifest"];
}

/** Every section and rule id this mod declares. */
export function sectionIds(): string[] {
  const m = modManifest() as { sections?: { id: string }[] };
  return (m.sections ?? []).map((s) => s.id);
}

/**
 * Compose core and this mod with exactly the named sections on. Every other
 * section is off, so a test sees one restoration at a time unless it asks for
 * several.
 */
export function compose(on: readonly string[]): ComposedContent {
  const mod: Loaded = { manifest: modManifest(), files: modFiles() };
  const state: Record<string, boolean> = {};
  for (const id of sectionIds()) state[id] = on.includes(id);
  const unknown = on.filter((id) => !(id in state));
  if (unknown.length > 0) throw new Error(`no such section: ${unknown.join(", ")}`);
  // The loader's own types are wider than the plain JSON read here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packs = [core(), mod] as any;
  const out = composeContentPacks(packs, { sections: { [mod.manifest.id]: state } });
  if (out.problems.length > 0) throw new Error(`composition refused:\n${out.problems.join("\n")}`);
  return out;
}

/** Compose, then bind through core. Throws with the game's error if a record is bad. */
export function gamePack(on: readonly string[]) {
  const composed = compose(on);
  const recs = (name: string): unknown[] => {
    const r = composed.records[name];
    if (!r) throw new Error(`pack file not found: ${name}.json`);
    return r;
  };
  const file = (name: string): unknown => ({ ...core().files[name], records: recs(name) });
  const pack = {
    constants: file("constants"),
    terrain: recs("terrain"),
    roomTemplates: recs("room_template"),
    vaults: recs("vault"),
    dungeonProfiles: recs("dungeon_profile"),
    chestTraps: recs("chest_trap"),
    world: recs("world"),
    projection: recs("projection"),
    trap: recs("trap"),
    messageTypes: composed.records["message_type"],
    /* A pack's own item classes, numbered before the kinds that name them
     * (core session/boot.ts). Core ships no tval.json, so a mod-only file. */
    tvals: composed.records["tval"],
    /* A pack's own monster spells have to be declared before bindCore binds a
     * monster that casts one (core session/boot.ts, #281). Core's own spells
     * are compiled in, so only records that carry a declaration `type` go here.
     * The game's web loader passes this field from 1.20.0 (#319). */
    monsterSpells: (composed.records["monster_spell"] ?? []).filter(
      (r) => typeof (r as { type?: unknown }).type === "string",
    ),
    names: recs("names"),
    store: recs("store"),
    quest: recs("quest"),
    uiKnowledge: recs("ui_knowledge"),
    hints: recs("hints"),
    obj: {
      objectBase: file("object_base"),
      object: file("object"),
      egoItem: file("ego_item"),
      artifact: file("artifact"),
      curse: file("curse"),
      brand: file("brand"),
      slay: file("slay"),
      activation: file("activation"),
      objectProperty: file("object_property"),
      flavor: file("flavor"),
    },
    mon: {
      pain: recs("pain"),
      blowMethods: recs("blow_methods"),
      blowEffects: recs("blow_effects"),
      monsterSpells: recs("monster_spell"),
      monsterBases: recs("monster_base"),
      monsters: recs("monster"),
      summons: recs("summon"),
      pits: recs("pit"),
    },
    player: {
      races: recs("p_race"),
      classes: recs("class"),
      properties: recs("player_property"),
      timed: recs("player_timed"),
      shapes: recs("shape"),
      bodies: recs("body"),
      history: recs("history"),
      realms: recs("realm"),
    },
  };
  return { composed, pack: pack as unknown as GamePack };
}

export function bind(on: readonly string[]): { composed: ComposedContent; game: CoreRegistries } {
  const { composed, pack } = gamePack(on);
  return { composed, game: bindCore(pack) };
}

/** Bind the player classes and register their synthesized spellbook kinds. */
export function bindBooks(on: readonly string[]) {
  const { composed, game } = bind(on);
  const recs = (name: string) => composed.records[name] as never[];
  const players = bindPlayer({
    races: recs("p_race"), classes: recs("class"), properties: recs("player_property"),
    timed: recs("player_timed"), shapes: recs("shape"), bodies: recs("body"),
    history: recs("history"), realms: recs("realm"),
  } satisfies PlayerPackRecords);
  registerBookKinds(game.objects, players.classes);
  return { composed, game, players };
}

export { existsSync, ROOT };

/**
 * Every `restoredItemArt` declaration in manifest.json.
 *
 * The art comes from tools/extract-art.py, which crops each record's own cell out
 * of upstream's tile sheets at the last release that mapped it. The policy it
 * follows: a pack's own historical tile first, then a real tile from a pack at the
 * same or a lower resolution, never a larger tile scaled down. This file checks
 * what can drift after the tool has run: that each declared kind still names a
 * kind the game binds, that each asset is on disk, and that no pack is handed a
 * tile larger than its own cells.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ContentIdResolver } from "@rpgm-tools/neo-angband-core";
import { recordKey } from "@rpgm-tools/neo-angband-mod-sdk";
import { PNG_SIZE } from "./test/png.js";
import { bind, bindBooks, modManifest, sectionIds } from "./test/game.js";

type Art = { kind: string; packs: Record<string, { asset?: string; row?: number; col?: number }> };
const ART = (modManifest() as unknown as { restoredItemArt: Art[] }).restoredItemArt;
const MONSTER_ART = (modManifest() as unknown as { restoredMonsterArt: Array<{ race: string; packs: Record<string, { asset?: string }>; hue?: number }> }).restoredMonsterArt;
const FLAVOR_ART = (modManifest() as unknown as { restoredFlavorArt: Array<{ flavor: number; drawAs?: number; hue?: number; packs?: Record<string, { asset?: string }> }> }).restoredFlavorArt;
const ART_REPORT = JSON.parse(readFileSync(new URL("./tools/art-report.json", import.meta.url), "utf8")) as Record<string, {
  kind: string;
  found: Record<string, { claimed_by?: string | null }>;
}>;

/** Each bundled pack's cell size. */
const CELL: Record<string, [number, number]> = {
  old: [8, 8],
  nomad: [8, 16],
  "adam-bolt": [16, 16],
  gervais: [32, 32],
  shockbolt: [64, 64],
};

describe("restored item art", () => {
  it("names a kind the game binds, with every section on", () => {
    const { game } = bindBooks(sectionIds());
    const ids = new ContentIdResolver({ objects: game.objects });
    for (const a of ART) expect(ids.kindIndex(a.kind), a.kind).toBeDefined();
  });

  it.each(ART.map((a) => [a.kind, a] as const))("%s: covers all five packs with assets that exist and fit", (_kind, a) => {
    expect(Object.keys(a.packs).sort()).toEqual(Object.keys(CELL).sort());
    for (const [pack, tile] of Object.entries(a.packs)) {
      const path = new URL(`./${tile.asset}`, import.meta.url);
      expect(existsSync(path), `${pack}: ${tile.asset}`).toBe(true);
      const [w, h] = PNG_SIZE(path);
      const [cw, ch] = CELL[pack]!;
      expect(w <= cw && h <= ch, `${pack} is handed ${w}x${h}`).toBe(true);
    }
  });
});

describe("junk art", () => {
  const LABEL: Record<string, string> = { old: "old", nomad: "nomad", "adam-bolt": "adambolt", gervais: "gervais", shockbolt: "shockbolt" };
  /* Cut after 3.0.9, before Nomad and Shockbolt existed: those two packs borrow a lower pack's tile. */
  const CUT_IN_3_0 = ["gnome-skeleton", "filthy-rag", "broken-dagger", "broken-sword"];

  it("gives all 14 junk records an entry that follows the art policy", () => {
    const records = JSON.parse(readFileSync(new URL("./object.json", import.meta.url), "utf8")) as {
      sections: Record<string, { records: Array<{ name: string; type: string }> }>;
    };
    const junk = records.sections["junk"]!.records;
    expect(junk).toHaveLength(14);
    for (const r of junk) {
      const [type, slug] = recordKey("object", r)!.split("--");
      const entry = ART.find((a) => a.kind === `feature-restoration:${type}:${slug}`);
      expect(entry, r.name).toBeDefined();
      const own = (pack: string) => `assets/${slug}-${LABEL[pack]}-native-`;
      const packs = entry!.packs;
      const fallback = CUT_IN_3_0.includes(slug!) ? ["nomad", "shockbolt"] : [];
      for (const pack of Object.keys(CELL)) {
        const asset = packs[pack]!.asset!;
        if (fallback.includes(pack)) {
          expect(asset.startsWith(own(pack)), `${slug} ${pack} borrows`).toBe(false);
          expect(asset.startsWith(`assets/${slug}-`), `${slug} ${pack} borrows its own item`).toBe(true);
        } else {
          expect(asset.startsWith(own(pack)), `${slug} ${pack}`).toBe(true);
        }
      }
    }
  });
});

describe("restored monster art", () => {
  it("names each restored race, with assets that exist and fit each pack", () => {
    const { game } = bind(sectionIds());
    const ids = new ContentIdResolver({ objects: game.objects, monsters: game.monsters });
    const records = JSON.parse(readFileSync(new URL("./monster.json", import.meta.url), "utf8")) as {
      sections: Record<string, { records: Array<{ name: string }> }>;
    };
    const expected = Object.values(records.sections).flatMap((s) => s.records)
      .map((race) => `feature-restoration:${recordKey("monster", race)}`);
    expect(MONSTER_ART.map((a) => a.race).sort()).toEqual(expected.sort());
    for (const art of MONSTER_ART) {
      expect(ids.raceIndex(art.race), art.race).toBeDefined();
      expect(Object.keys(art.packs).sort()).toEqual(Object.keys(CELL).sort());
      for (const [pack, tile] of Object.entries(art.packs)) {
        const path = new URL(`./${tile.asset}`, import.meta.url);
        expect(existsSync(path), `${art.race} ${pack}: ${tile.asset}`).toBe(true);
        const [w, h] = PNG_SIZE(path);
        const [cw, ch] = CELL[pack]!;
        expect(w <= cw && h <= ch, `${art.race} ${pack} is handed ${w}x${h}`).toBe(true);
      }
      const slug = art.race.split(":")[1]!;
      if (Object.values(ART_REPORT[slug]!.found).some((tile) => tile.claimed_by)) {
        expect(art.hue, art.race).toBeDefined();
      }
    }
  });

  it("gives every restored flavor a valid existing drawAs index and a hue", () => {
    const flavors = bind(["flavors"]).game.objects.flavors as unknown as Array<{ fidx: number } | null>;
    const indices = new Set(flavors.filter((f): f is { fidx: number } => f !== null).map((f) => f.fidx));
    expect(FLAVOR_ART.map((a) => a.flavor)).toEqual([303, 304, 305, 306, 307, 308, 309]);
    for (const art of FLAVOR_ART) {
      expect(art.drawAs, String(art.flavor)).toBeDefined();
      expect(indices.has(art.drawAs!), `${art.flavor} draws as ${art.drawAs}`).toBe(true);
      expect(art.hue, String(art.flavor)).toBeDefined();
    }
  });
});

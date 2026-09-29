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

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ContentIdResolver } from "@rpgm-tools/neo-angband-core";
import { PNG_SIZE } from "./test/png.js";
import { bind, modManifest, sectionIds } from "./test/game.js";

type Art = { kind: string; packs: Record<string, { asset?: string; row?: number; col?: number }> };
const ART = (modManifest() as unknown as { restoredItemArt: Art[] }).restoredItemArt;

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
    const { game } = bind(sectionIds());
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

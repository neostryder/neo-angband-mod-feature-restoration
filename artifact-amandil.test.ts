/**
 * "Add the Amulet of Amandil" (section amandil).
 *
 * Upstream added this artifact already commented out on 2011-06-19 (2744ef5a1,
 * "Merge jens's artifact changes"), and it has stayed commented out in every
 * release since; 4.2.6's artifact.txt still carries it that way. Its only
 * blocker was its base line, `amulet:55`, a numeric reference from before 2016.
 * Index 55 is the Golden amulet flavor, which 4.2 fixed to the Necklace artifact
 * base, so the record uses that base and draws as a golden amulet as it did.
 * Every other number is the commented record's own.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bind } from "./test/game.js";

const REFERENCE = [
  "#name:of Amandil",
  "#base-object:amulet:55",
  "#level:65",
  "#weight:3",
  "#cost:90000",
  "#alloc:3:60 to 127",
  "#flags:PROT_FEAR | PROT_BLIND | PROT_STUN | PROT_CONF",
  "#values:SEARCH[4] | SPEED[2] | RES_ELEC[1] | RES_COLD[1]",
];

type Artifact = { name: string; level: number; allocProb: number; allocMin: number; allocMax: number; cost: number; weight: number };

describe("the Amulet of Amandil", () => {
  it("does not exist in the base game", () => {
    const arts = bind([]).game.objects.artifacts as unknown as Array<Artifact | null>;
    expect(arts.some((a) => a?.name === "of Amandil")).toBe(false);
  });

  it("binds with the commented record's own numbers once the section is on", () => {
    const arts = bind(["amandil"]).game.objects.artifacts as unknown as Array<Artifact | null>;
    const a = arts.find((x) => x?.name === "of Amandil")!;
    expect(a).toBeDefined();
    expect([a.level, a.weight, a.cost, a.allocProb, a.allocMin, a.allocMax]).toEqual([65, 3, 90000, 3, 60, 127]);
  });

  it("matches the record 4.2.6 ships commented out, line for line apart from its base", () => {
    const rec = (JSON.parse(readFileSync(new URL("./artifact.json", import.meta.url), "utf8")) as {
      sections: { amandil: { records: Record<string, unknown>[] } };
    }).sections.amandil.records[0]!;
    const alloc = rec["alloc"] as { common: number; minmax: string };
    const ours = [
      `#name:${String(rec["name"])}`,
      "#base-object:amulet:55",
      `#level:${String(rec["level"])}`,
      `#weight:${String(rec["weight"])}`,
      `#cost:${String(rec["cost"])}`,
      `#alloc:${alloc.common}:${alloc.minmax}`,
      `#flags:${(rec["flags"] as string[]).join(" | ")}`,
      `#values:${(rec["values"] as string[]).join(" | ")}`,
    ];
    expect(ours).toEqual(REFERENCE);
    expect(rec["base-object"]).toEqual({ tval: "amulet", sval: "Necklace" });
  });
});

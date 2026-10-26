import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CURSE_ARMOUR, CURSE_WEAPON } from "./src/curse-scrolls.js";
import { LOSE_MEMORIES } from "./src/lose-memories.js";

/** Every `eff` string a content file names, wherever it sits in the file. */
function effectNames(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) for (const item of node) effectNames(item, found);
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "eff" && typeof value === "string") found.push(value);
      else effectNames(value, found);
    }
  }
  return found;
}

describe("effect names", () => {
  /* The game reads an effect line as name:type:radius:other, so a name with a colon
   * never resolves and the whole object record fails to load. */
  it("carry no colon in any content file or registered code", () => {
    const names = effectNames(JSON.parse(readFileSync(new URL("./object.json", import.meta.url), "utf8")));
    expect(names).toContain(LOSE_MEMORIES);
    expect(names.filter((name) => name.includes(":"))).toEqual([]);
    for (const code of [LOSE_MEMORIES, CURSE_WEAPON, CURSE_ARMOUR]) expect(code).not.toContain(":");
  });

  it("match the codes the plugin registers", () => {
    const names = effectNames(JSON.parse(readFileSync(new URL("./object.json", import.meta.url), "utf8")));
    for (const code of [LOSE_MEMORIES, CURSE_WEAPON, CURSE_ARMOUR]) expect(names).toContain(code);
  });
});

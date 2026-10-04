import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Only src/core-adapter.ts may reach the game's internals. Every other source
 * file gets engine names, registry seams and context members from the adapter,
 * so moving to a new mod API means rewriting that one file.
 */

const ADAPTER = "src/core-adapter.ts";

const FORBIDDEN: readonly { what: string; pattern: RegExp }[] = [
  {
    what: "a raw plugin context member",
    pattern: /\bctx\s*\.\s*(core|state|registries|snapshot|intent|events|characterStore|prefs|inspect|keymaps|ui|flags|log)\b/,
  },
  { what: "the registries", pattern: /\bregistries\b/ },
  { what: "the core namespace type", pattern: /import\(\s*["']@rpgm-tools\/neo-angband-core["']/ },
  { what: "a runtime import of core", pattern: /import\s+(?!type\b)[^;]*?from\s+["']@rpgm-tools\/neo-angband-core["']/ },
  { what: "a local core namespace", pattern: /(?<![\w$.])core\s*(\?\.|\.|\[)/ },
  { what: "the registry host", pattern: /(?<![\w$.])host\s*(\?\.|\.|\[)/ },
  { what: "the newCharacter hook's live state", pattern: /\bkindIgnoreWhen(Aware|Unaware)\b|\bobjects\s*\.\s*kinds\b/ },
];

function sources(): string[] {
  const files = ["plugin.ts"];
  for (const entry of readdirSync(new URL("./src/", import.meta.url), { recursive: true, encoding: "utf8" })) {
    const path = `src/${entry.replace(/\\/g, "/")}`;
    if (path.endsWith(".ts") && !path.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

/** The source with its comments blanked, so prose about ctx.core does not count. */
function code(path: string): string {
  return readFileSync(new URL(`./${path}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, "");
}

function violations(path: string, text: string): string[] {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(({ what }) => `${path}: ${what}`);
}

describe("the engine adapter boundary", () => {
  it("scans plugin.ts, the adapter and the other src files", () => {
    const files = sources();
    expect(files).toContain("plugin.ts");
    expect(files).toContain(ADAPTER);
    expect(files.length).toBeGreaterThan(2);
  });

  it("keeps every internal read inside the adapter", () => {
    const found = sources()
      .filter((path) => path !== ADAPTER)
      .flatMap((path) => violations(path, code(path)));
    expect(found).toEqual([]);
  });

  it("recognises each kind of internal read", () => {
    const samples = [
      "const x = ctx.core.TMD;",
      "ctx.keymaps?.bind(a, b);",
      "registries.objects.kinds.find(f);",
      "type C = typeof import(\"@rpgm-tools/neo-angband-core\");",
      "import { TMD } from \"@rpgm-tools/neo-angband-core\";",
      "const n = core.EF.ENCHANT;",
      "host.effects.register(a, b);",
      "state.ignore.kindIgnoreWhenAware(1);",
    ];
    for (const sample of samples) expect(violations("sample", sample), sample).not.toEqual([]);
    expect(violations("sample", "import type { GameState } from \"@rpgm-tools/neo-angband-core\";")).toEqual([]);
    expect(violations("sample", "engine.core.EF.ENCHANT; ctx.env.messages?.msg(t);")).toEqual([]);
  });
});

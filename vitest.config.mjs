/**
 * Test config, whose only job is an OPT-IN path to a local engine.
 *
 * By default these tests import `@rpgm-tools/neo-angband-core` and
 * `@rpgm-tools/neo-angband-content` from node_modules - the PUBLISHED versions, what a
 * player actually runs. That default is deliberate and package.json says so: a mod
 * that passes against an unreleased engine and fails against the released one has been
 * tested against the wrong thing.
 *
 * But it makes the opposite case impossible, and that case is real. When the engine
 * or the content pack grows something this mod needs, the change lands in the game's
 * repository and reaches npm at the next release - so until then there is no way to
 * run this mod against it.
 *
 *   NEO_ANGBAND_LOCAL_CORE=1 pnpm test
 *
 * A SECOND VARIABLE, not just the presence of a sibling checkout, and it selects the
 * ENGINE UNDER TEST rather than falling back quietly - the same reasoning the other
 * first-party mods use this exact file for.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

const CORE = "@rpgm-tools/neo-angband-core";

function localCore() {
  if (process.env["NEO_ANGBAND_LOCAL_CORE"] !== "1") return {};

  const explicit = process.env["NEO_ANGBAND_REPO"];
  const roots = explicit
    ? [explicit]
    : [fileURLToPath(new URL("../neo-angband/", import.meta.url))];

  for (const root of roots) {
    const entry = join(root, "packages", "core", "dist", "index.js");
    if (existsSync(entry)) {
      console.log(`[vitest] NEO_ANGBAND_LOCAL_CORE=1 -> ${entry}`);
      return { [CORE]: entry };
    }
  }
  throw new Error(
    "NEO_ANGBAND_LOCAL_CORE=1 was set, but no BUILT engine was found. Run `pnpm build`\n" +
      "in the game's repository, or point NEO_ANGBAND_REPO at it.\n" +
      `Looked for packages/core/dist/index.js under:\n${roots.map((r) => `  ${r}`).join("\n")}`,
  );
}

export default defineConfig({
  resolve: { alias: localCore() },
});

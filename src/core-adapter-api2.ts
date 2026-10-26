import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import { engineOf, type AdapterEngine } from "./core-adapter.js";

export interface AdapterMeta {
  /** API 2: `meta.flags`. */
  readonly flags: Readonly<Record<string, boolean>>;
  /** API 2: `meta.log(message)`. */
  log(message: string): void;
}

export interface Adapter {
  readonly meta: AdapterMeta;
  readonly engine: AdapterEngine;
}

/** The mod's view of the running game: its flags and log, and the engine names it still reads. */
export function createAdapter(mod: ModApi2): Adapter {
  return {
    meta: {
      flags: mod.meta.flags,
      log: (message) => mod.meta.log(message),
    },
    engine: engineOf(mod),
  };
}

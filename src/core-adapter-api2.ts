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
  readonly ui: {
    /** Null when `keymap:write` is not granted. A refusal answers `false`; a host fault rejects. */
    readonly keys: { bind(trigger: string, action: string): Promise<boolean> } | null;
  };
  readonly engine: AdapterEngine;
}

/** The mod's view of the running game: its flags and log, its one key binding, and the engine names it still reads. */
export function createAdapter(mod: ModApi2): Adapter {
  return {
    meta: {
      flags: mod.meta.flags,
      log: (message) => mod.meta.log(message),
    },
    ui: {
      keys: mod.meta.granted("keymap:write")
        ? { bind: async (trigger, action) => (await mod.ui.keys.bind(trigger, action)).ok }
        : null,
    },
    engine: engineOf(mod),
  };
}

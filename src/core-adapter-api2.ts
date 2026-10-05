import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import type { AdapterMeta } from "./core-adapter.js";

export interface Adapter {
  readonly meta: AdapterMeta;
  readonly ui: {
    readonly keys: { bind(trigger: string, action: string): Promise<boolean> } | null;
  };
}

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
  };
}

import { describe, expect, it, vi } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import type { Api2Engine, ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import { createAdapter } from "./src/core-adapter-api2.js";

function fakeApi(flags: Readonly<Record<string, boolean>>, engine?: Api2Engine): ModApi2 {
  const unused = async (): Promise<never> => { throw new Error("Unexpected domain call"); };
  return {
    ...(engine ? { engine } : {}),
    meta: {
      id: "feature-restoration",
      api: "2.0.0",
      engine: "test",
      tier: "first-party",
      flags,
      newCharacter: false,
      granted: vi.fn(() => false),
      log: vi.fn(),
      settings: unused,
      setSetting: unused,
      mods: unused,
    },
    view: { world: unused, player: unused, monsters: unused, level: unused, input: unused, isCurrent: unused },
    act: {
      submit: unused,
      answer: unused,
      controller: { owns: unused, setStatus: unused, markNondeterministic: unused, release: unused },
    },
    events: { on: unused, off: unused },
    hooks: { available: [], active: [] },
    content: { own: unused, asset: unused, records: unused, lookup: unused },
    ui: { mount: unused, patch: unused },
    store: { prefs: { get: unused, set: unused }, character: { get: unused, set: unused } },
  } as unknown as ModApi2;
}

describe("the API 2 adapter", () => {
  it("returns the mod's flags and forwards log text unchanged", () => {
    const flags = { "feature-restoration.junk": false, "feature-restoration.spike-doors": true };
    const mod = fakeApi(flags);
    const adapter = createAdapter(mod);
    expect(adapter.meta.flags).toEqual(flags);
    expect(adapter.meta.flags["missing"]).toBeUndefined();
    adapter.meta.log("spike installed");
    expect(vi.mocked(mod.meta.log).mock.calls).toEqual([["spike installed"]]);
  });

  it("carries no engine names when the mod has no engine domain", () => {
    const { engine } = createAdapter(fakeApi({}));
    expect(engine.core).toBeNull();
    expect(engine.registry).toBeNull();
  });

  it("keeps local keypad offsets equal to the engine table", () => {
    const engine = { api: "1.0.0", core, state: undefined, registries: undefined } as unknown as Api2Engine;
    expect(createAdapter(fakeApi({}, engine)).engine.core!.DDGRID).toEqual(core.DDGRID);
  });

  it("builds the registry adapter from the engine domain's host", () => {
    const set = vi.fn();
    const host = { commands: { register: vi.fn(), setVerb: set }, effects: undefined };
    const engine = { api: "1.0.0", core, state: undefined, registries: undefined, registry: host } as unknown as Api2Engine;
    const { registry } = createAdapter(fakeApi({}, engine)).engine;
    registry!.setCommandVerb("feature-restoration:spike", "spike");
    expect(set).toHaveBeenCalledWith("feature-restoration:spike", "spike");
    expect(registry!.registerEffect).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import {
  api2NotGranted,
  api2Ok,
  api2Refused,
  api2Unavailable,
  type Api2Result,
  type Api2Engine,
  type ModApi2,
} from "@rpgm-tools/neo-angband-mod-sdk";
import { createAdapter } from "./src/core-adapter-api2.js";

function fakeApi(flags: Readonly<Record<string, boolean>>, granted = true, result: Api2Result<null> = api2Ok(null), engine?: Api2Engine): ModApi2 {
  const unused = async (): Promise<never> => { throw new Error("Unexpected domain call"); };
  const bindings: { trigger: string; action: string }[] = [];
  return {
    ...(engine ? { engine } : {}),
    meta: {
      id: "feature-restoration",
      api: "2.0.0",
      engine: "test",
      tier: "first-party",
      flags,
      newCharacter: false,
      granted: vi.fn((cap: string) => cap === "keymap:write" && granted),
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
    ui: { mount: unused, patch: unused, keys: {
      bind: vi.fn(async (trigger: string, action: string) => {
        if (result.ok) bindings.push({ trigger, action });
        return result;
      }),
      list: vi.fn(async () => api2Ok([...bindings])),
      remove: unused,
    } },
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
    adapter.meta.log("spike binding");
    expect(vi.mocked(mod.meta.log).mock.calls).toEqual([["spike binding"]]);
  });

  it.each([
    ["success", api2Ok(null), true],
    ["claimed trigger", api2Refused("trigger-taken", "The trigger is claimed"), false],
    ["host permission refusal", api2NotGranted("keymap:write"), false],
    ["unavailable host", api2Unavailable("The host has no keymaps"), false],
  ] as const)("answers the binding as a boolean for %s", async (_name, result, bound) => {
    const mod = fakeApi({}, true, result);
    expect(await createAdapter(mod).ui.keys!.bind("j", "feature-restoration:spike")).toBe(bound);
    expect(mod.ui.keys.bind).toHaveBeenCalledWith("j", "feature-restoration:spike");
    expect(await mod.ui.keys.list()).toEqual(api2Ok(bound ? [{ trigger: "j", action: "feature-restoration:spike" }] : []));
  });

  it("omits key access when the permission is denied", () => {
    const mod = fakeApi({}, false, api2NotGranted("keymap:write"));
    expect(createAdapter(mod).ui.keys).toBeNull();
    expect(mod.meta.granted).toHaveBeenCalledWith("keymap:write");
    expect(mod.ui.keys.bind).not.toHaveBeenCalled();
  });

  it("keeps a host fault as a rejected promise", async () => {
    const mod = fakeApi({});
    vi.mocked(mod.ui.keys.bind).mockRejectedValueOnce(new Error("host fault"));
    await expect(createAdapter(mod).ui.keys!.bind("j", "feature-restoration:spike")).rejects.toThrow("host fault");
  });

  it("carries no engine names when the mod has no engine domain", () => {
    const { engine } = createAdapter(fakeApi({}));
    expect(engine.core).toBeNull();
    expect(engine.registry).toBeNull();
  });

  it("keeps local keypad offsets equal to the engine table", () => {
    const engine = { api: "1.0.0", core, state: undefined, registries: undefined } as unknown as Api2Engine;
    expect(createAdapter(fakeApi({}, true, api2Ok(null), engine)).engine.core!.DDGRID).toEqual(core.DDGRID);
  });

  it("builds the registry adapter from the engine domain's host", () => {
    const set = vi.fn();
    const host = { commands: { register: vi.fn(), setVerb: set }, effects: undefined };
    const engine = { api: "1.0.0", core, state: undefined, registries: undefined, registry: host } as unknown as Api2Engine;
    const { registry } = createAdapter(fakeApi({}, true, api2Ok(null), engine)).engine;
    registry!.setCommandVerb("feature-restoration:spike", "spike");
    expect(set).toHaveBeenCalledWith("feature-restoration:spike", "spike");
    expect(registry!.registerEffect).toBeNull();
  });
});

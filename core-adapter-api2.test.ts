import { describe, expect, it, vi } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import {
  api2NotGranted,
  api2Ok,
  api2Refused,
  api2Unavailable,
  type Api2Result,
  type ModApi2,
} from "@rpgm-tools/neo-angband-mod-sdk";
import { createAdapter as createApi1Adapter } from "./src/core-adapter.js";
import { createAdapter } from "./src/core-adapter-api2.js";

function fakeApi(flags: Readonly<Record<string, boolean>>, granted = true, result: Api2Result<null> = api2Ok(null)): ModApi2 {
  const unused = async (): Promise<never> => { throw new Error("Unexpected domain call"); };
  return {
    meta: {
      id: "feature-restoration",
      api: "2.0.0",
      engine: "test",
      tier: "first-party",
      flags,
      newCharacter: false,
      granted: vi.fn((cap) => cap === "keymap:write" && granted),
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
    ui: { mount: unused, patch: unused, keys: { bind: vi.fn(async () => result), list: unused, remove: unused } },
    store: { prefs: { get: unused, set: unused }, character: { get: unused, set: unused } },
  };
}

describe("the API 2 adapter twin", () => {
  it("returns the API 1 flags and forwards the same log text", () => {
    const flags = { "feature-restoration.junk": false, "feature-restoration.spike-doors": true };
    const mod = fakeApi(flags);
    const log = vi.fn();
    const old = createApi1Adapter({ flags, log });
    const twin = createAdapter(mod);
    expect(twin.meta.flags).toBe(old.meta.flags);
    expect(twin.meta.flags["missing"]).toBe(old.meta.flags["missing"]);
    old.meta.log("spike binding");
    twin.meta.log("spike binding");
    expect(vi.mocked(mod.meta.log).mock.calls).toEqual(log.mock.calls);
  });

  it.each([
    ["success", api2Ok(null), true],
    ["claimed trigger", api2Refused("trigger-taken", "The trigger is claimed"), false],
    ["denied permission", api2NotGranted("keymap:write"), false],
    ["unavailable host", api2Unavailable("The host has no keymaps"), false],
  ] as const)("matches the API 1 binding answer for %s", async (_name, result, bound) => {
    const flags = {};
    const mod = fakeApi(flags, true, result);
    const bind = vi.fn(() => bound);
    const old = createApi1Adapter({ flags, keymaps: { isBindableTriggerKey: () => true, bind } });
    expect(await createAdapter(mod).ui.keys!.bind("j", "feature-restoration:spike"))
      .toBe(old.ui.keys!.bind("j", "feature-restoration:spike"));
    expect(vi.mocked(mod.ui.keys.bind).mock.calls).toEqual(bind.mock.calls);
  });

  it("matches an invalid trigger without writing a binding", async () => {
    const mod = fakeApi({}, true, api2Refused("trigger-taken", "The trigger is unavailable"));
    const bind = vi.fn(() => true);
    const old = createApi1Adapter({ flags: {}, keymaps: { isBindableTriggerKey: () => false, bind } });
    expect(await createAdapter(mod).ui.keys!.bind("Escape", "feature-restoration:spike"))
      .toBe(old.ui.keys!.bind("Escape", "feature-restoration:spike"));
    expect(bind).not.toHaveBeenCalled();
  });

  it("omits key access when the permission is denied", () => {
    const mod = fakeApi({}, false);
    expect(createAdapter(mod).ui.keys).toBe(createApi1Adapter({ flags: {} }).ui.keys);
    expect(mod.meta.granted).toHaveBeenCalledWith("keymap:write");
    expect(mod.ui.keys.bind).not.toHaveBeenCalled();
  });

  it("keeps a host fault as a rejected promise", async () => {
    const mod = fakeApi({});
    vi.mocked(mod.ui.keys.bind).mockRejectedValueOnce(new Error("host fault"));
    await expect(createAdapter(mod).ui.keys!.bind("j", "feature-restoration:spike")).rejects.toThrow("host fault");
  });

  it("keeps local keypad offsets equal to the engine table", () => {
    expect(createApi1Adapter({ flags: {}, core }).engine.core!.DDGRID).toEqual(core.DDGRID);
  });
});

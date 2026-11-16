import { describe, expect, it } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import { api2PolicyEffects, checkApi2Policies, recordKey } from "@rpgm-tools/neo-angband-mod-sdk";
import { bind, gamePack, modManifest } from "./test/game.js";
import { policiesFor } from "./test/api2.js";

const FLAG = "feature-restoration.cursed-light";
const PLAYER = core.startGame(gamePack([]).pack).state.actor.player;

// Angband 4.0.5 calc_torch (player-calcs.c) tests LIGHT_CURSE alone.
const HISTORICAL = [
  ["artifact", 13, "the-one-ring"],
  ["artifact", 34, "of-morgoth"],
  ["artifact", 35, "of-ber-thiel"],
  ["artifact", 41, "of-gorlim"],
  ["artifact", 58, "camlost"],
  ["artifact", 63, "of-wormtongue"],
  ["artifact", 71, "calris"],
  ["artifact", 78, "mormegil"],
  ["artifact", 92, "of-melkor"],
  ["artifact", 123, "of-gothmog"],
  ["curse", 10, "vulnerability"],
  ["curse", 23, "vulnerability"],
  ["curse", 35, "teleportation"],
  ["curse", 38, "dullness"],
  ["curse", 39, "sickliness"],
  ["curse", 44, "enveloping"],
  ["curse", 45, "vulnerability"],
  ["curse", 46, "irritation"],
  ["curse", 54, "weakness"],
  ["curse", 55, "clumsiness"],
  ["curse", 62, "slowness"],
  ["curse", 63, "annoyance"],
  ["ego_item", 102, "of-morgul"],
  ["ego_item", 111, "of-the-nazg-l"],
] as const;

function fixture(on: readonly string[] = ["cursed-light"]) {
  const { game, composed } = bind(on);
  const flags = Object.fromEntries(on.map((id) => [`feature-restoration.${id}`, true]));
  const policies = policiesFor(flags)!;
  const hooks = api2PolicyEffects(policies).hooks;
  const equipment = new Array<core.GameObject | null>(PLAYER.body.count).fill(null);
  const radius = (obj: core.GameObject, worn = true): number => {
    equipment.fill(null);
    if (worn) equipment[0] = obj;
    return core.calcBonuses(PLAYER, {
      equipment, curses: game.objects.curses,
      cursedLightRadius: hooks.cursedLightRadius?.() ?? false,
    }).curLight;
  };
  const torch = (): core.GameObject => {
    const kind = game.objects.kinds.find((k) => k?.tval === core.TV.LIGHT && k.name.includes("Torch"))!;
    const obj = core.objectPrep(new core.Rng(1), game.objects, game.constants, kind, 1, "average");
    obj.timeout = 5000;
    return obj;
  };
  const artifact = (name: string): core.GameObject => {
    const art = game.objects.artifacts.find((record) => record?.name === name)!;
    const kind = game.objects.kinds.find((record) => record?.tval === art.tval && record.sval === art.sval)!;
    const obj = core.objectPrep(new core.Rng(1), game.objects, game.constants, kind, 1, "average");
    obj.artifact = art;
    core.copyArtifactData(new core.Rng(1), game.objects, obj, art);
    return obj;
  };
  return { game, composed, radius, torch, artifact };
}

describe("CRF-9 cursed light suppression", () => {
  it("declares a default-off section and a permission-gated LIGHT_CURSE selector", () => {
    const manifest = modManifest() as { sections?: Array<{ id: string; flag?: string; default?: boolean; requiresReload?: boolean }>; capabilities?: string[] };
    expect(manifest.sections?.find((section) => section.id === "cursed-light")).toMatchObject({ flag: FLAG, default: false, requiresReload: true });
    expect(manifest.capabilities).toContain("registry:ui-entry");
    const policies = policiesFor({ [FLAG]: true })!;
    expect(policies.cursedLightRadius).toEqual({ marker: "LIGHT_CURSE" });
    expect(checkApi2Policies(policies)).toBeNull();
    expect(api2PolicyEffects(policies, () => false).hooks.cursedLightRadius).toBeUndefined();
    expect(api2PolicyEffects(policies, (cap) => cap === "registry:ui-entry").hooks.cursedLightRadius?.()).toEqual({ marker: "LIGHT_CURSE" });
    expect(policiesFor({})?.cursedLightRadius).toBeUndefined();
    expect(policiesFor({ [FLAG]: false })?.cursedLightRadius).toBeUndefined();
  });

  it.each(HISTORICAL)("marks the Core %s counterpart of 4.0.5 record %i (%s)", (file, _id, key) => {
    const { composed } = fixture();
    const record = composed.records[file]!.find((r) => recordKey(file, r) === key);
    expect(record, `${file} core:${key}`).toMatchObject({ "light-curse": true });
  });

  it("marks exactly the historical counterparts and no shared object kind", () => {
    const { composed, game } = fixture();
    for (const file of ["object", "artifact", "ego_item", "curse"] as const) {
      const expected = [...new Set(HISTORICAL.filter(([target]) => target === file).map(([, , key]) => key))].sort();
      const marked = composed.records[file]!.filter((r) => (r as { "light-curse"?: boolean })["light-curse"] === true).map((r) => recordKey(file, r)).sort();
      expect(marked, file).toEqual(expected);
    }
    expect(game.objects.artifacts.filter((r) => r?.lightCurse)).toHaveLength(10);
    expect(game.objects.egos.filter((r) => r?.lightCurse)).toHaveLength(2);
    expect(game.objects.curses.filter((r) => r?.lightCurse)).toHaveLength(10);
  });

  it.each(["of Morgoth", "of Gothmog"])("suppresses a worn LIGHT_CURSE artifact %s", (name) => {
    const { artifact, radius } = fixture();
    const obj = artifact(name);
    const equipment = new Array<core.GameObject | null>(PLAYER.body.count).fill(null);
    equipment[0] = obj;
    expect(core.calcBonuses(PLAYER, { equipment }).curLight).toBe(1);
    expect(radius(obj)).toBe(0);
    expect(radius(obj, false)).toBe(0);
  });

  it("suppresses a worn of Morgul light", () => {
    const { game, torch, radius } = fixture();
    const obj = torch();
    obj.ego = game.objects.egos.find((ego) => ego?.name === "of Morgul")!;
    expect(radius(obj)).toBe(0);
  });

  it.each(["artifact", "ego"] as const)("keeps the %s marker after the last curse is removed", (site) => {
    const { game, torch, artifact, radius } = fixture();
    const obj = site === "artifact" ? artifact("of Gothmog") : torch();
    if (site === "ego") {
      obj.ego = game.objects.egos.find((ego) => ego?.name === "of Morgul")!;
    }
    const irritation = game.objects.curses.findIndex((curse) => curse?.name === "irritation");
    expect(irritation).toBeGreaterThan(0);
    obj.curses = game.objects.curses.map((_, index) => ({ power: index === irritation ? 4 : 0, timeout: 0 }));
    expect(radius(obj)).toBe(0);
    const active = obj.curses!.flatMap((curse, index) => curse.power > 0 ? [index] : []);
    expect(active.length).toBeGreaterThan(0);
    for (const pick of active) expect(core.removeObjectCurse(obj, pick)).toBe(true);
    expect(obj.curses).toBeNull();
    expect(radius(obj)).toBe(0);
  });

  it("suppresses only an active marked curse and restores light when it is removed", () => {
    const { game, torch, radius } = fixture();
    const obj = torch();
    const pick = game.objects.curses.findIndex((curse) => curse?.name === "weakness");
    obj.curses = game.objects.curses.map((_, index) => ({ power: index === pick ? 4 : 0, timeout: 0 }));
    expect(radius(obj)).toBe(0);
    expect(core.removeObjectCurse(obj, pick)).toBe(true);
    expect(radius(obj)).toBe(2);
  });

  it.each(["sticky-curses", "sticky-curses-all"])("keeps cursed light suppression independent when %s is also on", (sticky) => {
    const { artifact, radius } = fixture(["cursed-light", sticky]);
    expect(radius(artifact("of Gothmog"))).toBe(0);
  });

  it("restores normal light when the policy is off even if the item retains a marker", () => {
    const { artifact } = fixture();
    const obj = artifact("of Gothmog");
    const equipment = new Array<core.GameObject | null>(PLAYER.body.count).fill(null);
    equipment[0] = obj;
    expect(obj.artifact?.lightCurse).toBe(true);
    expect(core.calcBonuses(PLAYER, { equipment, cursedLightRadius: policiesFor({ [FLAG]: false })?.cursedLightRadius ?? false }).curLight).toBe(1);
  });

  it("leaves an unrelated cursed light and a sticky-only light shining", () => {
    const { game, torch, radius } = fixture();
    const obj = torch();
    const pick = game.objects.curses.findIndex((curse) => curse?.name === "air swing");
    expect(pick).toBeGreaterThan(0);
    obj.curses = game.objects.curses.map((_, index) => ({ power: index === pick ? 4 : 0, timeout: 0 }));
    expect(radius(obj)).toBe(2);
    obj.curses = null;
    obj.flags.on(core.OF.STICKY);
    expect(radius(obj)).toBe(2);
  });

  it.each([[], ["sticky-curses"], ["sticky-curses-all"], ["sticky-curses", "sticky-curses-all"]])("keeps normal light with cursed-light off and sections %j", (...on) => {
    const { game, composed, torch, radius } = fixture(on);
    const obj = torch();
    obj.artifact = game.objects.artifacts.find((art) => art?.name === "of Gothmog")!;
    obj.ego = game.objects.egos.find((ego) => ego?.name === "of Morgul")!;
    obj.flags.on(core.OF.STICKY);
    obj.curses = game.objects.curses.map((_, index) => ({ power: index > 0 ? 4 : 0, timeout: 0 }));
    expect(radius(obj)).toBe(2);
    for (const records of Object.values(composed.records)) expect(records.some((r) => (r as { "light-curse"?: boolean })["light-curse"] === true)).toBe(false);
    expect(policiesFor(Object.fromEntries(on.map((id) => [`feature-restoration.${id}`, true])))?.cursedLightRadius).toBeUndefined();
  });
});

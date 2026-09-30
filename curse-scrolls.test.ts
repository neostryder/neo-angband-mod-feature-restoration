import { describe, expect, it } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import { bind } from "./test/game.js";
import { CURSE_ARMOUR, CURSE_WEAPON } from "./src/curse-scrolls.js";
// @ts-expect-error The test imports the handwritten source module.
import plugin from "./plugin.ts";

type Handler = core.EffectHandler;
type Info = core.EffectTextHandler;

function setup() {
  const { game } = bind(["sticky-curses"]);
  const handlers = new Map<string, Handler>();
  const info = new Map<string, Info>();
  plugin.register({
    stores: { setDiscountRoll() {} },
    commands: { register() {}, setVerb() {} },
    effects: { register(code, def) { handlers.set(String(code), def.handler); } },
    effectInfo: { text: { set(code, entry) { info.set(code, entry); } } },
  }, {
    flags: { "feature-restoration.sticky-curses": true },
    core: {
      ...core,
      describeObject: (_state: unknown, obj: { kind: { name: string } }) => obj.kind.name,
    } as unknown as NonNullable<Parameters<typeof plugin.register>[1]["core"]>,
  });
  return { game, handlers, info };
}

function readScroll(code: string, artifact = false, seed = 7) {
  const { game, handlers } = setup();
  const scroll = game.objects.kinds.find((k) => k?.name === (code === CURSE_WEAPON ? "Curse Weapon" : "Curse Armour"))!;
  expect(scroll.effect?.[0]?.eff).toBe(code);
  const slotType = code === CURSE_WEAPON ? "WEAPON" : "BODY_ARMOR";
  const kind = game.objects.kinds.find((k) => k?.name === (code === CURSE_WEAPON ? "& Long Sword~" : "& Leather Scale Mail~"))
    ?? game.objects.kinds.find((k) => k && game.objects.egos.find((e) => e?.name === (code === CURSE_WEAPON ? "(Shattered)" : "(Blasted)"))?.possItems.has(k.kidx));
  expect(kind).toBeDefined();
  const obj = core.objectPrep(new core.Rng(13), game.objects, game.constants, kind!, 1, "average");
  if (artifact) obj.artifact = game.objects.artifacts.find((a) => a !== null)!;
  const rng = new core.Rng(seed);
  const state = {
    rng,
    gear: { store: new Map([[1, obj]]) },
    actor: { player: {
      body: { slots: [{ type: "WEAPON" }, { type: "BODY_ARMOR" }] },
      equipment: slotType === "WEAPON" ? [1, null] : [null, 1],
      upkeep: { notice: 0 },
    } },
    updateBonuses() {},
  };
  const messages: string[] = [];
  const ctx = {
    env: { game: { state, item: { reg: game.objects } }, messages: { msg: (text: string) => messages.push(text) } },
    ident: false,
  } as unknown as Parameters<Handler>[0];
  const result = handlers.get(code)!(ctx);
  return { obj, game, ctx, result, messages, state };
}

describe("curse scrolls", () => {
  it.each([
    [CURSE_WEAPON, "(Shattered)", "air swing"],
    [CURSE_ARMOUR, "(Blasted)", "vulnerability"],
  ])("%s binds and curses only its equipped item", (code, egoName, curseName) => {
    const { obj, game, ctx, result } = readScroll(code);
    expect(result).toBe(true);
    expect(ctx.ident).toBe(true);
    expect(obj.ego?.name).toBe(egoName);
    const index = game.objects.curses.findIndex((c) => c?.name === curseName);
    expect(obj.curses?.[index]?.power).toBe(40);
    expect([obj.ac, obj.dd, obj.ds]).toEqual([0, 0, 0]);
    if (code === CURSE_WEAPON) {
      expect(obj.toH).toBeGreaterThanOrEqual(-10);
      expect(obj.toH).toBeLessThanOrEqual(-2);
      expect(obj.toD).toBeGreaterThanOrEqual(-10);
      expect(obj.toD).toBeLessThanOrEqual(-2);
      expect(obj.toA).toBe(0);
    } else {
      expect(obj.toA).toBeGreaterThanOrEqual(-10);
      expect(obj.toA).toBeLessThanOrEqual(-2);
      expect(obj.toH).toBe(0);
      expect(obj.toD).toBe(0);
    }
  });

  it.each([CURSE_WEAPON, CURSE_ARMOUR])("%s lets an artifact resist the aura", (code) => {
    const { obj, ctx, messages } = readScroll(code, true);
    expect(ctx.ident).toBe(true);
    expect(obj.artifact).not.toBeNull();
    expect(obj.ego).toBeNull();
    expect(messages.some((m) => m.includes("resists"))).toBe(true);
  });

  it.each([CURSE_WEAPON, CURSE_ARMOUR])("%s destroys an artifact that fails its save", (code) => {
    const { obj } = readScroll(code, true, 1);
    expect(obj.artifact).toBeNull();
    expect(obj.ego?.name).toBe(code === CURSE_WEAPON ? "(Shattered)" : "(Blasted)");
  });

  it.each([CURSE_WEAPON, CURSE_ARMOUR])("%s cannot curse an empty equipment slot", (code) => {
    const { game, handlers } = setup();
    const messages: string[] = [];
    const ctx = {
      env: {
        game: {
          state: {
            actor: { player: { body: { slots: [{ type: "WEAPON" }, { type: "BODY_ARMOR" }] }, equipment: [null, null] } },
            gear: { store: new Map() },
          },
          item: { reg: game.objects },
        },
        messages: { msg: (text: string) => messages.push(text) },
      },
      ident: false,
    } as unknown as Parameters<Handler>[0];
    expect(handlers.get(code)!(ctx)).toBe(false);
    expect(ctx.ident).toBe(false);
    expect(messages).toEqual([]);
  });

  it("registers descriptions for both effects only with sticky curses on", () => {
    const { info, handlers } = setup();
    for (const code of [CURSE_WEAPON, CURSE_ARMOUR]) {
      expect(handlers.has(code)).toBe(true);
      expect(info.get(code)?.menuName?.({} as never)).toBeTruthy();
      expect(info.get(code)?.describe?.({} as never)).toBeTruthy();
    }
    for (const name of ["Curse Weapon", "Curse Armour"]) {
      const kind = bind([]).game.objects.kinds.find((k) => k?.name === name)!;
      expect(kind.allocProb).toBe(0);
      expect(kind.effect?.[0]?.eff).not.toContain("feature-restoration:");
    }
  });
});

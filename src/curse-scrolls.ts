/**
 * 3.0.9's Curse Weapon and Curse Armour (spells2.c L3470-3600).
 *
 * 3.0.9 reset name1 and name2 and set the Shattered or Blasted ego. An item's
 * magic came from those two lookups, so the old artifact's or ego's powers left
 * with them and only the base kind's own stayed. 4.2 copies powers onto the
 * object, so the handler puts back the kind's own before the new ego goes on.
 * The combat values are 3.0.9's own, and pval is kept, as 3.0.9 kept it.
 */

import type { EffectHandler, EffectHandlerContext } from "@rpgm-tools/neo-angband-core";

export const CURSE_WEAPON = "feature-restoration:CURSE_WEAPON";
export const CURSE_ARMOUR = "feature-restoration:CURSE_ARMOR";

/** A random value, as core's RandomValue is read by randcalc. */
interface RandomValueLike {
  base: number;
  dice: number;
  sides: number;
  mBonus: number;
}

/** An object flag set, structurally (core's FlagSet). */
interface FlagSetLike {
  copy(other: FlagSetLike): void;
  union(other: FlagSetLike): void;
  diff(other: FlagSetLike): void;
}

/** One element's resist entry, structurally (core's ElementInfo). */
interface ElementInfoLike {
  resLevel: number;
  flags: number;
}

/** What the reset reads off the kind and the ego, structurally. */
interface PowersLike {
  flags: FlagSetLike;
  modifiers: RandomValueLike[];
  elInfo: ElementInfoLike[];
  slays: boolean[] | null;
  brands: boolean[] | null;
}

interface KindLike extends PowersLike {
  kidx: number;
  base: { elInfo: ElementInfoLike[] };
  effect: unknown;
  time: RandomValueLike;
}

interface EgoLike extends PowersLike {
  name: string;
  possItems: ReadonlySet<number>;
  flagsOff: FlagSetLike;
  curses: number[] | null;
}

interface CursedObject {
  kind: KindLike;
  artifact: unknown;
  ego: unknown;
  curses: unknown;
  flags: FlagSetLike;
  modifiers: number[];
  elInfo: ElementInfoLike[];
  slays: boolean[] | null;
  brands: boolean[] | null;
  activation: unknown;
  knownActivation?: unknown;
  effect: unknown;
  time: RandomValueLike;
  toH: number;
  toD: number;
  toA: number;
  ac: number;
  dd: number;
  ds: number;
}

interface CurseRng {
  randint0(n: number): number;
  randint1(n: number): number;
  randcalc(v: RandomValueLike, level: number, aspect: "average"): number;
}

interface CurseState {
  rng: CurseRng;
  gear: { store: ReadonlyMap<number, CursedObject> };
  actor: {
    player: {
      body: { slots: readonly { type: string }[] };
      equipment: readonly (number | null)[];
      upkeep: { notice: number };
    };
  };
  updateBonuses?(): void;
}

interface CurseRegistry {
  egos: readonly (EgoLike | null)[];
  curses: readonly unknown[];
  slays: readonly unknown[];
  brands: readonly unknown[];
}

interface CurseEnv {
  state: CurseState;
  item?: { reg?: CurseRegistry };
}

export interface CurseScrollCore {
  readonly PN: { readonly COMBINE: number };
  readonly ODESC: { readonly BASE: number };
  describeObject(state: CurseState, obj: CursedObject, mode: number): string;
  copySlays(dest: boolean[] | null, source: boolean[] | null, slays: readonly unknown[]): boolean[] | null;
  copyBrands(dest: boolean[] | null, source: boolean[] | null, brands: readonly unknown[]): boolean[] | null;
  copyCurses(rng: CurseRng, obj: CursedObject, source: number[] | null, curses: readonly unknown[]): void;
}

/**
 * Strip an object back to its kind's own powers (object_prep's copies, without
 * its RNG) and apply `ego`'s. The kind's modifiers are read at their average,
 * which draws nothing and is exact for every fixed kind value.
 */
export function resetToEgo(core: CurseScrollCore, rng: CurseRng, reg: CurseRegistry, obj: CursedObject, ego: EgoLike): void {
  const kind = obj.kind;
  obj.artifact = null;
  obj.ego = ego;
  obj.flags.copy(kind.flags);
  obj.flags.union(ego.flags);
  obj.flags.diff(ego.flagsOff);
  for (let i = 0; i < obj.modifiers.length; i++) {
    const own = kind.modifiers[i];
    obj.modifiers[i] = own ? rng.randcalc(own, 0, "average") : 0;
  }
  for (let i = 0; i < obj.elInfo.length; i++) {
    const dst = obj.elInfo[i]!;
    dst.resLevel = Math.max(kind.elInfo[i]?.resLevel ?? 0, ego.elInfo[i]?.resLevel ?? 0);
    dst.flags = (kind.elInfo[i]?.flags ?? 0) | (kind.base.elInfo[i]?.flags ?? 0) | (ego.elInfo[i]?.flags ?? 0);
  }
  obj.slays = core.copySlays(core.copySlays(null, kind.slays, reg.slays), ego.slays, reg.slays);
  obj.brands = core.copyBrands(core.copyBrands(null, kind.brands, reg.brands), ego.brands, reg.brands);
  obj.activation = null;
  obj.knownActivation = undefined;
  obj.effect = kind.effect;
  obj.time = { ...kind.time };
  obj.curses = null;
  core.copyCurses(rng, obj, ego.curses, reg.curses);
}

export function curseScrollHandler(core: CurseScrollCore, slotType: "WEAPON" | "BODY_ARMOR"): EffectHandler {
  return (ctx: EffectHandlerContext) => {
    const env = ctx.env.game as CurseEnv | undefined;
    if (!env) return true;
    const { state } = env;
    const player = state.actor.player;
    const slot = player.body.slots.findIndex((s) => s.type === slotType);
    const handle = player.equipment[slot];
    const obj = handle ? state.gear.store.get(handle) : undefined;
    /* 3.0.9's curse_weapon returned FALSE here and the scroll was still used
     * up, unidentified (effects.c, EF_CURSE_WEAPON). */
    if (!obj) return true;
    const reg = env.item?.reg;
    if (!reg) throw new Error("Curse scroll requires the bound object registry");
    const name = slotType === "WEAPON" ? "(Shattered)" : "(Blasted)";
    const ego = reg.egos.find((e) => e?.name === name && e.possItems.has(obj.kind.kidx));
    if (!ego) throw new Error(`Missing curse scroll ego: ${name}`);

    const description = core.describeObject(state, obj, core.ODESC.BASE);
    const noun = slotType === "WEAPON" ? "weapon" : "armour";
    if (obj.artifact && state.rng.randint0(100) < 50) {
      ctx.env.messages?.msg(`A terrible black aura tries to surround your ${noun}, but your ${description} resists the effects!`);
    } else {
      ctx.env.messages?.msg(`A terrible black aura blasts your ${description}!`);
      resetToEgo(core, state.rng, reg, obj, ego);
      obj.toH = slotType === "WEAPON" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.toD = slotType === "WEAPON" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.toA = slotType === "BODY_ARMOR" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.ac = 0;
      obj.dd = 0;
      obj.ds = 0;
      player.upkeep.notice |= core.PN.COMBINE;
      state.updateBonuses?.();
    }
    ctx.ident = true;
    return true;
  };
}

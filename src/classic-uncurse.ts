/**
 * Classic uncursing (section classic-uncurse): the Angband 4.0 behaviour of the
 * Remove Curse and enchant effects, restored as handlers for this port's effect
 * registry.
 *
 * WHY THIS IS A HANDLER AND NOT A PATCH. 4.2.6 replaced the two effects with
 * one: Remove Curse targets a single item and a single curse, and a failed
 * attempt can leave the item fragile. 4.0.5's remove_curse_aux instead walked
 * every worn item, lifted every eligible curse, and never damaged anything
 * (effects.c L720-747), and its *Remove Curse* form also lifted heavy curses.
 * There is no data field that expresses "walk the equipment"; the effect
 * registry is the seam, so this file implements the 4.0 bodies and plugin.ts
 * installs them while the section is on.
 *
 * WHAT IS RESTORED, AND HOW THE TIERS MAP. 4.0 encoded a curse's severity as an
 * object flag (OF_LIGHT_CURSE / OF_HEAVY_CURSE / OF_PERMA_CURSE). 4.2 has no
 * such flag: a curse record carries a runtime power, so the tiers are mapped
 * onto it - light at 40 or below, heavy from 41 to 99, permanent at 100. 4.0
 * judged a whole item by its worst tier, so an item is lifted whole or not at
 * all: the light form skips an item with any heavy curse, and neither form
 * touches an item with a permanent one. Which form runs belongs to the source,
 * as it did in 4.0, not to a roll of the source's strength (see isHeavySource).
 *
 * WHY THE ENCHANT HANDLER REBUILDS THE EFFECT. The registry facade registers a
 * handler for an effect code but does not hand back the handler installed for
 * that code, so a mod cannot call through to core's own EF_ENCHANT. 4.0 also
 * rolled its curse break inside the attempt loop (effects.c L1696-1800), which
 * core's enchant() has no seam for, so classicEnchant copies that loop. Its
 * scoring rolls are core's own, in core's order; the curse roll sits after each
 * score roll, as 4.0's enchant2 placed it, and never draws for an item with no
 * breakable curse.
 */

import type { EffectHandler, EffectHandlerContext } from "@rpgm-tools/neo-angband-core";

/** A light curse: Remove Curse can lift it. 4.0's OF_LIGHT_CURSE tier. */
export const LIGHT_MAX_POWER = 40;
/** A permanent curse: never lifted. 4.0's OF_PERMA_CURSE tier. */
export const PERMA_POWER = 100;
/** enchant_curse's chance out of 100 to break a curse on an ordinary item. */
export const ENCHANT_CURSE_CHANCE = 25;
/**
 * The dice size that marks *Remove Curse*. Every 4.0 heavy source this can meet
 * rolls d50 (the *Remove Curse* scroll and activation, the Dispel Curse spell)
 * and every light one rolls less (Remove Curse at d20, 4.2's staff at d30).
 */
export const HEAVY_MIN_SIDES = 50;

/** The RNG calls the classic handlers make, structurally. */
export interface RngLike {
  randint0(n: number): number;
}

/** enchant_score also needs randint1. */
export interface EnchantRngLike extends RngLike {
  randint1(n: number): number;
}

/** One curse on an object: power 0 means "not present". */
export interface CurseDataLike {
  power: number;
  timeout: number;
}

/** The object slice the classic handlers touch. */
export interface UncurseObjectLike {
  number: number;
  weight: number;
  curses: (CurseDataLike | null | undefined)[] | null;
  artifact?: unknown;
}

/** The object slice enchanting also reads and raises. */
export interface EnchantObjectLike extends UncurseObjectLike {
  tval: number;
  toH: number;
  toD: number;
  toA: number;
}

/** A bound curse, by name only. */
export interface CurseLike {
  name: string;
}

/** A random value, as core's RandomValue is read by randcalc. */
export interface RandomValueLike {
  base: number;
  dice: number;
  sides: number;
}

/** get_item request, opaque to this module (core builds and reads it). */
export type ItemRequestLike = unknown;

/** The live game state slice the classic handlers read, structurally. */
interface ClassicStateLike {
  rng: EnchantRngLike & { randcalc(value: RandomValueLike, depth: number, mode: string): number };
  chunk: { depth: number };
  gear: { store: ReadonlyMap<number, UncurseObjectLike> };
  actor: {
    player: {
      equipment: readonly (number | null)[];
      upkeep: { totalWeight: number; notice: number };
      timed?: readonly number[];
    };
  };
  updateBonuses?: () => void;
}

/** The game-layer effect environment, structurally (core's GameEffectEnv). */
interface ClassicGameEnvLike {
  state: ClassicStateLike;
  item?: {
    getItem?: (req: ItemRequestLike) => UncurseObjectLike | null;
    /** The bound object registry, whose `curses` table names each curse. */
    reg?: { curses?: readonly (CurseLike | null)[] };
  };
}

/** The core helpers the classic handlers call through. */
export interface ClassicCore {
  removeObjectCurse(
    obj: UncurseObjectLike,
    pick: number,
    message?: boolean,
    env?: { curses: readonly (CurseLike | null)[]; msg: (text: string) => void },
  ): boolean;
  objectWeightOne(
    obj: { weight: number; curses: (CurseDataLike | null | undefined)[] | null },
    curses?: readonly (CurseLike | null)[] | null,
  ): number;
  requestForEffect(code: number, subtype: number, state: ClassicStateLike): ItemRequestLike | null;
  tvalIsAmmo(tval: number): boolean;
  describeObject(state: ClassicStateLike, obj: UncurseObjectLike, mode: number): string;
  objectIsCarried(gear: ClassicStateLike["gear"], obj: UncurseObjectLike): boolean;
  readonly ENCH_TOBOTH: number;
  readonly ENCH_TOHIT: number;
  readonly ENCH_TODAM: number;
  readonly ENCH_TOAC: number;
  readonly ODESC: { readonly BASE: number };
  readonly PN: { readonly COMBINE: number };
  readonly EF: { readonly ENCHANT: number };
  readonly TMD: { readonly BLIND: number };
}

/** The game env off an effect context, or null for a worldless interpreter. */
function gameEnvOf(ctx: EffectHandlerContext): ClassicGameEnvLike | null {
  return (ctx.env.game as ClassicGameEnvLike | undefined) ?? null;
}

/** msg() over the effect context's optional message sink. */
function say(ctx: EffectHandlerContext, text: string): void {
  ctx.env.messages?.msg(text);
}

/** The strongest curse on this object, or 0 when it has none. */
function worstCurse(obj: UncurseObjectLike): number {
  let worst = 0;
  const list = obj.curses ?? [];
  for (let i = 1; i < list.length; i++) worst = Math.max(worst, list[i]?.power ?? 0);
  return worst;
}

/**
 * enchant_curse's own gate (effects.c L1719-1721): the object is cursed and
 * carries no permanent curse.
 */
export function hasBreakableCurse(obj: UncurseObjectLike): boolean {
  const worst = worstCurse(obj);
  return worst > 0 && worst < PERMA_POWER;
}

/**
 * enchant_curse (effects.c L1717-1737): whether an enchant attempt breaks a
 * curse. Artifacts resist half the time first, then the item is uncursed one
 * time in four; both checks consume RNG, in that order.
 */
export function enchantCurseBreak(rng: RngLike, isArtifact: boolean): boolean {
  if (isArtifact && rng.randint0(100) < 50) return false;
  if (rng.randint0(100) >= ENCHANT_CURSE_CHANCE) return false;
  return true;
}

/**
 * Whether an effect's dice are those of a *Remove Curse* source. Reading the
 * dice rather than the rolled value keeps each source on one form, as 4.0 did.
 */
export function isHeavySource(value: RandomValueLike): boolean {
  return value.sides >= HEAVY_MIN_SIDES;
}

/**
 * remove_curse_aux (effects.c L720-747) for ONE object: an item with a
 * permanent curse, or a heavy one when `heavy` is false, is skipped whole;
 * otherwise every curse on it is lifted (uncurse_object, L703). Returns how many
 * curses were lifted. The object is never made fragile. The caller owns the
 * weight bookkeeping, so the delta is reported through `onWeightDelta`.
 */
export function uncurseOne(
  core: ClassicCore,
  curses: readonly (CurseLike | null)[],
  obj: UncurseObjectLike,
  heavy: boolean,
  onWeightDelta?: (delta: number) => void,
  msg?: (text: string) => void,
): number {
  const worst = worstCurse(obj);
  if (worst <= 0 || worst >= PERMA_POWER) return 0;
  if (worst > LIGHT_MAX_POWER && !heavy) return 0;
  const oldWeight = obj.number * core.objectWeightOne(obj, curses);
  let count = 0;
  for (let i = 1; i < curses.length; i++) {
    /* removeObjectCurse drops the whole array once the last curse goes. */
    if (!obj.curses) break;
    if (!(obj.curses[i]?.power ?? 0)) continue;
    const env = msg ? { curses, msg } : undefined;
    if (core.removeObjectCurse(obj, i, msg !== undefined, env)) count++;
  }
  if (count > 0) {
    const newWeight = obj.number * core.objectWeightOne(obj, curses);
    onWeightDelta?.(newWeight - oldWeight);
  }
  return count;
}

/** The curse table the live game is running, or null when it is not wired. */
function cursesOf(env: ClassicGameEnvLike): readonly (CurseLike | null)[] | null {
  return env.item?.reg?.curses ?? null;
}

/**
 * The classic EF_REMOVE_CURSE handler: effect_handler_REMOVE_CURSE and
 * effect_handler_REMOVE_ALL_CURSE (effects.c L753-778) as one handler, the form
 * chosen by the source's dice. The light form identifies and speaks only when
 * something was lifted; the strong form always identifies and never speaks.
 * 4.0's uncurse_object said nothing per curse, so neither does this.
 */
export function classicRemoveCurseHandler(core: ClassicCore): EffectHandler {
  return (ctx) => {
    const env = gameEnvOf(ctx);
    if (!env) return true;
    const { state } = env;
    const curses = cursesOf(env);
    if (!curses) return true;

    const heavy = isHeavySource(ctx.value);
    const player = state.actor.player;
    let items = 0;
    let weightDelta = 0;
    for (const handle of player.equipment) {
      if (!handle) continue;
      const obj = state.gear.store.get(handle);
      if (!obj) continue;
      if (uncurseOne(core, curses, obj, heavy, (d) => (weightDelta += d)) > 0) items++;
    }

    if (items > 0) {
      player.upkeep.totalWeight += weightDelta;
      player.upkeep.notice |= core.PN.COMBINE;
      state.updateBonuses?.();
    }
    if (heavy) {
      ctx.ident = true;
      return true;
    }
    if (items > 0) {
      const blind = (player.timed?.[core.TMD.BLIND] ?? 0) > 0;
      say(ctx, blind ? "You feel as if someone is watching over you." : "The air around your body glows blue for a moment...");
      ctx.ident = true;
    }
    return true;
  };
}

/** enchant_table (effects.c L1683), the same table core's enchant reads. */
const ENCHANT_TABLE: readonly number[] = [
  0, 10, 20, 40, 80, 160, 280, 400, 550, 700, 800, 900, 950, 970, 990, 1000,
];

/** enchant_score (effects.c L1696-1714), drawing exactly as core's copy does. */
function enchantScore(rng: EnchantRngLike, score: number, isArtifact: boolean): number {
  if (isArtifact && rng.randint0(100) < 50) return score;
  const chance = score < 0 ? 0 : score > 15 ? 1000 : ENCHANT_TABLE[score]!;
  if (rng.randint1(1000) <= chance) return score;
  return score + 1;
}

/**
 * enchant (effects.c L1765-1800) with 4.0's enchant2: after each score roll,
 * an item with a breakable curse rolls enchant_curse, and a break lifts every
 * curse on it through `breakCurse`. Returns true when a bonus rose or a curse
 * broke. For an item with no breakable curse the draws are core's own.
 */
export function classicEnchant(
  core: ClassicCore,
  rng: EnchantRngLike,
  obj: EnchantObjectLike,
  n: number,
  eflag: number,
  breakCurse: (obj: EnchantObjectLike) => void,
): boolean {
  const isArtifact = !!obj.artifact;
  let res = false;
  let prob = obj.number * 100;
  if (core.tvalIsAmmo(obj.tval)) prob = Math.trunc(prob / 20);

  const enchant2 = (key: "toH" | "toD" | "toA"): boolean => {
    let result = false;
    const next = enchantScore(rng, obj[key], isArtifact);
    if (next !== obj[key]) {
      obj[key] = next;
      result = true;
    }
    if (hasBreakableCurse(obj) && enchantCurseBreak(rng, isArtifact)) {
      breakCurse(obj);
      result = true;
    }
    return result;
  };

  for (let i = 0; i < n; i++) {
    if (prob > 100 && rng.randint0(prob) >= 100) continue;
    if (eflag & core.ENCH_TOHIT && enchant2("toH")) res = true;
    if (eflag & core.ENCH_TODAM && enchant2("toD")) res = true;
    if (eflag & core.ENCH_TOAC && enchant2("toA")) res = true;
  }
  return res;
}

/**
 * The classic EF_ENCHANT handler: core's own selection and messages around
 * classicEnchant. As in 4.0 and 4.2, a chosen item uses the scroll up whether
 * or not anything changed.
 */
export function enchantCurseBreakHandler(core: ClassicCore): EffectHandler {
  return (ctx) => {
    const env = gameEnvOf(ctx);
    if (!env) return true;
    const { state } = env;
    const value = state.rng.randcalc(
      ctx.value as unknown as RandomValueLike,
      state.chunk.depth,
      "randomise",
    );
    let used = false;
    ctx.ident = true;
    const player = state.actor.player;

    const breakCurse = (obj: EnchantObjectLike): void => {
      say(ctx, "The curse is broken!");
      const curses = cursesOf(env);
      if (curses) uncurseOne(core, curses, obj, true, (d) => (player.upkeep.totalWeight += d));
    };

    const enchant = (obj: EnchantObjectLike, n: number, eflag: number): boolean => {
      if (!classicEnchant(core, state.rng, obj, n, eflag, breakCurse)) return false;
      state.updateBonuses?.();
      player.upkeep.notice |= core.PN.COMBINE;
      return true;
    };

    const spell = (numHit: number, numDam: number, numAc: number): boolean => {
      const request = core.requestForEffect(core.EF.ENCHANT, ctx.subtype, state);
      const obj = env.item?.getItem?.(request) as EnchantObjectLike | null | undefined;
      if (!obj) return false;

      const name = core.describeObject(state, obj, core.ODESC.BASE);
      const carried = core.objectIsCarried(state.gear, obj);
      say(ctx, `${carried ? "Your" : "The"} ${name} glow${obj.number > 1 ? "" : "s"} brightly!`);

      let okay = false;
      if (numDam && enchant(obj, numHit, core.ENCH_TOBOTH)) okay = true;
      else if (enchant(obj, numHit, core.ENCH_TOHIT)) okay = true;
      else if (enchant(obj, numDam, core.ENCH_TODAM)) okay = true;
      if (enchant(obj, numAc, core.ENCH_TOAC)) okay = true;

      if (!okay) say(ctx, "The enchantment failed.");
      return true;
    };

    if ((ctx.subtype & core.ENCH_TOBOTH) === core.ENCH_TOBOTH) {
      if (spell(value, value, 0)) used = true;
    } else if (ctx.subtype & core.ENCH_TOHIT) {
      if (spell(value, 0, 0)) used = true;
    } else if (ctx.subtype & core.ENCH_TODAM) {
      if (spell(0, value, 0)) used = true;
    }
    if (ctx.subtype & core.ENCH_TOAC) {
      if (spell(0, 0, value)) used = true;
    }

    return used;
  };
}

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
 * onto it - light at 40 or below, heavy from 41 to 99, permanent at 100. Remove
 * Curse's own strength tops out at 40 and *Remove Curse*'s at 100, so the light
 * form clears the light band and the strong form clears the heavy band, while
 * the permanent band never comes off. The same bands are what the restored
 * cursed items in object.json carry.
 *
 * WHY THE ENCHANT HANDLER REBUILDS THE EFFECT. The registry facade registers a
 * handler for an effect code but does not hand back the handler installed for
 * that code, so a mod cannot call through to core's own EF_ENCHANT. The handler
 * below therefore re-runs the 4.2 selection and scoring through core's exported
 * helpers (requestForEffect, enchant, describeObject), then adds 4.0's curse
 * break (enchant_curse, effects.c L1717-1737). The scoring itself stays core's;
 * only the curse break is new.
 */

import type { EffectHandler, EffectHandlerContext } from "@rpgm-tools/neo-angband-core";

/** A light curse: Remove Curse can lift it. 4.0's OF_LIGHT_CURSE tier. */
export const LIGHT_MAX_POWER = 40;
/** A permanent curse: never lifted. 4.0's OF_PERMA_CURSE tier. */
export const PERMA_POWER = 100;
/** enchant_curse's chance out of 100 to break a curse on an ordinary item. */
export const ENCHANT_CURSE_CHANCE = 25;

/** The one RNG call enchant_curse needs, structurally. */
export interface RngLike {
  randint0(n: number): number;
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

/** A bound curse, by name only. */
export interface CurseLike {
  name: string;
}

/** A random value, as core's RandomValue is read by randcalc. */
interface RandomValueLike {
  base: number;
  dice: number;
  sides: number;
}

/** get_item request, opaque to this module (core builds and reads it). */
export type ItemRequestLike = unknown;

/** The live game state slice the classic handlers read, structurally. */
interface ClassicStateLike {
  rng: RngLike & { randcalc(value: RandomValueLike, depth: number, mode: string): number };
  chunk: { depth: number };
  gear: { store: ReadonlyMap<number, UncurseObjectLike> };
  actor: {
    player: {
      equipment: readonly (number | null)[];
      upkeep: { totalWeight: number; notice: number };
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
  effectCalculateValue(ctx: EffectHandlerContext, useBoost: boolean): number;
  requestForEffect(code: number, subtype: number, state: ClassicStateLike): ItemRequestLike | null;
  enchant(state: ClassicStateLike, obj: UncurseObjectLike, n: number, eflag: number): boolean;
  describeObject(state: ClassicStateLike, obj: UncurseObjectLike, mode: number): string;
  objectIsCarried(gear: ClassicStateLike["gear"], obj: UncurseObjectLike): boolean;
  readonly ENCH_TOBOTH: number;
  readonly ENCH_TOHIT: number;
  readonly ENCH_TODAM: number;
  readonly ENCH_TOAC: number;
  readonly ODESC: { readonly BASE: number };
  readonly PN: { readonly COMBINE: number };
  readonly EF: { readonly ENCHANT: number };
}

/** The game env off an effect context, or null for a worldless interpreter. */
function gameEnvOf(ctx: EffectHandlerContext): ClassicGameEnvLike | null {
  return (ctx.env.game as ClassicGameEnvLike | undefined) ?? null;
}

/** msg() over the effect context's optional message sink. */
function say(ctx: EffectHandlerContext, text: string): void {
  ctx.env.messages?.msg(text);
}

/**
 * Whether this object carries a curse that is not permanent - enchant_curse's
 * own gate (`cursed_p` and not OF_PERMA_CURSE).
 */
export function hasBreakableCurse(obj: UncurseObjectLike): boolean {
  if (!obj.curses) return false;
  for (let i = 1; i < obj.curses.length; i++) {
    const power = obj.curses[i]?.power ?? 0;
    if (power > 0 && power < PERMA_POWER) return true;
  }
  return false;
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
 * remove_curse_aux (effects.c L720-747) for ONE object: lift every non-permanent
 * curse, the heavy band only when `heavy`, and return how many were lifted. The
 * object is never made fragile. The caller owns the weight bookkeeping, so the
 * delta is reported through `onWeightDelta`.
 */
export function uncurseOne(
  core: ClassicCore,
  curses: readonly (CurseLike | null)[],
  obj: UncurseObjectLike,
  heavy: boolean,
  onWeightDelta?: (delta: number) => void,
  msg?: (text: string) => void,
): number {
  if (!obj.curses) return 0;
  const oldWeight = obj.number * core.objectWeightOne(obj, curses);
  let count = 0;
  for (let i = 1; i < curses.length; i++) {
    const power = obj.curses[i]?.power ?? 0;
    if (power <= 0 || power >= PERMA_POWER) continue;
    if (power > LIGHT_MAX_POWER && !heavy) continue;
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
 * The classic EF_REMOVE_CURSE handler: walk every worn item and lift its
 * eligible curses. The strength core computes from the effect decides whether
 * the heavy band is reachable, exactly as the two 4.0 forms differ only by that
 * flag. `ctx.ident` is set, as both 4.0 forms do.
 */
export function classicRemoveCurseHandler(core: ClassicCore): EffectHandler {
  return (ctx) => {
    const env = gameEnvOf(ctx);
    if (!env) return true;
    const { state } = env;
    const curses = cursesOf(env);
    if (!curses) return true;

    const heavy = core.effectCalculateValue(ctx, false) > LIGHT_MAX_POWER;
    const msg = (text: string): void => say(ctx, text);
    const player = state.actor.player;
    let removed = 0;
    let weightDelta = 0;
    for (const handle of player.equipment) {
      if (!handle) continue;
      const obj = state.gear.store.get(handle);
      if (!obj) continue;
      removed += uncurseOne(core, curses, obj, heavy, (d) => (weightDelta += d), msg);
    }

    ctx.ident = true;
    if (removed === 0) return true;

    player.upkeep.totalWeight += weightDelta;
    player.upkeep.notice |= core.PN.COMBINE;
    state.updateBonuses?.();
    /* 4.0's own line for the light form (effects.c L780). The strong form says
     * nothing, so neither does this one when the heavy band was in reach. */
    if (!heavy) say(ctx, "The air around your body glows blue for a moment...");
    return true;
  };
}

/**
 * The classic EF_ENCHANT handler: core's own selection and scoring, plus 4.0's
 * curse break after each enchant of a chosen item.
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

    const spell = (numHit: number, numDam: number, numAc: number): boolean => {
      const request = core.requestForEffect(core.EF.ENCHANT, ctx.subtype, state);
      const obj = env.item?.getItem?.(request);
      if (!obj) return false;

      const name = core.describeObject(state, obj, core.ODESC.BASE);
      const carried = core.objectIsCarried(state.gear, obj);
      say(ctx, `${carried ? "Your" : "The"} ${name} glow${obj.number > 1 ? "" : "s"} brightly!`);

      let okay = false;
      if (numDam && core.enchant(state, obj, numHit, core.ENCH_TOBOTH)) okay = true;
      else if (core.enchant(state, obj, numHit, core.ENCH_TOHIT)) okay = true;
      else if (core.enchant(state, obj, numDam, core.ENCH_TODAM)) okay = true;
      if (core.enchant(state, obj, numAc, core.ENCH_TOAC)) okay = true;

      /* enchant2's parallel curse attempt (effects.c L1740-1746): every enchant
       * attempt also tries to break a curse, whether or not a bonus rose. */
      if (hasBreakableCurse(obj) && enchantCurseBreak(state.rng, !!obj.artifact)) {
        const curses = cursesOf(env);
        if (curses) {
          uncurseOne(
            core,
            curses,
            obj,
            true,
            (d) => (state.actor.player.upkeep.totalWeight += d),
            (t) => say(ctx, t),
          );
          say(ctx, "The curse is broken!");
          state.actor.player.upkeep.notice |= core.PN.COMBINE;
          state.updateBonuses?.();
          okay = true;
        }
      }
      return okay;
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

    if (!used) say(ctx, "The enchantment failed.");
    return used;
  };
}

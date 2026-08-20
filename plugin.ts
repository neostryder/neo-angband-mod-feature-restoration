/**
 * The `feature-restoration` mod's behaviour, as the mod's OWN code.
 *
 * Every other restored feature in this mod is content-only (see class.json):
 * restoring a spell that already exists elsewhere in the game is a data patch,
 * nothing more. Store discounts are the one restoration that needs behaviour
 * instead, because Angband 4.2.6's core has no discount concept left to patch
 * data onto - `obj->discount` and the roll that set it were both dropped from
 * the game before this port's 4.2.6 baseline (confirmed: no `discount` field
 * anywhere in the port's `object.h` equivalent). There is therefore no
 * `reference/` citation for this feature the way there is for a restored
 * spell; the mechanism below is transcribed from the real upstream Angband
 * v3.0.0 `store.c` (`mass_produce`), fetched from the authoritative
 * angband/angband history, and documented with the exact numbers in this
 * mod's README rather than invented.
 *
 * ------------------------------------------------------------------
 * ENTRY POINT CONTRACT - one shape, for every mod and every front end
 * ------------------------------------------------------------------
 *
 * A mod that runs code default-exports a ModPlugin:
 *
 *   export default { api: 1, hooks(ctx) { ... }, register(host, ctx) { ... } }
 *
 * `ctx.flags` is the host's RESOLVED per-patch choice map: every `rules[].flag`
 * this mod declares in manifest.json, mapped to the player's toggle choice
 * (manifest `default` unless they changed it). `register(host, ctx)` runs once,
 * with the live game built, and is where a capability-gated registry (here,
 * `registry:store`) is reached - see docs/modding/PLUGINS.md in the game's repo.
 *
 * This file imports @rpgm-tools/neo-angband-core for TYPES ONLY. The same source is
 * built to the plugin.js that ships in this repository; a module fetched from a
 * mod folder cannot resolve a bare specifier, nor should it - a bundled copy of
 * core would give this plugin its own registries while the game ran on another
 * set, a failure with no error message anywhere.
 */

/**
 * The RNG the host hands a discount roll, structurally - same reason as
 * everywhere else in this file: the mod names what it touches instead of
 * importing a host type.
 */
interface RngLike {
  /** True with probability 1/n (host's Rng.oneIn). */
  oneIn(n: number): boolean;
}

/** DiscountRollContext, structurally (core's store/store.ts). */
interface DiscountRollContext {
  rng: RngLike;
  /** object_value_real(obj, 1) - the cost band the roll qualifies against. */
  cost: number;
}

/** The one registry facade this plugin reaches, structurally. */
interface HostLike {
  readonly stores: {
    setDiscountRoll(handler: (ctx: DiscountRollContext) => number): void;
  };
}

interface HookCtx {
  readonly flags: Readonly<Record<string, boolean>>;
  /** Emit a diagnostic line; the host decides where it goes. */
  readonly log?: (msg: string) => void;
}

/**
 * mass_produce's discount arm (Angband v3.0.0, store.c), transcribed exactly:
 * successive independent rolls, each only reached if the previous one missed,
 * cheapest tier first. Items under 5 gold never discount. See this mod's
 * README for the fetched source and the citation. Exported (rather than kept
 * module-private) so plugin.test.ts can assert the exact odds against a
 * recording Rng double, not just the tier outputs.
 */
export function discountRoll(ctx: DiscountRollContext): number {
  const { rng, cost } = ctx;
  if (cost < 5) return 0;
  if (rng.oneIn(25)) return 10;
  if (rng.oneIn(50)) return 25;
  if (rng.oneIn(150)) return 50;
  if (rng.oneIn(300)) return 75;
  if (rng.oneIn(500)) return 90;
  return 0;
}

export default {
  api: 1,

  hooks(_ctx: HookCtx): Record<string, never> {
    /* No ModHooks entry needed - the discount roll is a registry.js seam
     * (register, below), not a per-turn hook. */
    return {};
  },

  /**
   * `registry:store` capability. Installed only while the player's own
   * "Restore store discounts" toggle is on - a disabled rule is never called
   * at all, so a store that never discounts is core's own faithful path, not
   * a branch this mod chose to skip.
   */
  register(host: HostLike, ctx: HookCtx): void {
    if (ctx.flags["feature-restoration.discounts"] !== true) return;
    host.stores.setDiscountRoll(discountRoll);
    ctx.log?.("feature-restoration: store discount roll installed");
  },
};

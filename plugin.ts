/**
 * Feature Restoration (feature-restoration)'s behaviour, as the mod's OWN code.
 *
 * Most restored features in this mod are content-only (see class.json,
 * object.json): restoring a spell that already exists elsewhere in the game, or
 * an item with no behaviour of its own, is a data patch, nothing more. Store
 * discounts and door spiking are the two restorations that need behaviour
 * instead.
 *
 * Store discounts: Angband 4.2.6's core has no discount concept left to patch
 * data onto - `obj->discount` and the roll that set it were both dropped from
 * the game before this port's 4.2.6 baseline (confirmed: no `discount` field
 * anywhere in the port's `object.h` equivalent). There is therefore no
 * `reference/` citation for this feature the way there is for a restored
 * spell; the mechanism below is transcribed from the real upstream Angband
 * 3.0.6 `store.c` (`mass_produce`) - the last official release to carry it,
 * fetched from the authoritative angband/angband history, and documented
 * with the exact numbers and the release history in this mod's README
 * rather than invented.
 *
 * Door spiking: the "spike a door" command and the object it consumes
 * (`TV_SPIKE`, `do_cmd_spike`) were both removed from Angband before this
 * port's 4.2.6 baseline - `reference/src/cmd-cave.c` mentions a "jammed" door
 * only as a condition opening has to defeat, never as something a command
 * sets. object.json's `spike-doors` section restores the item; `spikeDoor`
 * below restores the command, gated on the same section's flag. See this
 * mod's README, "Restore door spiking", for the upstream mechanic (Angband
 * 3.4.1, the last official release to carry it) and exactly how it maps onto
 * this port's continuous door-lock-power dial instead of upstream's separate
 * locked/jammed encoding.
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
 * and every `sections[].flag` this mod declares in manifest.json, mapped to the
 * player's toggle choice (manifest `default` unless they changed it).
 * `register(host, ctx)` runs once, with the live game built, and is where a
 * capability-gated registry (here, `registry:store` and `registry:command`) is
 * reached - see docs/modding/PLUGINS.md in the game's repo.
 *
 * `ctx.core` is the live core namespace - the same module instance the game
 * runs on, not a bundled copy - so `spikeDoor` below reaches
 * `playerConfuseDir`, `gearObjectForUse` and `DDGRID` through it rather than
 * reimplementing them: a mod that duplicated confusion-redirect or item-stack
 * arithmetic by hand would be a second copy of behaviour core already owns,
 * and one this file has no way of keeping in sync. This file otherwise imports
 * @rpgm-tools/neo-angband-core for TYPES ONLY, never as a bare specifier: a
 * module fetched from a mod folder cannot resolve one, nor should it - a
 * bundled copy of core would give this plugin its own registries while the
 * game ran on another set, a failure with no error message anywhere.
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

/** A grid on the level map, structurally (core's loc.ts Loc). */
interface Loc {
  x: number;
  y: number;
}

/** A live player command, structurally (core's game/context.ts PlayerCommand). */
interface PlayerCommandLike {
  dir?: number;
  [key: string]: unknown;
}

/** The one pack object this plugin cares to look at: its kind's own name. */
interface SpikeGearObject {
  kind: { name: string };
  number: number;
}

/**
 * The slice of a live GameState this plugin touches, structurally - same
 * reason as everywhere else in this file: the mod names what it needs rather
 * than importing a host type.
 */
interface GameStateLike {
  readonly actor: { readonly grid: Loc; readonly player: unknown };
  readonly chunk: {
    isClosedDoor(grid: Loc): boolean;
    /** > 0 when a monster occupies the grid (core's chunk.mon). */
    mon(grid: Loc): number;
  };
  readonly gear: {
    /** Non-equipped handles, master-gear order (core's Gear.pack). */
    readonly pack: readonly number[];
    readonly store: ReadonlyMap<number, SpikeGearObject>;
  };
  readonly z: { readonly moveEnergy: number };
  /** Emit a message; the host decides where it goes. */
  msg?(text: string): void;
  /** square_door_power (game/trap.ts): a closed door's lock strength. */
  doorLockPower?(grid: Loc): number;
  /** square_set_door_lock (game/trap.ts): set a closed door's lock strength. */
  setDoorLock?(grid: Loc, power: number): void;
}

/**
 * The slice of `ctx.core` - the live core namespace, not a bundled copy - this
 * plugin calls directly, so confusion-redirect and item-stack consumption stay
 * byte-identical to core's own rather than a second, hand-written copy of
 * either.
 */
interface CoreLike {
  /** ddgrid: keypad direction (1-9, 5 is "no direction") -> grid offset. */
  readonly DDGRID: readonly Loc[];
  /**
   * player_confuse_dir (player-util.c): redirects `dir` while the player is
   * confused, drawing the RNG and emitting core's own message. Returns `dir`
   * unchanged while not confused - drawing nothing.
   */
  playerConfuseDir(state: GameStateLike, dir: number): number;
  /**
   * gear_object_for_use (obj-gear.c): splits `amt` off the pack stack at
   * `handle` (or excises the whole stack), for a caller that is about to
   * consume it. The returned object is deliberately left unused here, exactly
   * as core's own consuming callers (obj-cmd.ts, world.ts) leave it - letting
   * it fall out of scope IS the destroy.
   */
  gearObjectForUse(
    gear: GameStateLike["gear"],
    player: unknown,
    handle: number,
    amt: number,
  ): { obj: unknown; noneLeft: boolean };
}

/** The one registry facade this plugin reaches, structurally. */
interface HostLike {
  readonly stores: {
    setDiscountRoll(handler: (ctx: DiscountRollContext) => number): void;
  };
  readonly commands: {
    /** Register (or replace) the action a player command code runs. */
    register(code: string, action: (state: GameStateLike, cmd: PlayerCommandLike) => number): void;
    /** Name the command, for the "Really <verb> ...?" inscription confirm. */
    setVerb(code: string, verb: string): void;
  };
}

interface HookCtx {
  readonly flags: Readonly<Record<string, boolean>>;
  /** The live core namespace; present on register()'s ctx, not on hooks()'s. */
  readonly core?: CoreLike;
  /** Emit a diagnostic line; the host decides where it goes. */
  readonly log?: (msg: string) => void;
}

/**
 * mass_produce's discount arm (Angband 3.0.6, store.c), transcribed exactly:
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

/**
 * The `object.json` `spike-doors` record's own `name` field, markup and all
 * (`kind.name` carries a bound kind's name exactly as its content record
 * spelled it - see core's obj/bind.ts `bindKinds`, `name: rec.name`). The two
 * files are kept in sync by hand, the same way this codebase's own
 * `lookupTrap` matches a trap kind by its record text rather than a numeric
 * id - there is no third place to derive the string from.
 */
export const IRON_SPIKE_NAME = "& Iron Spike~";

/**
 * A door already at this lock power - however it got there - takes no further
 * benefit from spiking. Angband 3.4.1 (2012-10-18, the last official release
 * with a spike command) encoded a spiked door's own jam level as a separate
 * 0-7 field from its pre-existing lock power, and capped it there:
 * "Placing more than 7 spikes in one door will not have any further effect"
 * (lib/edit/object.txt, the item's own description). This port has no such
 * second field - a closed door carries one continuous lock-power number (the
 * "door lock" trap, game/trap.ts), fed into the same `skill - 4 * power`
 * formula upstream's OWN locked-door pick chance already used - so spiking
 * raises that number directly instead, capped at the same 7 upstream capped
 * its jam level at. See this mod's README, "Restore door spiking", for why a
 * fully jammed, pick-proof door (upstream's actual result) is not
 * reproduced: this port has no "bash a door down" command for a player to
 * fall back on, so a door literally immune to picking would be a door with no
 * way back in rather than merely a harder one.
 */
export const MAX_SPIKE_POWER = 7;

/** get_spike (cmd2.c): the first pack object of this mod's Iron Spike kind. */
function findSpike(state: GameStateLike): { handle: number; obj: SpikeGearObject } | null {
  for (const handle of state.gear.pack) {
    const obj = state.gear.store.get(handle);
    if (obj && obj.kind.name === IRON_SPIKE_NAME) return { handle, obj };
  }
  return null;
}

/** do_cmd_spike_test (cmd2.c v3.4.1 L1322-1345): a closed door with room for one more spike. */
function spikeTest(state: GameStateLike, at: Loc): "ok" | "not-a-door" | "fully-spiked" {
  if (!state.chunk.isClosedDoor(at)) return "not-a-door";
  if ((state.doorLockPower?.(at) ?? 0) >= MAX_SPIKE_POWER) return "fully-spiked";
  return "ok";
}

function gridInDirection(state: GameStateLike, core: CoreLike, dir: number): Loc {
  const offset = core.DDGRID[dir] ?? { x: 0, y: 0 };
  return { x: state.actor.grid.x + offset.x, y: state.actor.grid.y + offset.y };
}

/**
 * do_cmd_spike (cmd2.c v3.4.1 L1354-1420): jam the closed door in the given
 * direction with one Iron Spike from the pack, raising its lock power (see
 * MAX_SPIKE_POWER above for the one deliberate departure from upstream).
 * "This command may NOT be repeated" upstream, and nothing here queues one.
 *
 * Exported so plugin.test.ts can drive it directly against a fake state and a
 * fake core, the same way discountRoll is tested against a fake Rng.
 */
export function spikeDoor(core: CoreLike, state: GameStateLike, cmd: PlayerCommandLike): number {
  const spike = findSpike(state);
  if (!spike) {
    state.msg?.("You have no spikes!");
    return 0;
  }

  const dir = cmd.dir;
  if (dir === undefined || dir < 1 || dir > 9 || dir === 5) return 0;

  /* do_cmd_spike_test, reached BEFORE the turn is committed (L1376): an
   * illegal target draws no RNG and spends no energy. */
  const at = gridInDirection(state, core, dir);
  const pre = spikeTest(state, at);
  if (pre === "not-a-door") {
    state.msg?.("You see nothing there to spike.");
    return 0;
  }
  if (pre === "fully-spiked") {
    state.msg?.("You can't use more spikes on this door.");
    return 0;
  }

  /* Take a turn (L1383), THEN apply confusion (L1386-1391) - upstream's own
   * order, so a confused player can waste a turn jamming the wrong door, or
   * nothing at all, exactly as do_cmd_spike does. */
  const confusedDir = core.playerConfuseDir(state, dir);
  const finalGrid = confusedDir === dir ? at : gridInDirection(state, core, confusedDir);

  if (state.chunk.mon(finalGrid) > 0) {
    /* do_cmd_spike attacks the blocker here (py_attack) and keeps the turn;
     * this port declines the attack rather than re-deriving core's melee
     * math inside a mod, but still spends the turn and the spike stays
     * unused - see the README for this scoped-down edge case. */
    state.msg?.("There is a monster in the way!");
    return state.z.moveEnergy;
  }

  /* do_cmd_spike_test, re-checked at the (possibly redirected) grid (L1405). */
  const post = spikeTest(state, finalGrid);
  if (post === "not-a-door") {
    state.msg?.("You see nothing there to spike.");
    return state.z.moveEnergy;
  }
  if (post === "fully-spiked") {
    state.msg?.("You can't use more spikes on this door.");
    return state.z.moveEnergy;
  }

  state.setDoorLock?.(finalGrid, (state.doorLockPower?.(finalGrid) ?? 0) + 1);
  state.msg?.("You jam the door with a spike.");
  core.gearObjectForUse(state.gear, state.actor.player, spike.handle, 1);

  return state.z.moveEnergy;
}

export default {
  api: 1,

  hooks(_ctx: HookCtx): Record<string, never> {
    /* No ModHooks entry needed - the discount roll is a registry.js seam
     * (register, below), not a per-turn hook. */
    return {};
  },

  /**
   * `registry:store` and `registry:command`. Each installs only while its own
   * toggle is on - a disabled rule or section is never called at all, so the
   * game plays core's own faithful path rather than a branch this mod chose
   * to skip.
   */
  register(host: HostLike, ctx: HookCtx): void {
    if (ctx.flags["feature-restoration.discounts"] === true) {
      host.stores.setDiscountRoll(discountRoll);
      ctx.log?.("feature-restoration: store discount roll installed");
    }

    /* Iron Spikes only EXIST while this same flag's content section is on
     * (object.json's spike-doors section) - installing the command under any
     * other flag could register "spike" over an item nothing composed. */
    if (ctx.flags["feature-restoration.spike-doors"] === true && ctx.core) {
      const core = ctx.core;
      host.commands.register("feature-restoration:spike", (state, cmd) => spikeDoor(core, state, cmd));
      host.commands.setVerb("feature-restoration:spike", "spike");
      ctx.log?.("feature-restoration: spike-a-door command installed");
    }
  },
};

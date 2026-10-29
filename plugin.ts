/**
 * Feature Restoration (feature-restoration)'s behaviour, as the mod's OWN code.
 *
 * Most restored features in this mod are content-only (see class.json,
 * object.json): restoring a spell that already exists elsewhere in the game, or
 * an item with no behaviour of its own, is a data patch, nothing more. Store
 * discounts, door spiking, Lose Memories and the bronze dragons' confusion
 * breath are the restorations that need behaviour instead; the confusion
 * handlers live in src/confusion.ts.
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
 * ENTRY POINT CONTRACT - mod API 2, first-party tier
 * ------------------------------------------------------------------
 *
 * The default export is an Api2ModDefinition. `meta.flags` is the host's
 * RESOLVED per-patch choice map: every `rules[].flag` and every
 * `sections[].flag` this mod declares in manifest.json, mapped to the player's
 * toggle choice (manifest `default` unless they changed it). The store
 * discount is a policy table the game applies itself. The other restorations
 * (effects, projections, the spike command, the junk ignore at birth) change
 * the live game, so they go through the `engine` domain, which the game hands
 * to its own first-party mods and to nobody else.
 *
 * The engine names this file uses come from src/core-adapter.ts, the only
 * module that reads the engine domain. That namespace is the live one, the
 * same module instance the game runs on rather than a bundled copy, so
 * `spikeDoor` below reaches `playerConfuseDir`, `gearObjectForUse` and
 * `DDGRID` through the adapter rather than reimplementing them: a mod that
 * duplicated confusion-redirect or item-stack arithmetic by hand would be a
 * second copy of behaviour core already owns, and one this file has no way of
 * keeping in sync. This file otherwise imports
 * @rpgm-tools/neo-angband-core for TYPES ONLY, never as a bare specifier: a
 * module fetched from a mod folder cannot resolve one, nor should it - a
 * bundled copy of core would give this plugin its own registries while the
 * game ran on another set, a failure with no error message anywhere.
 */

import {
  BRONZE_BREATHERS,
  CONFUSION,
  confuseMonster,
  confusePlayer,
} from "./src/confusion.js";
import {
  classicRemoveCurseHandler,
  enchantCurseBreakHandler,
} from "./src/classic-uncurse.js";
import type { Api2ModDefinition, Api2Policies, ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import type { GameObject, GameState, Loc, PlayerCommand } from "@rpgm-tools/neo-angband-core";
import { adaptEngine, type AdapterEngine, type EngineCore } from "./src/core-adapter.js";
import { createAdapter } from "./src/core-adapter-api2.js";
import { LOSE_MEMORIES, loseMemoriesHandler } from "./src/lose-memories.js";
import { CURSE_ARMOUR, CURSE_WEAPON, curseScrollHandler } from "./src/curse-scrolls.js";
import { ignoreJunk } from "./src/junk-ignore.js";

/** The engine names the spike command uses. */
type SpikeEngine = Pick<EngineCore, "DDGRID" | "playerConfuseDir" | "gearObjectForUse">;

/**
 * mass_produce's discount arm (Angband 3.0.6, store.c), transcribed exactly:
 * successive independent rolls, each only reached if the previous one missed,
 * cheapest tier first. Items under 5 gold never discount. See this mod's
 * README for the fetched source and the citation. A policy table rather than a
 * function: the game rolls it during stocking on its own random stream, in this
 * order, and draws nothing for a cheap item. Exported so plugin.test.ts can
 * assert the exact odds against a recording roll double, not just the tier
 * outputs.
 */
export const DISCOUNT_ROLL = {
  minCost: 5,
  tiers: [
    { oneIn: 25, percent: 10 },
    { oneIn: 50, percent: 25 },
    { oneIn: 150, percent: 50 },
    { oneIn: 300, percent: 75 },
    { oneIn: 500, percent: 90 },
  ],
} as const;

/**
 * The `object.json` `spike-doors` record's own `name` field, markup and all
 * (`kind.name` carries a bound kind's name exactly as its content record
 * spelled it - see core's obj/bind.ts `bindKinds`, `name: rec.name`). The two
 * files are kept in sync by hand, the same way this codebase's own
 * `lookupTrap` matches a trap kind by its record text rather than a numeric
 * id - there is no third place to derive the string from.
 */
export const IRON_SPIKE_NAME = "& Iron Spike~";

export const SPIKE_COMMAND = "feature-restoration:spike";

/** The command a key runs: it asks for a direction, then spikes that way and spends the turn. */
export const SPIKE_KEY_COMMAND = "feature-restoration:spike-door";

/** Angband 3.4.1's original-command trigger for jamming a door. */
export const SPIKE_TRIGGER = "j";

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
function findSpike(state: GameState): { handle: number; obj: GameObject } | null {
  for (const handle of state.gear.pack) {
    const obj = state.gear.store.get(handle);
    if (obj && obj.kind.name === IRON_SPIKE_NAME) return { handle, obj };
  }
  return null;
}

/** do_cmd_spike_test (cmd2.c v3.4.1 L1322-1345): a closed door with room for one more spike. */
function spikeTest(state: GameState, at: Loc): "ok" | "not-a-door" | "fully-spiked" {
  if (!state.chunk.isClosedDoor(at)) return "not-a-door";
  if ((state.doorLockPower?.(at) ?? 0) >= MAX_SPIKE_POWER) return "fully-spiked";
  return "ok";
}

function gridInDirection(state: GameState, engine: SpikeEngine, dir: number): Loc {
  const offset = engine.DDGRID[dir] ?? { x: 0, y: 0 };
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
export function spikeDoor(engine: SpikeEngine, state: GameState, cmd: PlayerCommand): number {
  const spike = findSpike(state);
  if (!spike) {
    state.msg?.("You have no spikes!");
    return 0;
  }

  const dir = cmd.dir;
  if (dir === undefined || dir < 1 || dir > 9 || dir === 5) return 0;

  /* do_cmd_spike_test, reached BEFORE the turn is committed (L1376): an
   * illegal target draws no RNG and spends no energy. */
  const at = gridInDirection(state, engine, dir);
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
  const confusedDir = engine.playerConfuseDir(state, dir);
  const finalGrid = confusedDir === dir ? at : gridInDirection(state, engine, confusedDir);

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
  engine.gearObjectForUse(state.gear, state.actor.player, spike.handle, 1);

  return state.z.moveEnergy;
}

/**
 * Gives the spike command a key. The game asks for a direction, the command spikes that way and
 * returns the energy it used, and the key goes on `j` when nothing else holds it. Each step logs how it ended, since
 * a refusal (the key already bound, keymap access not granted) is the player's to see in the log.
 */
async function bindSpikeKey(mod: ModApi2, engine: AdapterEngine, core: EngineCore): Promise<void> {
  const { meta } = createAdapter(mod);
  const registered = await mod.ui.commands.register(
    SPIKE_KEY_COMMAND,
    "spike",
    ({ dir }) => {
      const state = engine.state;
      if (dir === undefined || !state) return {};
      return { energy: spikeDoor(core, state, { code: SPIKE_COMMAND, dir } as PlayerCommand) };
    },
    { direction: true, turn: true },
  );
  if (!registered.ok) {
    meta.log("feature-restoration: spike key not bound; the command could not be registered");
    return;
  }
  const bound = await mod.ui.keys.bind(SPIKE_TRIGGER, SPIKE_KEY_COMMAND);
  meta.log(
    bound.ok
      ? `feature-restoration: spike default key ${SPIKE_TRIGGER} bound`
      : `feature-restoration: spike default key ${SPIKE_TRIGGER} not bound; it is already claimed or unavailable`,
  );
}

export default {
  api: ">=2.0.0 <3.0.0",

  /** The store discount is a table the game rolls itself, present only while its flag is on. */
  policies({ flags }): Api2Policies {
    return flags["feature-restoration.discounts"] === true ? { storeDiscountRoll: DISCOUNT_ROLL } : {};
  },

  /** Junk ignore marks its kinds ignored on a new character, through the game's own `newCharacter` hook. */
  engineHooks({ flags, engine }) {
    if (flags["feature-restoration.junk"] !== true) return {};
    const adapted = adaptEngine(engine);
    if (!adapted.core) throw new Error("Junk ignore requires the live core item classes");
    return { newCharacter: adapted.newCharacter(ignoreJunk) };
  },

  /**
   * Registry handlers install when the engine domain carries the registry host.
   * Content toggles control whether the matching effect or command record
   * exists.
   */
  async start(mod): Promise<void> {
    const { meta, engine } = createAdapter(mod);
    const { core: engineCore, registry } = engine;

    if (!registry) {
      meta.log("feature-restoration: the engine domain carries no registry host, so the effect, projection and spike-command restorations are not installed");
      return;
    }

    if (engineCore && registry.registerEffect && registry.setEffectText) {
      registry.registerEffect(LOSE_MEMORIES, loseMemoriesHandler(engineCore));
      registry.setEffectText(LOSE_MEMORIES, {
        menuName: () => "drains experience",
        describe: () => "drains experience",
      });
      meta.log("feature-restoration: Lose Memories effect installed");
    }

    /* The CONFUSION projection only exists while the bronze-dragons section
     * is on (its projection.json record), so its handlers go in under the same
     * flag and no other. */
    if (meta.flags["feature-restoration.bronze-dragons"] === true && engineCore && registry.setPlayerProjection && registry.setMonsterProjection) {
      registry.setPlayerProjection(CONFUSION, confusePlayer(engineCore));
      registry.setMonsterProjection(CONFUSION, confuseMonster(engineCore, BRONZE_BREATHERS));
      meta.log("feature-restoration: confusion projection handlers installed");
    }

    /* Classic uncursing replaces core's own REMOVE_CURSE and ENCHANT handlers,
     * so both go in under the section's flag and no other. The adapter's
     * engine core carries EF, ENCH_*, ODESC, PN and the obj helpers the
     * handlers call through; ClassicCore names only those. */
    if (meta.flags["feature-restoration.classic-uncurse"] === true && engineCore && registry.registerEffect) {
      registry.registerEffect(engineCore.EF.REMOVE_CURSE, classicRemoveCurseHandler(engineCore));
      registry.registerEffect(engineCore.EF.ENCHANT, enchantCurseBreakHandler(engineCore));
      meta.log("feature-restoration: classic uncursing handlers installed");
    }

    if (meta.flags["feature-restoration.sticky-curses"] === true && engineCore && registry.registerEffect && registry.setEffectText) {
      registry.registerEffect(CURSE_WEAPON, curseScrollHandler(engineCore, "WEAPON"));
      registry.registerEffect(CURSE_ARMOUR, curseScrollHandler(engineCore, "BODY_ARMOR"));
      registry.setEffectText(CURSE_WEAPON, {
        menuName: () => "curses a wielded weapon",
        describe: () => "curses a wielded weapon",
      });
      registry.setEffectText(CURSE_ARMOUR, {
        menuName: () => "curses worn body armour",
        describe: () => "curses worn body armour",
      });
    }

    /* Iron Spikes only EXIST while this same flag's content section is on
     * (object.json's spike-doors section) - installing the command under any
     * other flag could register "spike" over an item nothing composed. */
    if (meta.flags["feature-restoration.spike-doors"] === true && engineCore) {
      registry.registerCommand(SPIKE_COMMAND, (state, cmd) => spikeDoor(engineCore, state, cmd));
      registry.setCommandVerb(SPIKE_COMMAND, "spike");
      meta.log("feature-restoration: spike-a-door command installed");
      await bindSpikeKey(mod, engine, engineCore);
    }
  },
} satisfies Api2ModDefinition;

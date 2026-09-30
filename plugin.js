// feature-restoration - generated from plugin.ts by neo-angband-mod-build
// (@rpgm-tools/neo-angband-mod-sdk). Edit the TypeScript source, not this file.

// src/confusion.ts
var CONFUSION = "CONFUSION";
var BRONZE_BREATHERS = /* @__PURE__ */ new Set([
  "giant bronze dragon fly",
  "baby bronze dragon",
  "young bronze dragon",
  "mature bronze dragon",
  "ancient bronze dragon",
  "great wyrm of perplexity"
]);
function confusePlayer(core) {
  return (ctx) => {
    ctx.incTimed(core.TMD.CONFUSED, ctx.rng.randint1(20) + 10, true);
  };
}
function confuseMonster(core, breathers) {
  return (ctx) => {
    if (ctx.seen) ctx.obvious = true;
    ctx.monTimed[core.MON_TMD.CONF] = Math.trunc((10 + ctx.rng.randint1(15) + ctx.r) / (ctx.r + 1));
    if (breathers.has(ctx.mon.race.name)) {
      ctx.hurtMsg = core.MON_MSG.RESIST;
      ctx.dam = Math.trunc(ctx.dam * 2 / (ctx.rng.randint1(6) + 6));
    } else if (ctx.mon.race.flags.has(core.RF.NO_CONF)) {
      ctx.hurtMsg = core.MON_MSG.RESIST_SOMEWHAT;
      ctx.dam = Math.trunc(ctx.dam / 2);
    }
  };
}

// src/classic-uncurse.ts
var LIGHT_MAX_POWER = 40;
var PERMA_POWER = 100;
var ENCHANT_CURSE_CHANCE = 25;
function gameEnvOf(ctx) {
  return ctx.env.game ?? null;
}
function say(ctx, text) {
  ctx.env.messages?.msg(text);
}
function hasBreakableCurse(obj) {
  if (!obj.curses) return false;
  for (let i = 1; i < obj.curses.length; i++) {
    const power = obj.curses[i]?.power ?? 0;
    if (power > 0 && power < PERMA_POWER) return true;
  }
  return false;
}
function enchantCurseBreak(rng, isArtifact) {
  if (isArtifact && rng.randint0(100) < 50) return false;
  if (rng.randint0(100) >= ENCHANT_CURSE_CHANCE) return false;
  return true;
}
function uncurseOne(core, curses, obj, heavy, onWeightDelta, msg) {
  if (!obj.curses) return 0;
  const oldWeight = obj.number * core.objectWeightOne(obj, curses);
  let count = 0;
  for (let i = 1; i < curses.length; i++) {
    const power = obj.curses[i]?.power ?? 0;
    if (power <= 0 || power >= PERMA_POWER) continue;
    if (power > LIGHT_MAX_POWER && !heavy) continue;
    const env = msg ? { curses, msg } : void 0;
    if (core.removeObjectCurse(obj, i, msg !== void 0, env)) count++;
  }
  if (count > 0) {
    const newWeight = obj.number * core.objectWeightOne(obj, curses);
    onWeightDelta?.(newWeight - oldWeight);
  }
  return count;
}
function cursesOf(env) {
  return env.item?.reg?.curses ?? null;
}
function classicRemoveCurseHandler(core) {
  return (ctx) => {
    const env = gameEnvOf(ctx);
    if (!env) return true;
    const { state } = env;
    const curses = cursesOf(env);
    if (!curses) return true;
    const heavy = core.effectCalculateValue(ctx, false) > LIGHT_MAX_POWER;
    const msg = (text) => say(ctx, text);
    const player = state.actor.player;
    let removed = 0;
    let weightDelta = 0;
    for (const handle of player.equipment) {
      if (!handle) continue;
      const obj = state.gear.store.get(handle);
      if (!obj) continue;
      removed += uncurseOne(core, curses, obj, heavy, (d) => weightDelta += d, msg);
    }
    ctx.ident = true;
    if (removed === 0) return true;
    player.upkeep.totalWeight += weightDelta;
    player.upkeep.notice |= core.PN.COMBINE;
    state.updateBonuses?.();
    if (!heavy) say(ctx, "The air around your body glows blue for a moment...");
    return true;
  };
}
function enchantCurseBreakHandler(core) {
  return (ctx) => {
    const env = gameEnvOf(ctx);
    if (!env) return true;
    const { state } = env;
    const value = state.rng.randcalc(
      ctx.value,
      state.chunk.depth,
      "randomise"
    );
    let used = false;
    ctx.ident = true;
    const spell = (numHit, numDam, numAc) => {
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
      if (hasBreakableCurse(obj) && enchantCurseBreak(state.rng, !!obj.artifact)) {
        const curses = cursesOf(env);
        if (curses) {
          uncurseOne(
            core,
            curses,
            obj,
            true,
            (d) => state.actor.player.upkeep.totalWeight += d,
            (t) => say(ctx, t)
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

// src/lose-memories.ts
var LOSE_MEMORIES = "feature-restoration:LOSE_EXP";
function loseMemoriesHandler(core) {
  return (ctx) => {
    const env = core.gameEnv(ctx);
    if (!env) return true;
    const player = env.state.actor.player;
    if (!core.playerOfHas(env.state, core.OF.HOLD_LIFE) && player.exp > 0) {
      ctx.env.messages?.msg("You feel your memories fade.");
      core.playerExpLose(player, Math.trunc(player.exp / 4), false, core.effectExpDeps(ctx, env));
    }
    ctx.ident = true;
    return true;
  };
}

// plugin.ts
function discountRoll(ctx) {
  const { rng, cost } = ctx;
  if (cost < 5) return 0;
  if (rng.oneIn(25)) return 10;
  if (rng.oneIn(50)) return 25;
  if (rng.oneIn(150)) return 50;
  if (rng.oneIn(300)) return 75;
  if (rng.oneIn(500)) return 90;
  return 0;
}
var IRON_SPIKE_NAME = "& Iron Spike~";
var SPIKE_TRIGGER = "j";
var SPIKE_COMMAND = "feature-restoration:spike";
var MAX_SPIKE_POWER = 7;
function findSpike(state) {
  for (const handle of state.gear.pack) {
    const obj = state.gear.store.get(handle);
    if (obj && obj.kind.name === IRON_SPIKE_NAME) return { handle, obj };
  }
  return null;
}
function spikeTest(state, at) {
  if (!state.chunk.isClosedDoor(at)) return "not-a-door";
  if ((state.doorLockPower?.(at) ?? 0) >= MAX_SPIKE_POWER) return "fully-spiked";
  return "ok";
}
function gridInDirection(state, core, dir) {
  const offset = core.DDGRID[dir] ?? { x: 0, y: 0 };
  return { x: state.actor.grid.x + offset.x, y: state.actor.grid.y + offset.y };
}
function spikeDoor(core, state, cmd) {
  const spike = findSpike(state);
  if (!spike) {
    state.msg?.("You have no spikes!");
    return 0;
  }
  const dir = cmd.dir;
  if (dir === void 0 || dir < 1 || dir > 9 || dir === 5) return 0;
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
  const confusedDir = core.playerConfuseDir(state, dir);
  const finalGrid = confusedDir === dir ? at : gridInDirection(state, core, confusedDir);
  if (state.chunk.mon(finalGrid) > 0) {
    state.msg?.("There is a monster in the way!");
    return state.z.moveEnergy;
  }
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
var plugin_default = {
  api: 1,
  hooks(_ctx) {
    return {};
  },
  /**
   * Registry handlers install when their host seams are available. Content
   * toggles control whether the matching effect or command record exists.
   */
  register(host, ctx) {
    if (ctx.core && host.effects && host.effectInfo) {
      const core = ctx.core;
      host.effects.register(LOSE_MEMORIES, { handler: loseMemoriesHandler(core) });
      host.effectInfo.text.set(LOSE_MEMORIES, {
        menuName: () => "drains experience",
        describe: () => "drains experience"
      });
      ctx.log?.("feature-restoration: Lose Memories effect installed");
    }
    if (ctx.flags["feature-restoration.discounts"] === true) {
      host.stores.setDiscountRoll(discountRoll);
      ctx.log?.("feature-restoration: store discount roll installed");
    }
    if (ctx.flags["feature-restoration.bronze-dragons"] === true && ctx.core && host.projections) {
      const core = ctx.core;
      host.projections.player.set(CONFUSION, confusePlayer(core));
      host.projections.mon.set(CONFUSION, confuseMonster(core, BRONZE_BREATHERS));
      ctx.log?.("feature-restoration: confusion projection handlers installed");
    }
    if (ctx.flags["feature-restoration.classic-uncurse"] === true && ctx.core && host.effects) {
      const core = ctx.core;
      const ef = ctx.core.EF;
      host.effects.register(ef.REMOVE_CURSE, { handler: classicRemoveCurseHandler(core) });
      host.effects.register(ef.ENCHANT, { handler: enchantCurseBreakHandler(core) });
      ctx.log?.("feature-restoration: classic uncursing handlers installed");
    }
    if (ctx.flags["feature-restoration.spike-doors"] === true && ctx.core) {
      const core = ctx.core;
      host.commands.register(SPIKE_COMMAND, (state, cmd) => spikeDoor(core, state, cmd));
      host.commands.setVerb(SPIKE_COMMAND, "spike");
      ctx.log?.("feature-restoration: spike-a-door command installed");
      if (ctx.keymaps) {
        const bound = ctx.keymaps.isBindableTriggerKey(SPIKE_TRIGGER) && ctx.keymaps.bind(SPIKE_TRIGGER, SPIKE_COMMAND);
        ctx.log?.(
          bound ? `feature-restoration: spike default key ${SPIKE_TRIGGER} bound` : `feature-restoration: spike default key ${SPIKE_TRIGGER} not bound; it is already claimed or unavailable`
        );
      } else {
        ctx.log?.(`feature-restoration: spike default key ${SPIKE_TRIGGER} not bound; keymap access is unavailable`);
      }
    }
  }
};
export {
  IRON_SPIKE_NAME,
  MAX_SPIKE_POWER,
  SPIKE_COMMAND,
  SPIKE_TRIGGER,
  plugin_default as default,
  discountRoll,
  spikeDoor
};

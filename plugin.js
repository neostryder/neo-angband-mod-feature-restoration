// crf-fix - generated from plugin.ts by neo-angband-mod-build
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
var HEAVY_MIN_SIDES = 50;
function gameEnvOf(ctx) {
  return ctx.env.game ?? null;
}
function say(ctx, text) {
  ctx.env.messages?.msg(text);
}
function worstCurse(obj) {
  let worst = 0;
  const list = obj.curses ?? [];
  for (let i = 1; i < list.length; i++) worst = Math.max(worst, list[i]?.power ?? 0);
  return worst;
}
function hasBreakableCurse(obj) {
  const worst = worstCurse(obj);
  return worst > 0 && worst < PERMA_POWER;
}
function enchantCurseBreak(rng, isArtifact) {
  if (isArtifact && rng.randint0(100) < 50) return false;
  if (rng.randint0(100) >= ENCHANT_CURSE_CHANCE) return false;
  return true;
}
function isHeavySource(value) {
  return value.sides >= HEAVY_MIN_SIDES;
}
function uncurseOne(core, curses, obj, heavy, onWeightDelta, msg) {
  const worst = worstCurse(obj);
  if (worst <= 0 || worst >= PERMA_POWER) return 0;
  if (worst > LIGHT_MAX_POWER && !heavy) return 0;
  const oldWeight = obj.number * core.objectWeightOne(obj, curses);
  let count = 0;
  for (let i = 1; i < curses.length; i++) {
    if (!obj.curses) break;
    if (!(obj.curses[i]?.power ?? 0)) continue;
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
    const heavy = isHeavySource(ctx.value);
    const player = state.actor.player;
    let items = 0;
    let weightDelta = 0;
    for (const handle of player.equipment) {
      if (!handle) continue;
      const obj = state.gear.store.get(handle);
      if (!obj) continue;
      if (uncurseOne(core, curses, obj, heavy, (d) => weightDelta += d) > 0) items++;
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
var ENCHANT_TABLE = [
  0,
  10,
  20,
  40,
  80,
  160,
  280,
  400,
  550,
  700,
  800,
  900,
  950,
  970,
  990,
  1e3
];
function enchantScore(rng, score, isArtifact) {
  if (isArtifact && rng.randint0(100) < 50) return score;
  const chance = score < 0 ? 0 : score > 15 ? 1e3 : ENCHANT_TABLE[score];
  if (rng.randint1(1e3) <= chance) return score;
  return score + 1;
}
function classicEnchant(core, rng, obj, n, eflag, breakCurse) {
  const isArtifact = !!obj.artifact;
  let res = false;
  let prob = obj.number * 100;
  if (core.tvalIsAmmo(obj.tval)) prob = Math.trunc(prob / 20);
  const enchant2 = (key) => {
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
    const player = state.actor.player;
    const breakCurse = (obj) => {
      say(ctx, "The curse is broken!");
      const curses = cursesOf(env);
      if (curses) uncurseOne(core, curses, obj, true, (d) => player.upkeep.totalWeight += d);
    };
    const enchant = (obj, n, eflag) => {
      if (!classicEnchant(core, state.rng, obj, n, eflag, breakCurse)) return false;
      state.updateBonuses?.();
      player.upkeep.notice |= core.PN.COMBINE;
      return true;
    };
    const spell = (numHit, numDam, numAc) => {
      const request = core.requestForEffect(core.EF.ENCHANT, ctx.subtype, state);
      const obj = env.item?.getItem?.(request);
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
    core.equipLearnFlag(player, env.state.runeEnv, core.OF.HOLD_LIFE);
    return true;
  };
}

// src/curse-scrolls.ts
var CURSE_WEAPON = "feature-restoration:CURSE_WEAPON";
var CURSE_ARMOUR = "feature-restoration:CURSE_ARMOR";
function resetToEgo(core, rng, reg, obj, ego) {
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
    const dst = obj.elInfo[i];
    dst.resLevel = Math.max(kind.elInfo[i]?.resLevel ?? 0, ego.elInfo[i]?.resLevel ?? 0);
    dst.flags = (kind.elInfo[i]?.flags ?? 0) | (kind.base.elInfo[i]?.flags ?? 0) | (ego.elInfo[i]?.flags ?? 0);
  }
  obj.slays = core.copySlays(core.copySlays(null, kind.slays, reg.slays), ego.slays, reg.slays);
  obj.brands = core.copyBrands(core.copyBrands(null, kind.brands, reg.brands), ego.brands, reg.brands);
  obj.activation = null;
  obj.knownActivation = void 0;
  obj.effect = kind.effect;
  obj.time = { ...kind.time };
  obj.curses = null;
  core.copyCurses(rng, obj, ego.curses, reg.curses);
}
function curseScrollHandler(core, slotType) {
  return (ctx) => {
    const env = ctx.env.game;
    if (!env) return true;
    const { state } = env;
    const player = state.actor.player;
    const slot = player.body.slots.findIndex((s) => s.type === slotType);
    const handle = player.equipment[slot];
    const obj = handle ? state.gear.store.get(handle) : void 0;
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

// src/junk-ignore.ts
var JUNK_KINDS = {
  bottle: ["& Empty Bottle~"],
  junk: ["& Shard~ of Pottery", "& Broken Stick~"],
  skeleton: [
    "& Broken Skull~",
    "& Broken Bone~",
    "& Canine Skeleton~",
    "& Rodent Skeleton~",
    "& Human Skeleton~",
    "& Dwarf Skeleton~",
    "& Elf Skeleton~",
    "& Gnome Skeleton~"
  ]
};
function ignoreJunk(state, registries, tvalFindIdx) {
  for (const [type, names] of Object.entries(JUNK_KINDS)) {
    const tval = tvalFindIdx(type);
    if (tval < 0) throw new Error(`Missing junk item class: ${type}`);
    for (const name of names) {
      const kind = registries.objects.kinds.find((k) => k?.name === name && k.tval === tval);
      if (!kind) throw new Error(`Missing junk kind: ${type} ${name}`);
      state.ignore.kindIgnoreWhenAware(kind.kidx);
      state.ignore.kindIgnoreWhenUnaware(kind.kidx);
    }
  }
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
  hooks(ctx) {
    if (ctx.flags["feature-restoration.junk"] !== true) return {};
    if (!ctx.core?.tvalFindIdx) throw new Error("Junk ignore requires the live core item classes");
    const { tvalFindIdx } = ctx.core;
    return { newCharacter: (state, registries) => ignoreJunk(state, registries, tvalFindIdx) };
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
    if (ctx.flags["feature-restoration.sticky-curses"] === true && ctx.core && host.effects && host.effectInfo) {
      const core = ctx.core;
      host.effects.register(CURSE_WEAPON, { handler: curseScrollHandler(core, "WEAPON") });
      host.effects.register(CURSE_ARMOUR, { handler: curseScrollHandler(core, "BODY_ARMOR") });
      host.effectInfo.text.set(CURSE_WEAPON, {
        menuName: () => "curses a wielded weapon",
        describe: () => "curses a wielded weapon"
      });
      host.effectInfo.text.set(CURSE_ARMOUR, {
        menuName: () => "curses worn body armour",
        describe: () => "curses worn body armour"
      });
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

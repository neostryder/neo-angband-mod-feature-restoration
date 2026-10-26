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
function confusePlayer(engine) {
  return (ctx) => {
    ctx.incTimed(engine.TMD.CONFUSED, ctx.rng.randint1(20) + 10, true);
  };
}
function confuseMonster(engine, breathers) {
  return (ctx) => {
    if (ctx.seen) ctx.obvious = true;
    ctx.monTimed[engine.MON_TMD.CONF] = Math.trunc((10 + ctx.rng.randint1(15) + ctx.r) / (ctx.r + 1));
    if (breathers.has(ctx.mon.race.name)) {
      ctx.hurtMsg = engine.MON_MSG.RESIST;
      ctx.dam = Math.trunc(ctx.dam * 2 / (ctx.rng.randint1(6) + 6));
    } else if (ctx.mon.race.flags.has(engine.RF.NO_CONF)) {
      ctx.hurtMsg = engine.MON_MSG.RESIST_SOMEWHAT;
      ctx.dam = Math.trunc(ctx.dam / 2);
    }
  };
}

// src/classic-uncurse.ts
var LIGHT_MAX_POWER = 40;
var PERMA_POWER = 100;
var ENCHANT_CURSE_CHANCE = 25;
var HEAVY_MIN_SIDES = 50;
function gameEnvOf(engine, ctx) {
  return engine.gameEnv(ctx);
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
function uncurseOne(engine, curses, obj, heavy, onWeightDelta, msg) {
  const worst = worstCurse(obj);
  if (worst <= 0 || worst >= PERMA_POWER) return 0;
  if (worst > LIGHT_MAX_POWER && !heavy) return 0;
  const oldWeight = obj.number * engine.objectWeightOne(obj, curses);
  let count = 0;
  for (let i = 1; i < curses.length; i++) {
    if (!obj.curses) break;
    if (!(obj.curses[i]?.power ?? 0)) continue;
    const env = msg ? { curses, msg } : void 0;
    if (engine.removeObjectCurse(obj, i, msg !== void 0, env)) count++;
  }
  if (count > 0) {
    const newWeight = obj.number * engine.objectWeightOne(obj, curses);
    onWeightDelta?.(newWeight - oldWeight);
  }
  return count;
}
function cursesOf(env) {
  return env.item?.reg?.curses ?? null;
}
function classicRemoveCurseHandler(engine) {
  return (ctx) => {
    const env = gameEnvOf(engine, ctx);
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
      if (uncurseOne(engine, curses, obj, heavy, (d) => weightDelta += d) > 0) items++;
    }
    if (items > 0) {
      player.upkeep.totalWeight += weightDelta;
      player.upkeep.notice |= engine.PN.COMBINE;
      state.updateBonuses?.();
    }
    if (heavy) {
      ctx.ident = true;
      return true;
    }
    if (items > 0) {
      const blind = (player.timed?.[engine.TMD.BLIND] ?? 0) > 0;
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
function classicEnchant(engine, rng, obj, n, eflag, breakCurse) {
  const isArtifact = !!obj.artifact;
  let res = false;
  let prob = obj.number * 100;
  if (engine.tvalIsAmmo(obj.tval)) prob = Math.trunc(prob / 20);
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
    if (eflag & engine.ENCH_TOHIT && enchant2("toH")) res = true;
    if (eflag & engine.ENCH_TODAM && enchant2("toD")) res = true;
    if (eflag & engine.ENCH_TOAC && enchant2("toA")) res = true;
  }
  return res;
}
function enchantCurseBreakHandler(engine) {
  return (ctx) => {
    const env = gameEnvOf(engine, ctx);
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
      if (curses) uncurseOne(engine, curses, obj, true, (d) => player.upkeep.totalWeight += d);
    };
    const enchant = (obj, n, eflag) => {
      if (!classicEnchant(engine, state.rng, obj, n, eflag, breakCurse)) return false;
      state.updateBonuses?.();
      player.upkeep.notice |= engine.PN.COMBINE;
      return true;
    };
    const spell = (numHit, numDam, numAc) => {
      const request = engine.requestForEffect(engine.EF.ENCHANT, ctx.subtype, state);
      const obj = request ? env.item?.getItem?.(request) : null;
      if (!obj) return false;
      const name = engine.describeObject(state, obj, engine.ODESC.BASE);
      const carried = engine.objectIsCarried(state.gear, obj);
      say(ctx, `${carried ? "Your" : "The"} ${name} glow${obj.number > 1 ? "" : "s"} brightly!`);
      let okay = false;
      if (numDam && enchant(obj, numHit, engine.ENCH_TOBOTH)) okay = true;
      else if (enchant(obj, numHit, engine.ENCH_TOHIT)) okay = true;
      else if (enchant(obj, numDam, engine.ENCH_TODAM)) okay = true;
      if (enchant(obj, numAc, engine.ENCH_TOAC)) okay = true;
      if (!okay) say(ctx, "The enchantment failed.");
      return true;
    };
    if ((ctx.subtype & engine.ENCH_TOBOTH) === engine.ENCH_TOBOTH) {
      if (spell(value, value, 0)) used = true;
    } else if (ctx.subtype & engine.ENCH_TOHIT) {
      if (spell(value, 0, 0)) used = true;
    } else if (ctx.subtype & engine.ENCH_TODAM) {
      if (spell(0, value, 0)) used = true;
    }
    if (ctx.subtype & engine.ENCH_TOAC) {
      if (spell(0, 0, value)) used = true;
    }
    return used;
  };
}

// src/core-adapter.ts
var DDGRID = [
  { x: 0, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 }
];
function pickCore(core) {
  return {
    EF: core.EF,
    ENCH_TOHIT: core.ENCH_TOHIT,
    ENCH_TODAM: core.ENCH_TODAM,
    ENCH_TOAC: core.ENCH_TOAC,
    ENCH_TOBOTH: core.ENCH_TOBOTH,
    MON_MSG: core.MON_MSG,
    MON_TMD: core.MON_TMD,
    RF: core.RF,
    TMD: core.TMD,
    ODESC: core.ODESC,
    OF: core.OF,
    PN: core.PN,
    DDGRID,
    gameEnv: core.gameEnv,
    describeObject: core.describeObject,
    objectIsCarried: core.objectIsCarried,
    objectWeightOne: core.objectWeightOne,
    removeObjectCurse: core.removeObjectCurse,
    requestForEffect: core.requestForEffect,
    tvalIsAmmo: core.tvalIsAmmo,
    copySlays: core.copySlays,
    copyBrands: core.copyBrands,
    copyCurses: core.copyCurses,
    playerOfHas: core.playerOfHas,
    playerExpLose: core.playerExpLose,
    effectExpDeps: core.effectExpDeps,
    equipLearnFlag: core.equipLearnFlag,
    playerConfuseDir: core.playerConfuseDir,
    gearObjectForUse: core.gearObjectForUse,
    tvalFindIdx: core.tvalFindIdx
  };
}
function engineRegistry(host) {
  const { effects, effectInfo, projections, commands } = host;
  return {
    registerEffect: effects ? (code, handler) => effects.register(code, { handler }) : null,
    setEffectText: effectInfo ? (code, text) => effectInfo.text.set(code, text) : null,
    setPlayerProjection: projections ? (code, handler) => projections.player.set(code, handler) : null,
    setMonsterProjection: projections ? (code, handler) => projections.mon.set(code, handler) : null,
    registerCommand: (code, action) => commands.register(code, action),
    setCommandVerb: (code, verb) => commands.setVerb(code, verb)
  };
}
function adaptEngine(engine) {
  const live = engine;
  const core = live?.core ? pickCore(live.core) : null;
  const host = live?.registry;
  return {
    core,
    registry: host ? engineRegistry(host) : null,
    newCharacter(run) {
      if (!core) throw new Error("The newCharacter hook requires the live core namespace");
      const { tvalFindIdx } = core;
      return (state, registries) => run({
        tvalFindIdx,
        findKind: (name, tval) => registries.objects.kinds.find((k) => k?.name === name && k.tval === tval)?.kidx,
        ignoreKind: (kidx) => {
          state.ignore.kindIgnoreWhenAware(kidx);
          state.ignore.kindIgnoreWhenUnaware(kidx);
        }
      });
    }
  };
}
function engineOf(mod) {
  return adaptEngine(mod.engine);
}

// src/core-adapter-api2.ts
function createAdapter(mod) {
  return {
    meta: {
      flags: mod.meta.flags,
      log: (message) => mod.meta.log(message)
    },
    engine: engineOf(mod)
  };
}

// src/lose-memories.ts
var LOSE_MEMORIES = "FEATURE_RESTORATION_LOSE_EXP";
function loseMemoriesHandler(engine) {
  return (ctx) => {
    const env = engine.gameEnv(ctx);
    if (!env) return true;
    const player = env.state.actor.player;
    if (!engine.playerOfHas(env.state, engine.OF.HOLD_LIFE) && player.exp > 0) {
      ctx.env.messages?.msg("You feel your memories fade.");
      engine.playerExpLose(player, Math.trunc(player.exp / 4), false, engine.effectExpDeps(ctx, env));
    }
    ctx.ident = true;
    engine.equipLearnFlag(player, env.state.runeEnv, engine.OF.HOLD_LIFE);
    return true;
  };
}

// src/curse-scrolls.ts
var CURSE_WEAPON = "FEATURE_RESTORATION_CURSE_WEAPON";
var CURSE_ARMOUR = "FEATURE_RESTORATION_CURSE_ARMOR";
function resetToEgo(engine, rng, reg, obj, ego) {
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
  obj.slays = engine.copySlays(engine.copySlays(null, kind.slays, reg.slays), ego.slays, reg.slays);
  obj.brands = engine.copyBrands(engine.copyBrands(null, kind.brands, reg.brands), ego.brands, reg.brands);
  obj.activation = null;
  delete obj.knownActivation;
  obj.effect = kind.effect;
  obj.time = { ...kind.time };
  obj.curses = null;
  engine.copyCurses(rng, obj, ego.curses, reg.curses);
}
function curseScrollHandler(engine, slotType) {
  return (ctx) => {
    const env = engine.gameEnv(ctx);
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
    const description = engine.describeObject(state, obj, engine.ODESC.BASE);
    const noun = slotType === "WEAPON" ? "weapon" : "armour";
    if (obj.artifact && state.rng.randint0(100) < 50) {
      ctx.env.messages?.msg(`A terrible black aura tries to surround your ${noun}, but your ${description} resists the effects!`);
    } else {
      ctx.env.messages?.msg(`A terrible black aura blasts your ${description}!`);
      resetToEgo(engine, state.rng, reg, obj, ego);
      obj.toH = slotType === "WEAPON" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.toD = slotType === "WEAPON" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.toA = slotType === "BODY_ARMOR" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.ac = 0;
      obj.dd = 0;
      obj.ds = 0;
      player.upkeep.notice |= engine.PN.COMBINE;
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
function ignoreJunk(game) {
  for (const [type, names] of Object.entries(JUNK_KINDS)) {
    const tval = game.tvalFindIdx(type);
    if (tval < 0) throw new Error(`Missing junk item class: ${type}`);
    for (const name of names) {
      const kidx = game.findKind(name, tval);
      if (kidx === void 0) throw new Error(`Missing junk kind: ${type} ${name}`);
      game.ignoreKind(kidx);
    }
  }
}

// plugin.ts
var DISCOUNT_ROLL = {
  minCost: 5,
  tiers: [
    { oneIn: 25, percent: 10 },
    { oneIn: 50, percent: 25 },
    { oneIn: 150, percent: 50 },
    { oneIn: 300, percent: 75 },
    { oneIn: 500, percent: 90 }
  ]
};
var IRON_SPIKE_NAME = "& Iron Spike~";
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
function gridInDirection(state, engine, dir) {
  const offset = engine.DDGRID[dir] ?? { x: 0, y: 0 };
  return { x: state.actor.grid.x + offset.x, y: state.actor.grid.y + offset.y };
}
function spikeDoor(engine, state, cmd) {
  const spike = findSpike(state);
  if (!spike) {
    state.msg?.("You have no spikes!");
    return 0;
  }
  const dir = cmd.dir;
  if (dir === void 0 || dir < 1 || dir > 9 || dir === 5) return 0;
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
  const confusedDir = engine.playerConfuseDir(state, dir);
  const finalGrid = confusedDir === dir ? at : gridInDirection(state, engine, confusedDir);
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
  engine.gearObjectForUse(state.gear, state.actor.player, spike.handle, 1);
  return state.z.moveEnergy;
}
var plugin_default = {
  api: ">=2.0.0 <3.0.0",
  /** The store discount is a table the game rolls itself, present only while its flag is on. */
  policies({ flags }) {
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
  async start(mod) {
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
        describe: () => "drains experience"
      });
      meta.log("feature-restoration: Lose Memories effect installed");
    }
    if (meta.flags["feature-restoration.bronze-dragons"] === true && engineCore && registry.setPlayerProjection && registry.setMonsterProjection) {
      registry.setPlayerProjection(CONFUSION, confusePlayer(engineCore));
      registry.setMonsterProjection(CONFUSION, confuseMonster(engineCore, BRONZE_BREATHERS));
      meta.log("feature-restoration: confusion projection handlers installed");
    }
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
        describe: () => "curses a wielded weapon"
      });
      registry.setEffectText(CURSE_ARMOUR, {
        menuName: () => "curses worn body armour",
        describe: () => "curses worn body armour"
      });
    }
    if (meta.flags["feature-restoration.spike-doors"] === true && engineCore) {
      registry.registerCommand(SPIKE_COMMAND, (state, cmd) => spikeDoor(engineCore, state, cmd));
      registry.setCommandVerb(SPIKE_COMMAND, "spike");
      meta.log("feature-restoration: spike-a-door command installed");
    }
  }
};
export {
  DISCOUNT_ROLL,
  IRON_SPIKE_NAME,
  MAX_SPIKE_POWER,
  SPIKE_COMMAND,
  plugin_default as default,
  spikeDoor
};

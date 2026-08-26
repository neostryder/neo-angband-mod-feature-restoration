// feature-restoration - generated from plugin.ts by neo-angband-mod-build
// (@rpgm-tools/neo-angband-mod-sdk). Edit the TypeScript source, not this file.

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
   * `registry:store` and `registry:command`. Each installs only while its own
   * toggle is on - a disabled rule or section is never called at all, so the
   * game plays core's own faithful path rather than a branch this mod chose
   * to skip.
   */
  register(host, ctx) {
    if (ctx.flags["feature-restoration.discounts"] === true) {
      host.stores.setDiscountRoll(discountRoll);
      ctx.log?.("feature-restoration: store discount roll installed");
    }
    if (ctx.flags["feature-restoration.spike-doors"] === true && ctx.core) {
      const core = ctx.core;
      host.commands.register("feature-restoration:spike", (state, cmd) => spikeDoor(core, state, cmd));
      host.commands.setVerb("feature-restoration:spike", "spike");
      ctx.log?.("feature-restoration: spike-a-door command installed");
    }
  }
};
export {
  IRON_SPIKE_NAME,
  MAX_SPIKE_POWER,
  plugin_default as default,
  discountRoll,
  spikeDoor
};

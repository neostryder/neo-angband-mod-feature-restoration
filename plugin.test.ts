/**
 * Unit coverage for plugin.ts's discount table, its spike-a-door command, and
 * the flag gating for both. The spike fixture uses a real Core state so the
 * command follows Core's gear and object types.
 */
import { describe, expect, it, vi } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
// @ts-expect-error The test imports the handwritten source module.
import { DISCOUNT_ROLL, IRON_SPIKE_NAME, MAX_SPIKE_POWER, SPIKE_COMMAND, SPIKE_TRIGGER, spikeDoor } from "./plugin.ts";
import { LOSE_MEMORIES } from "./src/lose-memories.js";
import type { EffectTextHandler } from "@rpgm-tools/neo-angband-core";
import { bind, gamePack } from "./test/game.js";
import { engineHooksFor, policiesFor, startWith } from "./test/api2.js";

const { Rng } = core;
type SpikeAction = core.PlayerAction;

interface FakeHost {
  commands: {
    register(code: string, action: SpikeAction): void;
    setVerb(code: string, verb: string): void;
  };
}

function fakeHost(): FakeHost & {
  installedSpike: SpikeAction | null;
  installedVerb: { code: string; verb: string } | null;
  actions: Map<string, SpikeAction>;
} {
  const host = {
    installedSpike: null as SpikeAction | null,
    installedVerb: null as { code: string; verb: string } | null,
    actions: new Map<string, SpikeAction>(),
    commands: {
      register(code: string, action: SpikeAction) {
        host.actions.set(code, action);
        host.installedSpike = action;
      },
      setVerb(code: string, verb: string) {
        host.installedVerb = { code, verb };
      },
    },
  };
  return host;
}

/**
 * The roll the game applies for the `storeDiscountRoll` table (Angband 3.0.6's
 * mass_produce): items under `minCost` draw nothing, then the tiers are checked
 * in order and the first hit wins. This double follows that rule so the tests
 * can assert the declared odds against a recording `oneIn`.
 */
function rollTable(table: typeof DISCOUNT_ROLL, rng: { oneIn(n: number): boolean }, cost: number): number {
  if (cost < table.minCost) return 0;
  for (const tier of table.tiers) if (rng.oneIn(tier.oneIn)) return tier.percent;
  return 0;
}

/** Minimal ModKeymaps double: bind only claims an otherwise free one-key trigger. */
class FakeKeymaps {
  readonly bindings = new Map<string, string>();

  isBindableTriggerKey(trigger: string): boolean {
    return trigger.length === 1 && !this.bindings.has(trigger);
  }

  bind(trigger: string, action: string): boolean {
    if (!this.isBindableTriggerKey(trigger) || action.length === 0) return false;
    this.bindings.set(trigger, action);
    return true;
  }

  dispatch(trigger: string, state: Parameters<SpikeAction>[0], cmd: Parameters<SpikeAction>[1], actions: ReadonlyMap<string, SpikeAction>): number | null {
    const action = this.bindings.get(trigger);
    return action ? (actions.get(action)?.(state, cmd) ?? null) : null;
  }
}

describe("engineHooks", () => {
  it("returns no hook when junk is off", () => {
    expect(engineHooksFor({ flags: {} })).toEqual({});
    expect(engineHooksFor({ flags: { "feature-restoration.discounts": true } })).toEqual({});
    expect(engineHooksFor({ flags: { "feature-restoration.junk": false } })).toEqual({});
  });
});

describe("policies - discount flag gating", () => {
  it("declares nothing when the toggle is off (the default)", () => {
    expect(policiesFor({})).toEqual({});
  });

  it("declares nothing when the toggle is explicitly off", () => {
    expect(policiesFor({ "feature-restoration.discounts": false })).toEqual({});
  });

  it("declares the discount table when the toggle is on", () => {
    expect(policiesFor({ "feature-restoration.discounts": true })).toEqual({ storeDiscountRoll: DISCOUNT_ROLL });
  });
});

describe("start - Lose Memories effect", () => {
  it("installs the effect handler and recall text", async () => {
    const host = fakeHost();
    let code = "";
    let installed: { handler: core.EffectHandler } | null = null;
    let infoCode = "";
    const captured: { info?: EffectTextHandler } = {};
    const registryHost = {
      ...host,
      effects: { register: (key: string, def: { handler: core.EffectHandler }) => { code = key; installed = def; } },
      effectInfo: { text: { set: (key: string, entry: EffectTextHandler) => { infoCode = key; captured.info = entry; } } },
    };
    await startWith({ flags: {}, core: {}, host: registryHost });

    expect(code).toBe(LOSE_MEMORIES);
    expect(installed).toBeDefined();
    expect(infoCode).toBe(LOSE_MEMORIES);
    expect(captured.info?.menuName?.({} as never)).toBe("drains experience");
    expect(captured.info?.describe?.({} as never)).toBe("drains experience");
  });
});

describe("storeDiscountRoll - mass_produce's discount arm (Angband 3.0.6)", () => {
  it("never discounts an item under 5 gold, and draws no RNG at all", () => {
    const oneIn = vi.fn(() => true);
    expect(rollTable(DISCOUNT_ROLL, Object.assign(new Rng(1), { oneIn }), 4)).toBe(0);
    expect(oneIn).not.toHaveBeenCalled();
  });

  it("checks the tiers in order, at their documented odds, stopping at the first hit", () => {
    const cases: Array<{ hits: number; expected: number; odds: number[] }> = [
      { hits: 1, expected: 10, odds: [25] },
      { hits: 2, expected: 25, odds: [25, 50] },
      { hits: 3, expected: 50, odds: [25, 50, 150] },
      { hits: 4, expected: 75, odds: [25, 50, 150, 300] },
      { hits: 5, expected: 90, odds: [25, 50, 150, 300, 500] },
    ];
    for (const { hits, expected, odds } of cases) {
      const oneIn = vi.fn((n: number) => n === odds[odds.length - 1]);
      expect(rollTable(DISCOUNT_ROLL, Object.assign(new Rng(1), { oneIn }), 100)).toBe(expected);
      expect(oneIn.mock.calls.map((c) => c[0])).toEqual(odds);
      expect(hits).toBe(odds.length);
    }
  });

  it("returns 0 when every roll misses, having checked all five tiers", () => {
    const oneIn = vi.fn((_n: number) => false);
    expect(rollTable(DISCOUNT_ROLL, Object.assign(new Rng(1), { oneIn }), 100)).toBe(0);
    expect(oneIn.mock.calls.map((c) => c[0])).toEqual([25, 50, 150, 300, 500]);
  });

  it("has the historical hit rate on the production RNG across realistic value bands", () => {
    const trials = 100_000;
    const expectedRate = 1 - (24 / 25) * (49 / 50) * (149 / 150) * (299 / 300) * (499 / 500);

    /* The floor must not consume the production stream at all. */
    const ineligible = new Rng(20_260_912);
    const before = ineligible.getState();
    let ineligibleHits = 0;
    for (let i = 0; i < trials; i++) {
      if (rollTable(DISCOUNT_ROLL, ineligible, 4) > 0) ineligibleHits++;
    }
    expect(ineligibleHits).toBe(0);
    expect(ineligible.getState()).toEqual(before);

    /* Five independent tier checks yield about 7.045 percent in total, not
     * the first tier's four percent alone. The intentionally broad 6.5-7.5
     * percent band is more than six standard deviations at this volume, while
     * still catching a broken Rng.oneIn path or a changed tier sequence. */
    for (const cost of [5, 60, 1_000]) {
      const rng = new Rng(20_260_912 + cost);
      let hits = 0;
      for (let i = 0; i < trials; i++) {
        if (rollTable(DISCOUNT_ROLL, rng, cost) > 0) hits++;
      }
      const rate = hits / trials;
      expect(rate, `cost ${String(cost)} observed ${String(rate)}`).toBeGreaterThan(0.065);
      expect(rate, `cost ${String(cost)} observed ${String(rate)}`).toBeLessThan(0.075);
      expect(Math.abs(rate - expectedRate)).toBeLessThan(0.005);
    }
  });
});

describe("start - spike-doors flag gating", () => {
  const liveCore = core;

  it("installs nothing when the toggle is off (the default)", async () => {
    const host = fakeHost();
    await startWith({ flags: {}, core: liveCore, host });
    expect(host.installedSpike).toBeNull();
    expect(host.installedVerb).toBeNull();
  });

  it("installs nothing when the engine domain carries no core, even with the toggle on", async () => {
    const host = fakeHost();
    await startWith({ flags: { "feature-restoration.spike-doors": true }, host });
    expect(host.installedSpike).toBeNull();
  });

  it("installs the command and its verb when the toggle is on", async () => {
    const host = fakeHost();
    await startWith({ flags: { "feature-restoration.spike-doors": true }, core: liveCore, host });
    expect(host.installedSpike).toBeTypeOf("function");
    expect(host.installedVerb).toEqual({ code: "feature-restoration:spike", verb: "spike" });
  });

  it("claims Angband 3.4.1's j trigger when free and dispatches it to the spike command", async () => {
    const host = fakeHost();
    const core = fakeCore();
    const keymaps = new FakeKeymaps();
    const log = vi.fn();
    await startWith({ flags: { "feature-restoration.spike-doors": true }, core, host, keymaps, log });

    expect(keymaps.bindings).toEqual(new Map([[SPIKE_TRIGGER, SPIKE_COMMAND]]));
    expect(log).toHaveBeenCalledWith(`feature-restoration: spike default key ${SPIKE_TRIGGER} bound`);

    const { state, doors } = fakeState({ spikes: 1 });
    expect(keymaps.dispatch(SPIKE_TRIGGER, state, { code: SPIKE_COMMAND, dir: 6 }, host.actions)).toBe(10);
    expect(doors["6,5"]!.power).toBe(1);
  });

  it("leaves an occupied default trigger unchanged", async () => {
    const host = fakeHost();
    const keymaps = new FakeKeymaps();
    keymaps.bind(SPIKE_TRIGGER, "player-command");
    const log = vi.fn();
    await startWith({ flags: { "feature-restoration.spike-doors": true }, core, host, keymaps, log });

    expect(keymaps.bindings).toEqual(new Map([[SPIKE_TRIGGER, "player-command"]]));
    expect(log).toHaveBeenCalledWith(`feature-restoration: spike default key ${SPIKE_TRIGGER} not bound; it is already claimed or unavailable`);
  });
});

/* ------------------------------------------------------------------ *
 * spikeDoor - do_cmd_spike (Angband 3.4.1, cmd2.c), reused against
 * this port's continuous door-lock-power dial. See plugin.ts's own
 * MAX_SPIKE_POWER comment for exactly what carried over.
 * ------------------------------------------------------------------ */

const DDGRID = core.DDGRID;

const PLAYER_GRID = { x: 5, y: 5 };
/** Direction 6 (east): PLAYER_GRID + DDGRID[6]. */
const DOOR_GRID = { x: 6, y: 5 };

function fakeCore(overrides: Partial<{ confuseTo: number }> = {}) {
  const gearObjectForUse = vi.fn(core.gearObjectForUse);
  const playerConfuseDir = vi.fn((_state: core.GameState, dir: number): number => overrides.confuseTo ?? dir);
  return { ...core, DDGRID, playerConfuseDir, gearObjectForUse };
}

interface FakeDoor {
  closed: boolean;
  power: number;
}

const SPIKE_PACK = gamePack(["spike-doors"]).pack;
const SPIKE_KIND = bind(["spike-doors"]).game.objects.kinds.find((kind) => kind?.name === IRON_SPIKE_NAME)!;

function fakeState(opts: {
  spikes?: number;
  doors?: Record<string, FakeDoor>;
  monsterAt?: string;
} = {}) {
  const doors = opts.doors ?? { "6,5": { closed: true, power: 0 } };
  const key = (g: { x: number; y: number }) => `${g.x},${g.y}`;
  const msgs: string[] = [];
  const state = core.startGame(SPIKE_PACK).state;
  state.actor.grid = PLAYER_GRID;
  state.gear.store.clear();
  state.gear.pack.length = 0;
  if (opts.spikes !== undefined && opts.spikes > 0) {
    const obj = core.objectNew(SPIKE_KIND);
    obj.number = opts.spikes;
    state.gear.store.set(1, obj);
    state.gear.pack.push(1);
  }
  const setDoorLock = vi.fn((g: { x: number; y: number }, power: number) => {
    const d = doors[key(g)];
    if (d) d.power = power;
  });
  state.chunk.isClosedDoor = (g) => doors[key(g)]?.closed ?? false;
  state.chunk.mon = (g) => (key(g) === opts.monsterAt ? 1 : 0);
  state.z.moveEnergy = 10;
  state.msg = (t) => msgs.push(t);
  state.doorLockPower = (g) => doors[key(g)]?.power ?? 0;
  state.setDoorLock = setDoorLock;
  return { state, msgs, doors, setDoorLock };
}

describe("spikeDoor - no spike in the pack", () => {
  it("refuses, spends no energy, and never resolves a direction or draws RNG", () => {
    const core = fakeCore();
    const { state, msgs } = fakeState({ spikes: 0 });
    const energy = spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
    expect(energy).toBe(0);
    expect(msgs).toEqual(["You have no spikes!"]);
    expect(core.playerConfuseDir).not.toHaveBeenCalled();
    expect(core.gearObjectForUse).not.toHaveBeenCalled();
  });
});

describe("spikeDoor - direction", () => {
  it("refuses silently (no message, no energy) when no direction is given", () => {
    const core = fakeCore();
    const { state, msgs } = fakeState({ spikes: 1 });
    expect(spikeDoor(core, state, { code: SPIKE_COMMAND })).toBe(0);
    expect(msgs).toEqual([]);
  });

  it("refuses silently for direction 5 (the player's own square) and out-of-range values", () => {
    const core = fakeCore();
    const { state } = fakeState({ spikes: 1 });
    expect(spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 5 })).toBe(0);
    expect(spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 0 })).toBe(0);
    expect(spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 10 })).toBe(0);
  });
});

describe("spikeDoor - pre-turn legality (do_cmd_spike_test before the turn commits)", () => {
  it("refuses a grid with no closed door, spending no energy", () => {
    const core = fakeCore();
    const { state, msgs } = fakeState({ spikes: 1, doors: { "6,5": { closed: false, power: 0 } } });
    expect(spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 })).toBe(0);
    expect(msgs).toEqual(["You see nothing there to spike."]);
    expect(core.playerConfuseDir).not.toHaveBeenCalled();
  });

  it("refuses a door already at MAX_SPIKE_POWER, spending no energy", () => {
    const core = fakeCore();
    const { state, msgs } = fakeState({
      spikes: 1,
      doors: { "6,5": { closed: true, power: MAX_SPIKE_POWER } },
    });
    expect(spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 })).toBe(0);
    expect(msgs).toEqual(["You can't use more spikes on this door."]);
    expect(core.playerConfuseDir).not.toHaveBeenCalled();
    expect(core.gearObjectForUse).not.toHaveBeenCalled();
  });
});

describe("spikeDoor - a monster in the way", () => {
  it("spends the turn, does not consume a spike, and does not raise the door's power", () => {
    const core = fakeCore();
    const { state, msgs, doors } = fakeState({ spikes: 1, monsterAt: "6,5" });
    const energy = spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
    expect(energy).toBe(10);
    expect(msgs).toEqual(["There is a monster in the way!"]);
    expect(core.gearObjectForUse).not.toHaveBeenCalled();
    expect(doors["6,5"]!.power).toBe(0);
  });
});

describe("spikeDoor - success", () => {
  it("raises the door's lock power by one, consumes one spike, and spends the turn", () => {
    const core = fakeCore();
    const { state, msgs, doors, setDoorLock } = fakeState({ spikes: 3 });
    const energy = spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
    expect(energy).toBe(10);
    expect(msgs).toEqual(["You jam the door with a spike."]);
    expect(setDoorLock).toHaveBeenCalledWith(DOOR_GRID, 1);
    expect(doors["6,5"]!.power).toBe(1);
    expect(core.gearObjectForUse).toHaveBeenCalledWith(state.gear, state.actor.player, 1, 1);
  });

  it("adds onto a door's existing lock power rather than overwriting it", () => {
    const core = fakeCore();
    const { state, doors } = fakeState({ spikes: 1, doors: { "6,5": { closed: true, power: 3 } } });
    spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
    expect(doors["6,5"]!.power).toBe(4);
  });

  it("repeated spiking converges on MAX_SPIKE_POWER and then refuses, one spike per success", () => {
    const core = fakeCore();
    const { state, msgs, doors } = fakeState({ spikes: MAX_SPIKE_POWER + 2 });
    for (let i = 0; i < MAX_SPIKE_POWER; i++) {
      const energy = spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
      expect(energy).toBe(10);
    }
    expect(doors["6,5"]!.power).toBe(MAX_SPIKE_POWER);
    expect(core.gearObjectForUse).toHaveBeenCalledTimes(MAX_SPIKE_POWER);

    msgs.length = 0;
    const energy = spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
    expect(energy).toBe(0);
    expect(msgs).toEqual(["You can't use more spikes on this door."]);
  });
});

describe("spikeDoor - confusion redirect (player_confuse_dir applied AFTER the turn commits)", () => {
  it("re-targets the confused-redirected grid, not the one originally aimed at", () => {
    /* do_cmd_spike_test must pass at the ORIGINAL direction (6,5) before the
     * turn commits at all - upstream's own order - so both grids need a
     * real, unspiked door for this scenario to be reachable. Direction 8
     * (north) from PLAYER_GRID lands on {5,4}; success there and NOT at
     * {6,5} proves the redirect actually moved the target rather than the
     * pre-turn check having silently used it. */
    const core = fakeCore({ confuseTo: 8 });
    const { state, doors } = fakeState({
      spikes: 1,
      doors: { "6,5": { closed: true, power: 0 }, "5,4": { closed: true, power: 0 } },
    });
    const energy = spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
    expect(energy).toBe(10);
    expect(doors["5,4"]!.power).toBe(1);
    expect(doors["6,5"]!.power).toBe(0);
    expect(core.playerConfuseDir).toHaveBeenCalledWith(state, 6);
  });

  it("a redirect onto a non-door still spends the turn but jams nothing", () => {
    const core = fakeCore({ confuseTo: 8 });
    const { state, msgs, doors } = fakeState({
      spikes: 1,
      doors: { "6,5": { closed: true, power: 0 }, "5,4": { closed: false, power: 0 } },
    });
    const energy = spikeDoor(core, state, { code: SPIKE_COMMAND, dir: 6 });
    expect(energy).toBe(10);
    expect(msgs).toEqual(["You see nothing there to spike."]);
    expect(doors["6,5"]!.power).toBe(0);
    expect(core.gearObjectForUse).not.toHaveBeenCalled();
  });
});

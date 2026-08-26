/**
 * Unit coverage for plugin.ts's discount roll, its spike-a-door command, and
 * the flag gating for both. No live game is needed here - discountRoll is a
 * pure function of (rng, cost), spikeDoor is a pure function of (core, state,
 * cmd), and register()'s only job is "install it when the toggle is on, touch
 * nothing otherwise" - so fakes stand in for the real host, state and core.
 */
import { describe, expect, it, vi } from "vitest";
import plugin, {
  discountRoll,
  IRON_SPIKE_NAME,
  MAX_SPIKE_POWER,
  spikeDoor,
} from "./plugin.js";

type DiscountHandler = (ctx: { rng: { oneIn: (n: number) => boolean }; cost: number }) => number;
/** The command action's real parameter types are plugin.ts's own, private types;
 * a fake host only needs to capture the function register() passes it, so its
 * own parameter types are widened deliberately (not `unknown`, which TS checks
 * as a covariant callback parameter type and refuses here). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpikeAction = (state: any, cmd: any) => number;

interface FakeHost {
  stores: { setDiscountRoll: (handler: DiscountHandler) => void };
  commands: {
    register(code: string, action: SpikeAction): void;
    setVerb(code: string, verb: string): void;
  };
}

function fakeHost(): FakeHost & {
  installedDiscount: DiscountHandler | null;
  installedSpike: SpikeAction | null;
  installedVerb: { code: string; verb: string } | null;
} {
  const host = {
    installedDiscount: null as DiscountHandler | null,
    installedSpike: null as SpikeAction | null,
    installedVerb: null as { code: string; verb: string } | null,
    stores: {
      setDiscountRoll(h: DiscountHandler) {
        host.installedDiscount = h;
      },
    },
    commands: {
      register(code: string, action: SpikeAction) {
        host.installedSpike = action;
      },
      setVerb(code: string, verb: string) {
        host.installedVerb = { code, verb };
      },
    },
  };
  return host;
}

describe("hooks", () => {
  it("always returns an empty ModHooks - the seam is register(), not a per-turn hook", () => {
    expect(plugin.hooks({ flags: {} })).toEqual({});
    expect(plugin.hooks({ flags: { "feature-restoration.discounts": true } })).toEqual({});
  });
});

describe("register - discount flag gating", () => {
  it("installs nothing when the toggle is off (the default)", () => {
    const host = fakeHost();
    plugin.register(host, { flags: {} });
    expect(host.installedDiscount).toBeNull();
  });

  it("installs nothing when the toggle is explicitly off", () => {
    const host = fakeHost();
    plugin.register(host, { flags: { "feature-restoration.discounts": false } });
    expect(host.installedDiscount).toBeNull();
  });

  it("installs the discount roll when the toggle is on", () => {
    const host = fakeHost();
    plugin.register(host, { flags: { "feature-restoration.discounts": true } });
    expect(host.installedDiscount).toBe(discountRoll);
  });
});

describe("discountRoll - mass_produce's discount arm (Angband 3.0.6)", () => {
  it("never discounts an item under 5 gold, and draws no RNG at all", () => {
    const oneIn = vi.fn(() => true);
    expect(discountRoll({ rng: { oneIn }, cost: 4 })).toBe(0);
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
      expect(discountRoll({ rng: { oneIn }, cost: 100 })).toBe(expected);
      expect(oneIn.mock.calls.map((c) => c[0])).toEqual(odds);
      expect(hits).toBe(odds.length);
    }
  });

  it("returns 0 when every roll misses, having checked all five tiers", () => {
    const oneIn = vi.fn((_n: number) => false);
    expect(discountRoll({ rng: { oneIn }, cost: 100 })).toBe(0);
    expect(oneIn.mock.calls.map((c) => c[0])).toEqual([25, 50, 150, 300, 500]);
  });
});

describe("register - spike-doors flag gating", () => {
  const core = { DDGRID: [], playerConfuseDir: vi.fn(), gearObjectForUse: vi.fn() };

  it("installs nothing when the toggle is off (the default)", () => {
    const host = fakeHost();
    plugin.register(host, { flags: {}, core });
    expect(host.installedSpike).toBeNull();
    expect(host.installedVerb).toBeNull();
  });

  it("installs nothing when ctx.core is absent, even with the toggle on", () => {
    const host = fakeHost();
    plugin.register(host, { flags: { "feature-restoration.spike-doors": true } });
    expect(host.installedSpike).toBeNull();
  });

  it("installs the command and its verb when the toggle is on", () => {
    const host = fakeHost();
    plugin.register(host, { flags: { "feature-restoration.spike-doors": true }, core });
    expect(host.installedSpike).toBeTypeOf("function");
    expect(host.installedVerb).toEqual({ code: "feature-restoration:spike", verb: "spike" });
  });
});

/* ------------------------------------------------------------------ *
 * spikeDoor - do_cmd_spike (Angband 3.4.1, cmd2.c), reused against
 * this port's continuous door-lock-power dial. See plugin.ts's own
 * MAX_SPIKE_POWER comment for exactly what carried over.
 * ------------------------------------------------------------------ */

/** ddgrid (loc.ts), reproduced here so the fake core behaves like the real one. */
const DDGRID = [
  { x: 0, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];

const PLAYER_GRID = { x: 5, y: 5 };
/** Direction 6 (east): PLAYER_GRID + DDGRID[6]. */
const DOOR_GRID = { x: 6, y: 5 };

function fakeCore(overrides: Partial<{ confuseTo: number }> = {}) {
  const gearObjectForUse = vi.fn(
    (
      _gear: unknown,
      _player: unknown,
      _handle: number,
      _amt: number,
    ): { obj: unknown; noneLeft: boolean } => ({ obj: {}, noneLeft: false }),
  );
  const playerConfuseDir = vi.fn((_state: unknown, dir: number): number => overrides.confuseTo ?? dir);
  return { DDGRID, playerConfuseDir, gearObjectForUse };
}

interface FakeDoor {
  closed: boolean;
  power: number;
}

function fakeState(opts: {
  spikes?: number;
  doors?: Record<string, FakeDoor>;
  monsterAt?: string;
} = {}) {
  const doors = opts.doors ?? { "6,5": { closed: true, power: 0 } };
  const key = (g: { x: number; y: number }) => `${g.x},${g.y}`;
  const msgs: string[] = [];
  const store = new Map<number, { kind: { name: string }; number: number }>();
  const pack: number[] = [];
  if (opts.spikes !== undefined && opts.spikes > 0) {
    store.set(1, { kind: { name: IRON_SPIKE_NAME }, number: opts.spikes });
    pack.push(1);
  }
  const setDoorLock = vi.fn((g: { x: number; y: number }, power: number) => {
    const d = doors[key(g)];
    if (d) d.power = power;
  });
  const state = {
    actor: { grid: PLAYER_GRID, player: { id: "fake-player" } },
    chunk: {
      isClosedDoor: (g: { x: number; y: number }) => doors[key(g)]?.closed ?? false,
      mon: (g: { x: number; y: number }) => (key(g) === opts.monsterAt ? 1 : 0),
    },
    gear: { pack, store },
    z: { moveEnergy: 10 },
    msg: (t: string) => msgs.push(t),
    doorLockPower: (g: { x: number; y: number }) => doors[key(g)]?.power ?? 0,
    setDoorLock,
  };
  return { state, msgs, doors, setDoorLock };
}

describe("spikeDoor - no spike in the pack", () => {
  it("refuses, spends no energy, and never resolves a direction or draws RNG", () => {
    const core = fakeCore();
    const { state, msgs } = fakeState({ spikes: 0 });
    const energy = spikeDoor(core, state, { dir: 6 });
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
    expect(spikeDoor(core, state, {})).toBe(0);
    expect(msgs).toEqual([]);
  });

  it("refuses silently for direction 5 (the player's own square) and out-of-range values", () => {
    const core = fakeCore();
    const { state } = fakeState({ spikes: 1 });
    expect(spikeDoor(core, state, { dir: 5 })).toBe(0);
    expect(spikeDoor(core, state, { dir: 0 })).toBe(0);
    expect(spikeDoor(core, state, { dir: 10 })).toBe(0);
  });
});

describe("spikeDoor - pre-turn legality (do_cmd_spike_test before the turn commits)", () => {
  it("refuses a grid with no closed door, spending no energy", () => {
    const core = fakeCore();
    const { state, msgs } = fakeState({ spikes: 1, doors: { "6,5": { closed: false, power: 0 } } });
    expect(spikeDoor(core, state, { dir: 6 })).toBe(0);
    expect(msgs).toEqual(["You see nothing there to spike."]);
    expect(core.playerConfuseDir).not.toHaveBeenCalled();
  });

  it("refuses a door already at MAX_SPIKE_POWER, spending no energy", () => {
    const core = fakeCore();
    const { state, msgs } = fakeState({
      spikes: 1,
      doors: { "6,5": { closed: true, power: MAX_SPIKE_POWER } },
    });
    expect(spikeDoor(core, state, { dir: 6 })).toBe(0);
    expect(msgs).toEqual(["You can't use more spikes on this door."]);
    expect(core.playerConfuseDir).not.toHaveBeenCalled();
    expect(core.gearObjectForUse).not.toHaveBeenCalled();
  });
});

describe("spikeDoor - a monster in the way", () => {
  it("spends the turn, does not consume a spike, and does not raise the door's power", () => {
    const core = fakeCore();
    const { state, msgs, doors } = fakeState({ spikes: 1, monsterAt: "6,5" });
    const energy = spikeDoor(core, state, { dir: 6 });
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
    const energy = spikeDoor(core, state, { dir: 6 });
    expect(energy).toBe(10);
    expect(msgs).toEqual(["You jam the door with a spike."]);
    expect(setDoorLock).toHaveBeenCalledWith(DOOR_GRID, 1);
    expect(doors["6,5"]!.power).toBe(1);
    expect(core.gearObjectForUse).toHaveBeenCalledWith(state.gear, state.actor.player, 1, 1);
  });

  it("adds onto a door's existing lock power rather than overwriting it", () => {
    const core = fakeCore();
    const { state, doors } = fakeState({ spikes: 1, doors: { "6,5": { closed: true, power: 3 } } });
    spikeDoor(core, state, { dir: 6 });
    expect(doors["6,5"]!.power).toBe(4);
  });

  it("repeated spiking converges on MAX_SPIKE_POWER and then refuses, one spike per success", () => {
    const core = fakeCore();
    const { state, msgs, doors } = fakeState({ spikes: MAX_SPIKE_POWER + 2 });
    for (let i = 0; i < MAX_SPIKE_POWER; i++) {
      const energy = spikeDoor(core, state, { dir: 6 });
      expect(energy).toBe(10);
    }
    expect(doors["6,5"]!.power).toBe(MAX_SPIKE_POWER);
    expect(core.gearObjectForUse).toHaveBeenCalledTimes(MAX_SPIKE_POWER);

    msgs.length = 0;
    const energy = spikeDoor(core, state, { dir: 6 });
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
    const energy = spikeDoor(core, state, { dir: 6 });
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
    const energy = spikeDoor(core, state, { dir: 6 });
    expect(energy).toBe(10);
    expect(msgs).toEqual(["You see nothing there to spike."]);
    expect(doors["6,5"]!.power).toBe(0);
    expect(core.gearObjectForUse).not.toHaveBeenCalled();
  });
});

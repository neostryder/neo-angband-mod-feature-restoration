import { describe, expect, it, vi } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import { api2PolicyEffects, checkApi2Policies } from "@rpgm-tools/neo-angband-mod-sdk";
import { bind, gamePack, modManifest } from "./test/game.js";
import { policiesFor, startWith, type RegisteredCommand } from "./test/api2.js";

const FLAG = "feature-restoration.classic-search";
const SEARCH = "feature-restoration:search";
const TOGGLE = "feature-restoration:toggle-search";
const PACK = gamePack([]).pack;
const GAME = bind([]).game;
const PIT = GAME.traps!.find((kind) => kind.desc === "pit")!;
const CHEST = GAME.objects.kinds.find((kind) => kind?.tval === core.TV.CHEST)!;

async function searching(skill = 50, enabled = true) {
  const state = core.startGame(PACK).state;
  state.actor.grid = { x: 5, y: 5 };
  state.floor.clear();
  state.traps.clear();
  state.actor.combat = { ...state.actor.combat, skills: state.actor.combat.skills.map((value, index) => index === core.SKILL.SEARCH ? skill : value) };
  const grids: core.Loc[] = [];
  for (let y = 4; y <= 6; y++) {
    for (let x = 4; x <= 6; x++) {
      const grid = { x, y };
      grids.push(grid);
      state.chunk.setFeat(grid, core.FEAT.FLOOR);
    }
  }
  state.chunk.sqinfoOn(state.actor.grid, core.SQUARE.SEEN);
  const flags = { [FLAG]: enabled };
  const tables = policiesFor(flags)!;
  const registrations = api2PolicyEffects(tables).registrations;
  state.modHooks = { classicSearch: () => registrations.classicSearch === true };
  const commands: RegisteredCommand[] = [];
  await startWith({ flags, commands });
  const invoke = (id = SEARCH): number => {
    const command = commands.find((entry) => entry.id === id);
    expect(command?.options?.turn).toBe(true);
    // The fixture dispatches the operation because host commands bypass the mod callback.
    if (command?.options?.hostOperation === "classic-search") return core.classicSearchAction(state);
    if (command?.options?.hostOperation === "toggle-classic-search") return core.toggleClassicSearchAction(state);
    throw new Error(`No host operation for ${id}`);
  };
  const messages: string[] = [];
  state.msg = (text) => messages.push(text);
  return { state, grids, messages, invoke };
}

function trapAt(state: core.GameState, grid: core.Loc): core.Trap {
  const trap = { tidx: PIT.tidx, kind: PIT, grid, power: 1000, timeout: 0, flags: PIT.flags.clone() };
  trap.flags.off(core.TRF.VISIBLE);
  state.traps.set(grid.y * state.chunk.width + grid.x, [trap]);
  return trap;
}

describe("CRF-7 classic active searching", () => {
  it("the manifest keeps the policy and commands behind a default-off setting", async () => {
    const manifest = modManifest() as { rules?: Array<{ flag: string; default: boolean; requiresReload: boolean }> };
    expect(manifest.rules?.find((rule) => rule.flag === FLAG)).toMatchObject({ default: false, requiresReload: true });
    expect(policiesFor({})?.classicSearch).toBeUndefined();
    expect(policiesFor({ [FLAG]: false })?.classicSearch).toBeUndefined();
    expect(policiesFor({ [FLAG]: true })?.classicSearch).toBe(true);
    expect(checkApi2Policies(policiesFor({ [FLAG]: true }))).toBeNull();
    const commands: RegisteredCommand[] = [];
    await startWith({ flags: { [FLAG]: false }, commands });
    expect(commands).toEqual([]);
  });

  it("the commands bind the 4.0.5 search and search-mode keys without replacing existing bindings", async () => {
    const bindings = new Map([["S", "player:command"]]);
    const commands: RegisteredCommand[] = [];
    await startWith({ flags: { [FLAG]: true }, commands, keymaps: {
      isBindableTriggerKey: (trigger) => !bindings.has(trigger),
      bind: (trigger, action) => { if (bindings.has(trigger)) return false; bindings.set(trigger, action); return true; },
    } });
    expect(commands.map(({ id, verb, options }) => ({ id, verb, options }))).toEqual([
      { id: SEARCH, verb: "search", options: { turn: true, hostOperation: "classic-search" } },
      { id: TOGGLE, verb: "toggle search", options: { turn: true, hostOperation: "toggle-classic-search" } },
    ]);
    expect(bindings).toEqual(new Map([["S", "player:command"], ["s", SEARCH], ["#", TOGGLE]]));
  });

  it("the host rolls each grid separately for hidden traps, secret doors, and trapped chests", async () => {
    const { state, grids, messages, invoke } = await searching();
    const traps = new Map<number, core.Trap>();
    const chests = new Map<number, core.GameObject>();
    grids.forEach((grid, index) => {
      if (index % 3 === 0) traps.set(index, trapAt(state, grid));
      else if (index % 3 === 1) state.chunk.setFeat(grid, core.FEAT.SECRET);
      else {
        const chest = core.objectNew(CHEST);
        chest.tval = core.TV.CHEST;
        chest.pval = 5;
        chest.knownPval = 0;
        core.floorCarry(state, grid, chest);
        chests.set(index, chest);
      }
    });
    const rolls = [49, 50, 0, 99, 49, 50, 49, 50, 49];
    let next = 0;
    const draws = vi.spyOn(state.rng, "randint0").mockImplementation(() => rolls[next++]!);
    vi.spyOn(state.rng, "randint1").mockReturnValue(100);
    vi.spyOn(state.rng, "oneIn").mockReturnValue(false);
    expect(invoke()).toBe(state.z.moveEnergy);
    expect(draws.mock.calls).toEqual(Array.from({ length: 9 }, () => [100]));
    grids.forEach((grid, index) => {
      const found = rolls[index]! < 50;
      if (index % 3 === 0) {
        expect(traps.get(index)!.flags.has(core.TRF.VISIBLE)).toBe(found);
        expect(core.squareKnownTraps(state.known, grid)).toHaveLength(found ? 1 : 0);
      } else if (index % 3 === 1) {
        expect(state.chunk.feat(grid)).toBe(found ? core.FEAT.CLOSED : core.FEAT.SECRET);
        if (found) expect(core.knownFeat(state, grid)).toBe(core.FEAT.CLOSED);
      } else expect(chests.get(index)!.knownPval).toBe(found ? 5 : 0);
    });
    expect(messages).toEqual([
      "You have found a trap.", "You have discovered a trap on the chest!", "You have found a secret door.",
      "You have found a trap.", "You have discovered a trap on the chest!",
    ]);
  });

  it.each([
    [100, 0, 0, 0, true, 99, true, 100],
    [100, 1, 0, 0, true, 9, true, 100],
    [100, 1, 0, 0, true, 10, false, 100],
    [100, 0, 0, 0, false, 10, false, 100],
    [100, 0, 1, 0, true, 9, true, 100],
    [100, 0, 0, 1, true, 10, false, 100],
    [100, 1, 1, 0, true, 0, true, 100],
    [99, 1, 0, 1, true, 0, false, 0],
    [0, 0, 0, 0, true, 0, false, 0],
  ])("the host applies 4.0.5 penalties for skill=%s blind=%s confused=%s hallucinating=%s lit=%s roll=%s", async (skill, blind, confused, image, lit, roll, found, energy) => {
    const { state, grids, invoke } = await searching(skill);
    state.actor.player.timed[core.TMD.BLIND] = blind;
    state.actor.player.timed[core.TMD.CONFUSED] = confused;
    state.actor.player.timed[core.TMD.IMAGE] = image;
    if (!lit) state.chunk.sqinfoOff(state.actor.grid, core.SQUARE.SEEN);
    const trap = trapAt(state, grids[0]!);
    state.chunk.setFeat(grids[1]!, core.FEAT.SECRET);
    const chest = core.objectNew(CHEST);
    chest.tval = core.TV.CHEST;
        chest.pval = 5;
    chest.knownPval = 0;
    core.floorCarry(state, grids[2]!, chest);
    const draws = vi.spyOn(state.rng, "randint0").mockReturnValue(roll);
    vi.spyOn(state.rng, "oneIn").mockReturnValue(false);
    vi.spyOn(state.rng, "randint1").mockReturnValue(100);
    expect(invoke()).toBe(energy);
    expect(draws).toHaveBeenCalledTimes(energy ? 9 : 0);
    expect(trap.flags.has(core.TRF.VISIBLE)).toBe(found);
    expect(state.chunk.feat(grids[1]!)).toBe(found ? core.FEAT.CLOSED : core.FEAT.SECRET);
    expect(chest.knownPval).toBe(found ? 5 : 0);
  });

  it("the host spends a turn on a fruitless positive-chance search and no energy on a mode toggle", async () => {
    const { state, messages, invoke } = await searching(100);
    expect(invoke()).toBe(state.z.moveEnergy);
    expect(messages).toEqual(["There are no secrets here."]);
    expect(invoke(TOGGLE)).toBe(0);
    expect(core.playerIsClassicSearching(state)).toBe(true);
    expect(invoke(TOGGLE)).toBe(0);
    expect(core.playerIsClassicSearching(state)).toBe(false);
  });

  it.each([0, 50])("the player loop spends energy only for a positive adjusted chance: %s", async (skill) => {
    const { state, invoke } = await searching(skill);
    const registry = new core.ActionRegistry();
    registry.register(SEARCH, () => invoke());
    state.actor.energy = state.z.moveEnergy;
    state.actor.totalEnergy = 0;
    state.cmdQueue = [{ code: SEARCH } as core.PlayerCommand];
    state.nextCommand = () => null;
    const energy = skill > 0 ? state.z.moveEnergy : 0;
    expect(core.processPlayer(state, registry).energyUsed).toBe(energy);
    expect(state.actor.energy).toBe(state.z.moveEnergy - energy);
    expect(state.actor.totalEnergy).toBe(energy);
  });
});

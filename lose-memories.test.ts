import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import { LOSE_MEMORIES, loseMemoriesHandler } from "./src/lose-memories.js";
import { bind, gamePack, modManifest } from "./test/game.js";

function usePotion(exp: number, holdLife = false) {
  const state = core.startGame(gamePack(["classic-potions"]).pack).state;
  const player = state.actor.player;
  player.exp = exp;
  player.maxExp = exp;
  const { runeEnv } = state;
  const msgs: string[] = [];
  const learned: unknown[][] = [];
  let permanentLoss: boolean | undefined;
  const testCore = {
    ...core,
    playerOfHas: () => holdLife,
    playerExpLose: (target: core.Player, amount: number, permanent: boolean) => {
      permanentLoss = permanent;
      target.exp -= Math.min(target.exp, amount);
      if (permanent) target.maxExp -= amount;
    },
    effectExpDeps: () => ({ rng: state.rng }),
    equipLearnFlag: (...args: Parameters<typeof core.equipLearnFlag>) => { learned.push(args); },
  };
  const handler = loseMemoriesHandler(testCore);
  const ctx = {
    env: { game: { state }, messages: { msg: (text: string) => msgs.push(text) } },
    ident: false,
  } as unknown as Parameters<typeof handler>[0];
  handler(ctx);
  return { player, msgs, permanentLoss, identified: ctx.ident, learned, runeEnv };
}

describe("Potion of Lose Memories", () => {
  it("loses one quarter of current experience", () => {
    const { player, msgs, permanentLoss, identified } = usePotion(1000);

    expect(player.exp).toBe(750);
    expect(player.maxExp).toBe(1000);
    expect(permanentLoss).toBe(false);
    expect(msgs).toContain("You feel your memories fade.");
    expect(identified).toBe(true);
  });

  it("does not drain experience from a player with Hold Life", () => {
    const { player, msgs, permanentLoss, identified } = usePotion(1000, true);

    expect(player.exp).toBe(1000);
    expect(msgs).toEqual([]);
    expect(permanentLoss).toBeUndefined();
    expect(identified).toBe(true);
  });

  it.each([false, true])("teaches the Hold Life rune from worn gear, as 4.1.3 did (Hold Life %s)", (holdLife) => {
    const { player, learned, runeEnv } = usePotion(1000, holdLife);
    expect(learned).toEqual([[player, runeEnv, core.OF.HOLD_LIFE]]);
  });

  it("lets Restore Life Levels recover the lost experience", () => {
    const { player, permanentLoss } = usePotion(1000);
    expect(permanentLoss).toBe(false);
    player.exp = player.maxExp;
    expect(player.exp).toBe(1000);
  });

  it("keeps the level 10 rare allocation and effect in the potion record", () => {
    const record = JSON.parse(readFileSync(new URL("./object.json", import.meta.url), "utf8"))
      .sections["classic-potions"].records.find((item: { name: string }) => item.name === "Lose Memories");
    expect(record).toMatchObject({
      level: 10,
      cost: 0,
      alloc: { common: 10, minmax: "10 to 15" },
      effect: [{ eff: LOSE_MEMORIES }],
    });
    expect(bind(["classic-potions"]).game.objects.kinds.some((kind) => kind?.name === "Lose Memories")).toBe(true);
  });

  it("declares Linoleum as an optional dependency", () => {
    expect((modManifest() as { optionalDependencies?: Record<string, string> }).optionalDependencies?.linoleum).toBe("*");
  });
});

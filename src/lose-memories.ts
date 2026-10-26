import type { EffectHandler } from "@rpgm-tools/neo-angband-core";
import type { EngineCore } from "./core-adapter.js";

export type LoseMemoriesCore = Pick<EngineCore,
  "OF" | "gameEnv" | "playerOfHas" | "playerExpLose" | "effectExpDeps" | "equipLearnFlag">;

/* The game reads an effect line as name:type:radius:other, so a name with a colon in it never resolves. */
export const LOSE_MEMORIES = "FEATURE_RESTORATION_LOSE_EXP";

export function loseMemoriesHandler(engine: LoseMemoriesCore): EffectHandler {
  return (ctx) => {
    const env = engine.gameEnv(ctx);
    if (!env) return true;
    const player = env.state.actor.player;
    if (!engine.playerOfHas(env.state, engine.OF.HOLD_LIFE) && player.exp > 0) {
      ctx.env.messages?.msg("You feel your memories fade.");
      engine.playerExpLose(player, Math.trunc(player.exp / 4), false, engine.effectExpDeps(ctx, env));
    }
    ctx.ident = true;
    /* 4.1.3 teaches the Hold Life rune whether or not it saved the player. */
    engine.equipLearnFlag(player, env.state.runeEnv, engine.OF.HOLD_LIFE);
    return true;
  };
}

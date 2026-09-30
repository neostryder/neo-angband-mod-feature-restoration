import type { EffectHandler } from "@rpgm-tools/neo-angband-core";

export type LoseMemoriesCore = Pick<typeof import("@rpgm-tools/neo-angband-core"),
  "OF" | "gameEnv" | "playerOfHas" | "playerExpLose" | "effectExpDeps" | "equipLearnFlag">;

export const LOSE_MEMORIES = "feature-restoration:LOSE_EXP";

export function loseMemoriesHandler(core: LoseMemoriesCore): EffectHandler {
  return (ctx) => {
    const env = core.gameEnv(ctx);
    if (!env) return true;
    const player = env.state.actor.player;
    if (!core.playerOfHas(env.state, core.OF.HOLD_LIFE) && player.exp > 0) {
      ctx.env.messages?.msg("You feel your memories fade.");
      core.playerExpLose(player, Math.trunc(player.exp / 4), false, core.effectExpDeps(ctx, env));
    }
    ctx.ident = true;
    /* 4.1.3 teaches the Hold Life rune whether or not it saved the player. */
    core.equipLearnFlag(player, env.state.runeEnv, core.OF.HOLD_LIFE);
    return true;
  };
}

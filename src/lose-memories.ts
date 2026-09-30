import type { EffectHandler, EffectHandlerContext } from "@rpgm-tools/neo-angband-core";

interface ExpPlayer {
  exp: number;
}

interface ExpState {
  actor: { player: ExpPlayer };
}

interface ExpEnv {
  state: ExpState;
}

export interface LoseMemoriesCore {
  readonly OF: { readonly HOLD_LIFE: number };
  gameEnv(ctx: EffectHandlerContext): ExpEnv | null;
  playerOfHas(state: ExpState, flag: number): boolean;
  playerExpLose(player: ExpPlayer, amount: number, permanent: boolean, deps: unknown): void;
  effectExpDeps(ctx: EffectHandlerContext, env: ExpEnv): unknown;
}

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
    return true;
  };
}

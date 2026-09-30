/**
 * Confusion as an element, for the bronze-dragons section.
 *
 * Angband 4.0.0 removed confusion as an element (bc0a46a01, "Change RES_ to
 * PROT_ for protections, remove confusion as an element"), and with it the
 * bronze dragons that breathed it. This section's projection.json adds the
 * CONFUSION projection back as data, and these two handlers give it the effect
 * Angband 3.2.0 gave GF_CONFUSION in spells1.c, the last release in which bronze
 * dragons were generated.
 *
 * On the player (project_p, spells1.c:3580): confused for 1d20+10 turns. 3.2.0
 * also cut the damage for a player with RES_CONFU; 4.2 turned that resistance
 * into the PROT_CONF protection, and 4.2 protections block a status without
 * reducing damage, so the damage is not cut here. PROT_CONF still stops the
 * confusion, through core's own timed-effect check.
 *
 * On a monster (project_m, spells1.c:2345): confused for (10 + 1d15 + r) /
 * (r + 1) turns, r being the distance from the centre of a ball. A monster that
 * breathes confusion takes dam * 2 / (1d6 + 6) and "resists"; one with NO_CONF
 * takes half damage and "resists somewhat". Core's own timed-effect check keeps
 * a NO_CONF monster from being confused at all.
 */
import type { MonProjectContext, PlayerSideCtx } from "@rpgm-tools/neo-angband-core";

export const CONFUSION = "CONFUSION";

/** The races that breathe confusion: this section's six monsters (monster.json). */
export const BRONZE_BREATHERS: ReadonlySet<string> = new Set([
  "giant bronze dragon fly",
  "baby bronze dragon",
  "young bronze dragon",
  "mature bronze dragon",
  "ancient bronze dragon",
  "great wyrm of perplexity",
]);

export type PlayerSideCtxLike = Pick<PlayerSideCtx, "incTimed"> & {
  rng: Pick<PlayerSideCtx["rng"], "randint1">;
};
export type MonProjectCtxLike = Pick<MonProjectContext, "r" | "seen" | "dam" | "obvious" | "hurtMsg" | "monTimed"> & {
  rng: Pick<MonProjectContext["rng"], "randint1">;
  mon: { race: Pick<MonProjectContext["mon"]["race"], "name"> & {
    flags: Pick<MonProjectContext["mon"]["race"]["flags"], "has">;
  } };
};
export type ConfusionCore = Pick<typeof import("@rpgm-tools/neo-angband-core"), "TMD" | "MON_TMD" | "RF" | "MON_MSG">;

export function confusePlayer(core: ConfusionCore): (ctx: PlayerSideCtxLike) => void {
  return (ctx) => {
    ctx.incTimed(core.TMD.CONFUSED, ctx.rng.randint1(20) + 10, true);
  };
}

/**
 * `breathers` names the races that breathe confusion. Core does not export the
 * lookup from a mod-declared spell name to its index, and the only breathers are
 * this section's own six monsters, so they are named instead.
 */
export function confuseMonster(
  core: ConfusionCore,
  breathers: ReadonlySet<string>,
): (ctx: MonProjectCtxLike) => void {
  return (ctx) => {
    if (ctx.seen) ctx.obvious = true;
    ctx.monTimed[core.MON_TMD.CONF] = Math.trunc((10 + ctx.rng.randint1(15) + ctx.r) / (ctx.r + 1));
    if (breathers.has(ctx.mon.race.name)) {
      ctx.hurtMsg = core.MON_MSG.RESIST;
      ctx.dam = Math.trunc((ctx.dam * 2) / (ctx.rng.randint1(6) + 6));
    } else if (ctx.mon.race.flags.has(core.RF.NO_CONF)) {
      ctx.hurtMsg = core.MON_MSG.RESIST_SOMEWHAT;
      ctx.dam = Math.trunc(ctx.dam / 2);
    }
  };
}

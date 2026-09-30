import type { EffectHandler, EffectHandlerContext } from "@rpgm-tools/neo-angband-core";

export const CURSE_WEAPON = "feature-restoration:CURSE_WEAPON";
export const CURSE_ARMOUR = "feature-restoration:CURSE_ARMOR";

interface CursedObject {
  kind: { kidx: number };
  artifact: unknown;
  ego: unknown;
  curses: unknown;
  toH: number;
  toD: number;
  toA: number;
  ac: number;
  dd: number;
  ds: number;
}

interface CurseState {
  rng: { randint0(n: number): number; randint1(n: number): number };
  gear: { store: ReadonlyMap<number, CursedObject> };
  actor: {
    player: {
      body: { slots: readonly { type: string }[] };
      equipment: readonly (number | null)[];
      upkeep: { notice: number };
    };
  };
  updateBonuses?(): void;
}

interface CurseEnv {
  state: CurseState;
  item?: { reg?: { egos: readonly { name: string; possItems: ReadonlySet<number> }[]; curses: readonly unknown[] } };
}

export interface CurseScrollCore {
  readonly PN: { readonly COMBINE: number };
  readonly ODESC: { readonly BASE: number };
  describeObject(state: CurseState, obj: CursedObject, mode: number): string;
  egoApplyMagic(rng: CurseState["rng"], reg: NonNullable<CurseEnv["item"]>["reg"], obj: CursedObject, level: number): void;
}

export function curseScrollHandler(core: CurseScrollCore, slotType: "WEAPON" | "BODY_ARMOR"): EffectHandler {
  return (ctx: EffectHandlerContext) => {
    const env = ctx.env.game as CurseEnv | undefined;
    if (!env) return true;
    const { state } = env;
    const player = state.actor.player;
    const slot = player.body.slots.findIndex((s) => s.type === slotType);
    const handle = player.equipment[slot];
    const obj = handle ? state.gear.store.get(handle) : undefined;
    if (!obj) return false;
    const reg = env.item?.reg;
    if (!reg) throw new Error("Curse scroll requires the bound object registry");
    const name = slotType === "WEAPON" ? "(Shattered)" : "(Blasted)";
    const ego = reg.egos.find((e) => e.name === name && e.possItems.has(obj.kind.kidx));
    if (!ego) throw new Error(`Missing curse scroll ego: ${name}`);

    const description = core.describeObject(state, obj, core.ODESC.BASE);
    const noun = slotType === "WEAPON" ? "weapon" : "armour";
    if (obj.artifact && state.rng.randint0(100) < 50) {
      ctx.env.messages?.msg(`A terrible black aura tries to surround your ${noun}, but your ${description} resists the effects!`);
    } else {
      ctx.env.messages?.msg(`A terrible black aura blasts your ${description}!`);
      obj.artifact = null;
      obj.curses = null;
      obj.ego = ego;
      core.egoApplyMagic(state.rng, reg, obj, 0);
      obj.toH = slotType === "WEAPON" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.toD = slotType === "WEAPON" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.toA = slotType === "BODY_ARMOR" ? -state.rng.randint1(5) - state.rng.randint1(5) : 0;
      obj.ac = 0;
      obj.dd = 0;
      obj.ds = 0;
      player.upkeep.notice |= core.PN.COMBINE;
      state.updateBonuses?.();
    }
    ctx.ident = true;
    return true;
  };
}

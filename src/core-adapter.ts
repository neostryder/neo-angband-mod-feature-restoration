/**
 * The one module that reaches the game's internals. Every other file gets the
 * engine's names, the registry seams and the plugin context from here.
 *
 * Exports are grouped by the API 2 domain they map to. `meta` and `ui` have
 * direct API 2 counterparts with the same names. `engine` has none: it holds
 * the core names, the registry seams and the hook values the restorations use,
 * and each entry says what API 2 would need to replace it.
 */

import type {
  CoreRegistries,
  EffectHandler,
  GameState,
  ModHooks,
  ModKeymaps,
  ModPluginContext,
  ModRegistryHost,
} from "@rpgm-tools/neo-angband-core";

/** The live core namespace, as a type only; nothing here imports it at runtime. */
type CoreNs = typeof import("@rpgm-tools/neo-angband-core");

/** The plugin context members this mod reads. */
export type HookCtx = Pick<ModPluginContext, "flags"> &
  Partial<Pick<ModPluginContext, "core" | "log">> & {
    /** The spike command uses only the consented keymap writer. */
    readonly keymaps?: Pick<ModKeymaps, "isBindableTriggerKey" | "bind">;
  };

/** The registry seams `register(host, ctx)` receives that this mod uses. */
export type HostLike = {
  readonly effectInfo?: { text: Pick<ModRegistryHost["effectInfo"]["text"], "set"> };
  readonly projections?: {
    readonly player: Pick<ModRegistryHost["projections"]["player"], "set">;
    readonly mon: Pick<ModRegistryHost["projections"]["mon"], "set">;
  };
  readonly effects?: Pick<ModRegistryHost["effects"], "register">;
  readonly stores: Pick<ModRegistryHost["stores"], "setDiscountRoll">;
  readonly commands: Pick<ModRegistryHost["commands"], "register" | "setVerb">;
};

/* ------------------------------------------------------------------ *
 * meta: API 2 `meta`
 * ------------------------------------------------------------------ */

export interface AdapterMeta {
  /** API 2: `meta.flags`, the same map. */
  readonly flags: Readonly<Record<string, boolean>>;
  /** API 2: `meta.log(message)`. A host without a log drops the line. */
  log(message: string): void;
}

/* ------------------------------------------------------------------ *
 * ui: API 2 `ui`
 * ------------------------------------------------------------------ */

export interface AdapterKeys {
  /** API 2: `ui.keys.bind(trigger, action)`, async, returns Api2Result (`refused` when taken). */
  bind(trigger: string, action: string): boolean;
}

export interface AdapterUi {
  /** Null when the host gave no keymap access (API 2: `not-granted` for `keymap:write`). */
  readonly keys: AdapterKeys | null;
}

/* ------------------------------------------------------------------ *
 * engine: no API 2 counterpart
 * ------------------------------------------------------------------ */

/** The core names this mod uses. None has an API 2 counterpart. */
export interface EngineCore {
  /** Effect codes: classic-uncurse replaces REMOVE_CURSE and ENCHANT and asks for an ENCHANT item. API 2: host-interpreted effect declaration. */
  readonly EF: CoreNs["EF"];
  /** Enchant subtype bit for to-hit. API 2: part of a host-interpreted classic-enchant policy. */
  readonly ENCH_TOHIT: CoreNs["ENCH_TOHIT"];
  /** Enchant subtype bit for to-dam. API 2: part of a host-interpreted classic-enchant policy. */
  readonly ENCH_TODAM: CoreNs["ENCH_TODAM"];
  /** Enchant subtype bit for to-ac. API 2: part of a host-interpreted classic-enchant policy. */
  readonly ENCH_TOAC: CoreNs["ENCH_TOAC"];
  /** Enchant subtype bits for to-hit and to-dam together. API 2: part of a host-interpreted classic-enchant policy. */
  readonly ENCH_TOBOTH: CoreNs["ENCH_TOBOTH"];
  /** Monster hurt messages RESIST and RESIST_SOMEWHAT for confusion damage. API 2: host-interpreted projection declaration. */
  readonly MON_MSG: CoreNs["MON_MSG"];
  /** Monster timed effect CONF that confusion sets. API 2: host-interpreted projection declaration. */
  readonly MON_TMD: CoreNs["MON_TMD"];
  /** Race flag NO_CONF that halves confusion damage. API 2: host-interpreted projection declaration. */
  readonly RF: CoreNs["RF"];
  /** Player timed effects: CONFUSED for the projection, BLIND for Remove Curse's message. API 2: projection declaration; BLIND as a view field. */
  readonly TMD: CoreNs["TMD"];
  /** Object description mode BASE for item names in effect messages. API 2: a view field with the item's known name. */
  readonly ODESC: CoreNs["ODESC"];
  /** Object flag HOLD_LIFE, checked and learned by Lose Memories. API 2: host-interpreted effect declaration. */
  readonly OF: CoreNs["OF"];
  /** Notice bit COMBINE, set after an item changes. API 2: host bookkeeping inside an effect declaration. */
  readonly PN: CoreNs["PN"];
  /** Local keypad offsets avoid an engine read for fixed command data. */
  readonly DDGRID: readonly { readonly x: number; readonly y: number }[];
  /** Live game env (state, item registry) off an effect context. API 2: none; each handler needs a host-interpreted effect declaration. */
  readonly gameEnv: CoreNs["gameEnv"];
  /** Item name for effect messages. API 2: a view field with the item's known name. */
  readonly describeObject: CoreNs["describeObject"];
  /** "Your" or "The" in the enchant message. API 2: a view field. */
  readonly objectIsCarried: CoreNs["objectIsCarried"];
  /** Single-item weight for the bookkeeping after curses lift. API 2: host bookkeeping inside the uncurse declaration. */
  readonly objectWeightOne: CoreNs["objectWeightOne"];
  /** Lifts one curse from an object. API 2: host-interpreted uncurse policy table (power tiers per source). */
  readonly removeObjectCurse: CoreNs["removeObjectCurse"];
  /** Item prompt for the ENCHANT effect. API 2: the host owns the prompt inside an effect declaration. */
  readonly requestForEffect: CoreNs["requestForEffect"];
  /** Ammo enchants at a twentieth of the odds. API 2: content lookup of the item class, or the enchant policy. */
  readonly tvalIsAmmo: CoreNs["tvalIsAmmo"];
  /** Rebuilds slays from kind and ego for the curse scrolls. API 2: host-interpreted effect declaration. */
  readonly copySlays: CoreNs["copySlays"];
  /** Rebuilds brands from kind and ego for the curse scrolls. API 2: host-interpreted effect declaration. */
  readonly copyBrands: CoreNs["copyBrands"];
  /** Applies the ego's curses for the curse scrolls (draws RNG). API 2: host-interpreted effect declaration. */
  readonly copyCurses: CoreNs["copyCurses"];
  /** Hold Life check for Lose Memories. API 2: host-interpreted effect declaration. */
  readonly playerOfHas: CoreNs["playerOfHas"];
  /** Drains experience for Lose Memories. API 2: host-interpreted effect declaration. */
  readonly playerExpLose: CoreNs["playerExpLose"];
  /** Experience-loss dependencies from the effect context. API 2: host-interpreted effect declaration. */
  readonly effectExpDeps: CoreNs["effectExpDeps"];
  /** Teaches the Hold Life rune. API 2: host-interpreted effect declaration. */
  readonly equipLearnFlag: CoreNs["equipLearnFlag"];
  /** Confusion redirect for the spike command. API 2: host-declared command. */
  readonly playerConfuseDir: CoreNs["playerConfuseDir"];
  /** Uses up one spike from the pack. API 2: host-declared command that consumes an item. */
  readonly gearObjectForUse: CoreNs["gearObjectForUse"];
  /** Item class index by name for the junk kinds. API 2: `content.records` or `content.lookup`. */
  readonly tvalFindIdx: CoreNs["tvalFindIdx"];
}

/** The registry seams. None has an API 2 counterpart. */
export interface EngineRegistry {
  /** Installs an effect handler (Lose Memories, classic uncurse, curse scrolls). API 2: host-interpreted effect declaration. Null without `registry:effect`. */
  readonly registerEffect: ((code: Parameters<NonNullable<HostLike["effects"]>["register"]>[0], handler: EffectHandler) => void) | null;
  /** Sets an effect's recall text. API 2: effect text as content data. Null without the effect-info seam. */
  readonly setEffectText: NonNullable<HostLike["effectInfo"]>["text"]["set"] | null;
  /** Confusion's effect on the player. API 2: host-interpreted projection declaration. Null without `registry:projection`. */
  readonly setPlayerProjection: NonNullable<HostLike["projections"]>["player"]["set"] | null;
  /** Confusion's effect on a monster. API 2: host-interpreted projection declaration. Null without `registry:projection`. */
  readonly setMonsterProjection: NonNullable<HostLike["projections"]>["mon"]["set"] | null;
  /** Store discount roll; runs synchronously during store stocking on the live RNG. API 2: host-interpreted policy table (tiers, odds, 5-gold floor). */
  readonly setDiscountRoll: HostLike["stores"]["setDiscountRoll"];
  /** Installs the spike command; its action receives the live GameState. API 2: host-declared command. */
  readonly registerCommand: HostLike["commands"]["register"];
  /** Names a command in prompts. API 2: part of the command declaration. */
  readonly setCommandVerb: HostLike["commands"]["setVerb"];
}

/** What the junk restoration needs from a new character. */
export interface NewCharacterGame {
  /** Item class index by name, or a negative number when there is none. */
  tvalFindIdx(name: string): number;
  /** The index of the object kind with this name in this item class, or undefined. */
  findKind(name: string, tval: number): number | undefined;
  /** Ignores a kind both before and after the player learns it. */
  ignoreKind(kidx: number): void;
}

export interface AdapterEngine {
  /** Null when the host gave no core namespace. */
  readonly core: EngineCore | null;
  /** Null outside `register(host, ctx)`. */
  readonly registry: EngineRegistry | null;
  /** The newCharacter hook over the live state and registries. API 2: a content declaration of kinds ignored at birth. */
  newCharacter(run: (game: NewCharacterGame) => void): NonNullable<ModHooks["newCharacter"]>;
}

export interface Adapter<R extends EngineRegistry | null = EngineRegistry | null> {
  readonly meta: AdapterMeta;
  readonly ui: AdapterUi;
  readonly engine: AdapterEngine & { readonly registry: R };
}

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

function pickCore(core: CoreNs): EngineCore {
  return {
    EF: core.EF,
    ENCH_TOHIT: core.ENCH_TOHIT,
    ENCH_TODAM: core.ENCH_TODAM,
    ENCH_TOAC: core.ENCH_TOAC,
    ENCH_TOBOTH: core.ENCH_TOBOTH,
    MON_MSG: core.MON_MSG,
    MON_TMD: core.MON_TMD,
    RF: core.RF,
    TMD: core.TMD,
    ODESC: core.ODESC,
    OF: core.OF,
    PN: core.PN,
    DDGRID,
    gameEnv: core.gameEnv,
    describeObject: core.describeObject,
    objectIsCarried: core.objectIsCarried,
    objectWeightOne: core.objectWeightOne,
    removeObjectCurse: core.removeObjectCurse,
    requestForEffect: core.requestForEffect,
    tvalIsAmmo: core.tvalIsAmmo,
    copySlays: core.copySlays,
    copyBrands: core.copyBrands,
    copyCurses: core.copyCurses,
    playerOfHas: core.playerOfHas,
    playerExpLose: core.playerExpLose,
    effectExpDeps: core.effectExpDeps,
    equipLearnFlag: core.equipLearnFlag,
    playerConfuseDir: core.playerConfuseDir,
    gearObjectForUse: core.gearObjectForUse,
    tvalFindIdx: core.tvalFindIdx,
  };
}

function engineRegistry(host: HostLike): EngineRegistry {
  const { effects, effectInfo, projections, stores, commands } = host;
  return {
    registerEffect: effects ? (code, handler) => effects.register(code, { handler }) : null,
    setEffectText: effectInfo ? (code, text) => effectInfo.text.set(code, text) : null,
    setPlayerProjection: projections ? (code, handler) => projections.player.set(code, handler) : null,
    setMonsterProjection: projections ? (code, handler) => projections.mon.set(code, handler) : null,
    setDiscountRoll: (roll) => stores.setDiscountRoll(roll),
    registerCommand: (code, action) => commands.register(code, action),
    setCommandVerb: (code, verb) => commands.setVerb(code, verb),
  };
}

/** Builds the adapter from the plugin context, and from the registry host inside `register`. */
export function createAdapter(ctx: HookCtx): Adapter<null>;
export function createAdapter(ctx: HookCtx, host: HostLike): Adapter<EngineRegistry>;
export function createAdapter(ctx: HookCtx, host?: HostLike): Adapter {
  const core = ctx.core ? pickCore(ctx.core) : null;
  const keymaps = ctx.keymaps;
  return {
    meta: {
      flags: ctx.flags,
      log: (message) => ctx.log?.(message),
    },
    ui: {
      keys: keymaps
        ? { bind: (trigger, action) => keymaps.isBindableTriggerKey(trigger) && keymaps.bind(trigger, action) }
        : null,
    },
    engine: {
      core,
      registry: host ? engineRegistry(host) : null,
      newCharacter(run) {
        if (!core) throw new Error("The newCharacter hook requires the live core namespace");
        const { tvalFindIdx } = core;
        return (state: GameState, registries: CoreRegistries) =>
          run({
            tvalFindIdx,
            findKind: (name, tval) => registries.objects.kinds.find((k) => k?.name === name && k.tval === tval)?.kidx,
            ignoreKind: (kidx) => {
              state.ignore.kindIgnoreWhenAware(kidx);
              state.ignore.kindIgnoreWhenUnaware(kidx);
            },
          });
      },
    },
  };
}

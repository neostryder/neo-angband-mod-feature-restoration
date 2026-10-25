/**
 * A stand-in for the API 2 host, so the tests can call the mod's entry the way
 * the game does: `engineHooks` with the flags and the engine domain, and `start`
 * with a running mod. The call shapes follow the old `hooks(ctx)` and
 * `register(host, ctx)` tests, so each of those reads the same way.
 */
import { vi } from "vitest";
import type { Api2Engine, Api2Policies, ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
// @ts-expect-error The test imports the handwritten source module.
import plugin from "../plugin.ts";

/** The pieces a test supplies; everything else about the game is absent. */
export interface FakeGame {
  readonly flags: Readonly<Record<string, boolean>>;
  /** The live core namespace, or a stand-in for the names a handler reads. */
  readonly core?: unknown;
  /** The registry host the engine domain carries, when the test has one. */
  readonly host?: unknown;
  /** A keymap double with the old synchronous shape; absent means `keymap:write` is not granted. */
  readonly keymaps?: { isBindableTriggerKey(trigger: string): boolean; bind(trigger: string, action: string): boolean };
  /** Receives every `meta.log` line. */
  readonly log?: (message: string) => void;
}

function engineOf(game: FakeGame): Api2Engine | undefined {
  if (game.core === undefined && game.host === undefined) return undefined;
  return { api: "1.0.0", core: game.core, state: undefined, registries: undefined, ...(game.host === undefined ? {} : { registry: game.host }) } as unknown as Api2Engine;
}

/** What `engineHooks` returns for these flags and this engine domain. */
export function engineHooksFor(game: FakeGame): Record<string, ((...args: never[]) => unknown) | undefined> {
  const engine = engineOf(game) ?? ({ api: "1.0.0", core: undefined, state: undefined, registries: undefined } as unknown as Api2Engine);
  return (plugin.engineHooks({ id: "feature-restoration", flags: game.flags, engine }) ?? {}) as Record<string, ((...args: never[]) => unknown) | undefined>;
}

/** The policy tables the mod declares for these flags. */
export function policiesFor(flags: Readonly<Record<string, boolean>>): Api2Policies | undefined {
  return plugin.policies({ id: "feature-restoration", flags });
}

/** Run the mod's `start` against a game built from the pieces given, and wait for it. */
export async function startWith(game: FakeGame): Promise<void> {
  const engine = engineOf(game);
  const granted = game.keymaps !== undefined;
  const refused = { ok: false, code: "refused", message: "refused" };
  const mod = {
    meta: {
      flags: game.flags,
      log: (message: string) => game.log?.(message),
      granted: (capability: string) => (capability === "keymap:write" ? granted : true),
    },
    ui: {
      keys: {
        bind: vi.fn(async (trigger: string, action: string) =>
          game.keymaps && game.keymaps.isBindableTriggerKey(trigger) && game.keymaps.bind(trigger, action) ? { ok: true, value: null } : refused,
        ),
      },
    },
    ...(engine ? { engine } : {}),
  } as unknown as ModApi2;
  await plugin.start(mod);
}

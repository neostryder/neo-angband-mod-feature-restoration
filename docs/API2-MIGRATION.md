# Cutting Room Floor and mod API 2

Cutting Room Floor, the first-party mod that restores content cut from the base game, runs on mod API 2. Its manifest asks for API `>=2.0.0 <3.0.0` and engine `>=1.22.0` and holds seven capabilities: `registry:store`, `registry:effect`, `registry:effect-info`, `registry:projection`, `registry:command`, `keymap:write`, and `engine:access`. `plugin.ts` exports one definition with `policies`, `engineHooks`, and `start`. Only `src/core-adapter.ts` reads the engine domain. The rest of the code gets its flags, its log, and the engine names from `src/core-adapter-api2.ts`.

## What each restoration uses

| Restoration | API 2 form | Status |
| --- | --- | --- |
| Store discounts | `policies`: a `storeDiscountRoll` table, present while `feature-restoration.discounts` is on | Works. The game rolls the table when it stocks a store. |
| Junk items | `engineHooks`: a `newCharacter` hook built from the engine domain | Works. |
| Lose Memories effect | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effect is `FEATURE_RESTORATION_LOSE_EXP`, because the game reads an effect line as `name:type:radius:other`, so a name with a colon never resolves. |
| Bronze dragons' confusion | `start`, through `engine.registry` (`registry:projection`) | Works. The game resolves the breath's projection name against the mod's own projection table. |
| Classic uncursing | `start`, through `engine.registry` (`registry:effect`) | Works. |
| Sticky-curse scrolls | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effects are `FEATURE_RESTORATION_CURSE_WEAPON` and `FEATURE_RESTORATION_CURSE_ARMOR`. |
| Spike command | `start`, through `engine.registry` (`registry:command`), plus `ui.commands` and `ui.keys` (`keymap:write`) | Works. `j` asks for a direction, then spikes that way and spends the turn the command returns. |

## What is still open

Nothing. The game resolves a mod's projection name for a breath, a monster casts a spell a mod added, a key bound to a direction command runs inside the turn when the command is registered with `turn: true`, and the load-time check leaves out findings the base game's own records already raise.

## How the tests drive the entry

`test/api2.ts` stands in for the host. `engineHooksFor` returns what `engineHooks` yields for a set of flags and an engine domain, and `policiesFor` returns the declared tables. `startWith` runs `start` against a fake mod that carries a core namespace and, when a test supplies them, a registry host, a keymap double, a game state, a projection table, and a list that collects the commands the mod registers.

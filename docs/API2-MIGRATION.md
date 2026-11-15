# Cutting Room Floor and mod API 2

Cutting Room Floor is the first-party mod that restores content cut from the base game, and it runs on mod API 2. Its manifest asks for API `>=2.3.0 <3.0.0` and engine `>=1.23.0-beta.1` and holds nine capabilities: `registry:store`, `registry:effect`, `registry:effect-info`, `registry:projection`, `registry:command`, `registry:glyph`, `registry:room`, `keymap:write`, and `engine:access`. `plugin.ts` exports one definition with `policies`, `engineHooks`, and `start`. Only `src/core-adapter.ts` reads the engine domain, and the rest of the code gets its flags, its log, and the engine names from `src/core-adapter-api2.ts`.

## What each restoration uses

| Restoration | API 2 form | Status |
| --- | --- | --- |
| Store discounts | `policies`: a `storeDiscountRoll` table, present while `feature-restoration.discounts` is on | Works. The game rolls the table when it stocks a store. |
| Junk items | `engineHooks`: a `newCharacter` hook built from the engine domain | Works. |
| Lose Memories effect | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effect is `FEATURE_RESTORATION_LOSE_EXP`, because the game reads an effect line as `name:type:radius:other`, so a name with a colon never resolves. |
| Bronze dragons' confusion | `start`, through `engine.registry` (`registry:projection`) | Works. The game resolves the breath's projection name against the mod's own projection table. |
| Vault trap density | `start`, through `engine.registry` (`registry:glyph`) | The vault ^ handler calls host trap placement without a density roll. |
| General trap density | `policies`: `trapAllocation` under `registry:room`, present while `feature-restoration.general-trap-density` is on | Classic levels use 4.0.5's bounded one-die count and both room and corridor placement. |
| Classic uncursing | `start`, through `engine.registry` (`registry:effect`) | Works. |
| Sticky-curse scrolls | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effects are `FEATURE_RESTORATION_CURSE_WEAPON` and `FEATURE_RESTORATION_CURSE_ARMOR`. |
| Spike command | `start`, through `engine.registry` (`registry:command`), plus `ui.commands` and `ui.keys` (`keymap:write`) | Works. `j` asks for a direction, then spikes that way and spends the turn the command returns. |

## What is still open

Active searching stays unrestored until its design is decided. General dungeon trap density uses the host's generation policy, and vault trap density uses the existing glyph registry.

### CRF-9: cursed light suppression

Angband 4.0.5's calc_torch in src/player-calcs.c tests of_has(obj->flags, OF_LIGHT_CURSE) before adding each worn object's light, and it does not test for other curses or for stickiness. Core d27ed50f9's cursedLightGivesNone in packages/core/src/player/calcs.ts accepts OF.STICKY or any curse with power above zero. The cursedLightRadius policy is a boolean, so it cannot select the historical flag or tell a restored curse from a later one. Neither sticky-curses setting turns this policy on.

| ID | What fails | Smallest addition | Priority | Status |
| --- | --- | --- | --- | --- |
| CRF-9 | Restoring 4.0.5 light suppression through cursedLightRadius also suppresses light for unrelated active 4.2 curses and sticky-only items. Evidence: 4.0.5 calc_torch tests the object's OF_LIGHT_CURSE; d27ed50f9 cursedLightGivesNone tests OF.STICKY or any positive curse power. | Add a LIGHT_CURSE-equivalent marker to object and curse records, plus a cursedLightRadius selector that tests that marker while Core retains the item truth. | degrade | Open against d27ed50f9; the boolean policy remains unused. |

The game resolves a mod's projection name for a breath, a monster casts a spell a mod added, a key bound to a direction command runs inside the turn when the command is registered with `turn: true`, and the load-time check leaves out findings the base game's own records already raise.

## How the tests drive the entry

`test/api2.ts` stands in for the host. `engineHooksFor` returns what `engineHooks` yields for a set of flags and an engine domain, and `policiesFor` returns the declared tables. `startWith` runs `start` against a fake mod that carries a core namespace and, when a test supplies them, a registry host, a keymap double, a game state, a projection table, and a list that collects the commands the mod registers.

# Cutting Room Floor and mod API 2

Cutting Room Floor, the first-party mod that restores content cut from the base game, runs on mod API 2. Its manifest asks for API `>=2.0.0 <3.0.0` and engine `>=1.22.0` and holds six capabilities: `registry:store`, `registry:effect`, `registry:effect-info`, `registry:projection`, `registry:command`, and `engine:access`. `plugin.ts` exports one definition with `policies`, `engineHooks`, and `start`. Only `src/core-adapter.ts` reads the engine domain. The rest of the code gets its flags, its log, and the engine names from `src/core-adapter-api2.ts`.

## What each restoration uses

| Restoration | API 2 form | Status |
| --- | --- | --- |
| Store discounts | `policies`: a `storeDiscountRoll` table, present while `feature-restoration.discounts` is on | Works. The game rolls the table when it stocks a store. |
| Junk items | `engineHooks`: a `newCharacter` hook built from the engine domain | Works. |
| Lose Memories effect | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effect is `FEATURE_RESTORATION_LOSE_EXP`, because the game reads an effect line as `name:type:radius:other`, so a name with a colon never resolves. |
| Bronze dragons' confusion | `start`, through `engine.registry` (`registry:projection`) | Installed. The game never lets a monster cast a spell a mod added (gap CRF-4), so the dragons do not breathe yet. |
| Classic uncursing | `start`, through `engine.registry` (`registry:effect`) | Works. |
| Sticky-curse scrolls | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effects are `FEATURE_RESTORATION_CURSE_WEAPON` and `FEATURE_RESTORATION_CURSE_ARMOR`. |
| Spike command | `start`, through `engine.registry` (`registry:command`) | Installed, but no key or menu reaches it yet (gap CRF-3). |

## What is still open

CRF-3: a key bound with `ui.keys.bind` replays its action as typed keys, so a command that needs a direction, such as spiking a door, cannot be the target of a key. The mod therefore binds no key. The command is registered and named "spike", and it becomes playable once a keymap action can name a registered command.

CRF-4: the game builds the list of spells a monster may cast from its compiled spell count, which leaves out a spell a mod adds. The bronze dragons carry the BR_CONF spell and their confusion handlers are installed, but a dragon never chooses to breathe.

## How the tests drive the entry

`test/api2.ts` stands in for the host. `engineHooksFor` returns what `engineHooks` yields for a set of flags and an engine domain, and `policiesFor` returns the declared tables. `startWith` runs `start` against a fake mod that carries a core namespace and, when a test supplies them, a registry host and a keymap double.

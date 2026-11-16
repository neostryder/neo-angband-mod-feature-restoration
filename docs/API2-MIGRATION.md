# Cutting Room Floor and mod API 2

Cutting Room Floor is the first-party mod that restores content cut from the base game, and it runs on mod API 2. Its manifest asks for API `>=2.6.0 <3.0.0` and engine `>=1.23.0-beta.1` and holds ten capabilities: `registry:store`, `registry:effect`, `registry:effect-info`, `registry:projection`, `registry:command`, `registry:glyph`, `registry:room`, `registry:ui-entry`, `keymap:write`, and `engine:access`. `plugin.ts` exports one definition with `policies`, `engineHooks`, and `start`. Only `src/core-adapter.ts` reads the engine domain, and the rest of the code gets its flags, its log, and the engine names from `src/core-adapter-api2.ts`.

## What each restoration uses

| Restoration | API 2 form | Status |
| --- | --- | --- |
| Store discounts | `policies`: a `storeDiscountRoll` table, present while `feature-restoration.discounts` is on | Works. The game rolls the table when it stocks a store. |
| Junk items | `engineHooks`: a `newCharacter` hook built from the engine domain | Works. |
| Lose Memories effect | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effect is `FEATURE_RESTORATION_LOSE_EXP`, because the game reads an effect line as `name:type:radius:other`, so a name with a colon never resolves. |
| Bronze dragons' confusion | `start`, through `engine.registry` (`registry:projection`) | Works. The game resolves the breath's projection name against the mod's own projection table. |
| Vault trap density | `start`, through `engine.registry` (`registry:glyph`) | The vault ^ handler calls host trap placement without a density roll. |
| Active searching | `policies`: `classicSearch`, plus host-owned turn commands under `registry:command` and `keymap:write` | The default-off rule binds s to search and S or # to toggle search mode, leaving keys that already have bindings untouched. |
| General trap density | `policies`: `trapAllocation` under `registry:room`, present while `feature-restoration.general-trap-density` is on | Classic levels use 4.0.5's bounded one-die count and both room and corridor placement. |
| Cursed light suppression | `policies`: `cursedLightRadius: { marker: "LIGHT_CURSE" }` under `registry:ui-entry`, plus section-gated content markers | The default-off section marks ten artifacts, two egos, and ten curse counterparts without marking shared object kinds. |
| Classic uncursing | `start`, through `engine.registry` (`registry:effect`) | Works. |
| Sticky-curse scrolls | `start`, through `engine.registry` (`registry:effect`, `registry:effect-info`) | Works. The effects are `FEATURE_RESTORATION_CURSE_WEAPON` and `FEATURE_RESTORATION_CURSE_ARMOR`. |
| Spike command | `start`, through `engine.registry` (`registry:command`), plus `ui.commands` and `ui.keys` (`keymap:write`) | Works. `j` asks for a direction, then spikes that way and spends the turn the command returns. |

## Search behavior and remaining gaps

### CRF-7: active searching

`feature-restoration.classic-search` is a default-off rule that declares the `classicSearch` policy under `registry:command`. It registers two commands, search and toggle-search, and both set `turn: true`. Their `hostOperation` values are `classic-search` and `toggle-classic-search`, and the mod binds them to s and to S or # only when those keys are free. Both operations run in the host. The hidden traps, doors, and chests stay in host state, and the host also makes the RNG rolls, keeps search mode, and charges energy. The mod never reads hidden state and gets no result back about what a search found. `classic-search.test.ts` compares the host's behavior with `search`, `do_cmd_search`, and `do_cmd_toggle_search` in Angband 4.0.5 `cmd-cave.c`. It checks that each grid gets its own roll, that both chance penalties apply, and that discoveries match. It also checks that a search with zero chance spends no energy. General trap density on dungeon levels comes from the host's generation policy, and vault trap density comes from the existing glyph registry.

### CRF-9: cursed light suppression

In Angband 4.0.5, `calc_torch` in `src/player-calcs.c` tests `of_has(obj->flags, OF_LIGHT_CURSE)` before adding each worn object's light. It tests no other curse and no stickiness. The default-off `feature-restoration.cursed-light` section marks the historical counterparts and declares `cursedLightRadius: { marker: "LIGHT_CURSE" }` under `registry:ui-entry`. Neither sticky-curses setting enables this policy.

Core c4d0bf92e binds `light-curse: true` on artifact, ego, and curse records and evaluates the selector in `cursedLightGivesNone` inside `calcLight`. Artifact and ego markers remain for the item's lifetime, including after curse removal. A curse counterpart selects an item only while that curse has positive power. The mod applies no marker to a shared object kind. Angband 4.0.5 `object.txt` has no LIGHT_CURSE records; `artifact.txt` has ten, and `ego_item.txt` has fourteen. The table lists all 24 historical records, with three Vulnerability egos sharing one Core curse. Air swing has no historical counterpart and remains unmarked.

| 4.0.5 file and record ID | Core record | Marker |
| --- | --- | --- |
| artifact.txt 13 | artifact core:the-one-ring | light-curse: true |
| artifact.txt 34 | artifact core:of-morgoth | light-curse: true |
| artifact.txt 35 | artifact core:of-ber-thiel | light-curse: true |
| artifact.txt 41 | artifact core:of-gorlim | light-curse: true |
| artifact.txt 58 | artifact core:camlost | light-curse: true |
| artifact.txt 63 | artifact core:of-wormtongue | light-curse: true |
| artifact.txt 71 | artifact core:calris | light-curse: true |
| artifact.txt 78 | artifact core:mormegil | light-curse: true |
| artifact.txt 92 | artifact core:of-melkor | light-curse: true |
| artifact.txt 123 | artifact core:of-gothmog | light-curse: true |
| ego_item.txt 10 | curse core:vulnerability | light-curse: true |
| ego_item.txt 23 | curse core:vulnerability | light-curse: true |
| ego_item.txt 35 | curse core:teleportation | light-curse: true |
| ego_item.txt 38 | curse core:dullness | light-curse: true |
| ego_item.txt 39 | curse core:sickliness | light-curse: true |
| ego_item.txt 44 | curse core:enveloping | light-curse: true |
| ego_item.txt 45 | curse core:vulnerability | light-curse: true |
| ego_item.txt 46 | curse core:irritation | light-curse: true |
| ego_item.txt 54 | curse core:weakness | light-curse: true |
| ego_item.txt 55 | curse core:clumsiness | light-curse: true |
| ego_item.txt 62 | curse core:slowness | light-curse: true |
| ego_item.txt 63 | curse core:annoyance | light-curse: true |
| ego_item.txt 102 | ego_item core:of-morgul | light-curse: true |
| ego_item.txt 111 | ego_item core:of-the-nazg-l | light-curse: true |

| ID | Restoration | Status |
| --- | --- | --- |
| CRF-9 | Historical LIGHT_CURSE counterparts give no light while worn, independently of sticky curses. | Closed on Core c4d0bf92e with API 2.6.0 artifact and ego markers and the LIGHT_CURSE selector. |

The game resolves a mod's projection name for a breath, a monster casts a spell a mod added, a key bound to a direction command runs inside the turn when the command is registered with `turn: true`, and the load-time check leaves out findings the base game's own records already raise.

## How the tests drive the entry

`test/api2.ts` stands in for the host. `engineHooksFor` returns what `engineHooks` yields for a set of flags and an engine domain, and `policiesFor` returns the declared tables. `startWith` runs `start` against a fake mod that carries a core namespace and, when a test supplies them, a registry host, a keymap double, a game state, a projection table, and a list that collects the commands the mod registers.

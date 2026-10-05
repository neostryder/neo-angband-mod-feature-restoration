# Cutting Room Floor and mod API 2

The schema 2 manifest keeps Cutting Room Floor on API 1 with range `>=1.0.0 <2.0.0` and runtime `in-process`. Conversion preserves every original field after SDK normalization, including the six grants. The folder loader accepts this manifest. An API 2 entry still needs the loader change in R1.

`src/core-adapter-api2.ts` exports `createAdapter(mod: ModApi2)`. It returns flags and forwards log messages through `meta`. Key binding returns `Promise<boolean>`: success gives `true`, an ordinary refusal gives `false`, and a host fault rejects the promise. Denying `keymap:write` makes `ui.keys` null. Trigger validation runs inside the host binding call.

Most of the plugin still runs through registry handlers and a hook with live objects. The twin omits `engine.core`, `engine.registry`, `engine.newCharacter` and the registry-host overload of `createAdapter`. A port needs the Core declarations proposed here, an API 2 entry and `await` at the key-binding call. Changing the adapter import alone is insufficient.

## Gap table

The table counts members and groups of related live fields. A moved row removes a read from the running plugin. A home row has an existing API 2 call, with the entry still using API 1. A Core request row waits for a missing operation or synchronous handler context.

| Old member | API 2 home or Core request | Notes |
| --- | --- | --- |
| `ctx.flags` | Home, unwired: `meta.flags` | The flag map comes from `meta.flags`. |
| `ctx.log` | Home, unwired: `meta.log` | The message goes to `meta.log`. |
| `ctx.keymaps.isBindableTriggerKey` | Home, unwired: `ui.keys.bind` | An invalid trigger returns a refusal before the binding is written. |
| `ctx.keymaps.bind` | Home, unwired: `ui.keys.bind` | The twin converts the result to an asynchronous boolean. |
| `ctx.core.EF` | Core request R3, R4 | Effect declarations name `REMOVE_CURSE` and `ENCHANT` by code. |
| `ctx.core.ENCH_TOHIT` | Core request R4 | The enchant policy names `toH`. |
| `ctx.core.ENCH_TODAM` | Core request R4 | The enchant policy names `toD`. |
| `ctx.core.ENCH_TOAC` | Core request R4 | The enchant policy names `toA`. |
| `ctx.core.ENCH_TOBOTH` | Core request R4 | The policy preserves combined hit and damage attempts. |
| `ctx.core.MON_MSG` | Core request R5 | The projection declaration names resistance messages. |
| `ctx.core.MON_TMD` | Core request R5 | Core applies monster confusion from the declaration. |
| `ctx.core.RF` | Core request R5 | The policy tests `NO_CONF`, including unseen monsters. |
| `ctx.core.TMD.CONFUSED` | Core request R5 | Core applies player confusion from the declaration. |
| `ctx.core.TMD.BLIND` | Home, unwired: `view.player().status.blind` | R3 still needs the value synchronously inside Remove Curse. |
| `ctx.core.ODESC` | Core request R6 | The effect message requires the known base name. |
| `ctx.core.OF` | Core request R3 | Lose Memories tests and teaches `HOLD_LIFE`. |
| `ctx.core.PN` | Core request R3, R4 | The host combines changed stacks after the effect. |
| `ctx.core.DDGRID` | Moved: local adapter data | Local offsets replace the fixed engine table. |
| `ctx.core.gameEnv` | Core request R2, R3 | The handlers retain the live effect environment. |
| `ctx.core.describeObject` | Core request R6 | The known base name needs a field or effect formatting context. |
| `ctx.core.objectIsCarried` | Core request R6 | A prompt-selected item needs its carried state. |
| `ctx.core.objectWeightOne` | Core request R3 | The host updates curse-dependent weight after uncursing. |
| `ctx.core.removeObjectCurse` | Core request R3 | The uncurse declaration lifts curses by source power tier. |
| `ctx.core.requestForEffect` | Core request R3, R4 | The declaration requests the host's enchant item prompt. |
| `ctx.core.tvalIsAmmo` | Core request R4 | The enchant policy applies the ammunition probability divisor. |
| `ctx.core.copySlays` | Core request R3 | The curse effect rebuilds kind and ego slays. |
| `ctx.core.copyBrands` | Core request R3 | The curse effect rebuilds kind and ego brands. |
| `ctx.core.copyCurses` | Core request R3 | The curse effect applies ego curses with the live RNG. |
| `ctx.core.playerOfHas` | Core request R3 | Lose Memories checks the actual Hold Life flag. |
| `ctx.core.playerExpLose` | Core request R3 | The effect drains a quarter of current experience. |
| `ctx.core.effectExpDeps` | Core request R3 | The host supplies experience-loss bookkeeping. |
| `ctx.core.equipLearnFlag` | Core request R3 | The effect teaches Hold Life even when it prevents the loss. |
| `ctx.core.playerConfuseDir` | Core request R8 | The command redirects the direction after committing the turn. |
| `ctx.core.gearObjectForUse` | Core request R8 | The command consumes one spike after jamming the door. |
| `ctx.core.tvalFindIdx` | Core request R11 | Class records lack their bound numeric indices. |
| `host.effects.register` / `registerEffect` | Core request R3, R4 | API 2 has no effect registration seam. |
| `host.effectInfo.text.set` / `setEffectText` | Core request R9 | Effect recall text needs a host-read content declaration. |
| `host.projections.player.set` / `setPlayerProjection` | Core request R5 | The host interprets the player projection declaration. |
| `host.projections.mon.set` / `setMonsterProjection` | Core request R5 | The host interprets the monster projection declaration. |
| `host.stores.setDiscountRoll` / `setDiscountRoll` | Core request R7 | The policy runs during stocking on the live RNG. |
| `host.commands.register` / `registerCommand` | Core request R8 | Command submission has no registration seam. |
| `host.commands.setVerb` / `setCommandVerb` | Core request R8 | The command declaration includes its prompt verb. |
| Plugin `api: 1` | Core request R1 | The folder loader needs an API 2 definition path. |
| Plugin `hooks(ctx)` | Core request R10 | The only hook produced is `newCharacter`. |
| Plugin `register(host, ctx)` | Core request R2-R5, R7-R9 | API 2 has no registry host member. |
| Hook `newCharacter(state, registries)` | Core request R10 | `meta.newCharacter` is a boolean, not the birth hook. |
| Effect `ctx.env.messages.msg` | Core request R3, R4 | The declaration emits the current effect messages. |
| Effect `ctx.value`, `ctx.subtype`, `ctx.ident` | Core request R3, R4 | The host evaluates source dice, selects enchant scores and records identification. |
| Effect `state.actor.player` | Core request R3, R4, R6 | The handlers read body slots, equipment, experience, timed effects and upkeep. |
| Effect `state.gear.store` | Core request R3 | The handlers resolve and change equipped objects. |
| Effect `state.rng` | Core request R3, R4 | RNG calls keep their current order and conditional draws. |
| Effect `state.chunk.depth` | Core request R4 | The enchant source dice use the dungeon depth. |
| Effect `state.updateBonuses`, `state.runeEnv` | Core request R3, R4 | The host updates bonuses and rune knowledge. |
| Effect `reg.egos`, `reg.curses`, `reg.slays`, `reg.brands` | Core request R2, R3 | The handlers use the bound item registry. |
| Effect live object fields and `flags.copy/union/diff` | Core request R2, R3, R4 | Resetting an ego changes powers, modifiers, elements, activation, effect, timeout dice, curses and combat scores. |
| Projection `ctx.incTimed`, `ctx.rng`, `ctx.monTimed`, `ctx.mon`, `ctx.seen`, `ctx.obvious`, `ctx.r`, `ctx.hurtMsg`, `ctx.dam` | Core request R5 | The declaration preserves resistance, damage, status duration and visibility bookkeeping. |
| Discount `ctx.rng`, `ctx.cost` | Core request R7 | Five conditional rolls follow the price floor. |
| Command `state.actor.grid`, `state.gear`, `state.chunk.isClosedDoor/mon`, `state.doorLockPower/setDoorLock`, `state.msg`, `state.z.moveEnergy`, `cmd.dir` | Core request R8 | The command tests legality, spends energy, checks blockers and changes the door. |
| Birth `registries.objects.kinds`, `state.ignore.kindIgnoreWhenAware/Unaware` | Core request R10, R11 | The declaration ignores each junk kind before and after awareness. |

The 59 rows comprise 1 moved read, 5 API 2 homes that remain unwired, and 53 Core request rows. Replacing `DDGRID` reduces the core-name reads from 30 to 29. The plugin has no `controller`, `hud`, `menu`, `screen`, `birth`, `frontend` or `regions` member. It reads neither raw snapshots nor `ctx.state` or `ctx.registries` directly. Live state enters through handler and hook arguments. There are no API 2 calls to `events`, `store`, `content` or `act`.

## Core requests

R1. The folder loader needs to run an API 2 definition. It can use the existing in-process wrapper when the manifest range admits API 2. The build validator also needs to accept that definition instead of requiring an integer `api`. Both changes apply to in-process mods across tiers.

R2. A versioned `engine` domain gives the P-tier handlers their current namespace, state and registries while declarations remain incomplete. Its proposed members are `api`, `core`, `state` and `registries`, with synchronous contexts for effects and commands. The first-party loader check controls access. This domain is P-tier only, including live RNG and flag objects.

R3. A host-read `content.effects` declaration replaces the Lose Memories, uncurse and curse-scroll handlers. Each entry names a `code` and a `kind`. `loseExperience` takes fraction 0.25, prevention flag `HOLD_LIFE` and the same flag to learn after use. `uncurseEquipment` takes light power 40, heavy power 99 and permanent power 100, with source-dice selection and the current identification and message rules. `curseEquipment` takes a body slot and eligible ego reference, 50 percent artifact resistance, kind-reset rules and combat-score dice. Core supplies prompts, weight changes, notices, bonus updates and rune learning in the current RNG order. The effect grant can cover these declarations across tiers. Live callbacks under R2 stay P-tier only.

R4. An `enchantPolicy` declaration supplies the curse check after each score attempt. Its fields name the score table and score fields, ammunition divisor 20, artifact resistance 50 percent, curse-break odds one in four and permanent power 100. Core performs source-dice, stack and score checks before each curse roll, then runs the existing prompt and message steps. This removes the numeric `ENCH_*` and `tvalIsAmmo` reads from the policy. The effect grant can cover a table across tiers. A callback on live objects stays P-tier only.

R5. A `projectionPolicy` for `CONFUSION` supplies the player and monster handlers, including unseen monsters. Player status `CONFUSED` lasts `randint1(20) + 10` turns. Monster status `CONF` lasts `trunc((10 + randint1(15) + radius) / (radius + 1))`. Named breathers take `trunc(damage * 2 / (randint1(6) + 6))` damage, and `NO_CONF` monsters take `trunc(damage / 2)`. Core applies the resistance messages and obviousness rules. The projection grant can cover declarations across tiers. Live handlers stay P-tier only.

R6. Effect messages use the selected item's known base name, carried state and count, plus the player's blindness. The proposed effect formatting context is `{ baseName, carried, number, blind }`. Views already contain known item labels and `KnownPlayer.status.blind`, but they cannot answer midway through a synchronous handler. Adding `KnownItem.baseName` and `KnownItem.carried` also makes those facts available outside declarations. These known-data fields can serve every tier.

R7. A `discountPolicy` table supplies the stock-time discount roll. It has `minimumCost: 5` and ordered `{ oneIn, percent }` pairs `(25,10)`, `(50,25)`, `(150,50)`, `(300,75)` and `(500,90)`. Core draws each roll only after the preceding roll misses, stops at the first success and returns zero after five misses. A table uses the store grant across tiers. A function on the live RNG stays P-tier only.

R8. A host-read command declaration adds the spike action. It names `code`, `verb`, `kind: "spikeDoor"`, the spike kind and `maximumPower: 7`. Core checks the pack and target before committing a turn. It then redirects for confusion, tests the destination for a door or blocking monster, raises lock power and consumes one spike. A redirected invalid destination or blocker consumes the turn and leaves the spike in the pack. The command grant can cover this declaration across tiers. Live door and gear access stays P-tier only.

R9. An `effectText` content entry keyed by effect code supplies `menuName` and `describe` strings. Three overrides need it today. API 2 content reads do not install a text handler. The host must read these entries when it formats effects. The effect-info grant can cover the strings across tiers.

R10. A `birthDefaults` declaration applies the junk ignore rules before a new character starts play. Its `ignoredKinds` entries take a stable `kind` reference, `aware: true` and `unaware: true`. Core resolves the references and sets both ignore states at the current hook point while the junk section is on. The declaration can serve every tier. The existing hook with live state stays P-tier only.

R11. Content lookup finds records by class name or kind key, but the composed records lack the numeric `tval` and `kidx` values used by the birth adapter. R10 avoids these numbers by taking kind references. A numeric lookup, if retained, needs class bindings `{ name, index }` and kind bindings `{ key, kindIndex, tval }`. These bindings describe content and can serve every tier.

R12. The builder's `readManifestId` reads only a top-level `id`. With schema 2 it falls back to the checkout basename, so this build writes `overhaul-api2` in the plugin banner. Normalizing the manifest before reading the id fixes that directory dependency for every tier. The build check currently passes only against the banner produced for this directory.

## Removal list

The `ctx.core.DDGRID` read is removed. Its keypad offsets now live in the adapter. All six grants remain in use: `registry:store` waits on R7, `registry:command` on R8, `registry:projection` on R5, `registry:effect` on R3-R4 and `registry:effect-info` on R9. The spike key still needs `keymap:write`. Core and content remain development dependencies for types and the binding tests. The SDK provides manifest validation, conversion and API 2 types. The core content dependency and optional Linoleum dependency keep their ranges.

The other engine reads remain behind the API 1 adapter until their table requests are available. All gameplay handlers stay in the entry. The built plugin has `api: 1` and no runtime engine import.

## Verification

`pnpm verify` runs typechecking, every test and the committed-plugin build check. The twin tests compare flags, logging and binding answers with the API 1 adapter on matching facts. They also test refusals, a host fault and the local direction table. The boundary test parses TypeScript and rejects context assertions, spaced accesses, core re-exports, dynamic imports, engine suffixes and `ctx` in the twin.

The existing on/off checks are in `plugin.test.ts`, `bronze-dragons.test.ts`, `classic-uncurse.test.ts`, `junk.test.ts`, `sticky-curses.test.ts`, `sticky-egos.test.ts` and `classic-books.test.ts`. They test registry installation, birth defaults, curses and composed content. Pixel rendering and a complete live-game replay remain unverified.

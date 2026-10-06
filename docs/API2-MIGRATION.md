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

R1. The folder loader has to be able to run an API 2 definition, which it can do through the existing in-process wrapper when the manifest range admits API 2. The build validator also has to accept that definition instead of requiring an integer `api`. Both changes apply to in-process mods in every tier.

R2. The `engine` request covers more than the documented `engine = ctx.core` alias. `engine.core` is the live core namespace, and `engine.registry` holds this adapter's registry methods. Effect and command handlers get state and bound registries in synchronous contexts. Those contexts, along with their RNG and flag objects, are open only to P-tier mods that pass the first-party loader check.

R3. A `content.effects` declaration, read by the host, replaces the Lose Memories, uncurse and curse-scroll handlers. Each entry names a `code` and a `kind`. For `loseExperience` the entry gives fraction 0.25 and prevention flag `HOLD_LIFE`, and that same flag is learned after use. `uncurseEquipment` takes light power 40, heavy power 99 and permanent power 100, picks by source dice, and keeps the current identification and message rules. `curseEquipment` takes a body slot and an eligible ego reference, 50 percent artifact resistance, the kind-reset rules and combat-score dice. Core handles the prompts, weight changes, notices, bonus updates and rune learning, in the current RNG order. With the effect grant, any tier can use these declarations, but live callbacks under R2 remain P-tier only.

R4. An `enchantPolicy` declaration provides the curse check that follows each score attempt. Its fields give the score table and score fields, an ammunition divisor of 20, 50 percent artifact resistance, one-in-four curse-break odds and permanent power 100. Before each curse roll Core does the source-dice, stack and score checks, and after that it runs the existing prompt and message steps. The policy then has no need to read the numeric `ENCH_*` values or `tvalIsAmmo`. Under the effect grant a table works in any tier. A callback on live objects remains P-tier only.

R5. A `projectionPolicy` for `CONFUSION` provides the player and monster handlers, unseen monsters included. The player's `CONFUSED` status lasts `randint1(20) + 10` turns, and a monster's `CONF` status lasts `trunc((10 + randint1(15) + radius) / (radius + 1))`. Named breathers take `trunc(damage * 2 / (randint1(6) + 6))` damage, while `NO_CONF` monsters take `trunc(damage / 2)`. Resistance messages and obviousness rules come from Core. The projection grant lets declarations work in any tier, and live handlers stay P-tier only.

R6. Effect messages depend on the selected item's known base name, whether it is carried, and its count, plus whether the player is blind. The proposed effect formatting context for this is `{ baseName, carried, number, blind }`. Views already hold known item labels and `KnownPlayer.status.blind`, but they can't be asked partway through a synchronous handler. Adding `KnownItem.baseName` and `KnownItem.carried` would also make those facts available outside declarations. Every tier can use these known-data fields.

R7. A `discountPolicy` table provides the discount roll made at stock time. It has `minimumCost: 5` and the ordered `{ oneIn, percent }` pairs `(25,10)`, `(50,25)`, `(150,50)`, `(300,75)` and `(500,90)`. Core only draws a roll once the one before it has missed, stops at the first success, and returns zero if all five miss. A table falls under the store grant in any tier. A function on the live RNG remains P-tier only.

R8. The spike action comes from a command declaration that the host reads. It names the `code`, `verb`, `kind: "spikeDoor"`, the spike kind and `maximumPower: 7`. Core checks the pack and the target before it commits a turn. Then it redirects for confusion, tests whether the destination holds a door or a blocking monster, raises the lock power and uses up one spike. When the redirected destination is invalid or blocked, the turn is spent and the spike stays in the pack. The command grant lets any tier use this declaration. Live access to doors and gear stays P-tier only.

R9. Three overrides currently need an `effectText` content entry, keyed by effect code, that provides `menuName` and `describe` strings. API 2 content reads don't install a text handler, so the host has to read these entries itself when it formats an effect. The effect-info grant can cover the strings in any tier.

R10. To replace the junk birth hook, Core needs a `birthDefaults.ignoredKinds` list. Each entry gives a stable kind reference and sets both `aware` and `unaware` to `true`. Resolving the reference takes the place of `findKind(name, tval)`, and setting both ignore states takes the place of `ignoreKind(kidx)`. When the junk section is on, Core applies the list at the existing birth hook point. Any tier can use the list, and the live-state hook stays P-tier only.

R11. Content lookup can find records by class name or kind key, but the composed records don't carry the numeric `tval` and `kidx` values that the birth adapter uses. R10 sidesteps those numbers by taking kind references. If a numeric lookup is kept, it needs class bindings `{ name, index }` and kind bindings `{ key, kindIndex, tval }`. Because these bindings describe content, every tier can use them.

R12. `readManifestId` calls `manifestFields`, but the Core builder never imports that function. The catch block returns `null`, and the builder ends up using the folder name `overhaul-api2` in this plugin's banner. Adding the import to the Core builder fixes the lookup. Until that lands, the committed-plugin check depends on the folder keeping this name.

## Checker warnings

The first-party checker lists 12 dangling references. It also warns that Core does not read `tval.json` or `message_type.json`, although the boot code reads both. `junk.test.ts` binds the custom item classes and their kinds. `bronze-dragons.test.ts` binds `BR_CONF` with its monster spell. These checker findings need a Core fix. The data files stay unchanged.

## Removal list

The `ctx.core.DDGRID` read is removed. Its keypad offsets now live in the adapter. All six grants remain in use: `registry:store` waits on R7, `registry:command` on R8, `registry:projection` on R5, `registry:effect` on R3-R4 and `registry:effect-info` on R9. The spike key still needs `keymap:write`. Core and content remain development dependencies for types and the binding tests. The SDK provides manifest validation, conversion and API 2 types. The core content dependency and optional Linoleum dependency keep their ranges.

The other engine reads remain behind the API 1 adapter until their table requests are available. All gameplay handlers stay in the entry. The built plugin has `api: 1` and no runtime engine import.

## Verification

`pnpm verify` runs the typecheck, every test and the committed-plugin build check. The flags test keeps separate fixtures holding the same entries, so a change to the twin's flag map can't disturb the API 1 expectation. The key tests tell a denied grant apart from a host refusing permission, and an invalid-trigger test checks the mock host's refusal result and its empty binding list. Other twin tests cover log calls, binding answers, a rejected host fault and the local direction table. The boundary scan catches aliases and destructures of the context, contexts held in members, CommonJS imports of core or of an engine module, copied engine objects and engines held in members. The checks that were already in place still cover assertions, spaced reads, core re-exports, dynamic imports, engine suffixes and `ctx` in the twin.

The existing on/off checks live in `plugin.test.ts`, `bronze-dragons.test.ts`, `classic-uncurse.test.ts`, `junk.test.ts`, `sticky-curses.test.ts`, `sticky-egos.test.ts` and `classic-books.test.ts`. Between them they test registry installation and birth defaults, along with curses and composed content. Pixel rendering hasn't been verified, and neither has a complete live-game replay.

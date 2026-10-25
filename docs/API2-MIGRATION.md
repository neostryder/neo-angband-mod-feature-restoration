# Cutting Room Floor and mod API 2

This mod runs on mod API 2. Its manifest asks for API `>=2.0.0 <3.0.0` and engine `>=1.22.0`, and it holds three capabilities: `registry:store`, `keymap:write` and `engine:access`. `plugin.ts` exports one definition with `policies`, `engineHooks` and `start`. Only `src/core-adapter.ts` reads the engine domain, and `src/core-adapter-api2.ts` gives the rest of the code its flags, its log, its single key binding and the engine names.

## What each restoration uses

| Restoration | API 2 form | Status |
| --- | --- | --- |
| Store discounts | `policies`: a `storeDiscountRoll` table, present while `feature-restoration.discounts` is on | Works. The game rolls the table when it stocks a store. |
| Junk items | `engineHooks`: a `newCharacter` hook built from the engine domain | Works. |
| Lose Memories effect | `start`, through a registry host | Waits for CRF-1. |
| Bronze dragons' confusion | `start`, through a registry host | Waits for CRF-1. |
| Classic uncursing | `start`, through a registry host | Waits for CRF-1. |
| Sticky-curse scrolls | `start`, through a registry host | Waits for CRF-1. |
| Spike command and `j` key | `start`, through a registry host, then `ui.keys.bind` | Waits for CRF-1. |

## The open Core request

CRF-1 exists because the engine domain hands a mod `api`, `core`, `state` and `registries` and no registry host. Without one, a mod cannot register an effect, a projection handler or a command, and the five restorations above have nowhere to attach. The smallest fix is an `engine.registry` member with the methods the API 1 host offered (`effects.register`, `effectInfo.text.set`, `projections.player.set`, `projections.mon.set`, `commands.register` and `commands.setVerb`). Declarative forms for effects, projections and commands would also work. Today `start` logs one line naming the gap, and it installs each restoration as soon as the member appears.

## How the tests drive the entry

`test/api2.ts` stands in for the host. `engineHooksFor` returns what `engineHooks` yields for a set of flags and an engine domain, and `policiesFor` returns the declared tables. `startWith` runs `start` against a fake mod that carries a core namespace, and optionally a registry host and a keymap double.

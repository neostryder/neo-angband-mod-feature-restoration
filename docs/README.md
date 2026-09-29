# Cutting Room Floor: quick reference

Brings back Angband features that later versions dropped, and content upstream wrote but never switched on, as opt-in content. Core stays as Angband 4.2.6 plays: nothing here changes unless you switch a toggle on, and every toggle defaults to off.

This page is the short version: every setting, what the mod asks the game for,
and where the longer material is. The account of why each of these exists is in
[the repository README](../README.md).

## Settings

Each one is a named toggle on the game's own Mods screen, which shows the full
description. The identifier is the name a save and another mod see; where a
switch has no flag of its own, the game knows it by its section id instead.

| Setting | Identifier | Default | What it does |
| --- | --- | --- | --- |
| Restore store discounts | `feature-restoration.discounts` | off | Angband 3.0.6, the last official release to carry it, sometimes discounted a store item by 10, 25, 50, 75 or 90 percent when it was stocked (10% about 1 time in 25, down to 90% about 1 time in 500; the README cites the exact source). |
| Restore Teleport Other (Priest, Paladin, Ranger) | `teleport-other` | off | Angband 4.1.3, the last official release before the 4.2.0 spellbook rewrite, gave every spellcasting class a way to teleport a monster away. |
| Restore door spiking | `feature-restoration.spike-doors` | off | Angband 3.4.1, the last official release before the 4.0 command rewrite dropped it, let you jam a closed door with an iron spike to make it harder to open. |
| Restore the "of Fury" weapon ego | `fury` | off | Angband 3.0.6 through 3.2.0 could make a sword, polearm or hafted weapon "of Fury": up to +10 to hit and to damage, two to five points of strength, one or two extra blows and immunity to fear, paid for by aggravating the monsters around you. |
| Restore cut rods, wands and staffs | `classic-devices` | off | Brings back six magic devices that later versions removed: the rods of Door/Stair Location and Trap Location (last in 4.0.5), the wand of Door Destruction (last in 4.1.3), and the staffs of Trap Location, Door/Stair Location and Object Location (last in 3.0.9). |
| Restore cut potions | `classic-potions` | off | Brings back seven potions that Angband 3.0.9 had and 3.1.0 removed. |
| Restore cut weapons, armour and diggers | `classic-equipment` | off | Brings back seven items that Angband 3.0.9 had and 3.1.0 removed: the Sabre, the Small Sword, Rusty Chain Mail, Double Chain Mail, the Gnomish Shovel, the Dwarven Shovel and the Dwarven Pick. |
| Restore the deadly potions | `classic-dangers` | off | Brings back three potions that Angband 3.0.9 had and 3.1.0 removed, each one a disaster to drink before you know what it is. |

## What it needs

- **Engine:** `>=1.0.0`
- **Shape:** `content`
- **Facets:** `content`, `plugin`
- **Capabilities:** `registry:store`, `registry:command`

What a capability string permits, and what a mod that asks for one cannot do
without it, is in [the mod lifecycle
document](https://github.com/neostryder/neo-angband/blob/master/docs/modding/MOD_LIFECYCLE.md).

## Elsewhere

- [README](../README.md), the full account
- [Changelog](../CHANGELOG.md), what changed in each version
- [What belongs in this mod, and
  why](https://github.com/neostryder/neo-angband/blob/master/docs/modding/FEATURE_RESTORATION.md),
  in the game's own repository
- [Installing a
  mod](https://github.com/neostryder/neo-angband/blob/master/docs/MODS.md), the
  route every mod installs by

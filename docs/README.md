# Feature Restoration: quick reference

Brings back beloved Angband features that later versions quietly dropped, as
opt-in content. Angband 4.2.6 stays faithful in core - nothing here changes
unless you switch a toggle on, and every toggle defaults OFF.

This page is the short version: every setting, what the mod asks the game for,
and where the longer material is. The account of why each of these exists is in
[the repository README](../README.md).

## Settings

Each one is a named toggle on the game's own Mods screen, which shows the full
description. The identifier is the name a save and another mod see; where a
switch has no flag of its own, the game knows it by its section id instead.

| Setting | Identifier | Default | What it does |
| --- | --- | --- | --- |
| Restore store discounts | `feature-restoration.discounts` | off | Angband 3.0.6, the last official release to carry it, occasionally discounted a store item by 10, 25, 50, 75 or 90 percent when it was stocked, at the same odds that version rolled (10% about 1 time in 25, down to 90% about 1 time in 500 - see the README for the exact source). |
| Restore Teleport Other (Priest, Paladin, Ranger) | `teleport-other` | off | Angband 4.1.3, the last official release before the 4.2.0 spellbook rewrite, gave every spellcasting class a way to teleport a monster away. |
| Restore door spiking | `feature-restoration.spike-doors` | off | Angband 3.4.1, the last official release before the 4.0 command rewrite dropped it, let a player jam a closed door with an iron spike, making it harder to open - a dedicated command consuming a stackable item that has had no use, and no way into a player's pack, since. |

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

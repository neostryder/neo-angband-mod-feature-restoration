# feature-restoration

Beloved Angband features that later versions quietly dropped, brought back as opt-in
content for [Neo Angband](https://github.com/neostryder/neo-angband).

**This is a mod.** It is off until you enable it, every restored feature inside it is a
named switch you can turn off on its own, and disabling the mod leaves the game exactly
as Angband 4.2.6 plays it.

## What it is not

This is not a rebalance and not a house-rule collection. Everything here is something
Angband itself used to do, in an earlier version, for a class or a mechanic that later
lost it. If it never existed in any Angband, it does not belong in this mod.

## What it adds

| Section | Default | What it does |
|---|---|---|
| **Restore Teleport Other** (`teleport-other`) | on | Gives the Priest, the Paladin and the Ranger the same "teleport the monster in front of you away" spell the Mage and the Rogue already have in Angband 4.2.6. Older Angband gave it to every caster; 4.2.6 kept it for two classes and dropped it for the rest. |

### Restore Teleport Other

Angband 4.2.6 ships `Teleport Other` - a bolt spell that teleports the first monster it
hits away, farther at higher character level - for the Mage (`[Magical Defences]`,
level 15) and the Rogue (`[Arcane Control]`, level 30). Earlier Angband gave it to the
Priest, the Paladin and the Ranger too; checked against `reference/lib/gamedata/old_class.txt`
in the game's own repository (an earlier version's class data, kept for exactly this kind
of comparison), all three had it and lost it somewhere between then and 4.2.6.

This section adds it back to those three, appended to a book each already has rather than
replacing anything:

| Class | Book | Level | Mana | Fail | XP |
|---|---|---|---|---|---|
| Priest | `[Healing and Sanctuary]` | 20 | 10 | 30% | 15 |
| Paladin | `[Healing and Sanctuary]` | 22 | 10 | 30% | 15 |
| Ranger | `[Nature Craft]` | 28 | 10 | 30% | 20 |

The mana cost and fail rate are the Mage's and the Rogue's own numbers for this spell -
both already agree on 10 mana / 30% fail despite being fifteen character levels apart, so
that appears to be what this spell costs in this engine regardless of who casts it. Only
the level and the experience cost, which govern how *early* each class gets it, are new,
chosen to sit among that class's own existing spells at a comparable tier. The spell's
effect and its description text are copied byte-for-byte from the Mage's copy, so it is
exactly the same spell in every caster's hands.

These numbers are a starting point, not a ruling - if a level or a fail rate feels wrong
once it's actually been played, they are three lines in `class.json` to change, and the
tests (below) will tell you immediately if a core update moves the target out from under
them.

**Where this idea came from:** a
[r/angband comment thread](https://github.com/neostryder/neo-angband) on the game's
alpha announcement, where a player pointed out that "nearly everyone" had lost Teleport
Other in 4.2 - a mechanic every earlier version gave every caster.

## Why this is a content mod, not a plugin

Restoring a spell to a class's book is data, not behaviour: the spell already exists (the
Mage and the Rogue cast it today), so nothing new needs to run - a class's book just needs
one more entry in it. That is exactly what a
[field-level patch](https://github.com/neostryder/neo-angband/blob/master/packages/mod-sdk/src/patch.ts)
onto core's own `class.json` does, and what a manifest
[section](https://github.com/neostryder/neo-angband/blob/master/docs/modding/MOD_LIFECYCLE.md)
turns on and off. There is no `plugin.ts` in this repository because there is nothing for
one to do.

## Installing

Two files: `manifest.json` and `class.json`. Any of:

- **In the game** - Mods → **Install a mod...**, which fetches this repository at a
  release tag and checks every file against a SHA-256 that ships inside the game.
- **A folder** - clone this repository into your mods directory, or point the browser
  build at it with **Load mod folder**.

## Working on it

```bash
npm install
npm run verify
```

That typechecks and runs the tests, which check every ref and every book index this
mod's patches name against `@rpgm-tools/neo-angband-content` - the same, PUBLISHED
content pack a player's game boots from. If a future core release renumbers a class's
books, adds a spell ahead of where this mod appends, or ships Teleport Other to a class
this mod also restores it to, the tests name exactly what moved rather than silently
composing onto the wrong slot.

### Adding another restored feature

Each restoration is its own manifest `section` with its own `fieldPatches`, nested the
same way `teleport-other` is in `class.json`. A new one:

1. Confirms the feature existed in some released Angband and is genuinely gone from
   4.2.6 - `reference/lib/gamedata/` in the game's repository is the primary source, not
   memory of "the way it used to be."
2. Gets its own `id` in `manifest.json`'s `sections`, its own toggle, and its own rows in
   this README's table.
3. Gets a test in the same shape as `teleport-other.test.ts`: assert the ref resolves,
   assert core does not already have the feature, assert the target this mod names by
   name (not just by index), and assert the append does not collide with an existing
   entry.

Candidates raised alongside Teleport Other but not yet built here (each is a bigger
question than a spell-book entry, and deserves its own design pass rather than a rushed
first cut): store haggling / price discounts, which several early Angband versions had
and 4.2.6 does not.

## Questions, or something wrong

[**The RPGM Tools Discord**](https://discord.gg/YegtwbHTBQ) is the fastest way
to ask anything - whether a level or a fail rate is intended, how to get this installed,
or what you should try next. No GitHub account needed.

[Open an issue here](../../issues/new/choose) for a bug in **this mod**. Two
things belong against the game instead, and the forms will point you there: the
mod **system** (an install that fails, a load order that will not stick, a
conflict report that looks wrong), and the game **not matching Angband 4.2.6**
once this mod is switched off - changing the game is what a mod is for.

For anything that should not be public, including a security report:
**strider-angband (at) rpgm.tools**. See
[SECURITY.md](https://github.com/neostryder/neo-angband/blob/master/SECURITY.md).

## Licence

Same dual licence as Neo Angband and Angband - GPL v2 or the Angband licence. See
[LICENSE.md](LICENSE.md).

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.

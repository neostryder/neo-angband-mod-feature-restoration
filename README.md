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

Every toggle below defaults **off**. Enabling this mod changes nothing on its own -
you still choose which restorations you actually want.

| Section | Default | What it does |
|---|---|---|
| **Restore Teleport Other** (`teleport-other`) | off | Gives the Priest, the Paladin and the Ranger the same "teleport the monster in front of you away" spell the Mage and the Rogue already have in Angband 4.2.6. Older Angband gave it to every caster; 4.2.6 kept it for two classes and dropped it for the rest. |
| **Restore store discounts** (`discounts`) | off | Stores occasionally sell an item at a random discount, the way a pre-4.2.6 Angband did. 4.2.6 dropped the mechanic entirely. |

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
| Ranger | `[Nature Craft]` | 23 | 10 | 30% | 20 |

The mana cost and fail rate are the Mage's and the Rogue's own numbers for this spell -
both already agree on 10 mana / 30% fail despite being fifteen character levels apart, so
that appears to be what this spell costs in this engine regardless of who casts it. Priest's
own `Portal` (its short-range self-teleport, the closest thing 4.2.6 gives any caster to
what `old_class.txt` calls `Teleport Self`) shares that same 30% fail too, so the number
looks like a fixed property of the teleport spell family, not something that should vary by
class or realm.

**Level and XP are not upstream numbers copied forward - the spell curriculum was rebuilt
wholesale between `old_class.txt`'s era and 4.2.6, not just relevelled**, so a flat "old
level minus N" shift does not hold across a class, let alone across classes. What each
class actually got instead was worked out from whichever OTHER spell survived that rebuild
under the same name, as the least speculative anchor available:

- **Priest**: `old_class.txt` has `Teleport Self` at level 20 mana 20 in the same book as
  its `Teleport Other` (level 20). 4.2.6's Priest keeps that spell's slot - `Portal`, level
  20 mana 4 - at the exact same level. Zero shift. Placed at level 20 for that reason, not
  interpolated among book neighbours.
- **Paladin**: no self-teleport analogue exists for Paladin in either version, so the
  closest anchor is `Protection from Evil`, which both versions keep: level 19 in
  `old_class.txt`, level 15 in 4.2.6 (a -4 shift). Applied to `old_class.txt`'s Paladin
  `Teleport Other` (level 25) that gives level 21; placed at 22, one level later, to land
  one after 4.2.6's own `Remove Curse` (level 20) rather than colliding with it. A second
  anchor, `Remove Curse` itself (level 13 -> 20, a +7 shift), points the other way entirely
  (toward the low 30s) - the two anchors disagree, so this number is a defensible pick
  inside a real range, not a tight derivation the way Priest's is.
- **Ranger**: this is the one that moved. Old Ranger was an **arcane** caster with attack
  spells (Magic Missile, Fire Ball, and its own `Teleport Other` at level 31); 4.2.6's
  Ranger is a **nature**-realm survivalist with almost none of that curriculum survived the
  realm change intact except one spell: `Haste Self`, level 33 in `old_class.txt`, level 25
  in 4.2.6 (Nature Craft). Old Ranger's `Teleport Other` sat 2 levels *before* its own
  `Haste Self` (31 vs 33); applied to the new `Haste Self`, that lands at level 23 - between
  4.2.6's own `Create Arrows` (22) and `Haste Self` (25). Originally shipped at level 28,
  picked before this comparison existed; moved to 23 once the anchor was found. This is the
  best-anchored of the three restorations after Priest's, since `Haste Self` is the *only*
  spell that survived Ranger's total realm rewrite.

Mana, fail and XP stayed at Mage/Rogue's own values (see above) rather than being
independently derived, since no clean old-to-new anchor for THOSE numbers specifically
presented itself for any of the three classes, and the two existing implementations already
agree with each other on them.

The spell's effect and its description text are copied byte-for-byte from the Mage's copy,
so it is exactly the same spell in every caster's hands.

These numbers are the best-evidenced starting point this analysis could produce, not a
balance ruling - Paladin's in particular sits inside a range rather than at a single derived
point. If a level or a fail rate feels wrong once it's actually been played, they are a few
lines in `class.json` to change, and the tests (below) will tell you immediately if a core
update moves the target out from under
them.

**Where this idea came from:** a
[r/angband comment thread](https://www.reddit.com/r/angband/comments/1vsb2sp/angband_but_moddable/) on the game's
alpha announcement, where a player pointed out that "nearly everyone" had lost Teleport
Other in 4.2 - a mechanic every earlier version gave every caster.

### Restore store discounts

A version of Angband before 4.2.6 gave `mass_produce` (the routine that decides how
much of an item a store stocks when it restocks) a second job: after sizing the stack,
roll a discount. Fetched directly from the real upstream history
(`gh api repos/angband/angband/contents/src/store.c?ref=v3.0.0`, since 4.2.6's own
`reference/` tree in the game's repository does not carry this code - it was removed
before the tag this port targets), the roll reads:

```c
/* Pick a discount (store.c, mass_produce, Angband v3.0.0) */
if (cost < 5)            discount = 0;
else if (rand_int(25) == 0)  discount = 10;
else if (rand_int(50) == 0)  discount = 25;
else if (rand_int(150) == 0) discount = 50;
else if (rand_int(300) == 0) discount = 75;
else if (rand_int(500) == 0) discount = 90;
```

Each check only runs if the one before it missed, cheapest tier first, and an item under
5 gold never qualifies. That is the entire mechanism this section restores - the same
tiers, the same odds, checked in the same order, nothing added and nothing rebalanced.
`plugin.ts`'s `discountRoll` is a direct transcription; `plugin.test.ts` asserts the exact
`oneIn` calls (25, then 50, then 150, then 300, then 500) in that order, not just the
resulting percentages.

4.2.6 dropped both the roll and the field it wrote to (`obj->discount`) - there is nothing
left in core to patch data onto, which is why this one restoration needs `plugin.ts`
instead of a `class.json`-style content patch. See the section below.

## Content, plus one plugin

Restoring a spell to a class's book is data, not behaviour: the spell already exists (the
Mage and the Rogue cast it today), so nothing new needs to run - a class's book just needs
one more entry in it. That is exactly what a
[field-level patch](https://github.com/neostryder/neo-angband/blob/master/packages/mod-sdk/src/patch.ts)
onto core's own `class.json` does, and what a manifest
[section](https://github.com/neostryder/neo-angband/blob/master/docs/modding/MOD_LIFECYCLE.md)
turns on and off. `teleport-other` needs nothing more than that.

Store discounts are different: 4.2.6's core has no discount field and no discount roll
left anywhere to patch, so there is no data seam to attach to. Restoring it needed one
small addition to the game's own engine - a `registry:store` discount-roll seam, alongside
the stack-size seam that was already there - and `plugin.ts` here installs a handler into
it, gated on the `feature-restoration.discounts` rule flag and nothing else. No other
system in the game is touched, and with the toggle off the seam is never called at all,
same as every other disabled mod hook.

## Installing

`manifest.json`, `class.json`, and `plugin.js` (built from `plugin.ts` - see below). Any
of:

- **In the game** - Mods → **Install a mod...**, which fetches this repository at a
  release tag and checks every file against a SHA-256 that ships inside the game.
- **A folder** - clone this repository into your mods directory, or point the browser
  build at it with **Load mod folder**.

## Working on it

```bash
npm install
npm run verify
```

That typechecks, runs the tests, and (via `npm run check`, folded into `verify`) confirms
the committed `plugin.js` is exactly what `plugin.ts` builds today - so a source edit that
was not rebuilt fails loudly instead of shipping stale behaviour. The content tests check
every ref and every book index this mod's patches name against
`@rpgm-tools/neo-angband-content` - the same, PUBLISHED content pack a player's game boots
from. If a future core release renumbers a class's books, adds a spell ahead of where this
mod appends, or ships Teleport Other to a class this mod also restores it to, the tests
name exactly what moved rather than silently composing onto the wrong slot.

```bash
npm run build   # plugin.ts -> plugin.js, after editing plugin.ts
```

### Adding another restored feature

Every new restoration:

1. Confirms the feature existed in some released Angband and is genuinely gone from
   4.2.6 - `reference/lib/gamedata/` in the game's repository is the primary source when
   the feature is content; a real upstream tag's source (fetched via `gh api`, as with the
   discount roll above) when it is not. Memory of "the way it used to be" is not evidence.
2. Decides content vs plugin the same way the two features above did: if 4.2.6 still has
   the field or record to patch, it is a manifest `section` with `fieldPatches`, nested the
   same way `teleport-other` is in `class.json`. If 4.2.6 dropped the underlying mechanism
   entirely, it needs a `registry:*` seam in the game's engine (a real code change there,
   not just here) and a `rules[]` toggle here, the way `discounts` does.
3. Gets its own row in this README's table and its own toggle, defaulting **off**.
4. Gets tests in the shape of `teleport-other.test.ts` (a content section: assert the ref
   resolves, assert core does not already have the feature, assert the target is named by
   name not index, assert no collision) or `plugin.test.ts` (a plugin: assert the flag
   gates it, assert the mechanism's exact odds/behaviour against a fake host and a
   recording Rng, not just its outputs).

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

Asking about AI use in this project? [AI_USAGE_POLICY.md](https://github.com/neostryder/neo-angband/blob/master/AI_USAGE_POLICY.md)
in the main repository is the complete answer.

## Licence

Same dual licence as Neo Angband and Angband - GPL v2 or the Angband licence. See
[LICENSE.md](LICENSE.md).

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.

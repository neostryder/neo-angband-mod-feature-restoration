# Cutting Room Floor

Angband features that later versions dropped, and content upstream wrote but never switched on, brought back as opt-in content for [Neo Angband](https://github.com/neostryder/neo-angband). The name comes from the Skyrim mod that does the same for that game's cut content.

**This is a mod.** It is off until you enable it, every restoration inside it is a named switch you can turn off on its own, and disabling the mod leaves the game as Angband 4.2.6 plays it.

![The mod manager's detail panel for this mod](docs/img/feature-restoration-detail.jpg)

## What belongs here

Two kinds of content belong here: features Angband shipped and a later release removed, and content upstream wrote and never switched on, found in the game's repository or its git history, such as an artifact record left commented out. Each section names the release it last shipped in, or the commit that added it unused.

Rebalances, house rules and anything with no upstream source stay out.

The identify-sell-restock town loop stays out too, because 4.2.6 still has it. `birth_no_selling` ("Increase gold drops but disable selling") is a birth option in the base game, on by default, and that default is what makes selling feel removed. Turn it off when you start a character and stores buy again, with no mod installed at all.

## What it adds

Every toggle below defaults **off**. Enabling this mod changes nothing on its own.
You still choose which restorations you actually want.

See the [settings reference](SETTINGS.md) for every flag, its default, and when a change takes effect.

| Section | Default | What it does |
|---|---|---|
| **Restore Teleport Other** (`teleport-other`) | off | Gives the Priest, the Paladin and the Ranger the same "teleport the monster in front of you away" spell the Mage and the Rogue already have in Angband 4.2.6. Angband 4.1.3, the last official release before the 4.2.0 spellbook rewrite, gave it to every caster; 4.2.6 kept it for two classes and dropped it for the rest. |
| **Restore store discounts** (`discounts`) | off | Stores occasionally sell an item at a random discount, the way Angband 3.0.6, the last official release to carry the mechanic, did. 4.2.6 dropped the mechanic entirely. |
| **Restore door spiking** (`spike-doors`) | off | Adds Iron Spikes as a findable item and a `spike` command that spends one to jam a closed door, making it harder to pick open. Angband 3.4.1, the last official release before the 4.0 command rewrite dropped both, is the source; 4.2.6 has neither. The command claims the original `j` key by default when it is free; see below. |
| **Restore the "of Fury" weapon ego** (`fury`) | off | Angband 3.0.6 through 3.2.0 could make a sword, polearm or hafted weapon "of Fury": up to +10 to hit and to damage, two to five points of strength, one or two extra blows and immunity to fear, paid for by aggravating the monsters around you. |
| **Restore cut rods, wands and staffs** (`classic-devices`) | off | Brings back six magic devices that later versions removed: the rods of Door/Stair Location and Trap Location (last in 4.0.5), the wand of Door Destruction (last in 4.1.3), and the staffs of Trap Location, Door/Stair Location and Object Location (last in 3.0.9). |
| **Restore cut potions** (`classic-potions`) | off | Brings back seven potions that Angband 3.0.9 had and 3.1.0 removed, plus Lose Memories from 4.1.3. |
| **Restore cut weapons, armour and diggers** (`classic-equipment`) | off | Brings back seven items that Angband 3.0.9 had and 3.1.0 removed: the Sabre, the Small Sword, Rusty Chain Mail, Double Chain Mail, the Gnomish Shovel, the Dwarven Shovel and the Dwarven Pick. |
| **Restore the deadly potions** (`classic-dangers`) | off | Brings back three potions that Angband 3.0.9 had and 3.1.0 removed, each one a disaster to drink before you know what it is. |
| **Restore the monsters cut in 4.2.0** (`monsters-4-1`) | off | Angband 4.2.0 replaced 55 monsters in a pass that made the game's cast fit Tolkien's world: the dark elves, Greek myth such as Medusa, Atlas and the Lernaean Hydra, the ninja and the dagashi, the drider, the black pudding and others. |
| **Restore the novices, swordsmen and angels** (`monsters-3x`) | off | Brings back sixteen monsters from Angband 3.x, alongside the monsters that replaced them. |
| **Add the Amulet of Amandil (never released)** (`amandil`) | off | Upstream wrote this artifact in 2011 and left it commented out, and it has stayed that way in every release since, 4.2.6 included. |
| **Restore the bronze dragons** (`bronze-dragons`) | off | Bronze dragons breathed confusion. |
| **Restore seven ring and amulet flavors** (`flavors`) | off | In 2013 upstream gave seven ring and amulet looks to artifacts. |

### Restore Teleport Other

Angband 4.2.6 ships `Teleport Other`, a bolt spell that teleports the first monster it
hits away, farther at higher character level, for the Mage (`[Magical Defences]`,
level 15) and the Rogue (`[Arcane Control]`, level 30). Angband 4.1.3, released 22 July
2018 and the last official release before the 4.2.0 spellbook rewrite, gave it to the
Priest, the Paladin and the Ranger as well. All three lost it at 4.2.0, the release that
cut pure casters from nine spellbooks to five and hybrid casters to two or three.

This section adds it back to those three, appended to a book each already has rather than
replacing anything:

| Class | Book | Level | Mana | Fail | XP |
|---|---|---|---|---|---|
| Priest | `[Healing and Sanctuary]` | 18 | 10 | 30% | 20 |
| Paladin | `[Healing and Sanctuary]` | 24 | 10 | 30% | 50 |
| Ranger | `[Nature Craft]` | 30 | 10 | 30% | 50 |

The spell's effect and description are copied exactly from the Mage's version, so every caster gets the same spell.

#### Where these numbers come from

The 4.1.3 records say which classes had the spell, but their prices cannot be reused as they are. A spell priced by 4.1.3 and dropped into 4.2.6 would charge a Priest 20 mana at 80 percent failure for a spell the Mage casts at 10 mana and 30 percent, which would be a penalty rather than a restoration. So the 4.1.3 records are the starting point and the two surviving copies of the spell are the guide.

In Angband 4.1.3, the last official release to have them, the three classes had these records, where a spell reads `name:level:mana:fail:exp`:

```
Teleport Other:20:20:80:16    (Priest)
Teleport Other:25:25:80:12    (Paladin)
Teleport Other:31:25:70:3     (Ranger)
```

The rows are the same across the whole 4.1.x series (4.1.0 through 4.1.3), so 4.1.3 is cited only because it is the last tagged release to check them against. The same records survive in the game's own repository as `reference/lib/gamedata/old_class.txt`, which upstream keeps next to the current `class.txt` for this kind of comparison, so every number below can be checked without leaving the checkout. The two classes that kept the spell changed like this:

```
Mage   23:12:60:8   ->  15:10:30:12     level -8, mana -2, fail -30, exp +4
Rogue  31:25:70:3   ->  30:10:30:50     level -1, mana -15, fail -40, exp +47
```

Mana is 10 and fail is 30 for all three classes, because both surviving copies arrive at exactly 10 and 30 from different starting points. That fits a wider change: Angband 4.2 repriced spells to cost the same in every class that has them, and the shift shows up across the whole spell list. Among spells shared by two or more classes, agreement on mana went from 4 of 88 in 4.1.3 to 15 of 29 now, agreement on fail from 23 of 88 to 25 of 29, and agreement on both from 1 of 88 to 14 of 29. Level is the one axis 4.2 kept class-specific.
Level follows the model class, eased for the full caster. The Priest is a full caster and follows the Mage; the Paladin and the Ranger are half casters and follow the Rogue. The Rogue's level fell by 1, so the Paladin goes from 25 to 24 and the Ranger from 31 to 30. The Mage's fell by 8, and the Priest takes a much smaller cut, from 20 to 18. How much smaller is a judgment call rather than something taken from the data: the Mage is the earliest caster in the game, and the deepest cut belongs to it. The Paladin's one-level drop is cosmetic, there for consistency with the Rogue rather than for balance.

Exp follows the caster type. The Priest takes the Mage's change, 16 up to 20, which keeps it in the full-caster range next to the Mage's 12. Both half casters go to 50, matching the Rogue's actual value instead of adding the Rogue's change, because adding +47 to the Paladin's 12 would give 59 and nothing suggests 4.2 would price one spell differently for two half casters. In the current file the Rogue earns roughly four times the Mage's exp for the same spell, on both Teleport Other and Teleport Level, so the pattern being matched is a half-caster range near 50 and a full-caster range of about 12 to 20. Which range each class falls in comes from the data; the exact 50 for the Paladin is a judgment call.

The Ranger's result, `30:10:30:50`, is identical to the Rogue's current row. The two classes also had identical 4.1.3 rows, `31:25:70:3`, so it makes sense that they match again. The test suite checks that equality against the published content pack, so if a future core release reprices the Rogue's copy, the tests fail instead of leaving this mod out of date.

The resulting ladder across all five classes is Mage 15, Priest 18, Paladin 24, Rogue 30, Ranger 30. Full casters get the spell early and half casters late, and the three restored classes keep the order they had in 4.1.3.

The formulas behind the price did not change either, which matters because a changed formula would make these comparisons meaningless. Mana accrual per class is the same: the `magic:` line holding each class's first spell level and spell weight is identical in both files for all five classes (Mage 1:300, Priest 1:350, Rogue 5:350, Ranger 3:400, Paladin 1:400), and failure still falls by 3 points per character level above the spell's own level. A price in mana and fail therefore means the same thing in both versions, and only the price itself needed to move.

If a core release reorders a class's books or adds a spell to one of them, the tests below fail rather than letting this mod patch the wrong slot.
**Where this idea came from:** a
[r/angband comment thread](https://www.reddit.com/r/angband/comments/1vsb2sp/angband_but_moddable/) on the game's
alpha announcement, where a player pointed out that "nearly everyone" had lost Teleport
Other in 4.2, a mechanic every earlier version gave every caster.

### Restore store discounts

Older versions of Angband rolled a random discount whenever a store restocked an item. The roll lived in `mass_produce`, the routine that decides how much of an item a store stocks when it restocks, and ran right after it sized the stack. The code is unchanged from Angband 3.0.0 through Angband 3.0.6 (18 June 2005), the last official release to carry it. Three beta snapshots followed (3.0.7s1, 3.0.7s2 and 3.0.7s3, released by a maintainer-to-be before she was made maintainer) and still had the same code, but none of them was an official release, and Angband never shipped an official 3.0.7. Angband 3.0.8 (8 July 2007), the next official release after 3.0.6, removed the roll as part of what its own changelog calls a "semi-rewrite of the store code," and no official release since has brought it back.

The code was removed in 3.0.8, decades before the tag this port targets, so the `reference/` tree in the game's repository does not have it. It comes from upstream's own history instead (`gh api repos/angband/angband/contents/src/store.c?ref=v3.0.6`), and the roll reads:

```c
/* Pick a discount (store.c, mass_produce, Angband 3.0.6) */
if (cost < 5)            discount = 0;
else if (rand_int(25) == 0)  discount = 10;
else if (rand_int(50) == 0)  discount = 25;
else if (rand_int(150) == 0) discount = 50;
else if (rand_int(300) == 0) discount = 75;
else if (rand_int(500) == 0) discount = 90;
```

Each check runs only if the one before it missed, cheapest tier first, and an item under 5 gold never qualifies. This section restores exactly that: the same tiers and odds, checked in the same order. Across all five checks, an eligible item has a combined 7.045 percent chance of being discounted. Most ordinary items in low-level stores cost more than 5 gold, so the floor only rules out the cheapest ones. For mod authors, `plugin.ts`'s `discountRoll` is a direct transcription, and `plugin.test.ts` asserts the exact `oneIn` calls (25, then 50, then 150, then 300, then 500) in that order, not just the resulting percentages.

4.2.6 dropped both the roll and the field it wrote to (`obj->discount`), so there is nothing left in core to patch data onto. That is why this one restoration needs `plugin.ts` instead of a `class.json`-style content patch; see the section below.
### Restore door spiking

Older Angband let you jam a closed door shut with an iron spike, making it harder to open. That was useful for buying time against something chasing you, or for sealing off a room you had already cleared. The item (`TV_SPIKE`) and the command (`do_cmd_spike`) are unchanged from Angband 3.0.0 through Angband 3.4.1 (18 October 2012), the last official release to carry either. Angband 4.0.0, the next official release, rewrote command handling from switch-driven functions to a table of registered commands and dropped both the item kind and the command along the way. No official release since has brought either back, and neither exists anywhere in 4.2.6. The `DOOR_JAMMED` terrain flag this port still carries as a generated constant is a leftover too, since nothing sets it. Taken from upstream's own history (`gh api repos/angband/angband/contents/src/cmd2.c?ref=v3.4.1` for the command, `.../lib/edit/object.txt?ref=v3.4.1` for the item), the mechanism reads:
```c
/* Jam a closed door with a spike (cmd2.c, do_cmd_spike, Angband 3.4.1) */
/* Convert "locked" to "stuck" */
if (cave->feat[y][x] < FEAT_DOOR_HEAD + 0x08)
    cave->feat[y][x] += 0x08;
/* Add one spike to the door */
if (cave->feat[y][x] < FEAT_DOOR_TAIL)
    cave->feat[y][x] += 0x01;
```

A door's feature byte packed two separate numbers from 0 to 7. An unspiked door had its own lock strength (0-7), checked by the normal lock-picking roll. Once it was spiked at all, it had a *jammed* level instead (also 0-7), and the pick roll was never even attempted: a jammed door could not be picked, only bashed down. The item's own description (`lib/edit/object.txt`) states the cap in plain language: "Each of the first 7 spikes will increase the door's resistance to bashing. Placing more than 7 spikes in one door will not have any further effect."

This port keeps part of that behaviour and leaves out the rest. It never had a separate jammed or stuck door state. A closed door here has one continuous lock-power number (the "door lock" trap, `game/trap.ts`), which feeds the same `skill - 4 * power` formula upstream already used for its locked-door pick chance. Spiking raises that number by one point per spike, up to 7, the same ceiling upstream put on its separate jam level. What does not carry over is upstream's hard wall, where a fully jammed door cannot be picked at all and bashing it down is the only way through. This port has no player command for bashing a door down (upstream's `do_cmd_bash`, which would be a separate restoration that this mod does not attempt), so a pick-proof door here would be a door you could never get back through, rather than just a harder one. A door at this mod's cap keeps upstream's own floor instead: `skill - 28`, minimum 2%, which is hard to pick but never impossible.
One more edge case is simplified. In upstream, spiking a door that has a monster standing in it attacks the monster instead (`py_attack`) and still uses the turn. Reproducing that would mean re-deriving core's melee math inside this mod, so here the attack does not happen: the turn is spent and the spike is not used. `plugin.test.ts` tests this simplified behaviour, not upstream's fuller version.

**The item.** Angband dropped `TV_SPIKE` itself before this port's 4.2.6 baseline, so there is no existing tval to add an Iron Spike under the way upstream had it, and adding a whole new item class would be a bigger change than this restoration needs (see "Content, plus one plugin" below). The Iron Spike in `object.json` borrows the `flask` tval instead. Core's own Flask of Oil is the closest real precedent: a small, stackable, single-purpose consumable with no weapon or armour behaviour to clash with. The Iron Spike carries `NO_FUEL`, so borrowing the tval does not let it refuel a lamp or pick up Flask of Oil's behaviour. Its weight (0.2 lb), cost (1 gold) and where it is found (dungeon levels 1-40, uncommon) are copied from the item's own Angband 3.4.1 record.

**Restored item art.** A restored item uses its own pack's confirmed historical art when that art still exists. If the active pack has none, the item uses the highest-resolution confirmed real substitute from another bundled pack whose resolution is at or below the active pack's own, and never a higher-resolution substitute. Only when no confirmed historical art exists anywhere does the item keep its ASCII glyph. When a pack has its own Linoleum conversion, the item's tile is declared as a standalone asset of that pack; a raw sheet coordinate is used only for a pack with no Linoleum conversion at all. Every restored item in this mod family follows these rules. New content that a mod adds follows the tile pack's normal donor policy instead, and Linoleum documents how to opt out of it.

**Reaching the command in play.** `plugin.ts` installs `feature-restoration:spike` through `registry:command`, names it with `commands.setVerb`, and claims the `j` key by default through the `keymap:write` capability. In Angband 3.4.1's original keyset, `j` was the key for jamming a door. The claim only succeeds when the current keyset leaves `j` free, so it never replaces a binding made by you or by another mod. If `j` is already taken or keymap access was not granted, you can still bind the command yourself in the keymap editor.
### Restore the "of Fury" weapon ego

"Of Fury" was a live weapon ego from Angband 3.0.6 through 3.2.0. In June 2011 upstream commit `d65dfe355` ("Merge Timo's item changes") commented out its three `type:` lines (sword, polearm, hafted) and kept everything else, and the record is still in 4.2.6's `ego_item.txt` in 4.2 syntax. With no weapon type, no weapon can carry it. This section sets the three types back and touches nothing else, so the numbers are 4.2.6's own: commonness 2 from depth 50, +d10 to hit and to damage, strength, one or two extra blows, protection from fear, and aggravation.

In the game's own item-power rating (`object_power`), a level-60 Long Sword averages 139 with Fury, below (Defender) at 149 and above of Extra Attacks at 80. `ego-fury.test.ts` measures this over 400 fixed seeds and fails if Fury ever rates above (Defender).

### Restore cut rods, wands, staffs, potions and equipment

These four sections bring back records that later releases removed and 4.2.6 does not have under any name:

| Section | Records | Last release |
|---|---|---|
| `classic-devices` | rods of Door/Stair Location and Trap Location; wand of Door Destruction; staffs of Trap Location, Door/Stair Location and Object Location | 4.0.5, 4.1.3 and 3.0.9 |
| `classic-potions` | Weakness, Stupidity, Naivety, Clumsiness, Sickliness, Apple Juice, Water, Lose Memories | 3.0.9 and 4.1.3 |
| `classic-equipment` | Sabre, Small Sword, Rusty Chain Mail, Double Chain Mail, Gnomish Shovel, Dwarven Shovel, Dwarven Pick | 3.0.9 |
| `classic-dangers` | Death, Ruination, Detonations | 3.0.9 |

Many items that look cut were only renamed, and those are left out because the game already has them. The Sleep Monster wand and rod are Hold Monster, the Disarming wand and rod are Disable Traps, the Shadow Cloak is the Elven Cloak, the Shield of Deflection is the Mithril Shield, and the Orcish Pick is the Pick. Each keeps its old level, weight and cost, and `restored-records.test.ts` fails if a restored record matches a 4.2.6 record on type, level, weight, cost, dice, armour and effects.

Where a record needed a change to fit 4.2, the reason is written beside it in `tools/restore/`:

- **Armour and digging.** 4.2 raised body armour values and replaced numeric digging with three grades. Rusty and Double Chain Mail take the armour class their 3.0.9 equals have in 4.2 (Chain Mail at 32, Augmented Chain Mail at 42), and Rusty Chain Mail's -8 penalty scales the same way to -18. The Gnomish Shovel digs at grade 2 and the Dwarven Shovel and Dwarven Pick at grade 3, the grade 4.2's Mattock has for the same 3.0.9 digging value.
- **Effects.** 3.0.9 wrote effects in code keyed to each item, so each restored 3.0.9 record uses the 4.2 effect that does the same thing. The stat potions use `DRAIN_STAT`, the staffs detect over 4.2's standard 22 by 40 area, and the deadly potions use `DAMAGE`, `DRAIN_STAT` and `TIMED_INC` with 3.0.9's own damage, stun and cut values. Ruination drained Charisma too, which 4.2 does not have.
- **How often.** 3.0.9 gave a depth and a rarity; the conversion keeps the depth and scales rarity against 4.2's usual commonness of 20. The five stat-draining potions are set to 10, 4.2's commonness for Salt Water. Apple Juice and Water were never generated at random in 3.0.9, so they take Slime Mold Juice's allocation and a share of its nourishment in proportion to their 3.0.9 values.

`tools/convert-records.mjs` rebuilds these records from a local clone of upstream Angband's git history and compiles each one with 4.2.6's own gamedata rules.

### Restore the monsters cut in 4.2.0, and the 3.x novices and angels

Of the 55 monsters Angband 4.2.0 cut, 51 handed their tile to a Tolkien-world replacement, and 25 of those replacements kept the old monster's depth, speed and hit points exactly: the jackal became the wild dog, the dark elven priest the ironfist priest, the Cat Lord Tevildo. `monsters-4-1` adds the old records back beside the new ones. For each of those 25 exact pairs, both monsters appear half as often while the section is on, so a depth that drew one wild dog now draws a wild dog or a jackal. The other monsters are simply added. The 4.1.3 casters dropped named spellbooks that 4.2 does not have; they now drop a magic book or a prayer book of no fixed title, the way 4.2's own casters do, so they drop 4.2's books normally and the classic books when those are on.

`monsters-3x` does the same for sixteen 3.x monsters: the six novices (the lone versions, since 3.2.0 also shipped grouped novices under the same names), the Swordsman and Hardened warrior from 3.4.1, and the angels from 3.3.2 on 4.2's Ainu base.

Two monsters stay out. 4.2's Azog, Enemy of the Dwarves is the same character as 4.1.3's Azog, King of the Uruk-Hai, and a game with two Azogs makes no sense. 4.2's craban is 3.4.1's Crebain with its singular name.

### Add the Amulet of Amandil

This one was never in a release. Upstream commit `2744ef5a1` ("Merge jens's artifact changes", 19 June 2011) added it already commented out, and 4.2.6's `artifact.txt` still has it that way. The record's only problem was its base line, `amulet:55`, a numeric reference from before 2016. Index 55 is the Golden amulet flavor, which 4.2 fixed to the artifact base called Necklace, so the restored record uses that base and draws as the golden amulet it was written as. Its level, weight, cost, allocation, flags, values and description are the commented record's own, and `artifact-amandil.test.ts` compares them line by line.

An artifact a mod adds is not redesigned in a random-artifact game, so Amandil keeps these numbers even with `birth_randarts` on.

### Restore the bronze dragons

Upstream commit `0ce785897` ("Remove "bronze" monsters and DSM. Remove BR_CONF from other monsters.", December 2010) set every bronze dragon's rarity to 0, so 3.3.0 through 3.5.1 carried the records without ever generating them. 4.0.0 then deleted them and removed confusion as an element (`bc0a46a01`). Angband 3.2.0 is the last release that put them in play, and it is the source here.

In 3.2.0 the baby bronze dragon and the giant bronze dragon fly were exact copies of their gold siblings, and each larger bronze dragon was a weaker gold dragon. 4.2 rebalanced the gold dragons, so each bronze dragon starts from its 4.2 gold sibling and scales hit points, armour, experience and blow dice by the 3.2.0 bronze-to-gold ratio, with depth moved by the 3.2.0 difference. The mature bronze dragon, for example, had 80% of the mature gold dragon's hit points in 3.2.0, so it has 592 against 4.2's 740. The Great Wyrm of Perplexity had exactly the Great Storm Wyrm's numbers in 3.2.0 and takes 4.2's great storm wyrm with confusion in place of lightning. Bronze Dragon Scale Mail matched Gold on level, cost and breath damage, and takes 4.2's Gold Dragon Scale Mail with 3.2.0 Bronze's weight, armour and depth.

Confusion breath follows 3.2.0's rules, with one change. A monster is confused for (10 + 1d15 + r) / (r + 1) turns, takes half damage if it cannot be confused, and a confusion breather takes dam x 2 / (1d6 + 6). The player is confused for 1d20 + 10 turns. In 3.2.0, resisting confusion also cut the damage. 4.2 made that resistance the protection from confusion, and a 4.2 protection stops a status without reducing damage, so protection here stops the confusion and the damage lands in full. The breath's divisor (hit points / 6) and damage cap (400) are 3.x's own.

### Restore seven ring and amulet flavors

Upstream commit `e08ed1dcb` ("Add some fixed artifact flavors", 4 October 2013) commented out seven random flavors so their index slots could become fixed flavors for artifacts: Ruby (28) became Narya, Sapphire (29) Vilya, Mithril (40) Nenya, Bronze (52) Carlammas and Golden (55) the Necklace of the Dwarves, while the Amber (44) and Coral (46) slots went to the Elfstone (drawn green) and the Evenstar (drawn white). The section appends the seven to core's ring and amulet flavor lists with the colours they had before that commit. They take new indices, 303 to 309, so the artifacts keep theirs. Five of the seven share a name with an artifact's fixed flavor, which brings back the pre-2013 guessing game: an unknown Ruby ring might be Narya.

### Where the tiles come from

`tools/extract-art.py` takes each restored item and monster's tile from upstream's own tile sheets. For every bundled pack it walks back from the record's last release to the newest one whose pref file still maps it, crops that cell from the sheet at the same release, and records in `tools/art-report.json` whether 4.2.6's sheet still holds the same pixels there and what 4.2.6 draws in that cell now. A pack with no tile of its own takes the best real tile from a pack at the same or a lower resolution. No tile from a larger pack is scaled down. The seven restored flavors alias their historical tiles and carry hue rotations where they share art with a fixed artifact flavor. Restored monster art carries hue rotations where its old tile is now used by a 4.2 monster.

## Content, plus one plugin

Restoring a spell to a class's book only takes data. The spell already exists (the Mage and the Rogue cast it today), so nothing new has to run; the class's book just needs one more entry. A [field-level patch](https://github.com/neostryder/neo-angband/blob/master/packages/mod-sdk/src/patch.ts) onto core's own `class.json` does exactly that, and a manifest [section](https://github.com/neostryder/neo-angband/blob/master/docs/modding/MOD_LIFECYCLE.md) turns it on and off. That is all `teleport-other` needs.

Store discounts are different. 4.2.6's core has no discount field and no discount roll left to patch, so there is no data to attach to. Restoring them needed one small addition to the game's own engine: a `registry:store` discount-roll hook alongside the stack-size hook that was already there. This mod's `plugin.ts` installs a handler into it, gated on the `feature-restoration.discounts` rule flag and nothing else. No other system in the game is touched, and with the toggle off the hook is never called at all, like every other disabled mod hook.

Door spiking needs both halves. Iron Spikes are a new `object.json` record (in the `spike-doors` section, borrowing the `flask` tval; see above), and the command that uses them is new behaviour with nothing in core to attach to, so it goes through `registry:command` the same way discounts go through `registry:store`. Both halves are gated on one flag, `feature-restoration.spike-doors`, which is the section's own `flag` field, so you see one toggle rather than a content switch and a behaviour switch that could get out of step. `register()` only calls `commands.register` while that flag is on, so with the section disabled the game has neither the item nor a command referring to it.

The bronze dragons need behaviour of a third kind: confusion as an element. `projection.json` adds the CONFUSION projection as data, and `plugin.ts` installs what it does to the player and to monsters through `registry:projection`, from `src/confusion.ts`. Both are gated on `feature-restoration.bronze-dragons`, the section's own flag, so the handlers never run for a projection that does not exist.

## Needs a core release

Some sections rely on game fixes that are not in a published release yet. The tests run against a loader that already has each fix, and a section listed here must not ship until the game release carrying its fix is out and `manifest.json`'s `engine` floor names it.

| Section | Needs |
|---|---|
| `bronze-dragons` | neostryder/neo-angband#319: the web loader has to declare a mod's monster spells before binding, or the first bronze dragon stops the game from starting. |

The game packages this repository tests against are pinned at 1.18.0 until neostryder/neo-angband#318 is fixed, because 1.19.0 and 1.19.1 cannot be installed.

## Installing

The mod is `manifest.json`, its gamedata files (`artifact.json`, `class.json`, `ego_item.json`, `flavor.json`, `message_type.json`, `monster.json`, `monster_spell.json`, `object.json`, `projection.json`) and `plugin.js` (built from `plugin.ts`; see below). You can install it in either of these ways:
- **In the game:** Mods -> **Install a mod...**, which fetches this repository at a
  release tag, never a branch. The install records a SHA-256 of every byte that
  arrived, so the manager can answer later whether the copy on your machine has
  changed; it cannot tell you whether what arrived is what was published here.
- **A folder:** clone this repository into your mods directory, or point the browser
  build at it with **Load mod folder**.

## Working on it

```bash
pnpm install --frozen-lockfile
pnpm verify
```

This typechecks, runs the tests, and (through `pnpm check`, which is part of `verify`) confirms that the committed `plugin.js` matches what `plugin.ts` builds today, so a source edit that was not rebuilt fails instead of shipping stale behaviour. The content tests check every ref and every book index this mod's patches name against `@rpgm-tools/neo-angband-content`, the same published content pack a player's game boots from. If a future core release renumbers a class's books, adds a spell ahead of where this mod appends, or ships Teleport Other to a class this mod also restores it to, the test failure says what moved instead of the patch quietly landing on the wrong slot.
```bash
pnpm build   # plugin.ts -> plugin.js, after editing plugin.ts
```

### Adding another restored feature

For each new restoration:

1. Confirm the feature existed in a released Angband and is really gone from 4.2.6. When the feature is content, `reference/lib/gamedata/` in the game's repository is the primary source; when it is not, use a real upstream tag's source, fetched with `gh api` as for the discount roll above. Memory of "the way it used to be" is not evidence.
2. Decide between content and plugin the same way the three features above did. If 4.2.6 still has the field or record to patch, use a manifest `section` with `fieldPatches`, nested the same way `teleport-other` is in `class.json`. If the item or record itself is gone (like `spike-doors`'s Iron Spike), use a `section` with `records` instead: a new entry under an existing tval. A new item class would be a bigger change, and this mod has not needed one yet. If 4.2.6 dropped the underlying mechanism entirely, the restoration needs a `registry:*` capability, either one that already exists (`registry:command`, used by `spike-doors`) or a real addition to the game's own engine first (`registry:store`, added for `discounts`), plus a `rules[]` or section `flag` toggle here.
3. Give it its own row in this README's table and its own toggle, defaulting to off. A restoration that needs both a record and behaviour uses one section for both, so the player sees one toggle rather than two that could get out of step (`spike-doors` does this: the item's `records` and the command's `registry:command` gate share one `flag`).
4. Add tests shaped like `teleport-other.test.ts` for a content section (assert the ref resolves, that core does not already have the feature, that the target is named by name and not by index, and that nothing collides) or like `plugin.test.ts` for a plugin (assert the flag gates it, and assert the mechanism's exact odds and behaviour against a fake host and a recording Rng, not just its outputs), or both, the way `object-spike.test.ts` and `plugin.test.ts` split `spike-doors` between them.
## Releasing

Pushing a tag matching `vX.Y.Z` makes the release; there is no separate publish step. The releases site at releases.rpgm.tools picks up each new release and posts it to the Neo Angband announcements forum on Discord.

## Questions, or something wrong

[**The RPGM Tools Discord**](https://discord.gg/YegtwbHTBQ) is the fastest way
to ask anything, whether a level or a fail rate is intended, how to get this installed,
or what you should try next. No GitHub account needed.

[Open an issue here](https://github.com/neostryder/neo-angband-mod-feature-restoration/issues/new/choose) for a bug in this mod. Two kinds of problem belong against the game instead, and the forms will point you there: the mod system (an install that fails, a load order that will not stick, a conflict report that looks wrong), and the game not matching Angband 4.2.6 while this mod is switched off. With the mod on, differences from 4.2.6 are expected, since changing the game is what the mod does.

For anything that should not be public, including a security report:
**strider-angband (at) rpgm.tools**. See
[SECURITY.md](https://github.com/neostryder/neo-angband/blob/master/SECURITY.md).

Asking about AI use in this project? [AI_USAGE_POLICY.md](AI_USAGE_POLICY.md) is
the complete answer.

[TERMS.md](TERMS.md) covers use of this mod. The core repository's
[PRIVACY.md](https://github.com/neostryder/neo-angband/blob/master/PRIVACY.md)
covers what is stored and what network requests the game makes. Project
participation is subject to the shared [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licence

Same dual licence as Neo Angband and Angband: GPL v2 or the Angband licence. See
[LICENSE.md](LICENSE.md).

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.

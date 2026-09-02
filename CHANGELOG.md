# Changelog

All notable changes to this mod are recorded here. Versions follow the mod's own
`manifest.json`, which is what the game reads, and each released version has a
matching git tag that an install pins itself to.

An entry has to matter to somebody running the mod. Documentation wording,
internal refactoring and test-only additions are not recorded here. Bug fixes
are, however small.

Every restoration in this mod defaults to **off**. Enabling the mod restores
nothing on its own; each switch is a separate decision, taken in
Mods -> Feature Restoration -> Fixes & tweaks.

Starting with this entry, an entry opens with one or more bracketed tags.
`[Visible]` marks a change a player would notice in the game or mod itself;
`[Internal]` marks one that touches only code, tooling, or a maintainer's own
workflow, with nothing for a player to see. A further tag (`[Security]`,
`[Balance]`, `[UI]`, `[Modding-API]`, `[Localization]`, `[Save-Compat]`,
`[Docs]`, `[Content]`, `[Compatibility]`, and others as they come up) names
what kind of change it is. Lists appear in this order and each is omitted
when empty for a release: Added, Changed, Removed, Fixed. Earlier entries
were not retagged.

## Unreleased

## 1.0.0 - 2026-08-26

### Added

- **Door spiking (neo-angband#28), off by default.** Iron spikes still
  existed as an object kind and doors still carried a jammed state, but
  nothing opened onto it. A new `feature-restoration:spike` command and an
  Iron Spikes object record restore it, gated behind the `spike-doors`
  section. Not yet reachable by a player: the web front end has no general
  mechanism to dispatch a mod-registered `registry:command` to a keypress,
  so the command exists and is tested but has no key bound to it yet.

## 0.3.4

Added a Terms of Use, a shared Code of Conduct, and `AI_USAGE_POLICY.md`
alongside the existing LICENSE policy, and a README screenshot of the mod's
description panel.

## 0.3.3

### Fixed

- Both restorations cited a version that had the behaviour without saying whether it
  was the last one to have it, which is the question the citation exists to answer.
  Teleport Other's README, `manifest.json` and code comments cited Angband 4.1.2. The
  Priest, Paladin and Ranger rows in `class.txt` are byte-identical across the entire
  4.1.x series, and Angband 4.1.3 (released 22 July 2018) is the last official release
  before 4.2.0's spellbook rewrite, which cut pure casters from nine
  spellbooks to five and hybrid casters to two or three, and dropped the spell from all
  three classes. Store discounts cited Angband v3.0.0. The discount roll in
  `mass_produce` is unchanged from 3.0.0 through 3.0.6, and Angband 3.0.6 (released 18
  June 2005) is the last OFFICIAL release to carry it: three snapshot betas that followed
  it (3.0.7s1, s2 and s3) still carried the same code but were released by a
  maintainer-to-be before she was appointed maintainer, so Angband never shipped an
  official 3.0.7, and Angband 3.0.8 (8 July 2007) removed the roll as part of what its
  own changelog calls a "semi-rewrite of the store code." Every number and every test
  assertion in both restorations is unaffected; only which release is named as the last
  one that had the behaviour has changed.

## 0.3.2

### Fixed

- The build section said the game's content pack and plugin builder come from a
  checkout of the game rather than from npm. They are published packages, so
  `npm ci` is the whole setup, and the builder's own documentation had the same
  order backwards. A sibling checkout is an override for developing against an
  engine change that has not reached the registry yet.
- One menu path used an arrow glyph where the rest of the documentation writes
  `->`.

### Changed

- Tested against engine and content 0.24.0 rather than 0.20.0. A mod tested
  against an older engine than the one it installs onto has been tested against
  the wrong thing.

## 0.3.1

### Fixed

- The install section claimed the game checks every file against a SHA-256 that
  ships inside it. It does not. The install records a digest of the bytes that
  arrived, which answers whether the copy on your machine has changed since it was
  installed, and cannot answer whether what arrived is what was published here.
  What the install does give is a pinned tag rather than a branch, so what arrived
  cannot change under you afterwards.

## 0.3.0

### Changed

- **Restore Teleport Other: the restored spell is now priced for the game as it is,
  not as it was.** The three rows previously carried Angband 4.1.2's values verbatim.
  Angband 4.2 repriced spells to cost the same in every class that has them, so a
  4.1.2 price landed in the current game as a penalty rather than a restoration: it
  charged a Priest 20 mana at 80 percent failure for a spell the Mage buys at 10 mana
  and 30 percent.

  | Class | Before | After |
  |---|---|---|
  | Priest | 20:20:80:16 | 18:10:30:20 |
  | Paladin | 25:25:80:12 | 24:10:30:50 |
  | Ranger | 31:25:70:3 | 30:10:30:50 |

  Mana 10 and fail 30 are measured: both surviving copies of the spell sit there. Level
  and exp follow the model for the caster class, the Mage for the Priest and the Rogue
  for the Paladin and the Ranger. How far to soften the Priest's level cut, and the
  exact exp for the Paladin, are judgment calls and are labelled as such in the README.
  The Ranger's result is identical to the Rogue's current row, which is the expected
  outcome given the two classes had identical 4.1.2 rows.

  The effect and description text are unchanged; they were already copied from the
  Mage's current copy.

### Added

- Two tests that pin the restored rows to the published content pack rather than to a
  constant in the test file: one asserting mana and fail still equal what both surviving
  copies of the spell cost in core, and one asserting the Ranger's row still matches the
  Rogue's. A core release that reprices either surviving copy now fails the suite instead
  of leaving this mod quietly stale.

### Documentation

- README gained a "Where these numbers come from" section carrying the measurement:
  the cross-class pricing convergence counts, the two model deltas, the per-axis basis,
  and an explicit split between what is measured and what is judgment. It replaces the
  earlier claim that nothing in the table was derived.
- `manifest.json`'s section description no longer states that every value comes from
  Angband 4.1.2.

## 0.2.0 - 2026-08-19

### Added

- Restored Teleport Other to the Priest, the Paladin and the Ranger as an opt-in
  section, defaulting off.
- **Restored pre-4.2.6 store discounts** as an opt-in rule flag, defaulting off.
  Angband 4.2.6 dropped the discount field entirely, so this needed code and a
  small seam in the game's own store registry rather than a content patch. The
  odds and tiers are transcribed from upstream's v3.0.0 source and cited in the
  README.

### Changed

- The Ranger's restored level moved from 28 to 23, re-derived from Haste Self,
  the one spell that survived the class's rewrite from the arcane realm to the
  nature one, rather than from an unanchored guess.

## 0.1.0

Never released. The first commit carried this version and no tag was cut from
it; 0.2.0 is the first version a player could install.

# Changelog

All notable changes to this mod are recorded here. Versions follow the mod's own
`manifest.json`, which is what the game reads.

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

## 0.2.0

- Restored Teleport Other to the Priest, the Paladin and the Ranger as an opt-in
  section, defaulting off.
- Restored pre-4.2.6 store discounts as an opt-in rule flag, defaulting off, through a
  `registry:store` discount roll in `plugin.ts`.

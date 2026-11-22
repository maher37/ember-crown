# Data fixes from the rulebook check (Nov 21)

The owner's PHB, DMG and Monster Manual PDFs were text-extracted in the claude.ai chat. Their numbers were compared against `src/data/*.json`. **No book text is in this repo**; only the differences are listed. The PDFs are OCR'd scans, so a few entries couldn't be read and are listed under "Not checked."

Roadmap task **N1**: apply the fixes in §1, clear the verify flags in §2, and update `docs/Data_Verify_Checklist.md` to match. Do it in one PR, and run `npm test`, `npm run validate-data` and `npm run balance`. The two monster fixes slightly change fights that use veterans and brown bears.

**Status: applied (roadmap N1).** One exception: the veteran's heavy crossbow was kept at **1d10+1**. The free SRD 5.1 rules print 1d10+1, and the game's number checker already listed that "+1" as a known book quirk, so the "1d10" reading is probably a scan error [inferred]. It stays flagged in the checklist for the owner to look at in the MM. Fixed spells (§1) had their flags cleared too, since they were checked. `veteran` and `brown-bear` stay flagged for ability scores and hit dice, which the check didn't confirm.

## 1. Fixes (game value → book value)

### Monsters (`src/data/monsters.json`)
| Monster | Field | Game now | Book (MM) |
|---|---|---|---|
| `veteran` | Heavy crossbow damage | 1d10+1 | **1d10** (to-hit +3 is correct) |
| `brown-bear` | Bite to-hit | +6 | **+5** |
| `brown-bear` | Claws to-hit | +6 | **+5** (damage 1d8+4 and 2d6+4 are correct) |

### Spells (`src/data/spells.json`)
| Spell | Field | Game now | Book (PHB) |
|---|---|---|---|
| `revivify` | school | necromancy | **conjuration** |
| `protection-from-evil-and-good` | range | 30 ft | **touch** |
| `prestidigitation` | range | 30 ft | **10 ft** |
| `dancing-lights` | range | 30 ft | **120 ft** |
| `feather-fall` | range | 30 ft | **60 ft** |
| `fog-cloud` | range | 30 ft | **120 ft** |
| `beacon-of-hope` | range | 90 ft | **30 ft** |
| `sleet-storm` | range | 90 ft | **150 ft** |

## 2. Checked and matching: set `"verify": false` for these fields

**Monsters.** These match the MM on AC, HP, hit dice, challenge rating and XP. They also match on ability scores and attack to-hit and damage wherever the scan was readable:
`bandit`, `bandit-captain`, `thug`, `scout`, `guard`, `cultist`, `cult-fanatic`, `priest`, `mage`, `lizardfolk`, `goblin`, `hobgoblin`, `orc`, `bugbear`, `wolf`, `worg`, `dire-wolf`, `giant-rat`, `swarm-of-rats`, `giant-centipede`, `stirge`, `giant-spider`, `swarm-of-insects`, `griffon`, `owlbear`, `skeleton`, `ghoul`, `ghast`, `shadow`, `specter`, `wraith`, `wight`, `animated-armor`, `gargoyle`, `fire-elemental`, `magma-mephit`, `hell-hound`, `salamander`, `ogre`, `hill-giant`, `fire-giant`, `troll`, `green-hag`, `red-dragon-wyrmling`, `young-red-dragon`

**Spells.** These match the PHB on level, school, casting time, range, concentration and damage dice (where readable):
`fire-bolt`, `ray-of-frost`, `shocking-grasp`, `acid-splash`, `chill-touch`, `eldritch-blast`, `poison-spray`, `sacred-flame`, `vicious-mockery`, `produce-flame`, `shillelagh`, `thorn-whip`, `guidance`, `spare-the-dying`, `light`, `mage-hand`, `minor-illusion`, `thaumaturgy`, `bless`, `bane`, `burning-hands`, `color-spray`, `command`, `cure-wounds`, `healing-word`, `guiding-bolt`, `inflict-wounds`, `magic-missile`, `shield`, `mage-armor`, `sleep`, `thunderwave`, `faerie-fire`, `entangle`, `hex`, `hunters-mark`, `hellish-rebuke`, `armor-of-agathys`, `shield-of-faith`, `divine-favor`, `sanctuary`, `charm-person`, `dissonant-whispers`, `detect-magic`, `disguise-self`, `goodberry`, `aid`, `hold-person`, `misty-step`, `scorching-ray`, `shatter`, `spiritual-weapon`, `moonbeam`, `flaming-sphere`, `spike-growth`, `web`, `lesser-restoration`, `prayer-of-healing`, `invisibility`, `mirror-image`, `silence`, `heat-metal`, `pass-without-trace`, `branding-smite`, `suggestion`, `darkness`, `fireball`, `lightning-bolt`, `counterspell`, `dispel-magic`, `spirit-guardians`, `mass-healing-word`, `hypnotic-pattern`, `haste`, `fly`, `call-lightning`, `conjure-animals`, `hunger-of-hadar`, `vampiric-touch`, `fear`, `slow`, `remove-curse`, `stinking-cloud`, `meld-into-stone`, `spider-climb`, `greater-invisibility`, `ice-storm`, `cone-of-cold`, `resistance`, `false-life`, `ray-of-sickness`, `tashas-hideous-laughter`, `searing-smite`, `blindness-deafness`, `blur`, `enlarge-reduce`, `magic-weapon`, `protection-from-energy`, `bestow-curse`, `daylight`

**Classes: all 12 match the PHB class tables for levels 1–6.**
- Hit dice and saving throws.
- Full, half and pact spell slots.
- Cantrips known, and spells known (bard, ranger, sorcerer, warlock).
- Rages, ki points, sorcery points, Channel Divinity uses, Wild Shape uses, Martial Arts die and Unarmored Movement.

You can clear the class-table verify notes. **Not covered:** the wording of individual features and the second subclasses (D29).

## 3. Not checked (still need a look)
- `crown-shard` and `ember-wraith`: homebrew, not in the books.
- `grey-bruiser`: a reskinned bandit (the base bandit matches).
- `zombie` (attack line unreadable) and `earth-elemental` (attack lines unreadable). AC, HP and CR match for both.
- `gust-of-wind`: the scan was unreadable. The game's values (2nd-level evocation, a 60-foot line, concentration up to 1 minute) agree with the PHB as best known [inferred].
- Not checked at all: monster traits and special abilities (save DCs, Regeneration and so on), `foes.json`, magic items (DMG), species, backgrounds, and the feature descriptions.

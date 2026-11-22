# The Ember Crown: Magic Items & Elite Monsters (v0.1)

> **Item numbers and descriptions live in `src/data/magicItems.json`.** This doc keeps where each item comes from and why. If they disagree, the JSON wins.

*Every magic item is from the user's DMG (✅ = found in the DMG's item tables) unless marked homebrew. Rarity follows the DMG's guidance: uncommon items through about level 4, rare from about level 5. Each act's **elite** reward is one step stronger than the act's other items. It's powerful, but still within reason for the level.*

---

## Design rules
- **2–4 level-appropriate items per act**, each tied to a story beat (no random loot piles for the important stuff).
- **Plus one ring, one cloak and one necklace hidden in each act's finds** (owner, Nov 22). These are smaller, useful items; the act's standout items stay tied to story beats.
- **One optional elite monster per act.** It's Deadly at the expected level and Hard if you're ahead from side quests. It's clearly telegraphed (a "Deadly" skull rating in the journal, warnings from NPCs) and guards the act's **standout item**.
- **Healing potions** (2d4 + 2, common) are sold at the Drowned Lantern and found regularly. Greater healing (4d4 + 4, uncommon) appears from Act II.
- **Attunement:** up to 3 attuned items per character (DMG rule). Attuning happens during a short rest.

---

## Act I: Lantern Night (levels 1–3)
| Item | Rarity | What it does (our words) | Where it comes from | Why it fits |
|---|---|---|---|---|
| **Deepdelver** (+1 warhammer) ✅ (+1 weapon) | Uncommon | +1 to attack and damage rolls | Ulric's sunken shrine, in an Ammarindar dwarf's tomb niche (main path) | Bludgeoning shreds the shrine's skeletons; dwarven history of the Greypeaks |
| **Lysa's Locket** (Periapt of Wound Closure) ✅ | Uncommon, attunement | When you're dying you stabilize automatically at the start of your turn; healing from spending Hit Dice is doubled | *The Mill at Night*: Lysa Varrow's ghost gives it to the party (or to Corin) | A mother's protection; it matters more later, because Maelis recognizes it in Act III |
| **The Luck-Stone** (Stone of Good Luck) ✅ | Uncommon, attunement | +1 to ability checks and saving throws | *The Goblin Who Stayed*: Wix's clan says "the luck goes with whoever brought it home" | Funny and genuinely useful |
| **Elite reward: Scald's hoard.** Cloak of Protection ✅ + 2 Potions of Resistance (fire) ✅ | Uncommon | Cloak: +1 AC and +1 to all saving throws | Scald's lair (see Elites) | A real power spike for level 2–3, and the fire potions foreshadow the dragon |

## Act II: The Hollow Star (levels 3–4)
| Item | Rarity | What it does | Where | Why |
|---|---|---|---|---|
| **The Bog Pearl** (Pearl of Power) ✅ | Uncommon, attunement (spellcaster) | Once per day, regain one spent spell slot of 3rd level or lower | *Mother Sallow's Bargain* | Casters' favorite; the price you paid the hag makes it feel earned |
| **The Mayor's Boots** (Boots of Elvenkind) ✅ | Uncommon | Silent steps; advantage on Stealth checks that rely on moving quietly | *Edric's Errand*: Edric "liberates" them from Tarrow's wardrobe during the ledger heist | Comic, and rewards the stealth quest |
| **Kell's Shield** (Sentinel Shield) ✅ | Uncommon | Advantage on initiative and on Perception (Wisdom) checks | *Deserters' Bounty*: Captain Kell's thanks if you freed his deserters | Rewards mercy; ambush-proofing |
| **Shield of the Morninglord** (homebrew: +1 shield) | Uncommon-plus | +1 AC (on top of a normal shield); while you hold it, you resist fire damage | *The Fallen Paladin's Shield* | Built for the Act III fire finale |
| **Elite reward: the Abbot's choice.** **Mace of Disruption** ✅ *or* **Staff of Healing** ✅ (the player chooses one) | Rare | Mace: extra radiant damage vs undead and fiends; weak undead may be destroyed outright. Staff: charges to cast *cure wounds*, *lesser restoration* and *mass cure wounds* (bard, cleric, druid) | The Drowned Abbot's crypt (see Elites) | Act III is full of undead (honor guard, ossuary), so this is huge but fair. The choice means every party benefits |

## Act III: The King's Kiln (levels 4–6)
| Item | Rarity | What it does | Where | Why |
|---|---|---|---|---|
| **Kiln-Quenched Weapon** (+1 weapon of the player's choice) ✅ | Uncommon | +1 to attack and damage rolls | *The Cold Forge*: quench a weapon in the relit Ammarindar forge | Lets any martial character upgrade |
| **The Honor Guard's Ring** (Ring of Protection) ✅ | Rare, attunement | +1 AC and +1 to saving throws | *Ser Ida's Unfinished Oath*: King Varrow's own ring, given by Ida | Act III level-appropriate rare; ties to the "real Varrow" truth |
| **The Drowned Lantern** (Lantern of Revealing) ✅ | Uncommon | Its light reveals invisible creatures and objects | *Last Boats from Ashford*: Brannoc gives the inn's namesake lantern if he leaves (or wills it to you if he stays) | Maelis's last letter asks you to bring a lantern. Carrying this one into the finale unlocks a special line |
| **Wix's Clan Gift** (Bag of Tricks, gray) ✅ | Uncommon | Pull out a random small animal that fights for you briefly | *Wix's Homecoming* | Goblin chaos; Wix insists it is "mostly badgers" |
| **Elite reward: Vorrag's forge-blade.** **Dragon Slayer** ✅ (+1 longsword or greatsword) | Rare | +1 to attack and damage; extra 3d6 damage against dragons | Vorrag the Kiln-Smith (see Elites) | Devastating against Cindrath's ember-wraith (dragon type). It makes the finale easier, which is the reward for beating the hardest optional fight |

**Deliberately absent:** fire-damage weapons such as Flame Tongue (Cindrath is immune to fire, which is a nice trap for players who bring fire spells: the game should warn via Arcana or the Truths).

---

## Things to find on the walk-around maps (D23)
Small finds, so exploring pays without upsetting the item plan [inferred amounts]:
- **Old Mine:** the overturned ore cart (Investigation DC 12: 25 gp, or 8 gp on a failure); the dwarven storeroom (Perception DC 13: 1 Potion of Healing).
- **King's Kiln:** the cult supply cache (Investigation DC 13: 2 Potions of Healing and 30 gp, or 1 potion on a failure).
- No XP for these, so the XP ledger in Encounters_and_XP.md is unchanged.

## Adventuring gear (D24)
Sold at Brannoc's stores (`src/data/gear.json`), PHB prices [CONFIRM: prices from memory]:
- **Rope** (1 gp), **torches** (1 sp), **hooded lantern** (5 gp), **crowbar** (2 gp), **thieves' tools** (25 gp): they open story choices (the cellar tunnel, the dwarven arch, Ashfall Pass, the Kiln's dials). They never run out.
- **Healer's kit** (5 gp): stabilize a dying ally next to you, no check. Never runs out.
- **Alchemist's fire** (50 gp), **holy water** (25 gp), **acid** (25 gp): thrown in fights and used up.
- All PHB armor and weapons, and Potions of Healing (50 gp), are also for sale.

## Ashford's shops (D26)
Bought, not found [inferred prices; XGtE puts uncommon items at 101–500 gp and rare at 501–5,000]. Each shop is data in `src/data/shops.json`.
- **Brannoc:** adventuring gear and Potions of Healing.
- **Stonemantle Forge (Hulda):** every PHB weapon, armor and shield; from Act II the +1 weapons and Shield +1 (400 gp); a Sentinel Shield in Act III (450 gp).
- **Quillon's Curios (Sabeth):** Wand of the War Mage +1 (300 gp, spellcaster) from Act I; Potions of Greater Healing and Fire Resistance, Pearl of Power (450 gp, spellcaster) and a Stone of Good Luck (450 gp) from Act II; Cloak and Ring of Protection and a Wand of the War Mage +2 (1,200 gp) in Act III.
- **The Dawn Shrine (Sister Aubra):** holy water, healing potions, and services (healing, restoration, raising the dead).
- **Odo's wagon (market days):** three of: Periapt of Wound Closure, Boots of Elvenkind, healing potions, alchemist's fire; from Act II Greater Healing and Fire Resistance potions, a Stone of Good Luck, a Sentinel Shield, a rapier or longbow +1; a Wand of the War Mage +2 in Act III. Two purchases a visit.
- **Hidden merchants (one purchase each):** Nib the goblin pedlar in the Ashwood (Act I), Ssessk the lizardfolk trader in the hunting grounds (Act II), Brokk the exiled smith at the Great Forge (Act III).

## Things to find while exploring (D27)
22 finds in `src/data/finds.json`: chests, caches, bodies and buried things, sized to each act (Act I: 3–75 gp and potions; Act II: 18–150 gp; Act III: 30–250 gp plus a Periapt of Wound Closure in the Kiln-Wardens' strongroom). Three of them start short side quests: the Smuggler's Note (Ashwood → Varrow's Mill), the Sergeant's Key (hunting grounds → Marrowmere) and the Kiln-Wardens' Strongroom (Ashfall Pass → the Great Forge).

Magic rings, cloaks and necklaces hidden in the finds (owner, Nov 22; placements are my picks [inferred]):
- **Act I:** Ring of Warmth (cold resistance; the skeleton in the steaming cave), Cloak of Elvenkind (advantage on Stealth; the mill's pantry chest), Brooch of Shielding (force resistance, worn at the neck; the goblin stash in the warren).
- **Act II:** Ring of Protection (the toll-bridge box), Cloak of Protection (the deserters' paychest), Amulet of the Devout +1 (+1 spell attack and save DC; the abbey reliquary).
- **Act III:** Ring of Resistance (fire) (Wix's cave of trophies), the Kiln-Warden's Mantle (homebrew: advantage on initiative and Perception; the Kiln-Wardens' strongroom). The strongroom's Periapt of Wound Closure is the act's necklace.


## Brannoc's rare finds (D25, replaced by D26)
Bought, not found, so they don't replace the story items above [inferred prices]:
- **From Act II:** Longsword, Rapier, Mace, Longbow, Greataxe and Quarterstaff +1 (400 gp each); Shield +1 (400 gp); Potion of Greater Healing and Potion of Fire Resistance (150 gp).
- **From Act III:** Ring of Protection (900 gp, attunement); Cloak of Protection (450 gp, attunement).

## Elite monsters (one per act, optional)
| Act | Elite | Monster (MM) | Raw XP → adjusted | Difficulty | XP/PC | Where and how it's telegraphed | Fight notes |
|---|---|---|---|---|---|---|---|
| I | **Scald**, a red dragon wyrmling hatched when the mountain's heat woke an egg from Cindrath's ancient clutch | Red dragon wyrmling ✅ (AC 17, HP 75, CR 4) | 1,100 → 1,100 | **Deadly at L2, Hard at L3** | 275 | A steaming hot-spring cave above the Old Mine. Wix refuses to go near it. Scorched goats and melted snow trail. Journal: "☠ Deadly" | Fire breath (recharge) can drop a level-2 character. Fire potions or spreading out are the counterplay. **Foreshadows Cindrath** |
| II | **The Drowned Abbot**, the abbey's last abbot, who refused to leave his flooded crypt | Wraith ✅ (AC 13, HP 67, CR 5) + 1 specter it made from a novice | 2,000 → 3,000 | **Deadly at L4, Hard at L5** | 500 | The abbey's flooded lower crypt. Abbey novices whisper about it, and a sealed door is marked with the sun of Lathander, scratched out. Journal: "☠ Deadly" | Life Drain lowers max HP, so bring Lesser Restoration or rest after. Radiant damage and the Paladin's Shield quest help |
| III | **Vorrag the Kiln-Smith**, a fire giant drawn to the Kiln's heat, who wants the crown for his own forge | Fire giant ✅ (AC 18, HP 162; CR 9 believed) | 5,000 → 5,000 | **Deadly at L5, Hard at L6** | 1,250 | Ammarindar's Great Forge, a side cavern before the Kiln Gate. Smoke and hammering heard for miles. He can be **talked into a single-combat duel or a smithing contest** instead (Athletics or smith's tools) | Two huge sword hits per turn, and a rock throw. Spread out, use cover, and make the most of a cold weapon or the Kiln-Quenched weapon. The talk options cut the danger in half |

**XP note:** elites are bonus XP outside the main ledger. A completionist who also beats all three elites earns about 2,000 more XP per character.

## CONFIRM LOCALLY
- [ ] Each item's exact DMG wording (charges, attunement, damage). The names were found in the DMG tables; the effects are summarized from memory.
- [ ] The fire giant's challenge rating (believed CR 9, 5,000 XP) and its attack numbers. AC 18 and HP 162 were read from the MM PDF.
- [ ] The wraith's attack numbers and the Life Drain save DC.

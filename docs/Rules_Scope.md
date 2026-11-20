# The Ember Crown: Rules Scope (v0.1)

*Exactly which 5e (2014) rules the game implements. Source: the user's Player's Handbook, DMG and Basic Rules PDFs, for personal use. Everything here is written in our own words and keeps only the numbers the engine needs. ✅ = checked against the PDFs this session; everything else is from the 2014 PHB as best known; verify during data entry (see CONFIRM LOCALLY).*

---

## 1. Core mechanics (the engine must do all of these)
- **d20 tests:** d20 + ability modifier (+ proficiency if proficient) vs a DC or AC. Modifier = (score − 10) ÷ 2, rounded down.
- **Proficiency bonus:** +2 at levels 1–4, +3 at levels 5–6 ✅.
- **Advantage / disadvantage:** roll 2d20 and take the higher / lower. Any amount of both cancels out to a straight roll.
- **Critical hit:** a natural 20 hits and doubles the damage dice. A natural 1 always misses.
- **Action economy per turn:** move (speed) + 1 action + 1 bonus action (only if a feature grants one) + 1 free object interaction; 1 reaction per round.
- **Standard actions:** Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object, plus Shove and Grapple (in place of an attack).
- **Opportunity attacks:** leaving an enemy's reach provokes one, unless you Disengaged.
- **Cover:** half = +2 AC and Dex saves; three-quarters = +5; total = can't be targeted.
- **Two-weapon fighting:** attack with a light weapon, then a bonus-action attack with the other light weapon (no ability modifier to its damage unless you have the fighting style).
- **Surprise:** creatures that didn't notice the threat can't move or act on their first turn.
- **Concentration:** one concentration spell at a time. Taking damage forces a Con save, DC 10 or half the damage, whichever is higher. Failing ends the spell.
- **0 HP and death saves ✅:**
  - At 0 HP a creature falls unconscious and makes death saves (DC 10). Three successes = stable; three failures = dead.
  - A natural 1 counts as two failures; a natural 20 = regain 1 HP.
  - Damage while at 0 HP = 1 failure (a critical hit = 2). Damage at or above max HP = instant death.
- **Knocking out ✅:** reducing a creature to 0 HP with a melee attack can knock it out instead (it's unconscious and stable). Used for the tavern brawl.
- **Monsters at 0 HP** simply die, except named villains (Maelis, Ulric, Tarrow), who fall unconscious so the story can continue ✅ (PHB allows this).
- **Resting ✅:**
  - **Short rest:** at least 1 hour; spend Hit Dice to heal (roll + Con modifier each).
  - **Long rest:** at least 8 hours, at most once per 24 hours; restores all HP and half your total Hit Dice (minimum 1). Interrupted by an hour of strenuous activity.
- **Random encounters ✅:** d20 per travel leg; 18 or higher triggers an encounter (see Encounters_and_XP.md §5b).
- **Inspiration:** awarded for acting on your character's personality (dialogue choices tagged by background). Spend it for advantage on one roll.

## 2. Conditions (all 14 + exhaustion, as the engine applies them)
| Condition | Effect in game |
|---|---|
| Blinded | Fails sight checks; its attacks have disadvantage; attacks against it have advantage |
| Charmed | Can't attack the charmer; the charmer has advantage on social checks against it |
| Deafened | Fails hearing checks |
| Frightened | Disadvantage on checks and attacks while the source is in sight; can't move closer to the source |
| Grappled | Speed 0 |
| Incapacitated | No actions or reactions |
| Invisible | Its attacks have advantage; attacks against it have disadvantage |
| Paralyzed | Incapacitated, can't move or speak; fails Str/Dex saves; attacks against it have advantage; melee hits from within 5 ft are critical |
| Petrified | Turned to stone; incapacitated; resists all damage |
| Poisoned | Disadvantage on attacks and ability checks |
| Prone | Can only crawl; its attacks have disadvantage; melee attacks against it have advantage, ranged attacks have disadvantage |
| Restrained | Speed 0; its attacks have disadvantage; attacks against it have advantage; disadvantage on Dex saves |
| Stunned | Incapacitated, can't move; fails Str/Dex saves; attacks against it have advantage |
| Unconscious | Incapacitated, drops what it holds, falls prone; fails Str/Dex saves; attacks against it have advantage; melee hits from within 5 ft are critical |
| Exhaustion (6 levels) | Cumulative: disadvantage on checks → half speed → disadvantage on attacks and saves → half max HP → speed 0 → death. A long rest removes 1 level (only the Berserker's Frenzy causes it in v1) |

## 3. Character creation
- **Ability scores:** standard array (15, 14, 13, 12, 10, 8), 27-point buy, or 4d6 drop the lowest.
- **Species (9) ✅:**
  - Hill Dwarf (+2 Con, +1 Wis, 25 ft)
  - High Elf (+2 Dex, +1 Int, 30 ft)
  - Lightfoot Halfling (+2 Dex, +1 Cha, 25 ft)
  - Human (+1 to all, 30 ft)
  - Dragonborn (+2 Str, +1 Cha, 30 ft)
  - Rock Gnome (+2 Int, +1 Con, 25 ft)
  - Half-Elf (+2 Cha, +1 to two others, 30 ft)
  - Half-Orc (+2 Str, +1 Con, 30 ft)
  - Tiefling (+2 Cha, +1 Int, 30 ft)
- **Backgrounds (8 from the PHB, personal use):** each gives 2 skills, a feature, and dialogue tags.

  | Background | Skills | Dialogue tag use |
  |---|---|---|
  | Acolyte | Insight, Religion | Temples, Lathander's abbey |
  | Criminal | Deception, Stealth | Grey Company, smugglers |
  | Folk Hero | Animal Handling, Survival | Ashford's commoners trust you |
  | Sage | Arcana, History | Abbey archives, Ammarindar lore |
  | Soldier | Athletics, Intimidation | Captain Kell respects rank |
  | Outlander | Athletics, Survival | Mountain travel, goblins |
  | Urchin | Sleight of Hand, Stealth | Edric, street rumors |
  | Noble | History, Persuasion | Mayor Tarrow, the Coinwright Guild |
- **Feats:** none in v1 (ability score increases only at level 4).
- **Multiclassing:** not in v1.

## 4. Classes, levels 1–6 (one subclass each) ✅ feature names checked in the PHB
**Spell slots.** Full casters (Bard, Cleric, Druid, Sorcerer, Wizard):

| Level | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Slots (1st/2nd/3rd) | 2 | 3 | 4/2 | 4/3 | 4/3/2 | 4/3/3 |

Half casters (Paladin, Ranger): L2: 2, L3: 3, L4: 3, L5: 4/2, L6: 4/2.
Warlock (pact magic; recharges on a short rest): L1: one 1st-level slot; L2: two 1st; L3–4: two 2nd; L5–6: two 3rd.

| Class (subclass) | L1 | L2 | L3 | L4 | L5 | L6 |
|---|---|---|---|---|---|---|
| **Barbarian** (Berserker), d12 | Rage (+2 damage, resist weapon damage, advantage on Str; 2 per long rest); Unarmored Defense (10 + Dex + Con) | Reckless Attack; Danger Sense | Frenzy (bonus-action attack while raging, exhaustion after); 3 rages | Ability score increase | Extra Attack; +10 ft speed | Mindless Rage (immune to charm and fear while raging); 4 rages |
| **Bard** (Lore), d8 | Spellcasting (Cha); Bardic Inspiration (d6, Cha modifier uses per long rest) | Jack of All Trades; Song of Rest (d6) | Expertise; Lore: 3 bonus skills and Cutting Words (reaction: subtract the die from an enemy roll) | Ability score increase | Inspiration d8; Font of Inspiration (recharges on a short rest) | Countercharm; Additional Magical Secrets (2 spells from any class) |
| **Cleric** (Life), d8 | Spellcasting (Wis); heavy armor; Disciple of Life (healing spells heal +2 + spell level) | Channel Divinity (1/rest): Turn Undead or Preserve Life (heal 5 × cleric level split among allies) | 2nd-level spells | Ability score increase | Destroy Undead (CR 1/2); 3rd-level spells | Channel Divinity 2/rest; Blessed Healer (heals self when healing others) |
| **Druid** (Land: Mountain), d8 | Druidic; Spellcasting (Wis) | Wild Shape (beasts up to CR 1/4, no fly/swim, 2 per short rest); bonus cantrip; Natural Recovery (regain slots on a short rest) | Mountain circle spells (*spider climb*, *spike growth*) | Ability score increase; Wild Shape up to CR 1/2 (no fly) | Circle spells (*lightning bolt*, *meld into stone*) | Land's Stride |
| **Fighter** (Champion), d10 | Fighting Style; Second Wind (bonus action, heal 1d10 + level, 1 per short rest) | Action Surge (1 per short rest) | Improved Critical (crit on 19–20) | Ability score increase | Extra Attack | Ability score increase |
| **Monk** (Open Hand), d8 | Unarmored Defense (10 + Dex + Wis); Martial Arts (d4; bonus unarmed strike) | Ki (points = level): Flurry of Blows, Patient Defense, Step of the Wind; +10 ft speed | Open Hand Technique (flurry hits knock prone, push 15 ft, or deny reactions); Deflect Missiles | Ability score increase; Slow Fall | Extra Attack; Stunning Strike; Martial Arts d6 | Ki-Empowered Strikes; Wholeness of Body; +15 ft speed |
| **Paladin** (Devotion), d10 | Divine Sense; Lay on Hands (pool of 5 × level HP) | Fighting Style; Spellcasting (Cha); **Divine Smite** (2d8 radiant + 1d8 per slot level above 1st; +1d8 vs undead and fiends) | Divine Health; Sacred Weapon (+Cha to attacks); Turn the Unholy; oath spells | Ability score increase | Extra Attack; 2nd-level spells | Aura of Protection (+Cha to saves for allies within 10 ft) |
| **Ranger** (Hunter), d10 | Favored Enemy; Natural Explorer | Fighting Style; Spellcasting (Wis) | Hunter's Prey (pick Colossus Slayer, Giant Killer or Horde Breaker); Primeval Awareness | Ability score increase | Extra Attack; 2nd-level spells | Favored Enemy and Natural Explorer improvements |
| **Rogue** (Thief), d8 | Expertise; Sneak Attack 1d6; Thieves' Cant | Cunning Action (Dash, Disengage or Hide as a bonus action) | Fast Hands; Second-Story Work; Sneak Attack 2d6 | Ability score increase | Uncanny Dodge (reaction: halve one hit); Sneak Attack 3d6 | Expertise (2 more skills) |
| **Sorcerer** (Draconic, red), d6 | Spellcasting (Cha); Draconic Resilience (+1 HP per level; AC 13 + Dex unarmored) | Font of Magic (sorcery points = level) | Metamagic (choose 2) | Ability score increase | 3rd-level spells | Elemental Affinity (+Cha to fire spell damage) |
| **Warlock** (Fiend), d8 | Pact Magic (Cha); Dark One's Blessing (temporary HP = Cha + level when you drop an enemy) | Eldritch Invocations (2, e.g., Agonizing Blast) | Pact Boon (Blade, Chain or Tome) | Ability score increase | 3rd-level pact slots; 3 invocations | Dark One's Own Luck (+d10 to a check or save, 1 per rest) |
| **Wizard** (Evocation), d6 | Spellcasting (Int, spellbook); Arcane Recovery | Evocation Savant; Sculpt Spells (allies are safe inside your area spells) | 2nd-level spells | Ability score increase | 3rd-level spells | Potent Cantrip (half damage on a successful save) |

**Corin Varrow (origin)** is a Draconic Bloodline sorcerer with red (fire) ancestry. The Ember bargains in Story_Bible.md §9 add homebrew boons on top of these features.

## 5. Curated spell list (about 70 spells, cantrips to 3rd level)
*Mechanics summarized in our own words. "Conc." means concentration. Class letters: B = Bard, C = Cleric, D = Druid, P = Paladin, R = Ranger, S = Sorcerer, Wl = Warlock, Wz = Wizard.*

### Cantrips
| Spell | Classes | Effect |
|---|---|---|
| Fire Bolt | S, Wz | Spell attack, 120 ft, 1d10 fire (2d10 at L5) |
| Ray of Frost | S, Wz | Spell attack, 1d8 cold, −10 ft speed |
| Shocking Grasp | S, Wz | Melee spell attack, 1d8 lightning, advantage vs metal armor, target loses its reaction |
| Acid Splash | S, Wz | Dex save, 1d6 acid, up to 2 adjacent targets |
| Chill Touch | S, Wl, Wz | Spell attack, 1d8 necrotic; target can't regain HP |
| Eldritch Blast | Wl | Spell attack, 1d10 force; 2 beams at L5 |
| Poison Spray | D, S, Wl, Wz | Con save, 1d12 poison, 10 ft |
| Sacred Flame | C | Dex save (no cover bonus), 1d8 radiant |
| Vicious Mockery | B | Wis save, 1d4 psychic; target has disadvantage on its next attack |
| Produce Flame | D | Thrown flame: spell attack, 1d8 fire; also a light source |
| Shillelagh | D | Club/staff uses Wis and d8 damage (bonus action) |
| Thorn Whip | D | Melee spell attack, 1d6, pull 10 ft |
| Guidance | C, D | Conc.: +1d4 to one ability check |
| Spare the Dying | C | Stabilize a dying creature |
| Light, Mage Hand, Minor Illusion, Prestidigitation, Thaumaturgy | various | Exploration and puzzle utility |

### 1st level
| Spell | Classes | Effect |
|---|---|---|
| Bless | C, P | Conc.: 3 creatures add 1d4 to attacks and saves |
| Bane | B, C | Conc.: 3 creatures (Cha save) subtract 1d4 |
| Burning Hands | S, Wz | 15-ft cone, Dex save, 3d6 fire (half on a save) |
| Color Spray ✅ | B, S, Wz | 15-ft cone; 6d10 "HP pool" blinds lowest-HP creatures first until the pool runs out; lasts 1 round |
| Command | C, P | Wis save; one-word command (flee, drop, grovel, halt) |
| Cure Wounds | B, C, D, P, R | Touch, heal 1d8 + modifier |
| Healing Word | B, C, D | Bonus action, 60 ft, heal 1d4 + modifier |
| Guiding Bolt | C | Spell attack, 4d6 radiant; next attack against the target has advantage |
| Inflict Wounds | C | Melee spell attack, 3d10 necrotic |
| Magic Missile ✅ | S, Wz | 3 darts that always hit, 1d4 + 1 force each, can split targets, strike together; +1 dart per slot level |
| Shield | S, Wz | Reaction: +5 AC until your next turn; blocks Magic Missile |
| Mage Armor | S, Wz | AC 13 + Dex for 8 hours |
| Sleep | B, S, Wz | 5d8 "HP pool" puts creatures to sleep, lowest HP first |
| Thunderwave | B, D, S, Wz | 15-ft cube, Con save, 2d8 thunder and push 10 ft |
| Faerie Fire | B, D | Conc.: Dex save; outlined targets grant advantage and can't be invisible |
| Entangle | D | Conc.: 20-ft square, Str save or restrained |
| Hex | Wl | Bonus action, conc.: +1d6 necrotic per hit on the target |
| Hunter's Mark | R | Bonus action, conc.: +1d6 per hit on the target |
| Hellish Rebuke | Wl | Reaction when hit: Dex save, 2d10 fire |
| Armor of Agathys | Wl | 5 temporary HP; attackers who hit you in melee take 5 cold |
| Shield of Faith | C, P | Bonus action, conc.: +2 AC |
| Divine Favor | P | Bonus action, conc.: +1d4 radiant on weapon hits |
| Sanctuary | C | Enemies must pass a Wis save to target the warded creature |
| Charm Person | B, D, S, Wl, Wz | Wis save; target is charmed for 1 hour |
| Dissonant Whispers | B | Wis save, 3d6 psychic; target must use its reaction to move away |
| Detect Magic, Feather Fall, Fog Cloud, Disguise Self, Protection from Evil and Good, Goodberry | various | Utility |

### 2nd level
| Spell | Classes | Effect |
|---|---|---|
| Aid | C, P | +5 max HP to 3 creatures for 8 hours |
| Hold Person | B, C, D, S, Wl, Wz | Conc.: Wis save or a humanoid is paralyzed (save each turn to end) |
| Misty Step | S, Wl, Wz | Bonus action: teleport 30 ft |
| Scorching Ray | S, Wz | 3 rays, a spell attack each, 2d6 fire each |
| Shatter | B, S, Wl, Wz | 10-ft sphere, Con save, 3d8 thunder |
| Spiritual Weapon | C | Bonus action: a floating weapon attacks for 1d8 + modifier each turn (not conc.) |
| Moonbeam | D | Conc.: 5-ft cylinder, Con save, 2d10 radiant; movable |
| Flaming Sphere | D, Wz | Conc.: 2d6 fire to adjacent creatures (Dex save); rolls around |
| Spike Growth | D, R | Conc.: 20-ft radius area; 2d4 damage per 5 ft moved |
| Web | Wz | Conc.: 20-ft cube, Dex save or restrained |
| Lesser Restoration | B, C, D, P, R | End blinded, deafened, paralyzed or poisoned |
| Prayer of Healing | C | Out of combat: up to 6 creatures heal 2d8 + modifier |
| Invisibility | B, S, Wl, Wz | Conc.: invisible until it attacks or casts |
| Mirror Image | S, Wl, Wz | 3 duplicates draw attacks away |
| Silence | B, C, R | Conc.: 20-ft sphere; no verbal spells |
| Heat Metal | B, D | Conc.: 2d8 fire each turn to a creature in metal armor |
| Pass without Trace | D, R | Conc.: +10 to the party's Stealth |
| Branding Smite | P | Bonus action, conc.: next hit +2d6 radiant |
| Suggestion | B, S, Wl, Wz | Conc.: Wis save; a reasonable command (dialogue use too) |

### 3rd level (full casters at L5; warlocks at L5)
| Spell | Classes | Effect |
|---|---|---|
| Fireball ✅ | S, Wz | 20-ft-radius sphere, 150 ft, Dex save, 8d6 fire (half on a save) |
| Lightning Bolt | S, Wz, (Land/Mountain D) | 100-ft line, Dex save, 8d6 lightning |
| Counterspell | S, Wl, Wz | Reaction: stop a spell of 3rd level or lower automatically; higher needs a check |
| Dispel Magic | B, C, D, P, S, Wl, Wz | End spells of 3rd level or lower on a target |
| Spirit Guardians | C | Conc.: 15-ft aura, enemies halved speed, Wis save, 3d8 radiant per turn |
| Revivify | C, P | Return a creature dead under 1 minute to life with 1 HP (300 gp diamond) |
| Mass Healing Word | C | Bonus action: up to 6 creatures heal 1d4 + modifier |
| Hypnotic Pattern | B, S, Wl, Wz | Conc.: 30-ft cube, Wis save or charmed and incapacitated |
| Haste | S, Wz | Conc.: double speed, +2 AC, an extra action; lethargic when it ends |
| Fly | S, Wl, Wz | Conc.: fly speed 60 ft |
| Call Lightning | D | Conc.: 3d10 lightning bolt each turn (Dex save) |
| Conjure Animals | D, R(later) | Conc.: summon beasts (v1: wolves only, to keep it simple) |
| Hunger of Hadar | Wl | Conc.: 20-ft sphere of darkness and cold, 2d6 cold per turn |
| Vampiric Touch | Wl, Wz | Conc.: melee spell attack 3d6 necrotic, heal half |
| Fear | B, Wl, Wz | Conc.: 30-ft cone, Wis save or frightened and flees |
| Slow | S, Wz | Conc.: up to 6 creatures (Wis save) lose speed, AC and actions |
| Remove Curse, Beacon of Hope, Stinking Cloud, Sleet Storm | various | Situational |

**Paladins and rangers** only reach 2nd-level spells by level 6. **Spell schools** (needed for the animation color plan) come from the PHB entries during data entry.

## 6. Items and treasure (sketch; details in a future Items.md)
- **Healing potions:** Potion of Healing heals 2d4 + 2. Drinking one is an action in RAW; consider the BG3-style bonus-action house rule.
- **Magic items:** plan 2–4 memorable items per act, using the DMG's magic-item rarity by level (Ch. 7). Story items already named: the fire-resistance shield (Act II), the forge-quenched weapon (Act III), and Mother Sallow's bargain reward.
- **Gold:** keep the economy small. The shop (Brannoc's stores, in the Drowned Lantern) sells PHB equipment at PHB prices and buys gear back at half (PHB: Selling Treasure). Story treasures can't be sold.
- **Adventuring gear (D24):** rope, torches, a hooded lantern, a crowbar, thieves' tools, a healer's kit, alchemist's fire, holy water and acid (`src/data/gear.json`). No weight, rations or ammunition are tracked.

## 7. House rules (track every deviation here)
- [ ] (Proposed) Potions as a bonus action.
- [ ] (Proposed) Party-best roll for dialogue checks (decided D11), with Inspiration awarded for background-flavored choices.
- [ ] Named villains are knocked out, not killed, when the story needs them.
- [ ] Easy difficulty: downed heroes stand up at 1 HP after a won fight.
- [ ] (Proposed, M4) On Easy, enemies don't take opportunity attacks; on Medium and Hard they do.
- [ ] (Proposed, M4) Enemies never attack a hero who is already down, on any difficulty.
- [ ] (Proposed, M4) The last enemy standing flees when below half HP (from round 2).
- [ ] (Proposed, M4) After a won fight, dying heroes are stabilized at 0 HP (Medium/Hard).
- [ ] (Proposed, M4) Hiding on the grid: you need brush or at least half cover from every enemy.
- [ ] (Proposed, M4) Bardic Inspiration is spent automatically when it turns a miss or failed save into a success.
- [ ] (Proposed, M4) Command is simplified to "Halt!" (the target loses its next turn).
- [ ] (Proposed, M4) Wild Shape offers the wolf only (like Conjure Animals); more beasts later.
- [ ] (Proposed, M4) Magic Missile darts share one damage roll (Sage Advice reading).
- [ ] (Proposed, M4) A versatile weapon is used two-handed when the hero has no shield and no other melee weapon.
- [ ] (Proposed, M5) Spells and cantrips can be re-picked freely at each level-up (the creator doesn't ask for them yet). RAW only lets known casters swap one spell per level.
- [x] ~~(Proposed, M5) Until the tavern brawl exists (M7), a failed check with the Grey Company ends with Brannoc firing a crossbow into the ceiling.~~ Replaced in M7 by the real brawl (F1).
- [ ] (Proposed, M6) Arcane Recovery (wizard) and Natural Recovery (Land druid) are used automatically after a short rest, recovering the lowest spent slots first.
- [ ] (Proposed, M6) A road encounter during a long rest in the wild interrupts it: fight (or talk), then try to rest again.
- [ ] (Proposed, M6) Random road encounters scale by difficulty with one fewer enemy on Easy and one more on Hard (single monsters stay single).
- [x] (Approved by the owner, M7) The tavern brawl (F1): every hit knocks out instead of killing, including ranged attacks and spells (RAW: melee only), and a blow never does more damage than the HP left, so massive damage can't kill anyone in a brawl.
- [x] (Approved by the owner, M7) Losing the brawl still gives its 25 XP (the level curve needs it); everyone wakes with 1 HP.
- [x] (Approved by the owner, M7) Talking Brother Ulric down mid-fight: each hero may try once, using their action, with the better of Persuasion or Insight; DC 15, or DC 11 once Brannoc has given you Ulric's name. Success ends the fight with full XP (D16).
- [x] (Approved by the owner, M7) Brother Ulric only casts Hold Person on Hard (bot tests showed it was too swingy at level 3 on Medium).
- [x] (Approved by the owner, M7) Monster breath weapons only count standing heroes when aiming (they don't breathe on the fallen).
- [x] (Approved by the owner, M7) A shadow's Strength Drain returns when the fight ends (RAW: after a short or long rest). Aid's extra HP also end with the fight (RAW: 8 hours).
- [x] (Approved by the owner, M7) Deflect Missiles (monk) and Giant Killer (Hunter ranger) are used automatically when they apply; Cutting Words (Lore bard) asks first.
- [x] (Approved by the owner, M7) Metamagic in combat: Quickened, Twinned, Careful and Distant. Empowered, Extended, Heightened and Subtle can be chosen at level-up but don't do anything in fights yet.
- [x] (Approved by the owner, M7) Pact of the Blade always makes a longsword (RAW: any melee weapon form).
- [x] (Approved by the owner, M7) Traps in dialogue (the cellar tunnel's falling beam): the party's leader makes the save, and a trap can't drop anyone below 1 HP outside a fight.
- [x] (Approved by the owner, M7) Magic items that don't need attunement can be equipped any time; attuning (Items.md) happens during a short rest.
- [x] (Approved by the owner, M7) Brannoc gives four Potions of Healing once (one each), after Lantern Night (there's no shop or money yet).

- [ ] (Proposed, M8) Lasting spell areas on the grid: Spirit Guardians, Moonbeam, Flaming Sphere, Hunger of Hadar, Spike Growth and Silence. Flaming Sphere and Hunger of Hadar hit at the start of a turn (RAW: end of turn for some parts); Moonbeam and Flaming Sphere can't be moved yet; Spirit Guardians' "half speed" counts as difficult terrain.
- [ ] (Proposed, M8) Haste's extra action allows one weapon attack, Dash, Disengage, Hide or Use an Object; its advantage on Dex saves isn't in yet. Slow's −2 to Dex saves and spell delay aren't in yet.
- [ ] (Proposed, M8) Fear: the frightened creature flees and repeats the Wis save at the end of each of its turns (RAW: only once it can't see you).
- [ ] (Proposed, M8) Conjure Animals always brings two wolves, which act right after the caster and are controlled by you. Fly gives a 60-ft speed that ignores difficult terrain. Suggestion is "stop fighting until hurt".
- [ ] (Proposed, M8) Revivify works on anyone who died during the current fight. Dispel Magic ends every spell on the target (ours are all 3rd level or lower, so no check is needed).
- [ ] (Proposed, M8) Uncanny Dodge (rogue 5) is used automatically on the first hit each round; Counterspell asks first.
- [ ] (Proposed, M8) Monsters that only fly or hover (wraiths, specters) move at their flying speed on the grid.
- [ ] (Proposed, M8) Sister Venna (priest) casts Spirit Guardians and Guiding Bolt only on Medium and Hard.
- [ ] (Proposed, M8) A magic shield (Kell's Shield, the Shield of the Morninglord) counts as a normal +2 shield, replacing a plain one.
- [ ] (Proposed, M8) The Staff of Healing casts Cure Wounds outside fights only (1 charge, 10 charges, 1d6 + 4 back each long rest). The Bog Pearl is used from the Inventory, once per long rest.
- [ ] (Proposed, M8) Gold: Kell's bounty pays 300 gp; the toll-bridge bribe costs 50 gp. There's no shop yet.
- [ ] (Proposed, M8) Map gates: the marsh places open once you cross the toll bridge, the abbey once Ashford Hall is settled, and the deserters' camp once you read the Lantern Board.
- [ ] (Proposed, M8) Not in yet: a wraith's Create Specter, specters moving through walls, the green hag's invisibility, the priest's Divine Eminence, and Edric being captured if you ignore him.

- [ ] (Proposed, M9) The finale's ember-wraith (homebrew): it can't leave its circle (speed 0), has a ranged "molten spit" (+8, 3d8 fire, 60/120 ft) so it can't be shot safely from afar, and three crown shards (AC 15, 20 HP, no turns): every point of damage to a shard is also dealt to the wraith. The Cindrath fight happens in the Lamp Lit ending too, with Maelis fighting beside you.
- [ ] (Proposed, M9) Maelis (mage) casts Fireball at most once a fight on Medium, twice on Hard, never on Easy.
- [ ] (Proposed, M9) The speech: three Truths always work; two make it a Persuasion check with advantage at DC 15 (13 at 3+ Trust); fewer can't reach her. Corin plus one Truth counts as two (Brother and Sister).
- [ ] (Proposed, M9) Corin's Ember meter: after Act I, every long rest offers a dream bargain with three boons (+2 to his fire spell damage, fire resistance in fights, or a spell slot back). At Ember 5, Cindrath takes him at the Crowning unless the party holds two Truths (then Ember drops to 4).
- [ ] (Proposed, M9) The Kiln-Quenched Weapon is a +1 version of its owner's first weapon; Dragon Slayer is a longsword or greatsword, whichever its owner carries.
- [ ] (Proposed, M9) Vorrag's contest: Athletics DC 18, or a smithing contest (History DC 16) for a hill dwarf or rock gnome; winning gives Dragon Slayer and the full elite XP.
- [ ] (Proposed, M9) Kell holds the Kiln Gate if he respects you or owes you (the gate fight drops to one gargoyle); he can claim the crown at the end if he's at the gate or hostile. Ulric's passage or Wix's back way halves the Star's last stand.
- [ ] (Proposed, M9) Dark One's Own Luck (warlock 6) is used automatically when it can turn a failed save into a success. Land's Stride lets a level-6 druid ignore brush. Countercharm and the Wix's Clan Gift bag have no combat use yet.
- [ ] (Proposed, M9) Last Boats from Ashford: whichever Brannoc chooses, he gives you the Drowned Lantern.

- [x] (Owner's choice, Nov 20) Spells change by the official rules: clerics, druids and paladins re-prepare from their class list after a long rest (ability modifier + level; paladins half level); bards, rangers, sorcerers and warlocks change spells at level-up. Wizards keep the M5 simplification (the whole spellbook is ready).
- [x] (Owner's choice, Nov 20) Gear is useful with no bookkeeping: torches, the lantern, rope, the crowbar, thieves' tools and the healer's kit never run out; thrown flasks are used up.
- [ ] (Proposed, Nov 20) The chance to re-prepare spells lasts from the long rest until the next fight starts [inferred reading of "when you finish a long rest"].
- [ ] (Proposed, Nov 20) Heroes can only wear armor and wield weapons their class (or species) is trained with (RAW allows it with penalties). At most six weapons carried.
- [ ] (Proposed, Nov 20) Alchemist's fire: the target makes the DC 10 Dex check to put it out at the end of each of its turns, as a save (RAW: someone spends an action; monsters never would).
- [ ] (Proposed, Nov 20) Thieves' tools on the Kiln's dials use Sleight of Hand (RAW: Dex with tool proficiency).
- [ ] (Proposed, Nov 20) A new party starts with 15 gp a hero, rope, torches and a healer's kit (thieves' tools with a rogue); older saves get the same once (save version 7).
- [ ] (Proposed, Nov 20) Heavy armor too heavy for the wearer's Strength costs 10 ft of speed (PHB). Noisy armor's Stealth disadvantage is shown on the sheet but not applied to checks yet.

## CONFIRM LOCALLY
- [ ] Spell details for anything not marked ✅. They're summarized from memory of the 2014 PHB, so verify damage dice and saves when entering data (the PHB text extracts cleanly enough to check each spell).
- [ ] Class resource counts (rages per level, ki, sorcery points, invocations known, spells known for bard, sorcerer, ranger and warlock). Copy them from the PHB class tables during data entry.
- [ ] Druid Circle of the Land "Mountain" spell list and Wild Shape limits.
- [ ] Color Spray's higher-level bonus (believed +2d10 per slot level above 1st).

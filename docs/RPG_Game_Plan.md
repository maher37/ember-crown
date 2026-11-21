# RPG Game: Master Plan (v0.1)

*A 5e-rules party RPG in the spirit of the Gold Box games and Baldur's Gate 1–3, built in about a week with Claude, for personal play.*

**How to read this doc:** anything tagged **[inferred]** is my recommendation or estimate, not a sourced fact. Anything you should check yourself is in the **CONFIRM LOCALLY** list at the end. This doc is meant to be the "source of truth" for every later chat and coding session, so update it as decisions get made.

---

## 1. Decisions to lock before writing any code

| # | Decision | My recommendation [inferred] | Why it matters |
|---|---|---|---|
| D1 | **Rules version**: 2014 (SRD 5.1) or 2024 (SRD 5.2) | ✅ **DECIDED: SRD 5.1 (2014).** BG3 is built mostly on 2014 rules, so it will feel familiar. Both SRDs are free to use under CC-BY-4.0. | Spells, class features and monster stat blocks differ between versions. Mixing them causes bugs and arguments. |
| D2 | **Party model** | **Gold Box style: you create all 4 party members** with the same character creator. Companion NPCs with their own dialogue can come in v2. | Premade BG-style companions need writing, approval systems and banter. A 4-person party you build yourself reuses one system you already need. |
| D3 | **Level cap** | **Level 6.** | Casters stop at 3rd-level spells (Fireball, Revivify, Counterspell). The spell list stays manageable, and every class gets its subclass and Extra Attack moment. |
| D4 | **Subclasses** | ✅ **DECIDED (revised Nov 21, owner): one per class (the SRD one), except clerics, who choose a domain in the creator: Life, Light, War or Tempest.** More subclasses for other classes may follow (playtest Phase 4). | The SRD has roughly one subclass per class; the extra domains are built from memory of the PHB (see Rules_Scope §4 and CONFIRM LOCALLY). |
| D5 | **Platform / tech** | **Browser game: TypeScript + Vite, with a 2D canvas renderer (Phaser or PixiJS) and plain HTML/React for menus.** | See §3. This is the setup Claude handles best end to end. |
| D6 | **Visual style** | **2D top-down tiles for exploration, grid-based turn-based combat, and character portraits in menus and dialogue.** | 3D would eat the whole week. Top-down 2D matches the Gold Box / BG1 feel. |
| D7 | **Leveling** | **XP-based (not milestone)**, so side quests actually push you ahead of the curve. | This is how your goal of "side quests make the main story easier" works. |
| D8 | **Encounters and side quests per act** | ✅ **DECIDED (revised): 7 mandatory fights, up to 4 optional fights, up to 4 multi-part side quests per act, plus random travel encounters between areas** (d20, 18+ per leg, DMG default). Planned fights are telegraphed; travel encounters use a passive Perception check. | Full ledger in **Encounters_and_XP.md**. |
| D16 | **XP and level curve** | ✅ **DECIDED: XP for everything** (fights, quest stages, discoveries; talking past a fight = same XP). Main path only = L5 at the finale. About 80% of optional content = L6 cap during Act III. | Quest stages carry about 70% of XP because 8 fights per act can't level a party alone. |
| D18 | **Setting** | ✅ **DECIDED: Forgotten Realms, personal use.** Ashford (invented) sits on the Grayflow river in the southern Greypeak Mountains beside the Marsh of Chelimber, on the edge of fallen dwarven Ammarindar. Waterdeep holds the town's debt. Real gods (Lathander, Tymora, Moradin) are used. | If ever shared, swap back: Greypeak→Greyspine, Grayflow→Wend, Marsh of Chelimber→Fenmoor, Waterdeep→Halvarren, Abbey of the Morninglord→Abbey of Saint Aldric, Ammarindar→"the old dwarf-holds". |
| D19 | **Build environment** | ✅ **DECIDED (recommended): Claude Code cloud sessions + GitHub, with no installs.** Start sessions from the Desktop app's Code tab with **Cloud** selected, or from claude.ai/code. Claude works in an Anthropic-hosted VM that already has Node.js, git and Chrome, and pushes changes to the user's GitHub repo. The game is played in the browser via **GitHub Pages** (free hosting from the repo). Local installs (Node.js, Git) are only needed later if the user wants to run the game offline. | The user has Claude Pro, Claude Desktop and a GitHub account, but no Node.js or Git. |
| D20 | **Elites, items, letters, calendar** | ✅ One optional elite per act guarding a standout item (Items.md); 2–4 story items per act; 7 lantern-moth letters plus epilogues (Maelis_Letters.md); Calendar of Harptos with Lantern Night as the Feast of the Moon, 1492 DR (Story_Bible.md §3). | — |
| D21 | **New screens** | ✅ World map with travel and road-encounter rolls; a level-up screen with hover previews; an animated camp (wilderness, inn room, cave) where Wix tells jokes and letters arrive. Mockups are on the canvas. | — |
| D17 | **Wix** | ✅ **DECIDED: non-combat, joke-telling camp companion** (Act I side quest). | — |
| D9 | **Difficulty** | ✅ **DECIDED: an Easy / Medium / Hard setting, changeable any time; Medium is the default.** Main fights are designed at Medium for the expected level. Easy ≈ 75% of the Medium XP budget; Hard ≈ 150% plus smarter AI and riskier rests [inferred percentages]. | One encounter table, scaled by a single setting. The balance simulator tests all three. |
| D11 | **Who rolls dialogue checks** | ✅ **DECIDED: the party member with the best bonus**, unless an option is tied to a specific character (`[Corin]`, `[Cleric]`, `[Dwarf]`, etc.). | See Story_Bible.md §10. |
| D12 | **Resting** | ✅ **DECIDED: standard 5e rules, then relaxed by the owner (Nov 21):** a Short Rest (1 hour, spend Hit Dice) and a Long Rest (8 hours) **whenever you like**, in town or in the open (RAW allows one per 24 hours). Rests in the wild can still be interrupted by a road encounter. | Encounter "rest blocks" stay a *design* guide only. With free resting, Medium fights will play a little easier; the Hard setting covers players who want more challenge. |
| D13 | **Premade origin character** | ✅ **DECIDED: one origin character, Corin Varrow** (human Draconic Bloodline sorcerer, the villain's brother), with his own scenes, dialogue and endings. Custom heroes get a complete story without him. | See Story_Bible.md §9. |
| D14 | **Build order** | ✅ **DECIDED: core mechanics first, animations after.** Version 1 uses tokens and floating numbers; the animation system is phase 2. | Keeps the week realistic. |
| D15 | **Look** | ✅ **DECIDED: lighter slate-and-parchment palette** (replacing dark brown), with ember-orange accents. Personal use only; no sharing planned. | Applied to the mockups. |
| D22 | **Sound** | ✅ **DECIDED (owner, Nov 20): sound is in v1**, not v2. Music, place sounds and effects are generated live in the browser (Web Audio), so there are no files to license. Music, place-sound and effect volumes plus mute live in Settings and the speaker button (M mutes). | The owner asked for sound during the first playthrough. Recorded music could replace the generated tracks later [inferred option]. |
| D23 | **Explorable places** | ✅ **DECIDED (owner, Nov 20): the Old Mine and the King's Kiln are walk-around maps** like the tavern; every other place keeps its illustrated scene. Each area of the story is a spot on the map that opens when the story reaches it, plus a few spots to search (small gold and potion finds). Spots are data in `src/data/placeMaps.json`. | Baldur's Gate players expect to explore. Two dungeons first; more can follow the same pattern. |
| D24 | **Equipment, shop and character sheet** | ✅ **DECIDED (owner, Nov 20):** a full 5e character sheet (abilities, saves, skills, attacks, features, spells, equipment) on the Party screen; armor, shields and weapons can be bought, worn and swapped, and portraits show armor, shields and helmets. Brannoc's stores sell PHB gear at PHB prices. Gear is useful but needs no bookkeeping (no weight, rations or ammo). Spells change by the official rules. | The owner noticed there was no real inventory during the first playthrough. |
| D25 | **Equipment slots** | ✅ **DECIDED (owner, Nov 21):** every hero has the same slots: two weapon sets (main hand and off hand; switch free outside fights, once a turn in a fight), armor, cloak, neck, two rings, feet and two trinkets. Two-handed weapons leave no room for a shield; only light weapons go in the off hand. The shop shows, per hero, whether they can use a thing and why not, and sells a few magic items from Act II. | Playtest: Deepdelver showed as "magic" rather than a weapon, and weapon swapping wasn't possible. |
| D26 | **Ashford, a walkable town** | ✅ **DECIDED (owner, Nov 21):** Ashford is a walk-around map like the mine (the tavern is one building in it). Shops each sell their own trade: Brannoc (gear, healing potions), the Stonemantle Forge (weapons, armor, shields; +1 weapons from Act II), Quillon's Curios (magic for spellcasters: Wand of the War Mage, Pearl of Power, rings and cloaks by act), the Dawn Shrine (healing, restoration, raising the dead for coin), and Odo's travelling wagon on market days (three rotating items, two purchases a visit). Townsfolk (the crier, Gran Esk, Mags, Pell) comment on what you've done. Ashford Hall's notice board posts bounties. Supersedes D24's "Brannoc sells everything". | The owner asked for a Baldur's Gate-style town with a smith, a town hall quest board and a magic shop. |
| D27 | **Exploring and bounties** | ✅ **DECIDED (owner, Nov 21):** places hold hidden finds (`src/data/finds.json`): noticed on arrival by the party's best passive Perception, or by a Search (a Perception check, an hour, once a day). Chests can be locked (thieves' tools, or forced) and trapped (Investigation to spot). Some finds start small side quests; three hidden merchants sell one item each. Bounties from the Hall's board (`src/data/bounties.json`) reuse road encounters and pay gold plus a little quest XP. Active quests show a "!" on the world map where they lead next. | Rewards for curiosity, as in Baldur's Gate, without new fights to balance. |
| D28 | **Story: the ember-kiss, the town remembers, Maelis in person** | ✅ **DECIDED (owner, Nov 21):** Story_Review.md recommendations #1, #3 and #6. Every hero is marked on Lantern Night (my pick: everyone, not one chosen hero); once an act, Cindrath offers the party a gift in a dream (fire resistance, burning blows, or temporary HP each fight), and each gift taken makes the final speech to Maelis 1 harder. Townsfolk, Brannoc and Maelis's letters quote your choices back. Maelis meets you in person at the mill (hooded before her reveal, at her mother's table after) and above Ashfall Pass, as well as the mine and the Act II camp. | Gives a custom party a personal stake, and makes choices visible. |
| D10 | **Claude plan** | ✅ **You have Claude Pro.** Pro includes Claude Code, and Claude chat and Claude Code share the same usage limits (a 5-hour session limit plus a weekly limit). | Pace the week. Long build sessions may hit the 5-hour limit; plan breaks around it. |

---

## 2. Scope: what's in v1 vs later

**v1 (the one-week goal)**
- All 12 SRD classes: Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard. Levels 1–6, one subclass each.
- SRD species/races and a handful of backgrounds.
- Ability scores by standard array, point buy, or 4d6-drop-lowest.
- Appearance: pick from a **set of premade portraits**, plus name, pronouns and color tint.
- Automated dice for everything, with a **combat log that shows every roll** ("d20 (14) + 5 = 19 vs AC 15 → hit"). Optional toggle to pause and "click to roll."
- Turn-based grid combat: initiative, movement, action / bonus action / reaction, opportunity attacks, conditions, concentration, death saves.
- About 60–80 curated spells (cantrips through 3rd level) instead of the full SRD list [inferred estimate].
- Short and long rests, inventory, loot, simple shop, quest journal.
- Save/load (multiple slots, autosave, plus export/import to a file).
- A 3-act campaign: 4 main encounters per act and 2–3 side quests per act.

**v2+ (after the week)**
- Layered **paper-doll character builder** (body, skin, hair, beard, armor that shows on the sprite). See §6.
- BG-style companions with dialogue and approval.
- Multiclassing, feats beyond the basics, more subclasses (homebrew), levels 7+.
- Cutscenes. (Sound moved into v1: see D22.)

---

## 3. Recommended tech approach and how to work with Claude

### Why a browser + TypeScript game [inferred]
- **Everything is text.** Claude reads, writes and changes all of it directly. Engines like Unity rely on editor GUIs and scene files that are awkward for an AI to edit.
- **Claude can test it itself.** It can run unit tests on the rules engine, and with the Playwright MCP server it can open the game in a real browser, click through it and take screenshots.
- **Saving is easy.** The browser's localStorage/IndexedDB, plus a "download save file" button.
- **Zero install for playing.** It runs in your browser. You can also put it on GitHub Pages later.

**Alternative: Godot 4.** Pick this if you'd rather have a "real engine" and a desktop .exe. GDScript and Godot scene files are text, and community MCP servers exist that let Claude Code run scenes, run tests and read errors. It's slower to iterate with than the browser route, but a solid second choice. **Not recommended for this timeline:** Unity or Unreal [inferred].

### Where each kind of work happens
| Work | Tool |
|---|---|
| Design, story, encounter tables, rules scope, dialogue drafts | **This claude.ai Project** (docs saved here so every chat sees them) |
| Writing, running and testing the code | **Claude Code** (desktop app, terminal, or claude.ai/code connected to a GitHub repo) |
| Quick throwaway prototypes (dice roller, character-creator mockup) | Claude chat, as a single-file HTML artifact |
| Version history and undo | **Git + GitHub** (non-negotiable with AI-written code) |

### The working loop for each feature (in Claude Code)
1. Start each session by pointing Claude at `CLAUDE.md` and the relevant design doc.
2. Ask for a **plan first** (plan mode). Approve or adjust it.
3. Let it implement **one feature**, with tests.
4. It runs the tests. You (or Playwright) playtest.
5. **Commit.** If something breaks badly later, you roll back instead of untangling it.
6. Update the design doc if a decision changed.

### Repo structure Claude should follow [inferred]
```
/docs        ← copies of this plan, story bible, rules scope
CLAUDE.md    ← conventions: "rules engine is pure TS, no UI imports; all content is JSON in /data; every rule has a test"
/src/rules   ← dice, checks, attacks, damage, conditions, spells, leveling (no UI, fully unit-tested)
/src/game    ← game state machine: explore / dialogue / combat / rest / menus; save/load
/src/ui      ← rendering, menus, character sheet, combat HUD
/data        ← classes, species, backgrounds, spells, monsters, items, encounters, quests, dialogue (JSON / Ink)
/assets      ← tiles, sprites, portraits, sounds + CREDITS.md
/tools       ← balance simulator, content validators
```

**The most important architectural rule:** keep the rules engine separate from the UI, and keep **all game state in one serializable object**. That one choice makes saving, testing, balancing and bug-fixing dramatically easier [inferred].

---

## 4. One-week schedule

This assumes roughly 4–6 focused hours a day [inferred]. Each day ends with a playable milestone.

| Day | Build | Milestone ("done when…") |
|---|---|---|
| **0 (prep, 1–2 hrs)** | Lock the D1–D8 decisions. Install Node.js, VS Code, Git, Claude Code. Create the GitHub repo. Download the SRD PDF. Finalize the story outline in this project. | Repo exists. `CLAUDE.md` and `/docs` are committed. |
| **1** | Project skeleton. Rules core: dice with a seeded RNG, ability modifiers, proficiency, checks/saves, attack rolls, damage/resistance, HP, conditions, advantage/disadvantage. Combat log. | Two test fighters duel in a test script, and every roll shows in the log. |
| **2** | Character creation (species, class, background, scores, skills, equipment, portrait). Level-1 features for all 12 classes. Party of 4. **Save/load, built now rather than later.** | Create a party, save, refresh the browser, load, and everything is identical. |
| **3** | Tactical combat: grid, initiative, movement, action/bonus/reaction, opportunity attacks, enemy AI, targeting UI, cantrips and 1st-level spells, death saves. | Your party fights 4 goblins and it's fun-ish. |
| **4** | Exploration: tile maps (Tiled), walking, doors/chests/traps, dialogue (Ink), quest journal, XP and level-up (1→6), rests, inventory, loot, shop. | Tavern → road → goblin cave plays start to finish (Act 1 vertical slice). |
| **5** | Finish Act 1 and its side quests. 2nd/3rd-level spells. Class features for levels 2–6 and subclasses. Run the balance simulator. | Act 1 is complete and balanced at its expected level. |
| **6** | Acts 2 and 3 content (maps, dialogue, encounters, side quests). Mostly data entry, since the systems already exist. | The full campaign is playable, maybe rough. |
| **7** | Full playthrough, bug fixes, balance tuning, portrait/sound polish. | You beat the game on a fresh save. |

**If you fall behind, cut in this order** [inferred]: Act 3 side quests → fancy spell animations → shop → reduce spells to ~40 → make Act 3 a single dungeon. Never cut save/load or the combat log.

---

## 5. Phase-by-phase recommendations

### Phase 0: Design (in this project)
- Write a **Rules Scope doc**: exactly which classes, features, spells (by name), conditions and monsters exist. Claude will otherwise "helpfully" invent extra content.
- Write a **Story Bible**: places, NPCs, factions, the plot per act, and the tone.
- Write an **Encounter Table**: every encounter with its monsters, expected party level, difficulty and XP.
- Use only **SRD content and your own invented names**. No Forgotten Realms, Baldur's Gate, beholders, mind flayers or other non-SRD names. This is less of a concern for a personal game, but it's good hygiene if you ever share it.

### Phase 1: Rules engine
- Use a **seeded RNG** and store the seed in saves, so a bug can be reproduced exactly.
- Model effects as **data primitives**: `attack`, `save`, `damage`, `heal`, `applyCondition`, `area`, `concentration`, `duration`. A spell like Burning Hands is then JSON, not new code. This is the single biggest time-saver for 12 classes [inferred].
- Ask Claude for **tests for every rule** (for example: "Rogue Sneak Attack only once per turn", "advantage + disadvantage = straight roll").

### Phase 2: Characters
- Data-drive classes as **level tables** in JSON. Level-up then reads the table and offers the choices.
- Premade portraits first (see §6). The appearance data model should still store `{portraitId, tint, …}` so a paper-doll builder can slot in later without breaking saves.

### Phase 3: Combat
- **Enemy AI** is the part people forget. Start simple: move toward the nearest or weakest target, use its best attack, cast a buff if it has one, flee at low HP. Add per-monster "personalities" later [inferred].
- **Reactions** (opportunity attacks, Shield, Counterspell) interrupt the flow. Have the game auto-prompt, with a "always use / never ask" setting.

### Phase 4: Exploration, dialogue, quests
- Make maps in **Tiled** (a free editor that exports JSON) rather than having Claude invent maps in code. You can paint maps; Claude can wire up triggers.
- Write dialogue in **Ink** (Inkle's narrative scripting language). Claude writes it well, and it supports branching, skill checks ("[Persuasion DC 13]") and variables.

### Phase 5: Content and balance
- Build a **headless balance simulator**: it runs a given party against a given encounter 500 times and reports win rate, average rounds and HP left. Claude can write this in an hour, and it replaces guesswork [inferred].
- Target: main-path encounters win about 85–95% of the time at the *expected* level, and nearly always at expected level +1 (the side-quest bonus) [inferred targets].

### Phase 6: Playtest and polish
- Keep a `BUGS.md` and hand Claude the list in batches.
- Use Playwright MCP so Claude can click through flows itself (create character → save → load → fight).

---

## 6. Character appearance

| Option | Effort | Notes |
|---|---|---|
| **A. Premade portrait set** (v1) | Low | 24–40 portraits covering species and genders. Make them with an AI image tool of your choice, or use free art. Claude can't create raster art, but it can wire up the picker. |
| **B. Claude-built SVG face builder** | Medium | Claude can code a layered vector portrait (face shape, skin, eyes, hair, beard, scars, colors). It's stylized but fully customizable, and you don't need to license any art [inferred]. |
| **C. LPC paper-doll sprites** | Medium | The **Universal LPC Spritesheet Character Generator** composes animated top-down sprites from layers (body, hair, clothes, weapons). It's free, but you **must credit the artists**; its CREDITS.csv / license export makes that easy. The licenses include CC-BY-SA and GPL. |

**Recommended path [inferred]:** A in v1. Then C for in-world sprites and B (or upgraded A) for portraits in v2.

---

## 7. Campaign draft: "The Ember Crown" (working title, a little cliché on purpose)

**Premise:** Centuries ago, the tyrant-king Varrow forged the Ember Crown by binding a red dragon's soul into it. When he fell, the crown was broken into three shards and hidden. Now a cult, the **Hollow Star**, is gathering the shards to remake it.

Expected levels below are for the **main path without side quests**. Side quests put you about +1 level ahead [inferred].

### Act 1: "Smoke at the Drowned Lantern" (levels 1→3)
*Riverside town of Ashford.*
1. **Tavern brawl** (L1). A dying courier staggers into the Drowned Lantern tavern clutching a sealed letter. Thugs burst in to take it. *(Bandits / thugs)*
2. **Road ambush** (L1–2). On the way to the mine named in the letter. *(Goblins, wolves)*
3. **Goblin warren** (L2). Rescue the kidnapped miners. *(Goblins, hobgoblin boss)*
4. **The sunken shrine** (L3, act boss). Cult acolytes are digging up the first shard beneath the mine. *(Cult acolyte/priest + skeletons)* Reveal: the Hollow Star exists, and the letter was a warning to the town's mayor.
- *Side quests:* the classic rats-in-the-cellar job for the innkeeper; the missing herbalist (wolves, plus a healing-potion reward); the haunted mill (shadow / specter-type undead).

### Act 2: "The Hollow Star" (levels 3→5)
*Fenmoor marshes and the ruined Abbey of Saint Aldric.*
1. **The toll bridge** (L3). Bandits or lizardfolk. You can talk your way past for less XP but keep your resources.
2. **The drowned village** (L4). Zombies and ghouls; a ghoul's paralysis teaches you to respect conditions.
3. **Betrayal** (L4). The mayor who hired you is a cult agent. Fight his guards, or expose him with clues from the side quests.
4. **The abbey undercroft** (L5, act boss). A cult priest, an ogre and the second shard. Reveal: the final shard is in Varrow's tomb, and the cult leader is Varrow's descendant.
- *Side quests:* the bog witch's bargain (a hag; she offers a powerful item at a cost); the bandit bounty; the fallen paladin's shield (restore it for a magic item).

### Act 3: "The Ember Crown" (levels 5→6)
*Mountain tomb of King Varrow.*
1. **The tomb gate** (L5). Animated guardians and traps. Puzzles reward Investigation/Arcana.
2. **Hall of the honor guard** (L5). Wights and skeleton soldiers.
3. **The cult's last stand** (L5–6). Cult fanatics and the leader's lieutenants.
4. **The crowning** (L6, final boss). The cult leader (mage stat block) mid-ritual, with a **young dragon** half-bound to the crown.
- *Ending choice:* destroy the crown (the dragon is freed and flies off, maybe a future sequel), or claim it yourself (an evil ending).
- *Side quests:* reclaim the dwarven forge (elemental or construct enemies; it upgrades a weapon); a ghost's unfinished business (lore plus a key that skips a trap).

*All monster choices still need checking against the SRD stat blocks and the encounter math. See CONFIRM LOCALLY.*

---

## 8. Things you may not be thinking about yet

1. **Spells are the real scope monster.** Twelve classes is fine. Hundreds of spells are not. Curate the list.
2. **Rest economy.** If you can long rest anywhere, every fight is trivial. Gold Box and BG limit it with random encounters during rest or rest only at camps or inns. Decide which [inferred].
3. **Enemy AI** takes time. Budget half a day.
4. **Reactions and concentration** need special UI.
5. **Death handling.** Death saves, Revivify (3rd-level spell), a temple that raises the dead for gold, and a game-over screen.
6. **Save versioning.** Put `saveVersion: 1` in every save from day one, or every update will break your old saves.
7. **Save-scumming.** Decide whether you can save mid-combat (BG3 lets you).
8. **Context limits.** Claude can lose the thread in long sessions. Use small files, one feature per session, and `CLAUDE.md` plus the design docs as memory.
9. **UI is usually the biggest time sink**, more than rules [inferred]: character sheet, inventory, spell picker, targeting, tooltips.
10. **Usage limits.** A week of heavy Claude Code use can hit your plan's usage caps. Check your plan.
11. **Your role.** You're the designer and playtester. You don't need to code, but you will run commands (install, run, commit) and describe bugs clearly ("expected X, saw Y, steps to reproduce").
12. **Licensing and credits.** Keep `assets/CREDITS.md` from the first asset you add. Include the SRD attribution line.
13. **Difficulty settings.** These are cheap to add if the balance simulator exists (enemy HP × 0.8 / 1.0 / 1.25) [inferred].

---

## 9. Tools that help, and how they connect to Claude

| Tool | Use | Connects to Claude how |
|---|---|---|
| **Claude Code** | Builds and tests the game | Main build tool |
| **Git + GitHub** | Undo button and history; Claude Code on the web works from GitHub repos | Built in |
| **Node.js + VS Code** | Runtime and editor | Claude Code runs in the terminal / VS Code |
| **Vite, TypeScript, Vitest** | Dev server, language, unit tests | Claude runs them |
| **Phaser or PixiJS** | 2D rendering | Code library |
| **Playwright MCP** | Claude opens the game in a real browser, clicks, screenshots and checks the UI | MCP server in Claude Code |
| **Tiled** | Map editor that exports JSON | You paint maps; Claude reads the JSON |
| **Ink / Inky + inkjs** | Branching dialogue | Claude writes `.ink` files |
| **SRD 5.1 / 5.2 PDFs** | Rules source of truth | Give Claude the relevant pages |
| **5e SRD JSON datasets** (e.g., 5e-database / Open5e) | Ready-made SRD data for monsters, spells, etc. | Import into `/data` (check license and version) |
| **Universal LPC Character Generator** | Customizable sprites | Export sprite sheets into `/assets` |
| **Kenney.nl, OpenGameArt, game-icons.net** | Free tiles, UI and icons | `/assets` + credits |
| **An AI image generator** (your choice) | Portraits | Outside Claude; drop the files into `/assets/portraits` |
| **Godot + a Godot MCP server** | *Only if you take the Godot route* | MCP server in Claude Code |

---

## 9b. Screen mockups (v0.1)
An interactive mockup canvas, "The Ember Crown – Game Screen Mockups": https://claude.ai/artifact/E6Ju3GYD6xxWzwCjPUgUhq
Screens: title & difficulty, character creator (12 classes, 9 SRD species, ability methods, portrait builder), tavern exploration, combat (initiative, action economy, automatic dice log, live difficulty switch), and dialogue with skill checks. All art is original vector drawing, a stand-in until real art is chosen.
Example encounter math used in the combat mockup (2014 DMG, four level-2 PCs) [computed by Claude, verify]: Easy = 3 goblins (300 adjusted XP), Medium = 4 goblins (400), Hard = 5 goblins + 1 wolf (600).

## 9c. Best-practice review: where we align and where we diverge (v0.2)

**Encounters**
- ✅ Aligned: XP leveling, side quests that put you ahead of the curve, a difficulty setting, and explicit encounter math.
- ⚠️ **Biggest divergence:** the 2014 DMG assumes most parties handle **6–8 Medium or Hard encounters per long rest, with about 2 short rests**. Our plan has few main fights and easy access to rests. If every fight is Medium and the party rests in between, fights will feel trivial, because casters can use their best spells every time [inferred].
  - **Fix: plan in "rest blocks".** Each dungeon or location is one adventuring day: 3–5 fights (main plus side), 1–2 short rests, ending in a Hard fight. Track a daily XP budget per block.
  - **"Medium" the difficulty *setting*** means "as designed". Individual fights still range from Easy to Hard/Deadly within a block.
- **Short rests matter in 2014 rules.** Warlocks, Fighters and Monks recharge on short rests, so give about 2 short rests per long rest [inferred].
- **Vary objectives:** protect the courier, escape, hold a door, reach the lever, stop the ritual. Offer non-combat solutions (talk, sneak, bribe). Let enemies flee or surrender at low morale [inferred].
- **Terrain:** cover, high ground, difficult terrain, chokepoints, things to shove enemies into [inferred].
- **Bosses:** never a lone boss against 4 heroes (the heroes' extra actions make it a pushover). Give bosses minions or lair effects [inferred].
- **Level 1 is fragile.** Make the tavern brawl nonlethal (fists and chairs, knocked out at 0 HP) and reach level 2 quickly [inferred].

**Conversations**
- ✅ Aligned: visible DCs and rolls; failure moves the story forward (failing Persuasion hands you the cellar side quest).
- Open decision **D11:** who rolls a dialogue check, the **speaker** or the **best in the party**? The mockup uses best-in-party; BG3-style is the speaker [inferred].
- Never gate the main story behind a single roll. Spread checks across many skills (Arcana, Religion, Nature, Intimidation, Athletics) so every class gets moments. Add a few species-, class- and background-specific lines. Track choices as flags so NPCs remember them [inferred].

**Exploration**
- Passive Perception spots traps and hidden doors automatically. Locked doors need at least two solutions (pick the lock, force it with Athletics, use a key, or cast a spell). No part of the main story should require a specific class [inferred].

**Rules faithfulness**
- Faithful to SRD 5.1 first, with every change listed in a `HOUSE_RULES.md`. BG3-style options to consider: potions as a bonus action, Shove as a bonus action, advantage from high ground [inferred].
- Always show the math: hit %, roll breakdowns, and tooltips on DCs.

**Death and saves**
- A hero at 0 HP is **downed** and rolls death saves. Damage while downed counts as a failed save. Spare the Dying / Healing Word / Medicine checks stabilize them. Add a temple raise-dead service for gold [verify rules details].
- Autosave before every fight and every major choice.

## 9d. Combat animations (VFX): v1.5 scope

**Approach.** The rules engine resolves the action first (all rolls). It then sends a list of **presentation events** that the renderer plays back. Animation never decides outcomes, so a missed arrow visibly flies past the target.
Example event list: `projectile → impact → damageNumber → status → downed`. Each spell or attack gets a small JSON "VFX recipe" (`projectile: {sprite, count, arc, trail, speed}`, `area: {shape, size}`, `impactFx`, `statusIcon`).

| Effect | How it plays [inferred design] |
|---|---|
| Arrow / bolt | Arcs from the shooter to the target. A miss lands in the ground behind. |
| Flaming arrow | Same arrow plus a fire trail, a burst on impact, and a separate fire damage number. *Not a basic SRD 5.1 item: we'd add it as our own homebrew "Ember Arrow".* |
| Magic Missile | Three darts (one more per slot level above 1st). They can split between targets, always hit, and **strike simultaneously** per the rules text, so they launch in a quick fan and land together. Each dart shows its own 1d4+1 force number. |
| Fireball | A small bead streaks to a point and blooms into a 20-ft-radius explosion. Each target shows "Saved – half" or "Failed". |
| Color Spray | A 15-ft cone of shifting color. Targets are affected one by one in order of lowest HP first, and get a Blinded icon. Needs a **"reduce flashing" setting** for photosensitive players. |
| Burning Hands / Thunderwave | Cone / cube shapes using the same area system. |
| Healing | Rising green motes and a green number. |
| **Downed** | The token goes gray and tilts, with a small blood-drop icon and **death-save pips (3 successes / 3 failures)**. "Stable" icon when stabilized; a skull when dead. |

- **More D&D-specific animation ideas (phase 2) [inferred design]:**
  - **Dice moments:** a d20 rolls on screen for big rolls. Advantage/disadvantage shows two d20s with the dropped one fading. A natural 20 gets a gold flash; a natural 1 gets a "clunk".
  - **Damage-type colors** on floating numbers and impacts: fire orange, cold pale blue, lightning yellow, thunder shock-ring, acid green, poison sickly green, necrotic purple-black, radiant gold, force violet, psychic pink.
  - **Spell-school "cast" glows** on the caster before the effect: evocation ember, abjuration blue hexes, necromancy green smoke, enchantment pink motes, illusion shimmer, conjuration swirl, divination eye-glint, transmutation sparkle.
  - **Area previews before casting:** the cone, sphere or line is drawn on the grid with affected creatures highlighted, and a warning if allies are inside.
  - **Saving throws:** a shield icon on each target, then "Saved" or "Failed".
  - **Reactions:** a quick pause-and-flash banner ("Opportunity Attack!", "Shield!", "Counterspell!") so you understand why the turn was interrupted.
  - **Class signatures:** Rage aura (Barbarian), Sneak Attack slash (Rogue), Divine Smite radiant burst (Paladin), Bardic Inspiration note floating to an ally, Wild Shape puff (Druid), Action Surge speed lines (Fighter), Flurry of Blows multi-hit (Monk), Eldritch Blast beams (Warlock).
  - **Condition icons on tokens:** prone (token lies flat), grappled/restrained (chains), frightened, charmed, poisoned, blinded, paralyzed, invisible (token fades to an outline), and a ring for concentration that cracks when concentration is checked.
  - **Movement:** opportunity-attack danger shown on the planned path; the movement path is previewed with the feet remaining.
  - **Downed / death saves:** gray, tilted token, a small blood drop, and 3 success / 3 failure markers. A natural 20 on a death save springs the hero back up with 1 HP.
  - **Out of combat:** a level-up flourish, a lockpick mini-moment, trap triggers, and camp scenes at long rests (where Maelis's lantern-moth letters arrive).
- **Settings:** animation speed 1× / 2× / instant; reduce flashing; shake on/off.
- **Art:** effects can be drawn in code with particles (free, no licensing), or with free VFX sprite packs (credit required). Animated *characters* (walk, slash, shoot, cast, hurt) would come from LPC sprites, which replace the current round tokens. Decision **D12: tokens (v1) vs. animated sprites (v1.5)**.
- **Cost:** roughly 1 extra day: half a day for the event and animation system, then about 15–20 minutes per spell recipe [inferred]. Minimum: generic projectile + burst + floating numbers + downed state, then per-spell polish.

## 9e. Known gaps (as of v0.2)
1. Number of main encounters per act (D8) and the rest model (rest blocks; how short and long rests work).
2. Who rolls dialogue checks (D11).
3. Tokens vs. animated sprites (D12) and the animation scope above.
4. Sound effects to go with animations (they sell hits and spells as much as visuals do).
5. Separate docs still to write: Rules Scope (exact spell list), Encounter Table by rest block, Story Bible (NPCs and factions), Item List (including homebrew like the Ember Arrow), HOUSE_RULES.md.
6. Accessibility: animation speed, reduce flashing, colorblind-safe ally/enemy markers (the mockup uses blue vs orange plus circle vs square shapes).

## 9f. Story
The full story lives in **Story_Bible.md** (in this project). It covers the factions, the cast, the three Truths clue system, act-by-act plot, five endings, and the Corin Varrow origin path. It replaces the short campaign draft in §7.

## 9g. Reference books and project knowledge (v0.3)

The user has the PHB, DMG, Monster Manual, Lost Mine of Phandelver, and the Basic Rules PDFs.

**Project knowledge strategy (recommended):** don't upload the full books.
- The DMG (≈90 MB) and LMoP (≈56 MB) exceed the 30 MB per-file project limit.
- The PHB alone is ≈280k words, more than the project's context capacity, which pushes the project into search (RAG) mode.
- Art and layout are wasted space.

Instead, keep **small, curated docs** that double as the game's data files:
- `Rules_Scope.md`: class features L1–6, the curated spell list with mechanics, conditions.
- `Monster_Roster.md`: stat summaries for only the ~30 monsters we use.
- `Items.md`: magic items by act.
- `Encounters_and_XP.md`: done.

Write them from **SRD 5.1** (free and CC-BY, so its text can be copied verbatim). Use the purchased books only for checking numbers and for ideas, and summarize anything outside the SRD in our own words.

**What to pull from each book [recommendations]:**
- **PHB:**
  - Backgrounds. SRD 5.1 includes only Acolyte, so for this personal game pick about 6 from the PHB, such as Soldier, Criminal, Folk Hero, Sage, Outlander and Urchin.
  - Equipment and prices, Appendix A conditions, rest rules, and spell details for cantrips through 3rd level.
- **DMG:**
  - Ch. 3 encounter math (done).
  - Ch. 5 traps (the trap save DC and damage-severity-by-level tables).
  - Ch. 7 treasure: magic item rarity by level, used to plan 2–4 memorable items per act.
  - Ch. 8 running the game: XP awards, milestones, and the **conversation reaction** rules (friendly / indifferent / hostile), which fit our dialogue system well.
  - Ch. 4 NPC traits and ideals, for characterization.
  - Ch. 9 optional rules worth considering: flanking, hero points.
- **Monster Manual:**
  - Stat blocks and lore for the roster, including behavior to drive enemy AI (for example, goblins disengage and hide).
  - Appendix B for human enemies (cult fanatic, priest, veteran, mage, thug).
- **Lost Mine of Phandelver:** structure only, never names or content.
  - A town hub with several quest-givers and a notice board. Idea: a **"Lantern Board" at the Drowned Lantern** where side quests are posted.
  - A small sandbox where the order is flexible.
  - Dungeons with alternate routes.
  - A villain chain the party uncovers step by step.

**Monster images:** the Monster Manual's artwork is copyrighted, so it isn't extracted or used. Monster art will be original: simple drawn tokens (like the current mockups), free art packs with credit (OpenGameArt, LPC), or the user's own AI-generated images. Claude can write the image prompts from our own descriptions.

**Color Spray (checked in the PHB):**
- 1st-level illusion, self (15-foot cone), duration 1 round.
- Roll 6d10: the total is how many hit points of creatures it can affect.
- Creatures are affected in ascending order of current HP, ignoring unconscious creatures and creatures that can't see.
- Each affected creature is blinded until the spell ends. Its HP is subtracted from the total, and the next creature needs HP at or below the remaining total.
- The "at higher levels" bonus (believed to be +2d10 per slot level) wasn't visible in the extracted text; confirm it.

## 9h. Project docs index
- **RPG_Game_Plan.md**: this doc (decisions, schedule, tech, animation plan).
- **Story_Bible.md**: plot, cast, the three Truths, endings, Corin.
- **Encounters_and_XP.md**: every fight, XP ledger, side quests, travel tables, Wix.
- **Rules_Scope.md**: exactly which 5e rules, classes (L1–6), spells and conditions the game implements.
- **Monster_Roster.md**: about 45 monsters with numbers and original art concepts.
- **Items.md**: magic items per act and the three optional elite monsters.
- **Maelis_Letters.md**: the villain's lantern-moth letters.

## 10. Next steps (updated, Nov 15)
1. **GitHub (5 minutes):** create a new repository named `ember-crown` with a README (cloud sessions need an existing repo).
2. **Connect it:** open claude.ai/code, or the Desktop Code tab with **Cloud** selected, sign in with GitHub, and install the Claude GitHub App on the repo when prompted.
3. **First cloud session:** paste the kickoff prompt Claude writes for you. It copies the six project docs into `/docs`, writes `CLAUDE.md`, scaffolds the TypeScript + Vite project, sets up GitHub Pages deployment, and builds the Day 1 rules engine with tests.
4. **Each session afterwards:** one feature at a time (rules engine → characters → combat → map and travel → camp and rests → content). Review and merge each change on GitHub, then play the result at your GitHub Pages link.
5. **Keep this claude.ai project for design:** story, dialogue writing, balance questions. Paste decisions back into the docs.
6. **Usage pacing (Pro):** chat and Claude Code share one limit. Spread build sessions across the day, and keep design chats short on build days.

## Spot-check log
- ✅ (Nov 15) Against the SRD 5.1 CC PDF: hit dice, saving throws and subclass levels for all 12 classes, plus species ability bonuses and speeds, match the mockup.
- ✅ 2014 encounter math: a ×2 multiplier for 3–6 monsters; level-2 Medium = 100 and Hard = 150 per character (worked from the DMG's own example). Combat mockup Medium (400) and Hard (600) check out. The level-2 Easy threshold (50) is still unverified.

- ✅ (Nov 15, from the user's uploaded **Player's Basic Rules v0.2** and **DM Basic Rules v0.3**):
  - Level-2 thresholds are 50 / 100 / 150 / 200 (Easy / Medium / Hard / Deadly).
  - Adventuring Day is 6–8 Medium or Hard encounters with about 2 short rests.
  - "Knocking a Creature Out" exists: melee attack to 0 HP, the creature falls unconscious and is stable.
  - Death saves: damage at 0 HP = 1 failure (a critical hit = 2); damage at or above max HP = instant death; a natural 1 = two failures; a natural 20 = regain 1 HP.
  - Short rest is at least 1 hour; long rest is at least 8 hours, once per 24 hours.
  - Fireball: 20-ft radius, 8d6, Dex save for half.
  - Magic Missile: 3 darts, 1d4+1 each, strike simultaneously, +1 dart per slot level.

## CONFIRM LOCALLY
- [ ] Color Spray details (not in the Basic Rules PDF; check against the SRD 5.1 spell text).
- [ ] Which LPC animations exist (walk/slash/shoot/cast/hurt) and their licenses.
- [ ] Which subclass each SRD (5.1 or 5.2) includes per class, and whether every monster named in §7 (hobgoblin, ghoul, wight, ogre, hag, young dragon, mage, cult fanatic, etc.) is in the SRD version you pick.
- [ ] Encounter XP thresholds/budgets for your rules version (the 2014 and 2024 DMG methods differ). Run the math on every §7 encounter.
- [ ] The SRD attribution wording required by CC-BY-4.0 for the version you use.
- [ ] Licenses: per-asset LPC licenses (via its CREDITS.csv), Kenney (believed CC0), game-icons.net (believed CC BY 3.0), and any 5e JSON dataset (which SRD version, which license).
- [ ] Current versions and status of Phaser/PixiJS, Ink/inkjs, and Tiled export formats.
- [ ] Claude Code features and usage limits on your specific Claude plan.
- [ ] Godot MCP servers are community projects, not Anthropic's. Check which one is maintained before relying on it.
- [ ] My time estimates (hours/day, about 60–80 spells, half a day for AI) are guesses. Adjust after Day 1.

## Sources
- [D&D Beyond: SRD 5.2 announcement](https://www.dndbeyond.com/posts/1949-you-can-now-publish-your-own-creations-using-the)
- [Tribality: SRD v5.2 FAQ excerpt (5.1 and 5.2 both CC-BY-4.0)](https://www.tribality.com/2025/04/23/dd-system-reference-document-v5-2/)
- [Roll20: SRD 5.2 overview and download](https://pages.roll20.net/dnd-srd)
- [PC Gamer: SRD 5.2 under Creative Commons; trademarked monsters not included](https://pcgamer.com/games/rpg/dandds-new-rules-will-be-available-under-a-creative-commons-licence)
- [Universal LPC Spritesheet Character Generator (GitHub)](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
- [LPC Spritesheet Generator, licensing notes (CC-BY-SA / OGA-BY / GPL)](https://gh.r-mj.com/BenCreating/LPC-Spritesheet-Generator)
- [Playwright MCP + Claude Code](https://www.testmuai.com/blog/playwright-mcp-claude-code/)
- [Coding-Solo godot-mcp](https://mcpservers.org/de/servers/Coding-Solo/godot-mcp)

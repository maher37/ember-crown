# Build roadmap

One milestone per Claude Code session (bigger ones may take two). Each milestone ends with a PR the owner merges, then plays on https://maher37.github.io/ember-crown/.

**How to start each session:** paste the "Prompt" line for that milestone. Claude reads `CLAUDE.md` automatically.

---

## M0: Project skeleton and deploy
- Vite + React + TypeScript (strict), ESLint/Prettier, Vitest, Playwright, zod, Zustand.
- GitHub Actions workflow: test → build → deploy to GitHub Pages on push to `main` (Vite `base: '/ember-crown/'`).
- A placeholder title screen styled like `docs/mockups/Main.dc.html` (difficulty selector working, SRD 5.1 attribution line).
- **Done when:** the Pages link shows the title screen, and `npm test` and `npm run build` pass in CI.
- **Owner steps:** Settings → Pages → Source: **GitHub Actions** (Claude will give exact clicks).
- **Prompt:** `Do Milestone M0 from docs/BUILD_ROADMAP.md.`

## M1: Rules engine core
- Seeded dice; ability modifiers; proficiency by level; checks, saves, advantage and disadvantage.
- Attack rolls, crits, damage with resistance, vulnerability and immunity.
- All conditions from Rules_Scope §2.
- Concentration checks; 0 HP, death saves, stabilizing, knockouts, instant death.
- Short and long rests; XP thresholds and level-ups (PHB table).
- **Done when:** there's a thorough Vitest suite, including a scripted duel test that prints a readable combat log.
- **Prompt:** `Do Milestone M1 from docs/BUILD_ROADMAP.md.`

## M2: Data layer
- zod schemas and JSON for: 9 species, 8 backgrounds, 12 classes L1–6 (features and resources), the curated spell list, the monster roster (incl. elites), and items.
- A `validate-data` script.
- Anything marked ⚠ or "verify" in the docs gets a `"verify": true` flag plus a list in the PR for the owner to check against his PDFs.
- **Prompt:** `Do Milestone M2 from docs/BUILD_ROADMAP.md.`

## M3: Character creation and saves
- The creator screen (mockup `CharacterCreator.dc.html`): Custom or **Origin: Corin Varrow**; species, class, the three ability methods, background, portrait builder (port `Portrait.dc.html` to a React SVG component), and name.
- Party of 4.
- Save slots (localStorage), autosave, and export/import of a save file.
- **Prompt:** `Do Milestone M3 from docs/BUILD_ROADMAP.md.`

## M4: Combat
- Grid, initiative, turn order, movement, action / bonus action / reaction.
- Opportunity attacks, cover, reaction prompts, spells via effect primitives, class features through level 2.
- Simple enemy AI; the combat log; difficulty scaling.
- A pre-combat "Prepare" step; autosave before fights.
- **Done when:** F2 *Road ambush* (4 goblins vs a level-2 party) is playable start to finish (mockup `Combat.dc.html`).
- **Prompt:** `Do Milestone M4 from docs/BUILD_ROADMAP.md.`

## M5: Exploration, dialogue, journal and level-up
- Tavern exploration (mockup `Exploration.dc.html`).
- Ink dialogue with party-best skill checks, character-specific `[Corin]` / `[Class]` options and flags (mockup `Dialogue.dc.html`).
- Quest journal; XP awards; the level-up screen with hover previews (mockup `LevelUp.dc.html`).
- **Prompt:** `Do Milestone M5 from docs/BUILD_ROADMAP.md.`

## M6: World map, travel, calendar and camp
- The map (mockup `WorldMap.dc.html`), travel times, the Harptos calendar, and road-encounter checks (d20, 18+).
- The camp screen (mockup `Camp.dc.html`): short and long rests (once per 24 hours), Wix jokes, lantern-moth letters with replies and Trust.
- **Prompt:** `Do Milestone M6 from docs/BUILD_ROADMAP.md.`

## M7: Act I content
- All 7 mandatory fights, 4 side quests, the Scald elite, Act I items, the Lantern Night opening, and the Corin origin opening.
- Class features through level 3.
- **Prompt:** `Do Milestone M7 from docs/BUILD_ROADMAP.md.`

## M8: Act II content
- Class features through level 5 (Extra Attack, 3rd-level spells). All Act II content per the docs.
- **Prompt:** `Do Milestone M8 from docs/BUILD_ROADMAP.md.`

## M9: Act III and endings
- Level 6. Act III content, the ember-wraith finale, the Truths check, and all endings with epilogue slides.
- **Prompt:** `Do Milestone M9 from docs/BUILD_ROADMAP.md.`

## M9b: Sound, place art and walk-around dungeons (owner request, Nov 20)
- Sound: generative music per mood, a background sound for every place, and effects for hits, misses, spells, dice, level-ups and quests (Web Audio, no recorded files). Volume sliders and mute (M key).
- An illustrated, gently animated backdrop for every place's scenes; a richer tavern where the party walks to what you click.
- The Old Mine and the King's Kiln become walk-around maps (`src/data/placeMaps.json`): areas open as the story goes, with a few things to search.
- **Prompt:** done in the session after M9.

## M9c: Equipment, shop and character sheet (owner request, Nov 20)
- A full character sheet per hero (Character, Spells, Equipment tabs); prepared casters re-prepare after a long rest.
- Brannoc's stores; armor, shields and weapons worn from the party's pack; portraits show armor, shields and helmets.
- Adventuring gear (`src/data/gear.json`): rope, torches, crowbar and thieves' tools open story choices; a healer's kit and thrown flasks work in fights.
- **Prompt:** done in the session after M9b.

## M10: Balance and polish
- A headless balance simulator (party vs. encounter × 500 runs), with tuning per Encounters_and_XP targets. **Done:** `npm run balance` (add `-- --report` to rewrite `docs/Balance_Report.md`, `-- --only f8-toll-bridge` for one fight).
- Bug pass, settings screen, credits. **Done**, plus floating damage numbers, hit flashes, the party on the Prepare screen, and the review's layout fixes.
- **Prompt:** `Do Milestone M10 from docs/BUILD_ROADMAP.md.`

## M10b: Playtest round 3 (owner request, Nov 21)
- Equipment slots (two weapon sets, worn slots), a shop with rare finds and who-can-use reasons, item descriptions.
- Fights: rotating initiative, bloodied portraits, click a square to cancel and move, enemy details in the side panel.
- Long rest any time; dialogue centered with styled lines; the sheet's boxes stand out.
- `docs/Story_Review.md`: Baldur's Gate 1–3 and recommendations (the owner picks what to adopt).

## M10c: Playtest round 4, Phase 1 (owner request, Nov 21)
- Hex: choose the cursed ability (remembered), real disadvantage on those checks, and it carries into the next fight within an hour.
- Battle music by foe (undead, beasts, fire creatures, humanoids, bosses), more intense on Hard.
- Item icons with rarity frames (mundane, uncommon, rare, story treasure).
- Cleric domains: Life, Light, War and Tempest (D4 revised).
- **Next phases (owner to confirm the order):** 2) Ashford as a walkable town: blacksmith, town hall quest board, travelling merchant. 3) Exploring: Perception finds, chests, hidden merchants, finds that start side quests. 4) More subclasses for other classes. 5) Spell animations (M11).

## M10d: Playtest round 4, Phases 2–3 (owner request, Nov 21)
- Quest markers on the world map (a "!" where each active quest leads next) and places in the journal.
- Ashford as a walkable town (D26): the forge, the magic shop, the temple, the market-day wagon, the Hall's notice board with bounties, and townsfolk who remember what you did.
- Exploring (D27): finds noticed by passive Perception or a search, chests with locks and traps, hidden merchants, and finds that start short quests.
- Story (D28): the ember-kiss and Cindrath's gifts, more callbacks (townsfolk, Brannoc, letters), and Maelis in person at the mill and above Ashfall Pass.
- Still to come: more subclasses for other classes (Phase 4), spell animations (M11).

## M10e: Playtest round 5 (owner request, Nov 21)
- Fixed: the convoy fight froze on a militia ally's turn; Eldritch Blast's second beam at level 5; Hex on spell attacks.
- Tooltips for spells and features (level-up, spell preparation); item rewards say what they do.
- 13 more spells; kind dice for party spells (D30).
- Seven new subclasses (D29). Next: Moon druid, Shadow monk, Beast Master ranger, Wild Magic sorcerer.
- Open: should Medium be harder? (D31)

## M11: Animations (phase 2)
- A presentation-event system, then the effects list in `RPG_Game_Plan.md` §9d (projectiles, spell areas, damage-type colors, condition icons, downed state).
- Includes the reduce-motion and reduce-flashing settings.
- **Prompt:** `Do Milestone M11 from docs/BUILD_ROADMAP.md.`

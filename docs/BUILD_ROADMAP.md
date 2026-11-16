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

## M10: Balance and polish
- A headless balance simulator (party vs. encounter × 500 runs), with tuning per Encounters_and_XP targets.
- Bug pass, settings screen, credits.
- **Prompt:** `Do Milestone M10 from docs/BUILD_ROADMAP.md.`

## M11: Animations (phase 2)
- A presentation-event system, then the effects list in `RPG_Game_Plan.md` §9d (projectiles, spell areas, damage-type colors, condition icons, downed state).
- Includes the reduce-motion and reduce-flashing settings.
- **Prompt:** `Do Milestone M11 from docs/BUILD_ROADMAP.md.`

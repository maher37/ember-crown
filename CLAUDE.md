# The Ember Crown: instructions for Claude Code

## What this project is
A personal-use, browser-based party RPG using **D&D 5th edition (2014) rules**, in the style of the Gold Box games and Baldur's Gate 1–3.
- **Setting:** the southern Greypeak Mountains of the Forgotten Realms.
- **Structure:** three acts, a party of four (or the premade origin character, Corin Varrow), levels 1–6.
- **The owner is not a programmer.** He designs, plays and tests. You write the code.

## How to work with the owner
- **Plain English, always.** At the start of a session, restate the plan in about 5 short bullets. At the end, say what changed, how to try it (the GitHub Pages link once deployed), and anything he needs to click.
- **One milestone per session**, from `docs/BUILD_ROADMAP.md`. Don't jump ahead.
- **Pull request per milestone.** Work on a branch, open a PR with a short plain-English summary, and let the owner merge it. Never force-push `main`.
- **Ask before** changing a design decision recorded in `docs/`. When a decision does change, update the relevant doc in the same PR.
- **Spell out GitHub steps** the owner must do by hand (settings, merges) as numbered click-by-click instructions.

## Source of truth (read before building)
| Doc | Use it for |
|---|---|
| `docs/RPG_Game_Plan.md` | Decisions (the D-numbered table), scope, tech, animation plan |
| `docs/Rules_Scope.md` | Exactly which 5e rules, classes (L1–6), spells and conditions to implement |
| `docs/Monster_Roster.md` | Monster stats (⚠ rows need checking) and art concepts |
| `docs/Encounters_and_XP.md` | Every fight, XP ledger, side quests, travel tables, Wix |
| `docs/Items.md` | Magic items per act and the elite monsters |
| `docs/Story_Bible.md` | Plot, cast, the three Truths, endings, Corin, calendar |
| `docs/Maelis_Letters.md` | Villain letters (verbatim game text) |
| `docs/mockups/*.dc.html` | Screen designs (layout, palette, interaction logic) |

If code and docs disagree, the docs win unless the owner says otherwise.

**About the mockups:** they're design-canvas files. They won't run on their own, but read them for layout, colors, copy and behavior. Rebuild them as real React components; don't port the canvas runtime.

## Tech stack
- **Vite + React + TypeScript** (strict mode).
- **Rendering:** HTML/CSS and inline SVG for screens, maps and the combat grid (as in the mockups). Add a canvas library (PixiJS) later only if the animation phase needs it.
- **State:** one serializable `GameState` object in a small store (Zustand). The rules engine never touches the store directly.
- **Data:** JSON in `src/data/`, validated with **zod** schemas at startup and in tests.
- **Dialogue:** **inkjs** (Ink scripts in `src/content/dialogue/`).
- **Tests:** **Vitest** for rules and data. **Playwright** smoke tests for key flows (new game → create party → fight → save → reload).
- **Deploy:** GitHub Actions → GitHub Pages on every push to `main`. The Vite `base` must be `/ember-crown/`. Site URL: https://maher37.github.io/ember-crown/

## Architecture rules
```
src/rules/    pure TypeScript 5e engine: dice (seeded RNG), checks, saves, attacks, damage types,
              conditions, concentration, death saves, knockouts, rests, leveling. NO React imports.
src/game/     game state, save/load, flags, quests, XP, calendar (Harptos), travel, encounters, AI
src/data/     JSON content + zod schemas (species, backgrounds, classes, spells, monsters, items, encounters)
src/content/  Ink dialogue, letters, journal text
src/ui/       React screens matching docs/mockups (title, creator, exploration, combat, dialogue,
              map, camp, level-up, inventory, journal)
tests/        Vitest + Playwright
```
- **Every rule has a test.** Cite the rule in a comment (for example `// PHB: Damage at 0 Hit Points`).
- **Seeded RNG everywhere;** the seed is stored in saves so bugs can be reproduced.
- **Every roll goes to the combat/dialogue log** with its breakdown: `d20 (14) + 5 = 19 vs AC 15 → HIT`.
- **Saves** carry `saveVersion`. Never break old saves without a migration.
- **Content is data, not code.** Spells and monsters are JSON records using effect primitives (attack, save, damage, heal, condition, area, concentration).
- **Difficulty** (Easy/Medium/Hard) adds or removes enemies per `docs/Encounters_and_XP.md`. XP awards don't change with difficulty.

## Look and feel
- **Palette (from the mockups):**
  - Ground `#2b3442`, header `#262f3c`, panel `#364256`, card `#323d4f`.
  - Border `#51607a`, text `#eef2f7`, headings `#f8f3e8`, muted `#c3ccd9`.
  - Accent ember `#e8833a`, accent text `#e8a060`, gold `#e8c27a`.
  - Parchment (letters, map) `#f3ead6` / `#ece4cf`.
  - Allies blue `#7fb3e6` with round tokens; enemies orange `#e06a3b` with square tokens.
- **Fonts:** Cinzel (headings), Inter (UI), Spectral (letters and dialogue prose), via Google Fonts.
- **Accessibility:** real `<button>`s, keyboard navigation, text contrast of at least 4.5:1, a reduce-motion setting (and respect `prefers-reduced-motion`), and a reduce-flashing option for spell effects.

## Content and IP rules (personal project)
- **Don't paste text from the PHB, DMG, MM or other books** into the repo. Numbers and mechanics are fine; descriptions go in our own words. SRD 5.1 text may be quoted (CC-BY-4.0); add its attribution on the title screen.
- **No Wizards of the Coast artwork or maps** (including Monster Manual art and the Sword Coast map). Art is original (SVG/CSS) or free assets with credit in `assets/CREDITS.md`.
- **Forgotten Realms names are allowed** because this is personal use. The swap-back list is in `docs/RPG_Game_Plan.md` (D18).

## Commands (set these up in Milestone 0)
- `npm install`
- `npm run dev`: local dev server
- `npm test`: Vitest
- `npm run e2e`: Playwright smoke tests
- `npm run build`: production build (must pass before every PR)
- `npm run validate-data`: zod-validate all JSON content

## Definition of done (every PR)
1. `npm test` and `npm run build` pass. Add or update tests for new rules.
2. The feature is playable on the deployed site after merge, or the PR says why not yet.
3. Docs are updated if a decision changed.
4. The PR description includes: what changed, how to try it, and known gaps.

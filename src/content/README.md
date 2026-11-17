# Story content

Dialogue is written in [Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) in `dialogue/*.ink`. The build compiles it (see `scripts/inkPlugin.ts`); an Ink error stops the build with the line number.

## What the game gives Ink

| In Ink | What it does |
|---|---|
| `has("corin")`, `has("class:cleric")`, `has("species:hill-dwarf")`, `has("background:soldier")` | Is someone like that in the party? |
| `flag("name")` / `~ set_flag("name", true)` | Story flags, saved with the game |
| `~ quest_step("quest", "step")` / `quest_done("quest")` | Journal steps (ids in `src/data/quests.json`); finishing a quest awards its XP |
| `~ award("id")` | One-off XP (ids and amounts in `quests.json` → `awards`) |
| `~ note("text")` | A journal note |
| `roller()` / `leader()` | Who rolled the last check / the party's first hero |
| `~ travel("map")` | Leave the scene and open the world map |
| `~ travel("scene:ashford.hall")` | Leave this scene for another story's knot (the tavern's front door → Ashford Hall) |
| `~ give_gold(300)` / `gold()` | Add (or, with a negative number, spend) gold / how much the party has |
| `truths()` / `speech()` | How many Truths the party holds / roll the finale speech (Story_Bible §6) |
| `ember()` / `~ regain_slot()` | Corin's Ember (0–5) / give Corin back his highest spent spell slot |
| `~ set_flag("ending", "lamp-lit")` then `~ travel("epilogue")` | End the game: the epilogue slides (`src/data/epilogue.json`) play |
| `~ fight("f3-warren-gate", "arrive.after_gate")` | Start a fight (ids in `src/data/encounters.json`); after it, the story picks up at that knot. The fight's result is a flag: `won:<id>`, `lost:<id>` (only for fights you can lose and carry on) or `parley:<id>` |
| `~ give_item("potion-of-healing", 2)` / `has_item("luck-stone")` | Put items in the party's pack / does anyone have it? (ids in `magicItems.json`) |
| `~ truth("collapse")` | One of the three Truths (`collapse`, `crown`, `family`) |
| `~ set_act(2)` | Move the story to the next act (unlocks its map places) |
| `trap("dex", 12, "2d6", "bludgeoning")` | The leader makes a save; returns whether it succeeded (damage on a failure, never below 1 HP) |

## Choice tags

- `+ [Let me see to his wounds. #check:medicine:10]`: a skill check. The party member with the best bonus rolls (D11); the result is in the variable `passed`. Always write both outcomes, and make failure move the story on.
- `+ {has("corin")} [You know me, Brannoc. #as:corin]`: a character option, shown as **[Corin]**; that character speaks (and rolls, if there's also a check).
- `+ [Fight him. #fight]`: marks a choice that starts a fight with ⚔ "(starts combat)" (Encounters_and_XP §6).

## Stories and places

Each `.ink` file is one story (`src/game/dialogue.ts` → `STORIES`). Arriving at a map place opens its scene (`PLACE_SCENES`): Act I's `warren`, `mine` (the Old Mine), `mill`, `ashwood` and `cave` (the Steaming Cave), Act II's `bridge`, `marsh` (lizardfolk), `marrowmere`, `abbey`, `sallow` and `deserters`, and Act III's `pass`, `forge` (Vorrag), `caves` (Wix's clan) and `kiln` (the King's Kiln and the Crowning) start at their `arrive` knot; `ashford.ink` holds Ashford Hall and Edric's Errand, and `camp.ink` Maelis's visit to the camp and Corin's dream bargains; the tavern's hotspots open knots in `tavern.ink`; `road.ink` holds Wix's scene after the road ambush.

Lines can switch the portrait with `#speaker:edric` (ids in `src/data/npcs.json`). Keep NPC lines to 3 sentences and choices to 5 (Story_Bible §10–11). `tests/unit/dialogue.test.ts` checks that every quest step and award the script names exists.

## Writing a place scene

A finished place should divert to a stitch that only offers "Leave": choices inside a `{ condition: … }` block don't stop the story, so the knot would carry on underneath. `tests/unit/scenes2.test.ts` checks this for every place.

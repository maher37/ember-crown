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
| `~ travel("f2-road-ambush")` | Leave the scene for an encounter |

## Choice tags

- `+ [Let me see to his wounds. #check:medicine:10]`: a skill check. The party member with the best bonus rolls (D11); the result is in the variable `passed`. Always write both outcomes, and make failure move the story on.
- `+ {has("corin")} [You know me, Brannoc. #as:corin]`: a character option, shown as **[Corin]**; that character speaks (and rolls, if there's also a check).

Lines can switch the portrait with `#speaker:edric` (ids in `src/data/npcs.json`). Keep NPC lines to 3 sentences and choices to 5 (Story_Bible §10–11). `tests/unit/dialogue.test.ts` checks that every quest step and award the script names exists.

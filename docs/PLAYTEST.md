# Playtest inbox

Two ways to report what you find while playing. Use whichever is easier.

1. **A GitHub issue (best):** in the repo, click **Issues → New issue → Playtest note**, fill in the short form, and attach an exported save if you can. Claude closes the issue in the PR that fixes it.
2. **This file:** add a line under "Open" below, in any order. The next session moves fixed lines to "Done".

**One note per problem.** "The convoy froze when the militia's turn came up" is perfect. A long list of mixed notes in one message is harder to split into small fixes.

**How Claude works through the inbox:**
- Bugs first, in their own PR.
- Then balance, then story, then feature wishes, each as separate PRs.
- Anything that changes a decision gets an entry in `docs/DECISIONS.md` and is confirmed with you first.

## Open
*Owner notes from Nov 22 (by voice, split into one line each by Claude).*

**Bugs**

**Story and clarity**

**Feature wishes**
- **Feature, resting in dungeons:** a long rest inside a mine or dungeon should have a small chance of being attacked by one or two of that place's roaming monsters. (Camps in the wild can already be attacked at night; dungeons and mines can't.)
- **Feature, ambushing monsters:** if the party notices roaming monsters before they notice the party (Stealth against Perception), the party gets the jump on them and acts first. This applies only to roaming monsters, not ones already waiting in a room. (Today only monsters can surprise the party.)

## Done
- **Feature, summons:** the warlock's Pact of the Chain familiar (Find Familiar) can't be summoned, and summoned creatures and beast companions aren't in the game yet. Expected: familiars, summons and animal companions join the fight as allies. **Decided (D36), one PR each:** familiars done in PR #56, Wix's bag in PR #57, and the Beast Master ranger's animal companion in the next PR.
- **Story, camp companions who talk** (Story_Review #2, D32): at camp only. **Built in the next PR:** "Around the fire" at camp, with scenes for Wix, Edric, Tamsin, Ulric, Kell and Ser Ida, and two personal quests.
- **Feature, casting between fights (D34):** besides healing, let casters cast other spells on the map, for example Hex or Armor of Agathys just before a fight, and carry them into it. Today only healing spells (and Mage Armor on the Prepare screen) work outside a fight. **Spell list approved Nov 22:** see D34. **Mostly done in PR #43:** the Prepare screen has a “Cast before the fight” panel for the approved buffs, plus Hex and Hunter’s Mark on a foe in sight. **Finished in PR #51:** Protection from Evil and Good, Beacon of Hope and Pass without Trace now work in fights (Pass without Trace also gives the scout +10), and Aid, Mage Armor, Armor of Agathys and False Life last into the next fight while their time runs.
- **Story, the new premade heroes' own story (D33):** Harl Deepdelve, Nessa Thorne and Vorna Kalvaar should get unique dialogue options and story beats like Corin's `[Corin]` lines and scenes. Expected: each one has `[Name]` choices in major scenes and a few personal story moments tied to their backstory (Story_Bible §9b). One hero per PR. **Done:** Harl in PR #46, Nessa in PR #47, Vorna in PR #48.
- **Feature, portraits:** the dragonborn portrait should look a little like a dragon, and small species (dwarf, halfling, gnome) should look smaller than humans. **Done in PR #45:** dragonborn have swept-back horns, fins instead of ears, scales, slit pupils, nostrils and small fangs (the hair colour tints the crest, fins and chin barbels); dwarves are drawn a bit shorter and broad, halflings and gnomes clearly smaller.
- **Story, rename a premade hero (D33):** Nessa and Rhessa rhyme; rename one of them. Owner to pick which one and the new name. **Done in PR #32:** Rhessa is now Vorna Kalvaar; old saves are renamed when they load.
- **Feature, premade companions (D33):** three more premade origin heroes like Corin Varrow, each with a backstory: a dwarf cleric, a female human warlock and a female dragonborn fighter. **Done in PR #29:** Harl Deepdelve (dwarf cleric), Nessa Thorne (warlock) and Rhessa Kalvaar (dragonborn fighter) can be picked under Origin hero, with their backstory on the sheet. Their own dialogue and scenes come later.
- **Story, dreams:** the nightly dream with the red figure (Corin's ember bargain after every long rest) doesn't make clear what accepting gives. The party's once-an-act kindled gifts are listed on the character sheet, but Corin's bargain gifts (+2 fire spell damage [inferred number], fire resistance, a spell slot back) are not shown anywhere. The owner refuses only because he knows it affects the ending. Expected: the choice says plainly what you get (for example "+2 damage on fire spells", "resist fire", "regain a spell slot"), the gift shows on the character sheet, and the cost is hinted at clearly enough for a player who doesn't know the ending. **Fixed in PR #27:** every dream choice now says what it gives and that it lasts, the cost is spelled out after you accept, gifts already taken aren't offered again, and Corin's bargain shows on his sheet.
- **Bug, combat, spells:** sometimes a spellcaster can't cast any spell, as if they had no spell slots, even though the sheet shows slots left. Expected: they can cast while they have slots. (Intermittent; a save from when it happens would help.) **Cause (from the owner's save):** on the map, the Spells & healing panel lets you cast only healing spells, so casters without one showed no Cast buttons, which looked like no slots. In a fight, every spell with a slot was castable. The panel now says so (PR #26).
- **Bug, combat, targeting:** when a monster stands on the body of a downed monster, you can hover it and see it, but you can't attack it with weapons or spells. Expected: you can target the living monster. **Fixed in PR #25.**
- **Bug, Lantern Board (notice board):** the list runs out of screen space, so new quests can't be reached. Expected: the board lists only quests you can take and ones in progress; finished quests drop off (they stay in the journal). **Fixed in PR #25.**

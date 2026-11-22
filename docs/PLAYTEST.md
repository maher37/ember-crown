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
- **Feature, summons:** the warlock's Pact of the Chain familiar (Find Familiar) can't be summoned, and summoned creatures and beast companions aren't in the game yet. Expected: familiars, summons and animal companions join the fight as allies.
- **Feature, premade companions (D33):** three more premade origin heroes like Corin Varrow, each with a backstory: a dwarf cleric, a female human warlock and a female dragonborn fighter.
- **Feature, portraits:** the dragonborn portrait should look a little like a dragon, and small species (dwarf, halfling, gnome) should look smaller than humans.
- **Story, camp companions who talk** (Story_Review #2, D32): at camp only.

## Done
- **Story, dreams:** the nightly dream with the red figure (Corin's ember bargain after every long rest) doesn't make clear what accepting gives. The party's once-an-act kindled gifts are listed on the character sheet, but Corin's bargain gifts (+2 fire spell damage [inferred number], fire resistance, a spell slot back) are not shown anywhere. The owner refuses only because he knows it affects the ending. Expected: the choice says plainly what you get (for example "+2 damage on fire spells", "resist fire", "regain a spell slot"), the gift shows on the character sheet, and the cost is hinted at clearly enough for a player who doesn't know the ending. **Fixed in PR #27:** every dream choice now says what it gives and that it lasts, the cost is spelled out after you accept, gifts already taken aren't offered again, and Corin's bargain shows on his sheet.
- **Bug, combat, spells:** sometimes a spellcaster can't cast any spell, as if they had no spell slots, even though the sheet shows slots left. Expected: they can cast while they have slots. (Intermittent; a save from when it happens would help.) **Cause (from the owner's save):** on the map, the Spells & healing panel lets you cast only healing spells, so casters without one showed no Cast buttons, which looked like no slots. In a fight, every spell with a slot was castable. The panel now says so (PR #26).
- **Bug, combat, targeting:** when a monster stands on the body of a downed monster, you can hover it and see it, but you can't attack it with weapons or spells. Expected: you can target the living monster. **Fixed in PR #25.**
- **Bug, Lantern Board (notice board):** the list runs out of screen space, so new quests can't be reached. Expected: the board lists only quests you can take and ones in progress; finished quests drop off (they stay in the journal). **Fixed in PR #25.**

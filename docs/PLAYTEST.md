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
- (add notes here: type, where, what happened, what you expected)

## Done
- (moved here with the PR number that fixed it)

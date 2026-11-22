// The notice board at Ashford Hall (src/data/bounties.json): bounties to take, fights to find
// at a place, and purses to collect. Each bounty runs as a side quest (steps: hunt, claim).
import { bounties, quests } from '../data';
import type { Bounty } from '../data/schemas/town';
import { completeStep, startQuest } from './journal';
import { holds } from './placeMaps';
import type { GameState } from './save';
import { getPlace, isUnlocked } from './travel';

export const getBounty = (questId: string): Bounty => {
  const b = bounties.find((x) => x.quest === questId);
  if (!b) throw new Error(`Unknown bounty "${questId}"`);
  return b;
};

export const questTitle = (id: string) => quests.find((q) => q.id === id)?.title ?? id;

export type NoticeState = 'new' | 'taken' | 'hunted' | 'done';

/** What the board shows: this act's notices (and any still running from earlier acts). */
export function boardNotices(g: GameState): { bounty: Bounty; state: NoticeState }[] {
  return (
    bounties
      .filter((b) => {
        const q = g.quests[b.quest];
        if (q) return true;
        return b.act === g.act && holds(g, b.requires) && !(b.setsFlag && g.flags[b.setsFlag]);
      })
      .map((b) => {
        const q = g.quests[b.quest];
        const state: NoticeState = !q
          ? 'new'
          : q.status === 'done'
            ? 'done'
            : q.steps.includes('hunt')
              ? 'hunted'
              : 'taken';
        return { bounty: b, state };
      })
      // Playtest Nov 22: the board shows only what you can take or are doing. Paid notices come
      // down (the journal keeps them), and the ones you can act on come first.
      .filter((n) => n.state !== 'done')
      .sort((a, b) => BOARD_ORDER[a.state] - BOARD_ORDER[b.state])
  );
}

const BOARD_ORDER: Record<NoticeState, number> = { hunted: 0, new: 1, taken: 2, done: 3 };

/** Take a notice off the board: the quest starts (and a story flag, for an existing side quest). */
export function takeBounty(g: GameState, questId: string): { game: GameState; messages: string[] } {
  const b = getBounty(questId);
  let next = g;
  if (b.setsFlag) next = { ...next, flags: { ...next.flags, [b.setsFlag]: true } };
  const r = startQuest(next, questId);
  return {
    game: r.game,
    messages: [
      ...r.messages,
      `${getPlace(b.place).name} is marked on your map${isUnlocked(g, getPlace(b.place)) ? '' : ' (you can’t reach it yet)'}.`,
    ],
  };
}

/** Bounties the party can hunt here now (taken, fight not yet won). */
export const huntsAt = (g: GameState, placeId: string): Bounty[] =>
  bounties.filter(
    (b) =>
      b.place === placeId &&
      b.encounter &&
      g.quests[b.quest]?.status === 'active' &&
      !g.quests[b.quest]!.steps.includes('hunt'),
  );

/** After winning a bounty fight: the hunt step is done; the purse waits at the Hall. */
export function markHunted(g: GameState, questId: string): { game: GameState; messages: string[] } {
  const r = completeStep(g, questId, 'hunt');
  return {
    game: r.game,
    messages: [...r.messages, 'Collect the reward at the town hall in Ashford.'],
  };
}

/** Collect the purse (and the quest's XP). */
export function claimBounty(
  g: GameState,
  questId: string,
): { game: GameState; messages: string[]; error?: string } {
  const b = getBounty(questId);
  const q = g.quests[questId];
  if (!q || !q.steps.includes('hunt') || q.status === 'done')
    return { game: g, messages: [], error: 'Nothing to collect yet.' };
  const paid: GameState = { ...g, gold: Math.round((g.gold + (b.rewardGp ?? 0)) * 100) / 100 };
  const r = completeStep(paid, questId, 'claim');
  return { game: r.game, messages: [`Received: ${b.rewardGp} gp from ${b.from}`, ...r.messages] };
}

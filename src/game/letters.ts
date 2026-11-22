import { letterReplies, letters, trustDcBonus } from '../data';
import { ORIGIN_IDS } from '../data/schemas/origin';
import type { Letter } from '../data/schemas/story';
import type { GameState } from './save';

export interface LetterState {
  id: string;
  read: boolean;
  reply?: string;
}

export const getLetter = (id: string): Letter => {
  const l = letters.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown letter "${id}"`);
  return l;
};

const hasCorin = (g: GameState) => g.party.some((h) => h.origin === 'corin' && !h.dead);

const ORIGIN_CONDS = new Set<string>(ORIGIN_IDS);

/** Does a paragraph's condition hold? (`flag`, `!flag`, or an origin hero's id such as `corin`.) */
export function conditionHolds(g: GameState, cond: string | undefined): boolean {
  if (!cond) return true;
  if (ORIGIN_CONDS.has(cond)) return g.party.some((h) => h.origin === cond && !h.dead);
  if (cond.startsWith('!')) return !g.flags[cond.slice(1)];
  return !!g.flags[cond];
}

/** The paragraphs this party gets to read (conditional lines depend on story flags). */
export const letterText = (g: GameState, l: Letter) =>
  l.paragraphs.filter((p) => conditionHolds(g, p.if)).map((p) => p.text);

/**
 * Maelis_Letters.md: each letter arrives at the first long rest after its trigger. Letter 0 is
 * in Corin's pack from the start.
 */
export function lettersDue(g: GameState): Letter[] {
  return letters.filter((l) => {
    if (g.letters.some((x) => x.id === l.id)) return false;
    if (l.originOnly) return hasCorin(g);
    return !!l.trigger && !!g.flags[l.trigger];
  });
}

export function deliverLetters(g: GameState): { game: GameState; delivered: Letter[] } {
  const delivered = lettersDue(g);
  if (!delivered.length) return { game: g, delivered };
  return {
    game: { ...g, letters: [...g.letters, ...delivered.map((l) => ({ id: l.id, read: false }))] },
    delivered,
  };
}

export const trust = (g: GameState) => Number(g.flags['maelis_trust'] ?? 0);

/** Read a letter, optionally replying. Kind and honest replies add +1 Trust. */
export function readLetter(g: GameState, id: string, replyId?: string): GameState {
  const state = g.letters.find((x) => x.id === id);
  if (!state) throw new Error(`Letter ${id} hasn't arrived`);
  if (state.reply || !replyId)
    return { ...g, letters: g.letters.map((x) => (x.id === id ? { ...x, read: true } : x)) };
  const reply = letterReplies.find((r) => r.id === replyId);
  if (!reply) throw new Error(`Unknown reply ${replyId}`);
  return {
    ...g,
    flags: { ...g.flags, maelis_trust: trust(g) + reply.trust },
    letters: g.letters.map((x) => (x.id === id ? { ...x, read: true, reply: replyId } : x)),
  };
}

/** At 3+ Trust the finale's persuasion DC drops by 2 (Maelis_Letters.md). */
export const finaleDcReduction = (g: GameState) =>
  trust(g) >= trustDcBonus.threshold ? trustDcBonus.dcReduction : 0;

/** Corin's own letter can't be "replied to" by the party. */
export const canReply = (l: Letter) => !l.originOnly;

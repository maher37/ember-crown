import { awards, quests } from '../data';
import { awardXp } from '../rules';
import type { Hero } from './hero';
import type { GameState } from './save';

export interface QuestState {
  status: 'active' | 'done';
  /** Steps done so far. */
  steps: string[];
}

export interface StoryResult {
  game: GameState;
  /** Short messages for the player ("Journal updated", "+275 XP each"). */
  messages: string[];
}

const getQuest = (id: string) => {
  const q = quests.find((x) => x.id === id);
  if (!q) throw new Error(`Unknown quest "${id}"`);
  return q;
};

/** Give every living hero the same XP (docs/Encounters_and_XP.md: XP is per character). */
export function partyXp(game: GameState, amount: number, reason: string): StoryResult {
  const party = game.party.map((h) => (h.dead ? h : (awardXp(h, amount).creature as Hero)));
  return { game: { ...game, party }, messages: [`+${amount} XP each: ${reason}`] };
}

export function startQuest(game: GameState, id: string): StoryResult {
  const q = getQuest(id);
  if (game.quests[id]) return { game, messages: [] };
  return {
    game: { ...game, quests: { ...game.quests, [id]: { status: 'active', steps: [] } } },
    messages: [`${q.kind === 'main' ? 'Main quest' : 'Side quest'} added: ${q.title}`],
  };
}

/** Mark a quest step done (starting the quest if needed). Completing a quest awards its XP. */
export function completeStep(game: GameState, questId: string, stepId: string): StoryResult {
  const q = getQuest(questId);
  if (!q.steps.some((s) => s.id === stepId))
    throw new Error(`Quest ${questId} has no step "${stepId}"`);
  let r = startQuest(game, questId);
  const messages = [...r.messages];
  const state = r.game.quests[questId]!;
  if (state.steps.includes(stepId)) return { game: r.game, messages };
  const steps = [...state.steps, stepId];
  let g: GameState = { ...r.game, quests: { ...r.game.quests, [questId]: { ...state, steps } } };
  messages.push(`Journal updated: ${q.steps.find((s) => s.id === stepId)!.text}`);
  if (state.status === 'active' && q.completeWhen.every((s) => steps.includes(s))) {
    g = { ...g, quests: { ...g.quests, [questId]: { status: 'done', steps } } };
    messages.push(`Quest complete: ${q.title}`);
    if (q.xp) {
      r = partyXp(g, q.xp, q.title);
      g = r.game;
      messages.push(...r.messages);
    }
    if (q.next) {
      r = startQuest(g, q.next);
      g = r.game;
      messages.push(...r.messages);
    }
  }
  return { game: g, messages };
}

/** One-off XP award by id (each can only be earned once). */
export function giveAward(game: GameState, id: string): StoryResult {
  const a = awards.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown award "${id}"`);
  const key = `award:${id}`;
  if (game.flags[key]) return { game, messages: [] };
  const r = partyXp({ ...game, flags: { ...game.flags, [key]: true } }, a.xp, a.reason);
  return r;
}

export function addNote(game: GameState, text: string): StoryResult {
  if (game.notes.some((n) => n.text === text)) return { game, messages: [] };
  return {
    game: { ...game, notes: [...game.notes, { text, at: new Date().toISOString() }] },
    messages: ['Journal: new note'],
  };
}

export const questDone = (game: GameState, id: string) => game.quests[id]?.status === 'done';

export function partyLevel(game: GameState): { level: number; xp: number } {
  const living = game.party.filter((h) => !h.dead);
  const xp = Math.min(...living.map((h) => h.xp));
  return { level: Math.min(...living.map((h) => h.level)), xp };
}

/**
 * Story_Review #1: the ember-kiss. Which of Cindrath's three dream offers is due (1 after the
 * mine, 2 after the abbey, 3 once through Ashfall Pass), or null. Lantern Night marks everyone;
 * saves from before the mark count as marked once Lantern Night is done.
 */
export function kindledOfferDue(g: GameState): 1 | 2 | 3 | null {
  const marked = !!g.flags['ember_marked'] || g.quests['lantern-night']?.status === 'done';
  if (!marked || g.flags['ending'] || Number(g.flags['kindled'] ?? 0) >= 3) return null;
  if (g.flags['act1_complete'] && !g.flags['kindled_offer_1']) return 1;
  if (g.flags['act2_complete'] && !g.flags['kindled_offer_2']) return 2;
  if (g.flags['pass_cleared'] && !g.flags['kindled_offer_3']) return 3;
  return null;
}

/**
 * D33 / Story_Bible §9b: Vorna's own dreams. The voice that calls her "daughter" comes once an
 * act (1 after the mine, 2 after the abbey, 3 once through Ashfall Pass), or null.
 */
export function vornaDreamDue(g: GameState): 1 | 2 | 3 | null {
  if (g.flags['ending'] || !g.party.some((h) => h.origin === 'vorna' && !h.dead)) return null;
  if (g.flags['act1_complete'] && !g.flags['vorna_dream_1']) return 1;
  if (g.flags['act2_complete'] && g.flags['vorna_dream_1'] && !g.flags['vorna_dream_2']) return 2;
  if (g.flags['pass_cleared'] && g.flags['vorna_dream_2'] && !g.flags['vorna_dream_3']) return 3;
  return null;
}

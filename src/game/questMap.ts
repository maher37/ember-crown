// Where each active quest wants the party next, for the "!" markers on the world map.
import { quests } from '../data';
import type { GameState } from './save';
import { getPlace, isUnlocked } from './travel';

export interface QuestTarget {
  questId: string;
  title: string;
  kind: 'main' | 'side';
  /** The step to do there. */
  step: string;
}

/**
 * The next step of every active quest, by place. "Next" is the first unfinished step after the
 * last one done (so a skipped branch doesn't keep pointing backwards), else the first unfinished.
 * Places the story hasn't opened yet get no marker.
 */
export function questTargets(g: GameState): Record<string, QuestTarget[]> {
  const out: Record<string, QuestTarget[]> = {};
  for (const [id, st] of Object.entries(g.quests)) {
    if (st.status !== 'active') continue;
    const q = quests.find((x) => x.id === id);
    if (!q) continue;
    const last = Math.max(-1, ...q.steps.map((s, i) => (st.steps.includes(s.id) ? i : -1)));
    const step =
      q.steps.slice(last + 1).find((s) => !st.steps.includes(s.id)) ??
      q.steps.find((s) => !st.steps.includes(s.id));
    if (!step?.place) continue;
    if (!isUnlocked(g, getPlace(step.place))) continue;
    (out[step.place] ??= []).push({ questId: id, title: q.title, kind: q.kind, step: step.text });
  }
  // Main quests first.
  for (const list of Object.values(out))
    list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'main' ? -1 : 1));
  return out;
}

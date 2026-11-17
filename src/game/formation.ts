// The party's marching order (playtest feedback): set once, used for every fight.
import type { GameState } from './save';

/** Hero ids front to back: the saved order, with any new heroes added at the back. */
export function formationOrder(g: GameState): string[] {
  const ids = g.party.map((h) => h.id);
  const saved = String(g.flags['formation'] ?? '')
    .split(',')
    .filter((id) => ids.includes(id));
  return [...saved, ...ids.filter((id) => !saved.includes(id))];
}

export const withFormation = (g: GameState, order: string[]): GameState => ({
  ...g,
  flags: { ...g.flags, formation: order.join(',') },
});

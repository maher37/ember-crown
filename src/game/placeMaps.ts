// Walk-around place maps (the Old Mine, the King's Kiln): which spots show, which are open, which
// are finished. Pure functions of the game state; the spots and their conditions are data
// (src/data/placeMaps.json).
import { placeMaps } from '../data';
import type { MapSpot, PlaceMap } from '../data/schemas/story';
import type { GameState } from './save';

export const placeMapFor = (placeId: string | null | undefined): PlaceMap | null =>
  placeMaps.find((m) => m.id === placeId) ?? null;

function token(g: GameState, t: string): boolean {
  const neg = t.startsWith('!');
  const key = neg ? t.slice(1) : t;
  const v = key.startsWith('quest:') ? g.quests[key.slice(6)]?.status === 'done' : !!g.flags[key];
  return neg ? !v : v;
}

/** Every group must hold; a group holds if any of its tokens does (see StoryCondition). */
export function holds(g: GameState, cond: string[][] | undefined): boolean {
  return !cond || cond.every((group) => group.some((t) => token(g, t)));
}

export type SpotState = 'hidden' | 'locked' | 'open' | 'done';

export function spotState(g: GameState, s: MapSpot): SpotState {
  if (!holds(g, s.showIf)) return 'hidden';
  if (s.done && holds(g, s.done)) return 'done';
  return holds(g, s.requires) ? 'open' : 'locked';
}

/** The next story area to go to (the first open, unfinished area or meeting), for the "!" marker. */
export function nextSpot(g: GameState, m: PlaceMap): MapSpot | null {
  return (
    m.spots.find((s) => (s.kind === 'area' || s.kind === 'quest') && spotState(g, s) === 'open') ??
    null
  );
}

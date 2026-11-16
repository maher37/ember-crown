import { encounters, places, roadEvents, roadTables } from '../data';
import type { Place } from '../data/schemas/story';
import { roll, type RandomSource } from '../rules';
import { questDone } from './journal';
import type { GameState } from './save';

export const getPlace = (id: string): Place => {
  const p = places.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown place "${id}"`);
  return p;
};

/** Where the party is on the map (the tavern is in Ashford). */
export const currentPlace = (game: GameState): Place =>
  getPlace(game.location === 'drowned-lantern' ? 'ashford' : game.location);

/** Hours on foot: map distance ÷ 32, at least 1 (docs/mockups/WorldMap.dc.html). */
export function travelHours(from: Place, to: Place): number {
  if (from.id === to.id) return 0;
  return Math.max(1, Math.round(Math.hypot(from.x - to.x, from.y - to.y) / 32));
}

/** Places of a later act stay locked until the story gets there. */
export const isUnlocked = (game: GameState, p: Place) => p.act <= game.act;

export type TravelOutcome =
  | { kind: 'arrive'; log: string[]; note?: string }
  | { kind: 'encounter'; encounterId: string; log: string[]; story?: boolean };

/** The story fight on the road to the mine (F2) happens on the first trip there. */
const ROAD_TO_MINE = new Set(['old-mine', 'warren', 'steaming-cave']);

/**
 * Travel one leg. Encounters_and_XP.md §5b: roll a d20 once per leg; on 18+ an encounter happens,
 * then a d8 on the region's table. Never in town. The story's road ambush (F2) comes first.
 */
export function travelLeg(game: GameState, toId: string, rng: RandomSource): TravelOutcome {
  const from = currentPlace(game);
  const to = getPlace(toId);
  const hours = travelHours(from, to);
  const log = [
    `The party travels from ${from.name} to ${to.name} (${hours} hour${hours === 1 ? '' : 's'}).`,
  ];
  if (
    ROAD_TO_MINE.has(to.id) &&
    !game.quests['old-mine']?.steps.includes('road') &&
    questDone(game, 'lantern-night')
  ) {
    log.push('Halfway along the river road, the birdsong stops…');
    return { kind: 'encounter', encounterId: 'f2-road-ambush', log, story: true };
  }
  const region = to.region === 'none' ? from.region : to.region;
  return roadCheck(region, `on the way to ${to.name}`, log, rng);
}

/** One road-encounter check for a region (also used for long rests in the wild). */
export function roadCheck(
  region: string,
  where: string,
  log: string[],
  rng: RandomSource,
): TravelOutcome {
  const table = roadTables[region];
  if (region === 'none' || !table) return { kind: 'arrive', log };
  const d20 = roll('1d20', rng).total;
  if (d20 < 18) {
    log.push(`Road check ${where}: d20 (${d20}) < 18, no encounter.`);
    return { kind: 'arrive', log };
  }
  const d8 = roll('1d8', rng).total;
  log.push(`Road check ${where}: d20 (${d20}) ≥ 18. Encounter! d8 (${d8}).`);
  const id = table[d8 - 1];
  if (!id) {
    const ev = roadEvents[region]?.[String(d8)];
    if (ev) log.push(ev.text);
    return { kind: 'arrive', log, note: ev?.note };
  }
  const enc = encounters.find((e) => e.id === id)!;
  log.push(`${enc.name}: ${enc.briefing}`);
  return { kind: 'encounter', encounterId: id, log };
}

import { encounters } from '../data';
import type { Encounter } from '../data/schemas/encounter';
import { getEncounter as get } from '../game/combat';
import { parseMap } from '../game/combat/grid';

export const getEncounter = (id: string): Encounter => get(id);
export const parseMapForUi = (e: Encounter) => parseMap(e.map.width, e.map.height, e.map.terrain);
export { encounters };

/** Plain-language version of a log line for players who hide dice rolls. */
export function briefLine(text: string): string {
  return text
    .replace(/: d20( adv| dis)? \([^)]*\)[^→]*→ /, ' → ')
    .replace(/ \((advantage|disadvantage)[^)]*\)$/, '');
}

/** Hide pure dice lines when "Show every dice roll" is off. */
export const isDiceLine = (text: string) =>
  /^[^:]+: \d*d\d+.*= \d+/.test(text) || /^Initiative:/.test(text);

/** Rough hit chance for the tooltip (ignores advantage). */
export function hitChance(toHit: number, ac: number): number {
  const need = ac - toHit;
  return Math.round(Math.min(0.95, Math.max(0.05, (21 - need) / 20)) * 100);
}

/**
 * Board drawing order: bodies and downed creatures first, the living last, so a living token
 * that stands on a body's square is drawn on top and gets the click (playtest Nov 22).
 */
export function tokenDrawOrder<T extends { creature: { dead: boolean; hp: number } }>(
  list: T[],
): T[] {
  const lying = (c: T) => c.creature.dead || c.creature.hp === 0;
  return [...list.filter(lying), ...list.filter((c) => !lying(c))];
}

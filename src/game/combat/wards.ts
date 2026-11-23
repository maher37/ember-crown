// Protection from Evil and Good, Beacon of Hope and Pass without Trace (D34: spells cast before a
// fight). Small checks the attack, save, condition, healing and Stealth code ask.
import { parseDice, roll, type RandomSource } from '../../rules';
import { getMonster } from '../creatures';
import { conscious, distanceFeet } from './grid';
import type { CombatState, Combatant } from './types';

const has = (c: Combatant, tag: string) => c.effects.some((e) => e.tag === tag);

/** PHB: Protection from Evil and Good. The creature types it wards against. */
export const WARDED_TYPES = new Set([
  'aberration',
  'celestial',
  'elemental',
  'fey',
  'fiend',
  'undead',
]);

const typeOf = (c: Combatant) => (c.monsterId ? getMonster(c.monsterId).type : 'humanoid');

/** Is `target` warded against `other` (disadvantage on its attacks; no charming or frightening)? */
export const protectedFrom = (target: Combatant, other: Combatant) =>
  has(target, 'prot-evil-good') && WARDED_TYPES.has(typeOf(other));

/** PHB: Beacon of Hope. Advantage on Wisdom saves and death saves. */
export const hasBeacon = (c: Combatant) => has(c, 'beacon');

/**
 * Roll healing dice, or take the most they can give under Beacon of Hope (PHB: "regains the
 * maximum number of hit points possible from any healing").
 */
export function healDice(
  target: Combatant,
  dice: string,
  rng: RandomSource,
): { total: number; text: string } {
  if (!hasBeacon(target)) return roll(dice, rng);
  const d = parseDice(dice);
  const total = d.count * d.sides + d.bonus;
  return { total, text: `${dice} = ${total} (maximum: Beacon of Hope)` };
}

/**
 * PHB: Pass without Trace. +10 to Stealth for the caster and allies within 30 ft of them, while
 * the caster concentrates.
 */
export function passWithoutTrace(s: CombatState, c: Combatant): number {
  const near = Object.values(s.combatants).some(
    (o) => o.side === c.side && conscious(o) && has(o, 'pwt') && distanceFeet(o.pos, c.pos) <= 30,
  );
  return near ? 10 : 0;
}

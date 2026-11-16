import { type RollMode } from './advantage';
import { signed } from './dice';
import type { RandomSource } from './rng';

/** One d20 roll, with advantage or disadvantage applied. */
export interface D20Roll {
  mode: RollMode;
  /** Both dice when rolling with advantage or disadvantage, otherwise one. */
  dice: number[];
  /** The die that counts. */
  natural: number;
}

// PHB: Advantage and Disadvantage. Roll a second d20; take the higher (advantage) or lower.
export function rollD20(mode: RollMode, rng: RandomSource): D20Roll {
  const first = rng.die(20);
  if (mode === 'normal') return { mode, dice: [first], natural: first };
  const second = rng.die(20);
  const natural = mode === 'advantage' ? Math.max(first, second) : Math.min(first, second);
  return { mode, dice: [first, second], natural };
}

/** "d20 (14)", "d20 adv (14, 7)", "d20 dis (14, 7)". */
export function describeD20(r: D20Roll): string {
  const tag = r.mode === 'advantage' ? ' adv' : r.mode === 'disadvantage' ? ' dis' : '';
  return `d20${tag} (${r.dice.join(', ')})`;
}

/** "d20 (14) + 5 = 19", with any extra dice bonuses (Bless etc.) spelled out. */
export function describeTotal(
  r: D20Roll,
  modifier: number,
  extras: { label: string; value: number }[] = [],
): string {
  const total = r.natural + modifier + extras.reduce((a, e) => a + e.value, 0);
  const extraText = extras.map((e) => ` ${signed(e.value)} ${e.label}`).join('');
  return `${describeD20(r)} ${signed(modifier)}${extraText} = ${total}`;
}

import { ABILITIES, type Ability, type AbilityScores } from './abilities';
import type { RandomSource } from './rng';

// PHB: Determining Ability Scores. The standard array.
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

// PHB: Variant: Customizing Ability Scores (point buy). 27 points; scores 8-15 before bonuses.
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function pointBuySpent(scores: AbilityScores): number {
  return ABILITIES.reduce((sum, a) => {
    const cost = POINT_BUY_COST[scores[a]];
    if (cost === undefined) throw new Error(`${a} ${scores[a]} is outside point buy (8-15)`);
    return sum + cost;
  }, 0);
}

export function isValidPointBuy(scores: AbilityScores): boolean {
  if (ABILITIES.some((a) => scores[a] < POINT_BUY_MIN || scores[a] > POINT_BUY_MAX)) return false;
  return pointBuySpent(scores) <= POINT_BUY_BUDGET;
}

/** Can this score go up one in point buy without breaking the budget or the 15 cap? */
export function canRaisePointBuy(scores: AbilityScores, ability: Ability): boolean {
  if (scores[ability] >= POINT_BUY_MAX) return false;
  return pointBuySpent({ ...scores, [ability]: scores[ability] + 1 }) <= POINT_BUY_BUDGET;
}

export interface AbilityRoll {
  dice: number[];
  dropped: number;
  total: number;
  /** "4d6 (6, 5, 3, 1) drop 1 = 14" */
  text: string;
}

// PHB: Determining Ability Scores. Roll four d6 and add the highest three.
export function roll4d6DropLowest(rng: RandomSource): AbilityRoll {
  const dice = [rng.die(6), rng.die(6), rng.die(6), rng.die(6)];
  const dropped = Math.min(...dice);
  const total = dice.reduce((a, b) => a + b, 0) - dropped;
  return { dice, dropped, total, text: `4d6 (${dice.join(', ')}) drop ${dropped} = ${total}` };
}

/** Six rolls, sorted highest first, ready to place. */
export function rollAbilitySet(rng: RandomSource): AbilityRoll[] {
  return Array.from({ length: 6 }, () => roll4d6DropLowest(rng)).sort((a, b) => b.total - a.total);
}

/** Add species bonuses. PHB: no score can go above 20. */
export function applyBonuses(base: AbilityScores, bonuses: Partial<AbilityScores>): AbilityScores {
  const out = { ...base };
  for (const a of ABILITIES) out[a] = Math.min(20, base[a] + (bonuses[a] ?? 0));
  return out;
}

/** Place six values onto abilities in priority order (best value on the first ability). */
export function placeByPriority(
  values: readonly number[],
  priority: readonly Ability[],
): AbilityScores {
  if (values.length !== 6 || priority.length !== 6 || new Set(priority).size !== 6) {
    throw new Error('Need six values and all six abilities in the priority list');
  }
  const sorted = [...values].sort((a, b) => b - a);
  const out = {} as AbilityScores;
  priority.forEach((a, i) => (out[a] = sorted[i]!));
  return out;
}

/** Swap the values of two abilities (used when re-placing the array or rolls). */
export function swapScores(scores: AbilityScores, a: Ability, b: Ability): AbilityScores {
  return { ...scores, [a]: scores[b], [b]: scores[a] };
}

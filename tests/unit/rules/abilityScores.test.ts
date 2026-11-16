import { describe, expect, it } from 'vitest';
import {
  applyBonuses,
  canRaisePointBuy,
  isValidPointBuy,
  placeByPriority,
  pointBuySpent,
  roll4d6DropLowest,
  rollAbilitySet,
  ScriptedRng,
  SeededRng,
  STANDARD_ARRAY,
  swapScores,
  type AbilityScores,
} from '../../../src/rules';

const s = (
  str: number,
  dex: number,
  con: number,
  int: number,
  wis: number,
  cha: number,
): AbilityScores => ({ str, dex, con, int, wis, cha });

// PHB: Determining Ability Scores.
describe('standard array', () => {
  it('is 15, 14, 13, 12, 10, 8', () => expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]));

  it('places values by class priority', () => {
    expect(placeByPriority(STANDARD_ARRAY, ['str', 'con', 'dex', 'cha', 'wis', 'int'])).toEqual(
      s(15, 13, 14, 8, 10, 12),
    );
  });

  it('rejects an incomplete priority list', () => {
    expect(() =>
      placeByPriority(STANDARD_ARRAY, ['str', 'str', 'dex', 'con', 'wis', 'int']),
    ).toThrow();
  });

  it('swaps two scores', () => {
    expect(swapScores(s(15, 14, 13, 12, 10, 8), 'str', 'cha')).toEqual(s(8, 14, 13, 12, 10, 15));
  });
});

// PHB: Variant: Customizing Ability Scores.
describe('27-point buy', () => {
  it('costs 0 for all 8s and 27 for 15/15/15/8/8/8', () => {
    expect(pointBuySpent(s(8, 8, 8, 8, 8, 8))).toBe(0);
    expect(pointBuySpent(s(15, 15, 15, 8, 8, 8))).toBe(27);
  });

  it('uses the PHB cost table (13 = 5, 14 = 7, 15 = 9)', () => {
    expect(pointBuySpent(s(13, 8, 8, 8, 8, 8))).toBe(5);
    expect(pointBuySpent(s(14, 8, 8, 8, 8, 8))).toBe(7);
    expect(pointBuySpent(s(15, 8, 8, 8, 8, 8))).toBe(9);
  });

  it('the standard array is a legal 27-point buy', () => {
    expect(pointBuySpent(s(15, 14, 13, 12, 10, 8))).toBe(27);
  });

  it('rejects overspending and scores outside 8-15', () => {
    expect(isValidPointBuy(s(15, 15, 15, 9, 8, 8))).toBe(false);
    expect(isValidPointBuy(s(16, 8, 8, 8, 8, 8))).toBe(false);
    expect(isValidPointBuy(s(7, 8, 8, 8, 8, 8))).toBe(false);
    expect(() => pointBuySpent(s(16, 8, 8, 8, 8, 8))).toThrow();
  });

  it('knows when a score can go up', () => {
    expect(canRaisePointBuy(s(8, 8, 8, 8, 8, 8), 'str')).toBe(true);
    expect(canRaisePointBuy(s(15, 8, 8, 8, 8, 8), 'str')).toBe(false);
    expect(canRaisePointBuy(s(15, 15, 15, 8, 8, 8), 'int')).toBe(false);
  });
});

describe('4d6 drop the lowest', () => {
  it('drops the lowest die', () => {
    const r = roll4d6DropLowest(new ScriptedRng([6, 1, 5, 3]));
    expect(r.total).toBe(14);
    expect(r.text).toBe('4d6 (6, 1, 5, 3) drop 1 = 14');
  });

  it('drops only one die when the lowest is tied', () => {
    expect(roll4d6DropLowest(new ScriptedRng([2, 2, 2, 2])).total).toBe(6);
  });

  it('rolls six scores between 3 and 18, highest first, reproducibly', () => {
    const set = rollAbilitySet(new SeededRng(5)).map((r) => r.total);
    expect(set).toHaveLength(6);
    expect([...set].sort((a, b) => b - a)).toEqual(set);
    for (const v of set) expect(v).toBeGreaterThanOrEqual(3);
    for (const v of set) expect(v).toBeLessThanOrEqual(18);
    expect(rollAbilitySet(new SeededRng(5)).map((r) => r.total)).toEqual(set);
  });
});

describe('species bonuses', () => {
  it('adds bonuses but never above 20', () => {
    expect(applyBonuses(s(15, 14, 13, 12, 10, 19), { str: 2, cha: 2 })).toEqual(
      s(17, 14, 13, 12, 10, 20),
    );
  });
});

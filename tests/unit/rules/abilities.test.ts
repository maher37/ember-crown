import { describe, expect, it } from 'vitest';
import { abilityModifier, proficiencyBonus } from '../../../src/rules';

// PHB: Ability Scores and Modifiers table.
describe('abilityModifier', () => {
  it.each([
    [1, -5],
    [3, -4],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [16, 3],
    [18, 4],
    [20, 5],
    [30, 10],
  ])('score %i gives %i', (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});

// PHB: Character Advancement. Rules_Scope §1: +2 at levels 1-4, +3 at 5-6.
describe('proficiencyBonus', () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [8, 3],
    [9, 4],
    [17, 6],
  ])('level %i gives +%i', (level, expected) => {
    expect(proficiencyBonus(level)).toBe(expected);
  });

  it('rejects level 0', () => {
    expect(() => proficiencyBonus(0)).toThrow();
  });
});

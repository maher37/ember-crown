import { describe, expect, it } from 'vitest';
import { formatDice, parseDice, roll, ScriptedRng } from '../../../src/rules';

describe('dice notation', () => {
  it.each([
    ['1d8', { count: 1, sides: 8, bonus: 0 }],
    ['2d6+3', { count: 2, sides: 6, bonus: 3 }],
    ['d20', { count: 1, sides: 20, bonus: 0 }],
    ['1d4-1', { count: 1, sides: 4, bonus: -1 }],
    ['5', { count: 0, sides: 0, bonus: 5 }],
    [' 3d10 + 2 ', { count: 3, sides: 10, bonus: 2 }],
  ])('parses %s', (text, expected) => {
    expect(parseDice(text)).toEqual(expected);
  });

  it.each(['', 'banana', '2d', 'd', '1d6+'])('rejects "%s"', (text) => {
    expect(() => parseDice(text)).toThrow();
  });

  it('formats back to notation', () => {
    expect(formatDice(parseDice('2d6+3'))).toBe('2d6+3');
    expect(formatDice(parseDice('1d4-1'))).toBe('1d4-1');
    expect(formatDice(parseDice('5'))).toBe('5');
  });
});

describe('roll', () => {
  it('adds the dice and the bonus, and explains it', () => {
    const r = roll('2d6+3', new ScriptedRng([4, 6]));
    expect(r.rolls).toEqual([4, 6]);
    expect(r.total).toBe(13);
    expect(r.text).toBe('2d6+3 (4, 6) + 3 = 13');
  });

  it('shows negative bonuses', () => {
    expect(roll('1d4-1', new ScriptedRng([1])).text).toBe('1d4-1 (1) - 1 = 0');
  });
});

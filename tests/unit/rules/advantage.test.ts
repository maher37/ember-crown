import { describe, expect, it } from 'vitest';
import {
  describeD20,
  describeTotal,
  Edge,
  resolveMode,
  rollD20,
  ScriptedRng,
} from '../../../src/rules';

// PHB: Advantage and Disadvantage.
describe('advantage and disadvantage', () => {
  it('resolves sources', () => {
    expect(resolveMode(0, 0)).toBe('normal');
    expect(resolveMode(1, 0)).toBe('advantage');
    expect(resolveMode(0, 2)).toBe('disadvantage');
  });

  it('cancels out no matter how many of each', () => {
    expect(resolveMode(1, 1)).toBe('normal');
    expect(resolveMode(3, 1)).toBe('normal');
    expect(resolveMode(1, 4)).toBe('normal');
  });

  it('collects reasons', () => {
    const e = new Edge().adv('hidden').dis('poisoned').dis('prone', false);
    expect(e.advantage).toEqual(['hidden']);
    expect(e.disadvantage).toEqual(['poisoned']);
    expect(e.mode).toBe('normal');
  });

  it('takes the higher die with advantage', () => {
    const r = rollD20('advantage', new ScriptedRng([5, 17]));
    expect(r.natural).toBe(17);
    expect(describeD20(r)).toBe('d20 adv (5, 17)');
  });

  it('takes the lower die with disadvantage', () => {
    const r = rollD20('disadvantage', new ScriptedRng([5, 17]));
    expect(r.natural).toBe(5);
    expect(describeD20(r)).toBe('d20 dis (5, 17)');
  });

  it('rolls one die normally', () => {
    const rng = new ScriptedRng([12, 3]);
    expect(rollD20('normal', rng).dice).toEqual([12]);
    expect(rng.remaining).toBe(1);
  });

  it('formats totals the way the log shows them', () => {
    const r = rollD20('normal', new ScriptedRng([14]));
    expect(describeTotal(r, 5)).toBe('d20 (14) + 5 = 19');
    expect(describeTotal(r, -1)).toBe('d20 (14) - 1 = 13');
    expect(describeTotal(r, 2, [{ label: 'Bless', value: 3 }])).toBe('d20 (14) + 2 + 3 Bless = 19');
  });
});

import { describe, expect, it } from 'vitest';
import { hashSeed, ScriptedRng, SeededRng } from '../../../src/rules';

describe('SeededRng', () => {
  it('gives the same rolls for the same seed', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const rollsA = Array.from({ length: 50 }, () => a.die(20));
    const rollsB = Array.from({ length: 50 }, () => b.die(20));
    expect(rollsA).toEqual(rollsB);
  });

  it('gives different rolls for different seeds', () => {
    const a = Array.from(
      { length: 20 },
      (
        (r) => () =>
          r.die(20)
      )(new SeededRng(1)),
    );
    const b = Array.from(
      { length: 20 },
      (
        (r) => () =>
          r.die(20)
      )(new SeededRng(2)),
    );
    expect(a).not.toEqual(b);
  });

  it('resumes exactly from a saved state', () => {
    const rng = new SeededRng('campaign');
    for (let i = 0; i < 7; i++) rng.die(6);
    const saved = rng.state;
    const expected = Array.from({ length: 10 }, () => rng.die(12));
    const resumed = SeededRng.fromState(saved);
    expect(Array.from({ length: 10 }, () => resumed.die(12))).toEqual(expected);
  });

  it('only rolls values from 1 to the die size and hits every face', () => {
    const rng = new SeededRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const r = rng.die(20);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
      seen.add(r);
    }
    expect(seen.size).toBe(20);
  });

  it('rejects impossible dice', () => {
    expect(() => new SeededRng(1).die(0)).toThrow();
  });

  it('hashes text seeds the same way every time', () => {
    expect(hashSeed('ember')).toBe(hashSeed('ember'));
    expect(hashSeed('ember')).not.toBe(hashSeed('crown'));
  });
});

describe('ScriptedRng', () => {
  it('plays back results in order', () => {
    const rng = new ScriptedRng([20, 1, 4]);
    expect([rng.die(20), rng.die(20), rng.die(4)]).toEqual([20, 1, 4]);
    expect(rng.remaining).toBe(0);
  });

  it('complains when it runs out or a result is impossible', () => {
    expect(() => new ScriptedRng([]).die(20)).toThrow(/ran out/);
    expect(() => new ScriptedRng([7]).die(6)).toThrow(/not a valid d6/);
  });
});

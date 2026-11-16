import { describe, expect, it } from 'vitest';
import { canLongRest, longRest, ScriptedRng, spendHitDie } from '../../../src/rules';
import { makeCreature } from './helpers';

const rng = (...r: number[]) => new ScriptedRng(r);
const con14 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };

// PHB: Short Rest.
describe('short rest: spending Hit Dice', () => {
  it('heals the die roll plus the Con modifier', () => {
    const c = makeCreature({
      hp: 3,
      maxHp: 20,
      abilities: con14,
      hitDice: { die: 10, total: 3, remaining: 3 },
    });
    const out = spendHitDie(c, rng(6));
    expect(out.creature.hp).toBe(11);
    expect(out.creature.hitDice.remaining).toBe(2);
    expect(out.log[0]!.text).toBe(
      'Hero spends a Hit Die: 1d10+2 (6) + 2 = 8 → +8 HP (11/20), 2 Hit Dice left',
    );
  });

  it("doesn't heal past the maximum", () => {
    const c = makeCreature({ hp: 9, maxHp: 10, hitDice: { die: 8, total: 1, remaining: 1 } });
    expect(spendHitDie(c, rng(8)).creature.hp).toBe(10);
  });

  it('a low roll with a negative Con modifier heals 0, not negative', () => {
    const c = makeCreature({ hp: 5, abilities: { ...con14, con: 6 } });
    expect(spendHitDie(c, rng(1)).creature.hp).toBe(5);
  });

  it('needs a Hit Die left', () => {
    expect(() =>
      spendHitDie(makeCreature({ hitDice: { die: 8, total: 1, remaining: 0 } }), rng(4)),
    ).toThrow(/no Hit Dice/);
  });

  it("can't be used at 0 HP", () => {
    expect(() => spendHitDie(makeCreature({ hp: 0 }), rng(4))).toThrow();
  });
});

// PHB: Long Rest.
describe('long rest', () => {
  it('restores all HP and clears death saves', () => {
    const out = longRest(
      makeCreature({ hp: 2, maxHp: 24, deathSaves: { successes: 1, failures: 1 } }),
    );
    expect(out.creature.hp).toBe(24);
    expect(out.creature.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('regains half the total Hit Dice, rounded down', () => {
    const c = makeCreature({ hitDice: { die: 8, total: 5, remaining: 0 } });
    expect(longRest(c).creature.hitDice.remaining).toBe(2);
  });

  it('regains at least 1 Hit Die', () => {
    const c = makeCreature({ hitDice: { die: 8, total: 1, remaining: 0 } });
    expect(longRest(c).creature.hitDice.remaining).toBe(1);
  });

  it("doesn't go above the total", () => {
    const c = makeCreature({ hitDice: { die: 8, total: 4, remaining: 3 } });
    expect(longRest(c).creature.hitDice.remaining).toBe(4);
  });

  it('removes one level of exhaustion, then restores HP to the new maximum', () => {
    const c = makeCreature({ hp: 5, maxHp: 10, exhaustion: 4 });
    const out = longRest(c).creature;
    expect(out.exhaustion).toBe(3);
    expect(out.hp).toBe(10);
  });

  it('needs at least 1 HP to start', () => {
    const c = makeCreature({ hp: 0, stable: true });
    expect(longRest(c).creature).toBe(c);
  });

  it('only once per 24 hours', () => {
    expect(canLongRest(30, null)).toBe(true);
    expect(canLongRest(30, 8)).toBe(false);
    expect(canLongRest(32, 8)).toBe(true);
  });
});

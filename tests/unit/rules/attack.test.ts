import { describe, expect, it } from 'vitest';
import {
  attackRoll,
  rollDamage,
  roll,
  ScriptedRng,
  type AttackOptions,
  type ConditionId,
} from '../../../src/rules';
import { makeCreature } from './helpers';

const rng = (...r: number[]) => new ScriptedRng(r);
const fighter = makeCreature({ id: 'f', name: 'Fighter' });
const goblin = makeCreature({ id: 'g', name: 'Goblin', kind: 'monster', ac: 15 });
const sword: AttackOptions = { attackBonus: 5, melee: true, within5ft: true, label: 'longsword' };
const bow: AttackOptions = { attackBonus: 5, melee: false, within5ft: false, label: 'shortbow' };

describe('attack rolls', () => {
  it('hits when the total meets AC, and logs the full breakdown', () => {
    const r = attackRoll(fighter, goblin, rng(10), sword);
    expect(r.hit).toBe(true);
    expect(r.critical).toBe(false);
    expect(r.log.text).toBe(
      'Fighter attacks Goblin with longsword: d20 (10) + 5 = 15 vs AC 15 → HIT',
    );
  });

  it('misses one below AC', () => {
    const r = attackRoll(fighter, goblin, rng(9), sword);
    expect(r.hit).toBe(false);
    expect(r.log.text).toMatch(/= 14 vs AC 15 → MISS$/);
  });

  // PHB: Rolling 1 or 20.
  it('a natural 1 always misses', () => {
    const r = attackRoll(fighter, makeCreature({ ac: 2 }), rng(1), { ...sword, attackBonus: 20 });
    expect(r.hit).toBe(false);
    expect(r.log.text).toContain('MISS (natural 1)');
  });

  it('a natural 20 always hits and crits', () => {
    const r = attackRoll(fighter, makeCreature({ ac: 40 }), rng(20), sword);
    expect(r.hit).toBe(true);
    expect(r.critical).toBe(true);
    expect(r.log.text).toContain('CRITICAL HIT');
  });

  // PHB: Champion, Improved Critical.
  it('Improved Critical: a 19 crits', () => {
    const r = attackRoll(fighter, goblin, rng(19), { ...sword, critRange: 19 });
    expect(r.critical).toBe(true);
    expect(attackRoll(fighter, goblin, rng(19), sword).critical).toBe(false);
  });

  // PHB: Cover.
  it('half cover adds 2 AC and three-quarters adds 5', () => {
    expect(attackRoll(fighter, goblin, rng(11), { ...bow, cover: 'half' }).hit).toBe(false);
    expect(attackRoll(fighter, goblin, rng(12), { ...bow, cover: 'half' }).targetAc).toBe(17);
    expect(attackRoll(fighter, goblin, rng(15), { ...bow, cover: 'three-quarters' }).hit).toBe(
      true,
    );
    expect(attackRoll(fighter, goblin, rng(14), { ...bow, cover: 'three-quarters' }).hit).toBe(
      false,
    );
  });

  it('total cover: the attack is not possible', () => {
    const r = attackRoll(fighter, goblin, rng(), { ...bow, cover: 'total' });
    expect(r.allowed).toBe(false);
    expect(r.log.text).toBe(
      'Fighter attacks Goblin with shortbow: not possible (target has total cover)',
    );
  });

  // PHB Appendix A: Incapacitated / Charmed.
  it('an incapacitated attacker cannot attack', () => {
    const r = attackRoll(makeCreature({ conditions: [{ id: 'stunned' }] }), goblin, rng(), sword);
    expect(r.allowed).toBe(false);
  });

  it('a charmed creature cannot attack its charmer, but can attack others', () => {
    const charmed = makeCreature({ conditions: [{ id: 'charmed', source: 'g' }] });
    expect(attackRoll(charmed, goblin, rng(), sword).allowed).toBe(false);
    expect(attackRoll(charmed, makeCreature({ id: 'other' }), rng(10), sword).allowed).toBe(true);
  });

  // PHB Appendix A: the attacker's conditions.
  it.each<[ConditionId, 'advantage' | 'disadvantage']>([
    ['blinded', 'disadvantage'],
    ['frightened', 'disadvantage'],
    ['invisible', 'advantage'],
    ['poisoned', 'disadvantage'],
    ['prone', 'disadvantage'],
    ['restrained', 'disadvantage'],
  ])('attacker %s → %s', (id, mode) => {
    const attacker = makeCreature({ conditions: [{ id }] });
    expect(attackRoll(attacker, goblin, rng(10, 10), sword).roll!.mode).toBe(mode);
  });

  it('attacker exhaustion 3 → disadvantage', () => {
    expect(attackRoll(makeCreature({ exhaustion: 3 }), goblin, rng(10, 10), sword).roll!.mode).toBe(
      'disadvantage',
    );
  });

  // PHB Appendix A: the target's conditions.
  it.each<[ConditionId, 'advantage' | 'disadvantage']>([
    ['blinded', 'advantage'],
    ['invisible', 'disadvantage'],
    ['paralyzed', 'advantage'],
    ['petrified', 'advantage'],
    ['restrained', 'advantage'],
    ['stunned', 'advantage'],
    ['unconscious', 'advantage'],
  ])('target %s → %s', (id, mode) => {
    const target = makeCreature({ conditions: [{ id }] });
    expect(attackRoll(fighter, target, rng(10, 10), sword).roll!.mode).toBe(mode);
  });

  it('target prone: advantage from within 5 ft, disadvantage from farther away', () => {
    const target = makeCreature({ conditions: [{ id: 'prone' }] });
    expect(attackRoll(fighter, target, rng(10, 10), sword).roll!.mode).toBe('advantage');
    expect(attackRoll(fighter, target, rng(10, 10), bow).roll!.mode).toBe('disadvantage');
  });

  it('advantage and disadvantage cancel (invisible attacker, poisoned attacker)', () => {
    const attacker = makeCreature({ conditions: [{ id: 'invisible' }, { id: 'poisoned' }] });
    const r = attackRoll(attacker, goblin, rng(10), sword);
    expect(r.roll!.mode).toBe('normal');
    expect(r.log.text).toContain('(advantage: invisible; disadvantage: poisoned)');
  });

  // PHB Appendix A: Paralyzed / Unconscious. Hits from within 5 ft are critical.
  it('hits on a paralyzed target from within 5 ft are critical', () => {
    const target = makeCreature({ ac: 10, conditions: [{ id: 'paralyzed' }] });
    const near = attackRoll(fighter, target, rng(8, 3), sword);
    expect(near.critical).toBe(true);
    expect(near.log.text).toContain('CRITICAL HIT (helpless target)');
    expect(attackRoll(fighter, target, rng(8, 3), bow).critical).toBe(false);
  });

  it('a miss on a helpless target is still a miss', () => {
    const target = makeCreature({ ac: 30, conditions: [{ id: 'unconscious' }] });
    const r = attackRoll(fighter, target, rng(3, 2), sword);
    expect(r.hit).toBe(false);
    expect(r.critical).toBe(false);
  });

  it('adds Bless to the attack roll', () => {
    const bless = roll('1d4', rng(2));
    const r = attackRoll(fighter, goblin, rng(8), {
      ...sword,
      diceBonuses: [{ label: 'Bless', roll: bless }],
    });
    expect(r.hit).toBe(true);
    expect(r.log.text).toContain('d20 (8) + 5 + 2 Bless = 15');
  });
});

// PHB: Damage Rolls / Critical Hits.
describe('damage rolls', () => {
  it('rolls dice plus modifier', () => {
    const d = rollDamage([{ dice: '1d8+3', type: 'slashing' }], false, rng(6), 'Longsword');
    expect(d.total).toBe(9);
    expect(d.log.text).toBe('Longsword: 1d8+3 (6) + 3 = 9 slashing');
  });

  it('a critical hit doubles the dice but not the modifier', () => {
    const d = rollDamage([{ dice: '1d8+3', type: 'slashing' }], true, rng(6, 2), 'Longsword');
    expect(d.total).toBe(11);
    expect(d.log.text).toBe('Longsword (critical: dice doubled): 2d8+3 (6, 2) + 3 = 11 slashing');
  });

  it('keeps each damage type separate', () => {
    const d = rollDamage(
      [
        { dice: '1d6+2', type: 'piercing' },
        { dice: '2d8', type: 'radiant' },
      ],
      true,
      rng(1, 2, 3, 4, 5, 6),
    );
    expect(d.instances).toEqual([
      { amount: 5, type: 'piercing' },
      { amount: 18, type: 'radiant' },
    ]);
  });

  it('never goes below 0', () => {
    expect(rollDamage([{ dice: '1d4-3', type: 'bludgeoning' }], false, rng(1)).total).toBe(0);
  });
});

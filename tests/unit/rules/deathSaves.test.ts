import { describe, expect, it } from 'vitest';
import { deathSave, medicineStabilize, ScriptedRng, stableRecoveryHours } from '../../../src/rules';
import { dying, makeCreature } from './helpers';

const rng = (...r: number[]) => new ScriptedRng(r);

// PHB: Death Saving Throws.
describe('death saves', () => {
  it('10 or higher is a success', () => {
    const out = deathSave(dying(), rng(10));
    expect(out.outcome).toBe('success');
    expect(out.creature.deathSaves).toEqual({ successes: 1, failures: 0 });
    expect(out.log[0]!.text).toBe(
      'Hero death save: d20 (10) vs DC 10 → SUCCESS (1 success, 0 failure)',
    );
  });

  it('9 or lower is a failure', () => {
    const out = deathSave(dying(), rng(9));
    expect(out.outcome).toBe('failure');
    expect(out.creature.deathSaves.failures).toBe(1);
  });

  it('no modifiers apply (a high Con does not help)', () => {
    const c = dying({
      abilities: { str: 10, dex: 10, con: 20, int: 10, wis: 10, cha: 10 },
      saveProficiencies: ['con'],
    });
    expect(deathSave(c, rng(9)).outcome).toBe('failure');
  });

  it('a natural 1 counts as two failures', () => {
    const out = deathSave(dying(), rng(1));
    expect(out.creature.deathSaves.failures).toBe(2);
    expect(out.log[0]!.text).toContain('NATURAL 1, two failures');
  });

  it('a natural 20 brings the hero back with 1 HP', () => {
    const out = deathSave(dying({ deathSaves: { successes: 0, failures: 2 } }), rng(20));
    expect(out.outcome).toBe('revived');
    expect(out.creature.hp).toBe(1);
    expect(out.creature.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(out.creature.conditions.map((c) => c.id)).not.toContain('unconscious');
  });

  it('three successes: stable', () => {
    const out = deathSave(dying({ deathSaves: { successes: 2, failures: 2 } }), rng(15));
    expect(out.outcome).toBe('stable');
    expect(out.creature.stable).toBe(true);
    expect(out.creature.hp).toBe(0);
  });

  it('three failures: dead', () => {
    const out = deathSave(dying({ deathSaves: { successes: 2, failures: 2 } }), rng(5));
    expect(out.outcome).toBe('dead');
    expect(out.creature.dead).toBe(true);
  });

  it('a natural 1 at one failure kills', () => {
    expect(
      deathSave(dying({ deathSaves: { successes: 0, failures: 1 } }), rng(1)).creature.dead,
    ).toBe(true);
  });

  it('only dying creatures roll', () => {
    expect(() => deathSave(makeCreature(), rng(10))).toThrow(/not dying/);
    expect(() => deathSave(dying({ stable: true }), rng(10))).toThrow(/not dying/);
  });
});

// PHB: Stabilizing a Creature.
describe('stabilizing', () => {
  it('a DC 10 Medicine check stabilizes', () => {
    const healer = makeCreature({
      name: 'Cleric',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    });
    const out = medicineStabilize(healer, dying(), rng(6), true);
    expect(out.patient.stable).toBe(true);
    expect(out.log[0]!.text).toBe('Cleric Medicine check: d20 (6) + 4 = 10 vs DC 10 → SUCCESS');
  });

  it('a failed check does nothing', () => {
    expect(medicineStabilize(makeCreature(), dying(), rng(9)).patient.stable).toBe(false);
  });

  it('a stable creature wakes with 1 HP after 1d4 hours', () => {
    expect(stableRecoveryHours(rng(3))).toBe(3);
  });
});

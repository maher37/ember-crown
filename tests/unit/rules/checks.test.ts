import { describe, expect, it } from 'vitest';
import { abilityCheck, roll, savingThrow, ScriptedRng } from '../../../src/rules';
import { makeCreature } from './helpers';

const rng = (...r: number[]) => new ScriptedRng(r);

// PHB: Ability Checks.
describe('ability checks', () => {
  it('succeeds when the total meets the DC', () => {
    const c = makeCreature({ abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    const r = abilityCheck(c, 'str', 15, rng(13));
    expect(r.total).toBe(15);
    expect(r.success).toBe(true);
    expect(r.log.text).toBe('Hero Str check: d20 (13) + 2 = 15 vs DC 15 → SUCCESS');
  });

  it('fails one below the DC', () => {
    expect(abilityCheck(makeCreature(), 'str', 15, rng(14)).success).toBe(false);
  });

  it('adds proficiency, and double proficiency with expertise', () => {
    const c = makeCreature({ proficiencyBonus: 3 });
    expect(abilityCheck(c, 'dex', 10, rng(5), { proficient: true }).total).toBe(8);
    expect(abilityCheck(c, 'dex', 10, rng(5), { proficient: true, expertise: true }).total).toBe(
      11,
    );
  });

  it('labels skill checks', () => {
    const r = abilityCheck(makeCreature(), 'wis', 10, rng(10), {
      label: 'Perception',
      proficient: true,
    });
    expect(r.log.text).toBe('Hero Perception check: d20 (10) + 2 = 12 vs DC 10 → SUCCESS');
  });

  it('a natural 20 is not an automatic success', () => {
    expect(abilityCheck(makeCreature(), 'str', 25, rng(20)).success).toBe(false);
  });

  it('adds dice bonuses such as Guidance', () => {
    const guidance = roll('1d4', rng(3));
    const r = abilityCheck(makeCreature(), 'int', 12, rng(9), {
      diceBonuses: [{ label: 'Guidance', roll: guidance }],
    });
    expect(r.total).toBe(12);
    expect(r.log.text).toContain('+ 3 Guidance');
  });

  // PHB Appendix A: Poisoned.
  it('poisoned: disadvantage', () => {
    const r = abilityCheck(
      makeCreature({ conditions: [{ id: 'poisoned' }] }),
      'str',
      10,
      rng(18, 4),
    );
    expect(r.roll.mode).toBe('disadvantage');
    expect(r.total).toBe(4);
    expect(r.log.text).toContain('disadvantage: poisoned');
  });

  // PHB Appendix A: Frightened.
  it('frightened: disadvantage only while the source is in sight', () => {
    const c = makeCreature({ conditions: [{ id: 'frightened', source: 'wraith' }] });
    expect(abilityCheck(c, 'cha', 10, rng(18, 4)).roll.mode).toBe('disadvantage');
    expect(abilityCheck(c, 'cha', 10, rng(18), { fearSourceVisible: false }).roll.mode).toBe(
      'normal',
    );
  });

  // PHB Appendix A: Exhaustion level 1.
  it('exhaustion 1: disadvantage', () => {
    expect(abilityCheck(makeCreature({ exhaustion: 1 }), 'str', 10, rng(18, 4)).roll.mode).toBe(
      'disadvantage',
    );
  });

  it('advantage from another source cancels poisoned', () => {
    const c = makeCreature({ conditions: [{ id: 'poisoned' }] });
    expect(abilityCheck(c, 'str', 10, rng(8), { advantage: ['Help'] }).roll.mode).toBe('normal');
  });

  // PHB Appendix A: Blinded / Deafened.
  it('blinded: fails checks that need sight, without rolling', () => {
    const c = makeCreature({ conditions: [{ id: 'blinded' }] });
    const r = abilityCheck(c, 'wis', 5, rng(), { needs: 'sight', label: 'Perception' });
    expect(r.autoFail).toBe(true);
    expect(r.success).toBe(false);
    expect(r.log.text).toBe('Hero Perception check: automatic FAIL (blinded) vs DC 5');
  });

  it('deafened: fails checks that need hearing', () => {
    const c = makeCreature({ conditions: [{ id: 'deafened' }] });
    expect(abilityCheck(c, 'wis', 5, rng(), { needs: 'hearing' }).autoFail).toBe(true);
    expect(abilityCheck(c, 'wis', 5, rng(10), { needs: 'sight' }).autoFail).toBe(false);
  });
});

// PHB: Saving Throws.
describe('saving throws', () => {
  it('adds proficiency automatically for proficient saves', () => {
    const c = makeCreature({
      saveProficiencies: ['con'],
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    });
    const r = savingThrow(c, 'con', 15, rng(11));
    expect(r.total).toBe(15);
    expect(r.log.text).toBe('Hero Con save: d20 (11) + 4 = 15 vs DC 15 → SUCCESS');
    expect(savingThrow(c, 'wis', 15, rng(11)).total).toBe(11);
  });

  it('a natural 20 is not an automatic success', () => {
    expect(savingThrow(makeCreature(), 'wis', 21, rng(20)).success).toBe(false);
  });

  it.each(['paralyzed', 'petrified', 'stunned', 'unconscious'] as const)(
    '%s: automatically fails Str and Dex saves, but rolls others',
    (id) => {
      const c = makeCreature({ conditions: [{ id }] });
      expect(savingThrow(c, 'str', 1, rng()).autoFail).toBe(true);
      expect(savingThrow(c, 'dex', 1, rng()).success).toBe(false);
      expect(savingThrow(c, 'con', 5, rng(10)).success).toBe(true);
    },
  );

  // PHB Appendix A: Restrained.
  it('restrained: disadvantage on Dex saves only', () => {
    const c = makeCreature({ conditions: [{ id: 'restrained' }] });
    expect(savingThrow(c, 'dex', 10, rng(15, 3)).roll.mode).toBe('disadvantage');
    expect(savingThrow(c, 'str', 10, rng(15)).roll.mode).toBe('normal');
  });

  // PHB Appendix A: Exhaustion level 3.
  it('exhaustion 3: disadvantage on saves (but not at level 2)', () => {
    expect(savingThrow(makeCreature({ exhaustion: 3 }), 'wis', 10, rng(15, 3)).roll.mode).toBe(
      'disadvantage',
    );
    expect(savingThrow(makeCreature({ exhaustion: 2 }), 'wis', 10, rng(15)).roll.mode).toBe(
      'normal',
    );
  });

  it('poisoned does not affect saves', () => {
    expect(
      savingThrow(makeCreature({ conditions: [{ id: 'poisoned' }] }), 'con', 10, rng(15)).roll.mode,
    ).toBe('normal');
  });
});

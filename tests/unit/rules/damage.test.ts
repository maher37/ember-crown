import { describe, expect, it } from 'vitest';
import {
  adjustForDefenses,
  applyDamage,
  concentrationDc,
  grantTempHp,
  heal,
  noDefenses,
  ScriptedRng,
  SeededRng,
  startConcentration,
  type Defenses,
} from '../../../src/rules';
import { dying, makeCreature } from './helpers';

const rng = (...r: number[]) => new ScriptedRng(r);
const def = (d: Partial<Defenses>): Defenses => ({ ...noDefenses(), ...d });
const texts = (l: { text: string }[]) => l.map((x) => x.text);

// PHB: Damage Resistance and Vulnerability.
describe('resistance, vulnerability and immunity', () => {
  it('resistance halves, rounding down', () => {
    expect(adjustForDefenses(9, 'fire', def({ resistances: ['fire'] })).amount).toBe(4);
  });
  it('vulnerability doubles', () => {
    expect(adjustForDefenses(9, 'fire', def({ vulnerabilities: ['fire'] })).amount).toBe(18);
  });
  it('immunity means no damage', () => {
    expect(adjustForDefenses(9, 'poison', def({ immunities: ['poison'] })).amount).toBe(0);
  });
  it('other types are unaffected', () => {
    expect(adjustForDefenses(9, 'cold', def({ resistances: ['fire'] })).amount).toBe(9);
  });
  it('resistance and vulnerability both apply: halve first, then double', () => {
    expect(
      adjustForDefenses(9, 'fire', def({ resistances: ['fire'], vulnerabilities: ['fire'] }))
        .amount,
    ).toBe(8);
  });
  it('duplicate resistances count once', () => {
    expect(adjustForDefenses(8, 'fire', def({ resistances: ['fire', 'fire'] })).amount).toBe(4);
  });
  // PHB Appendix A: Petrified.
  it('petrified creatures resist all damage', () => {
    const c = makeCreature({ hp: 10, conditions: [{ id: 'petrified' }] });
    expect(applyDamage(c, [{ amount: 7, type: 'force' }], rng()).creature.hp).toBe(7);
  });
  it('applies per damage type in a mixed hit', () => {
    const c = makeCreature({ hp: 30, maxHp: 30, defenses: def({ resistances: ['slashing'] }) });
    const out = applyDamage(
      c,
      [
        { amount: 7, type: 'slashing' },
        { amount: 4, type: 'fire' },
      ],
      rng(),
    );
    expect(out.damageTaken).toBe(7);
    expect(texts(out.log)[0]).toBe('Hero takes 7 damage [slashing resisted]');
  });
});

// PHB: Temporary Hit Points.
describe('temporary hit points', () => {
  it('are lost first', () => {
    const out = applyDamage(makeCreature({ tempHp: 5 }), [{ amount: 8, type: 'slashing' }], rng());
    expect(out.creature.tempHp).toBe(0);
    expect(out.creature.hp).toBe(7);
    expect(texts(out.log)[0]).toBe('Hero takes 8 damage (5 absorbed by temporary HP)');
  });
  it("don't stack: the higher amount wins", () => {
    expect(grantTempHp(makeCreature({ tempHp: 5 }), 3).tempHp).toBe(5);
    expect(grantTempHp(makeCreature({ tempHp: 5 }), 8).tempHp).toBe(8);
  });
});

// PHB: Dropping to 0 Hit Points.
describe('dropping to 0 HP', () => {
  it('a hero falls unconscious and prone, and is dying', () => {
    const out = applyDamage(makeCreature({ hp: 4 }), [{ amount: 6, type: 'slashing' }], rng());
    expect(out.creature.hp).toBe(0);
    expect(out.creature.dead).toBe(false);
    expect(out.creature.stable).toBe(false);
    expect(out.creature.conditions.map((c) => c.id)).toEqual(['unconscious', 'prone']);
    expect(texts(out.log)).toContain('Hero falls unconscious and is dying');
  });

  it('a monster dies (Rules_Scope §1)', () => {
    const out = applyDamage(
      makeCreature({ kind: 'monster', name: 'Goblin', hp: 4 }),
      [{ amount: 6, type: 'slashing' }],
      rng(),
    );
    expect(out.creature.dead).toBe(true);
    expect(texts(out.log)).toContain('Goblin dies (reduced to 0 HP)');
  });

  it('a named villain falls unconscious and stable (Rules_Scope §1)', () => {
    const out = applyDamage(
      makeCreature({ kind: 'villain', hp: 4 }),
      [{ amount: 6, type: 'fire' }],
      rng(),
    );
    expect(out.creature.dead).toBe(false);
    expect(out.creature.stable).toBe(true);
  });

  // PHB: Instant Death.
  it('instant death when leftover damage reaches the hit point maximum', () => {
    const c = makeCreature({ hp: 6, maxHp: 12 });
    expect(applyDamage(c, [{ amount: 18, type: 'fire' }], rng()).creature.dead).toBe(true);
    expect(applyDamage(c, [{ amount: 17, type: 'fire' }], rng()).creature.dead).toBe(false);
  });

  // PHB: Knocking a Creature Out.
  it('a melee attack can knock a creature out instead (unconscious, stable)', () => {
    const goblin = makeCreature({ kind: 'monster', hp: 3 });
    const out = applyDamage(goblin, [{ amount: 5, type: 'bludgeoning' }], rng(), {
      melee: true,
      knockOut: true,
    });
    expect(out.creature.dead).toBe(false);
    expect(out.creature.stable).toBe(true);
    expect(out.creature.conditions.map((c) => c.id)).toContain('unconscious');
  });

  it('knockouts need a melee attack', () => {
    const goblin = makeCreature({ kind: 'monster', hp: 3 });
    const out = applyDamage(goblin, [{ amount: 5, type: 'piercing' }], rng(), {
      melee: false,
      knockOut: true,
    });
    expect(out.creature.dead).toBe(true);
  });

  it('massive damage kills even when trying to knock out', () => {
    const c = makeCreature({ hp: 2, maxHp: 10 });
    expect(
      applyDamage(c, [{ amount: 12, type: 'bludgeoning' }], rng(), { melee: true, knockOut: true })
        .creature.dead,
    ).toBe(true);
  });

  it('dropping to 0 ends concentration', () => {
    const out = applyDamage(
      makeCreature({ hp: 3, concentration: 'bless' }),
      [{ amount: 5, type: 'fire' }],
      rng(),
    );
    expect(out.creature.concentration).toBeNull();
    expect(out.concentrationSave).toBeUndefined();
  });

  it('does nothing to the dead', () => {
    const dead = makeCreature({ hp: 0, dead: true });
    expect(applyDamage(dead, [{ amount: 5, type: 'fire' }], rng()).creature).toBe(dead);
  });
});

// PHB: Damage at 0 Hit Points.
describe('damage at 0 HP', () => {
  it('causes one death-save failure', () => {
    const out = applyDamage(dying(), [{ amount: 3, type: 'slashing' }], rng());
    expect(out.creature.deathSaves.failures).toBe(1);
    expect(out.creature.dead).toBe(false);
  });

  it('a critical hit causes two', () => {
    const out = applyDamage(dying(), [{ amount: 3, type: 'slashing' }], rng(), { critical: true });
    expect(out.creature.deathSaves.failures).toBe(2);
  });

  it('the third failure kills', () => {
    const c = dying({ deathSaves: { successes: 2, failures: 2 } });
    expect(applyDamage(c, [{ amount: 1, type: 'slashing' }], rng()).creature.dead).toBe(true);
  });

  it('damage at or above the hit point maximum kills outright', () => {
    expect(
      applyDamage(dying({ maxHp: 10 }), [{ amount: 10, type: 'fire' }], rng()).creature.dead,
    ).toBe(true);
  });

  it('a stable creature that takes damage starts dying again', () => {
    const out = applyDamage(dying({ stable: true }), [{ amount: 2, type: 'fire' }], rng());
    expect(out.creature.stable).toBe(false);
    expect(out.creature.deathSaves.failures).toBe(1);
  });
});

// PHB: Concentration.
describe('concentration', () => {
  it('the DC is 10 or half the damage, whichever is higher', () => {
    expect(concentrationDc(1)).toBe(10);
    expect(concentrationDc(21)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
    expect(concentrationDc(45)).toBe(22);
  });

  it('a successful Con save keeps the spell', () => {
    const c = makeCreature({ hp: 20, maxHp: 20, concentration: 'bless' });
    const out = applyDamage(c, [{ amount: 4, type: 'slashing' }], rng(10));
    expect(out.creature.concentration).toBe('bless');
    expect(out.concentrationSave!.dc).toBe(10);
    expect(texts(out.log)[1]).toBe(
      'Hero Con (concentration) save: d20 (10) + 0 = 10 vs DC 10 → SUCCESS',
    );
  });

  it('a failed save ends the spell', () => {
    const c = makeCreature({ hp: 40, maxHp: 40, concentration: 'hold-person' });
    const out = applyDamage(c, [{ amount: 24, type: 'fire' }], rng(11));
    expect(out.concentrationSave!.dc).toBe(12);
    expect(out.creature.concentration).toBeNull();
    expect(texts(out.log)).toContain('Hero loses concentration on hold-person');
  });

  it('damage soaked by temporary HP still forces a save', () => {
    const c = makeCreature({ tempHp: 10, concentration: 'bless' });
    expect(applyDamage(c, [{ amount: 4, type: 'fire' }], rng(15)).concentrationSave).toBeDefined();
  });

  it('no damage (immunity), no save', () => {
    const c = makeCreature({ concentration: 'bless', defenses: def({ immunities: ['poison'] }) });
    expect(
      applyDamage(c, [{ amount: 9, type: 'poison' }], rng()).concentrationSave,
    ).toBeUndefined();
  });

  it('starting a new concentration spell ends the old one', () => {
    const { creature, log } = startConcentration(makeCreature({ concentration: 'bless' }), 'hex');
    expect(creature.concentration).toBe('hex');
    expect(texts(log)).toEqual(['Hero stops concentrating on bless', 'Hero concentrates on hex']);
  });
});

// PHB: Healing.
describe('healing', () => {
  it("can't go above the hit point maximum", () => {
    const out = heal(makeCreature({ hp: 7, maxHp: 10 }), 8, 'Cure Wounds');
    expect(out.healed).toBe(3);
    expect(out.creature.hp).toBe(10);
    expect(texts(out.log)[0]).toBe('Hero regains 3 HP from Cure Wounds (10/10)');
  });

  it('wakes a dying creature, clears death saves, but it stays prone', () => {
    const out = heal(dying({ deathSaves: { successes: 1, failures: 2 } }), 4, 'Healing Word');
    expect(out.creature.hp).toBe(4);
    expect(out.creature.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(out.creature.conditions.map((c) => c.id)).toEqual(['prone']);
  });

  it("doesn't work on the dead", () => {
    expect(heal(makeCreature({ hp: 0, dead: true }), 10).creature.hp).toBe(0);
  });

  it('respects the exhaustion-4 halved maximum', () => {
    expect(heal(makeCreature({ hp: 2, maxHp: 10, exhaustion: 4 }), 10).creature.hp).toBe(5);
  });
});

describe('determinism', () => {
  it('the same seed gives the same outcome', () => {
    const run = () =>
      applyDamage(
        makeCreature({ hp: 30, maxHp: 30, concentration: 'bless' }),
        [{ amount: 12, type: 'fire' }],
        new SeededRng(99),
      );
    expect(run()).toEqual(run());
  });
});

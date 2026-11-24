// Beast special moves (SRD 5.1): Charge, Pounce, Relentless, and the giant elk's Hooves.
import { describe, expect, it } from 'vitest';
import { act, attackOptions } from '../../src/game/combat';
import { dealDamage } from '../../src/game/combat/core';
import { setCompanionForm } from '../../src/game/companion';
import type { Hero } from '../../src/game/hero';
import { hasCondition, SeededRng } from '../../src/rules';
import type { CombatState } from '../../src/game/combat';
import { arrange, fight, L, party, texts, withSeed } from './combat/arrange';

const ranger = (form: string): Hero =>
  setCompanionForm({ ...L('ranger', 'Kael', 3), subclassId: 'beast-master' }, form);
const ID = 'kael-companion';

/** The companion next to a sturdy foe, having run `run` feet straight at it this turn. */
function ready(form: string, run: number, seed = 1): { s: CombatState; foe: string } {
  const base = fight('f13-cloister', party(ranger(form), 3), seed);
  const s = arrange(base, { [ID]: { x: 5, y: 4 } }, ID);
  const foe = Object.values(s.combatants).find((c) => c.side === 'enemy')!;
  foe.pos = { x: 6, y: 4 };
  foe.creature = { ...foe.creature, hp: 99, maxHp: 99, ac: 1 };
  s.combatants[ID]!.turn.startPos = { x: 5 - run / 5, y: 4 };
  return { s, foe: foe.id };
}
const hit = (s: CombatState, foe: string, optionId: string) =>
  act(s, { type: 'attack', targetId: foe, optionId }).state;

describe('Charge (SRD: boar, giant elk)', () => {
  it('a tusk hit after a 20-ft run deals 1d6 extra and forces a DC 11 Str save', () => {
    const { s, foe } = ready('boar', 20);
    const out = hit(s, foe, 'tusk');
    expect(texts(out)).toMatch(/Charge! .* hits at a run/);
    expect(texts(out)).toMatch(/Str \(Charge\)/);
  });

  it('no charge without the run', () => {
    const { s, foe } = ready('boar', 5);
    expect(texts(hit(s, foe, 'tusk'))).not.toMatch(/Charge!/);
  });

  it('a failed save knocks the target prone', () => {
    const out = withSeed(
      (seed) => {
        const { s, foe } = ready('boar', 20, seed);
        return hit(s, foe, 'tusk');
      },
      (x) =>
        Object.values(x.combatants).some(
          (c) => c.side === 'enemy' && hasCondition(c.creature, 'prone'),
        ),
    );
    expect(texts(out)).toMatch(/knocked prone/);
  });
});

describe('Pounce (SRD: panther)', () => {
  it('a claw after a 20-ft run, then a bite as a bonus action if the target is prone', () => {
    const out = withSeed(
      (seed) => {
        const { s, foe } = ready('panther', 20, seed);
        return hit(s, foe, 'claw');
      },
      (x) => /knocked prone/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/Pounce!/);
    expect(out.combatants[ID]!.turn.bonusUsed).toBe(true);
    expect(texts(out)).toMatch(/Bite/);
  });
});

describe('Relentless (SRD: boar)', () => {
  it('7 damage or less that would drop it leaves it at 1 HP, once a fight', () => {
    const { s } = ready('boar', 0);
    const ctx = { s, rng: new SeededRng(1) };
    const boar = s.combatants[ID]!;
    boar.creature = { ...boar.creature, hp: 3 };
    dealDamage(ctx, boar, [{ amount: 5, type: 'slashing' }]);
    expect(boar.creature.hp).toBe(1);
    expect(texts(s)).toMatch(/Relentless/);
    dealDamage(ctx, boar, [{ amount: 5, type: 'slashing' }]);
    expect(boar.creature.hp).toBe(0);
  });

  it('more than 7 damage drops it', () => {
    const { s } = ready('boar', 0);
    const boar = s.combatants[ID]!;
    boar.creature = { ...boar.creature, hp: 3 };
    dealDamage({ s, rng: new SeededRng(1) }, boar, [{ amount: 9, type: 'slashing' }]);
    expect(boar.creature.hp).toBe(0);
  });
});

describe('Hooves (SRD: giant elk)', () => {
  it('only against a prone creature', () => {
    const { s, foe } = ready('wolf', 0);
    s.combatants[ID]!.monsterId = 'giant-elk';
    expect(attackOptions(s.combatants[ID]!).some((o) => o.id === 'hooves')).toBe(true);
    const r = act(s, { type: 'attack', targetId: foe, optionId: 'hooves' });
    expect(r.error).toMatch(/only against a prone creature/);
    const t = s.combatants[foe]!;
    t.creature = { ...t.creature, conditions: [...t.creature.conditions, { id: 'prone' }] };
    expect(act(s, { type: 'attack', targetId: foe, optionId: 'hooves' }).error).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { monsters } from '../../src/data';
import type { Effect } from '../../src/data/schemas/common';
import { foeToCreature, getMonster, monsterToCreature } from '../../src/game/creatures';
import { applyDamage, attackRoll, rollDamage, SeededRng, type DamagePart } from '../../src/rules';

describe('monster data in the rules engine', () => {
  it('turns a goblin into a creature', () => {
    const g = monsterToCreature(getMonster('goblin'), 'goblin-1', 'Goblin 1');
    expect(g).toMatchObject({
      id: 'goblin-1',
      kind: 'monster',
      ac: 15,
      hp: 7,
      maxHp: 7,
      proficiencyBonus: 2,
    });
    expect(g.hitDice).toEqual({ die: 6, total: 2, remaining: 2 });
  });

  it('copies damage defenses', () => {
    const s = monsterToCreature(getMonster('skeleton'));
    expect(s.defenses.vulnerabilities).toEqual(['bludgeoning']);
    expect(s.defenses.immunities).toEqual(['poison']);
  });

  it('uses CR for proficiency', () => {
    expect(monsterToCreature(getMonster('wraith')).proficiencyBonus).toBe(3);
    expect(monsterToCreature(getMonster('fire-giant')).proficiencyBonus).toBe(4);
  });

  it('makes villains fall unconscious instead of dying', () => {
    const ulric = foeToCreature('brother-ulric');
    expect(ulric.kind).toBe('villain');
    const out = applyDamage(ulric, [{ amount: 40, type: 'slashing' }], new SeededRng(1));
    expect(out.creature.dead).toBe(false);
    expect(out.creature.stable).toBe(true);
  });

  it('every monster attack in the data can be rolled by the engine', () => {
    const rng = new SeededRng(2026);
    const target = monsterToCreature(getMonster('veteran'));
    let attacks = 0;
    for (const m of monsters) {
      const me = monsterToCreature(m);
      for (const action of m.actions)
        for (const e of action.effects as Effect[]) {
          if (e.type !== 'attack') continue;
          attacks++;
          const r = attackRoll(me, target, rng, {
            attackBonus: e.toHit ?? 0,
            melee: e.kind === 'melee',
            within5ft: true,
            label: action.name,
          });
          expect(r.log.text).toMatch(/vs AC 17 →/);
          const parts: DamagePart[] = e.onHit.flatMap((x) =>
            x.type === 'damage' ? [{ dice: x.dice, type: x.damageType }] : [],
          );
          if (parts.length) expect(rollDamage(parts, true, rng).total).toBeGreaterThanOrEqual(0);
        }
    }
    expect(attacks).toBeGreaterThan(60);
  });
});

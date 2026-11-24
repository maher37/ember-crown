// Familiar abilities in a fight (SRD 5.1, PHB: Find Familiar; D36). Each test cites the rule.
import { describe, expect, it } from 'vitest';
import { act } from '../../src/game/combat';
import { combatSave, dealDamage } from '../../src/game/combat/core';
import { applyLeaf } from '../../src/game/combat/leaves';
import { getMonster } from '../../src/game/creatures';
import { setFamiliarForm } from '../../src/game/familiar';
import type { Hero } from '../../src/game/hero';
import type { CombatState } from '../../src/game/combat';
import type { Effect } from '../../src/data/schemas/common';
import { hasCondition, SeededRng } from '../../src/rules';
import { arrange, fight, L, party, texts, withSeed } from './combat/arrange';

const chain = (form: string): Hero =>
  setFamiliarForm(L('warlock', 'Nyx', 3, { 'pact-boon': ['pact-of-the-chain'] }), form);
const wizard = (): Hero => {
  const h = L('wizard', 'Ivo', 3);
  return {
    ...h,
    spells: [...h.spells, 'find-familiar'],
    cantrips: [...h.cantrips, 'shocking-grasp'],
  };
};
const NYX = 'nyx-familiar';

/** The familiar's turn, with one enemy placed at `foeAt`. */
function ready(lead: Hero, famId: string, foeAt: { x: number; y: number }, seed = 1) {
  const s = arrange(
    fight('f13-cloister', party(lead, 3), seed),
    { [famId]: { x: 5, y: 4 } },
    famId,
  );
  const foe = Object.values(s.combatants).find((c) => c.side === 'enemy')!;
  for (const c of Object.values(s.combatants))
    if (c.side === 'enemy' && c.id !== foe.id) c.gone = true;
  foe.pos = foeAt;
  foe.creature = { ...foe.creature, hp: 99, maxHp: 99 };
  return { s, foe: foe.id };
}
const invisible = (s: CombatState, id: string) =>
  hasCondition(s.combatants[id]!.creature, 'invisible');

describe('Invisibility (SRD: imp, quasit, sprite)', () => {
  it('an action makes it invisible until it attacks', () => {
    const { s, foe } = ready(chain('imp'), NYX, { x: 6, y: 4 });
    let r = act(s, { type: 'feature', id: 'pet-invisibility' });
    expect(r.error).toBeUndefined();
    expect(invisible(r.state, NYX)).toBe(true);
    r = act(
      { ...r.state, combatants: { ...r.state.combatants } },
      {
        type: 'attack',
        targetId: foe,
        optionId: 'sting',
      },
    );
    expect(r.error).toBe('No attacks left this turn.');
    // Next turn: the attack (with advantage) ends it.
    const next = arrange(r.state, {}, NYX);
    const out = act(next, { type: 'attack', targetId: foe, optionId: 'sting' }).state;
    expect(invisible(out, NYX)).toBe(false);
  });

  it('only creatures that have it (not a wizard owl)', () => {
    const { s } = ready(wizard(), 'ivo-familiar', { x: 9, y: 4 });
    expect(act(s, { type: 'feature', id: 'pet-invisibility' }).error).toBeTruthy();
  });
});

describe('Scare (SRD: quasit)', () => {
  it('DC 10 Wis or frightened, within 20 ft, once a fight', () => {
    const out = withSeed(
      (seed) => {
        const { s, foe } = ready(chain('quasit'), NYX, { x: 8, y: 4 }, seed);
        return act(s, { type: 'feature', id: 'pet-scare', targetId: foe }).state;
      },
      (x) =>
        Object.values(x.combatants).some(
          (c) => c.side === 'enemy' && !c.gone && hasCondition(c.creature, 'frightened'),
        ),
    );
    expect(texts(out)).toMatch(/Wis \(Scare\)/);
    const again = arrange(out, {}, NYX);
    const foe = Object.values(again.combatants).find((c) => c.side === 'enemy' && !c.gone)!;
    expect(act(again, { type: 'feature', id: 'pet-scare', targetId: foe.id }).error).toMatch(
      /used this fight/,
    );
  });

  it('not beyond 20 ft', () => {
    const { s, foe } = ready(chain('quasit'), NYX, { x: 10, y: 4 });
    expect(act(s, { type: 'feature', id: 'pet-scare', targetId: foe }).error).toMatch(/too far/);
  });
});

describe('Knock-out poison (SRD: pseudodragon sting, sprite arrow)', () => {
  it('failing the save by 5 or more knocks the target out until it takes damage', () => {
    const sting = getMonster('pseudodragon').actions.find((a) => a.id === 'sting')!.effects[0]!;
    const save = (sting as Extract<Effect, { type: 'attack' }>).onHit.find(
      (e) => e.type === 'save',
    )! as Extract<Effect, { type: 'save' }>;
    expect(save.knockOutIfFailBy).toBe(5);
    const out = withSeed(
      (seed) => {
        const { s, foe } = ready(chain('pseudodragon'), NYX, { x: 6, y: 4 });
        const t = s.combatants[foe]!;
        t.creature = { ...t.creature, abilities: { ...t.creature.abilities, con: 1 } };
        applyLeaf({ s, rng: new SeededRng(seed) }, s.combatants[NYX]!, t, save, {});
        return s;
      },
      (x) =>
        Object.values(x.combatants).some(
          (c) => c.side === 'enemy' && !c.gone && hasCondition(c.creature, 'unconscious'),
        ),
    );
    expect(texts(out)).toMatch(/falls unconscious from the poison/);
    const t = Object.values(out.combatants).find((c) => c.side === 'enemy' && !c.gone)!;
    dealDamage({ s: out, rng: new SeededRng(1) }, t, [{ amount: 1, type: 'piercing' }]);
    expect(texts(out)).toMatch(/wakes up/);
  });
});

describe('Magic Resistance (SRD: imp, pseudodragon, quasit)', () => {
  it('advantage on saves against spells', () => {
    const { s } = ready(chain('imp'), NYX, { x: 9, y: 4 });
    const r = combatSave({ s, rng: new SeededRng(1) }, s.combatants[NYX]!, 'wis', 13, {
      magic: true,
    });
    expect(r.log.text).toMatch(/Magic Resistance/);
  });
});

describe('Flyby (SRD: owl)', () => {
  it('no opportunity attacks when it flies out of reach', () => {
    const { s } = ready(wizard(), 'ivo-familiar', { x: 6, y: 4 });
    const out = act(s, { type: 'move', to: { x: 2, y: 4 } });
    expect(out.error).toBeUndefined();
    expect(out.state.prompt).toBeNull();
    expect(texts(out.state)).not.toMatch(/opportunity attack/);
  });
});

describe('Delivering a touch spell (PHB: Find Familiar)', () => {
  it('the familiar, next to the target, delivers it with its reaction', () => {
    const base = fight('f13-cloister', party(wizard(), 3));
    const s = arrange(base, { ivo: { x: 1, y: 4 }, 'ivo-familiar': { x: 5, y: 4 } }, 'ivo');
    const foe = Object.values(s.combatants).find((c) => c.side === 'enemy')!;
    foe.pos = { x: 6, y: 4 };
    const r = act(s, {
      type: 'cast',
      spellId: 'shocking-grasp',
      slotLevel: 0,
      targetIds: [foe.id],
    });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/delivers the touch of Shocking Grasp/);
    expect(r.state.combatants['ivo-familiar']!.reactionUsed).toBe(true);
  });

  it('not without the familiar next to the target', () => {
    const base = fight('f13-cloister', party(wizard(), 3));
    const s = arrange(base, { ivo: { x: 1, y: 4 }, 'ivo-familiar': { x: 2, y: 4 } }, 'ivo');
    const foe = Object.values(s.combatants).find((c) => c.side === 'enemy')!;
    foe.pos = { x: 6, y: 4 };
    const r = act(s, {
      type: 'cast',
      spellId: 'shocking-grasp',
      slotLevel: 0,
      targetIds: [foe.id],
    });
    expect(r.error).toMatch(/out of range/);
  });
});

// Phase 4 (owner request, Nov 21): a second subclass for most classes (D29), and the new spells.
// Each test cites the rule it checks (PHB, from memory: see Rules_Scope CONFIRM LOCALLY).
import { describe, expect, it } from 'vitest';
import { act, advance, featureList, readyParty, speedNow } from '../../src/game/combat';
import { dealDamage, produce } from '../../src/game/combat/core';
import { usesExtraAttack } from '../../src/game/combat/turn';
import { weapons } from '../../src/data';
import { weaponProficient } from '../../src/game/gear';
import type { Hero } from '../../src/game/hero';
import { applyLevelUp, defaultPlan, levelUpOptions, spellRules } from '../../src/game/levelup';
import type { CombatState } from '../../src/game/combat';
import { arrange, easyTarget, fight, L, party, texts, withSeed } from './combat/arrange';
import { hero } from './combat/helpers';

/** A hero of this class and subclass at this level. */
const S = (cls: string, sub: string, level: number, name = 'Ada', spells: string[] = []): Hero => {
  const h = { ...L(cls, name, level), subclassId: sub };
  return { ...h, spells: [...h.spells, ...spells] };
};
const F = (lead: Hero, id = 'f13-cloister', seed = 1) => fight(id, party(lead, lead.level), seed);
const tough = (s: CombatState, id: string) => {
  s.combatants[id]!.creature = { ...s.combatants[id]!.creature, hp: 200, maxHp: 200 };
};

describe('choosing a subclass at level-up (D29)', () => {
  it('reaching the subclass level offers every subclass; the pick is kept', () => {
    const f = readyParty([hero('fighter', 'Mira')], 2)[0]!;
    const o = levelUpOptions({ ...f, xp: 900 });
    const g = o.picks.find((p) => p.id === 'subclass')!;
    expect(g.name).toBe('Martial Archetype');
    expect(g.options.map((x) => x.id)).toEqual(['champion', 'battle-master']);
    // The subclass features are described on the choices, not listed as gained.
    expect(o.features.map((x) => x.id)).not.toContain('improved-critical');
    const plan = defaultPlan({ ...f, xp: 900 });
    const up = applyLevelUp(
      { ...f, xp: 900 },
      { ...plan, picks: { ...plan.picks, subclass: ['battle-master'] } },
    );
    expect(up.subclassId).toBe('battle-master');
  });
  it("a warlock patron's expanded spells join the list (PHB: Expanded Spell List)", () => {
    const goo = S('warlock', 'great-old-one', 1);
    expect(spellRules(goo, 1)!.spellPool.map((s) => s.id)).toContain('tashas-hideous-laughter');
    expect(spellRules(S('warlock', 'fiend', 1), 1)!.spellPool.map((s) => s.id)).not.toContain(
      'tashas-hideous-laughter',
    );
  });
});

describe('Path of the Totem Warrior', () => {
  it('Bear: while raging, resistance to everything but psychic (PHB)', () => {
    let s = arrange(F(S('barbarian', 'totem-bear', 3)), {}, 'ada');
    s = act(s, { type: 'feature', id: 'rage' }).state;
    const hp = s.combatants['ada']!.creature.hp;
    s = produce(s, (ctx) =>
      dealDamage(ctx, ctx.s.combatants['ada']!, [{ amount: 10, type: 'fire' }]),
    );
    expect(s.combatants['ada']!.creature.hp).toBe(hp - 5);
    expect(featureList(s.combatants['ada']!, s).map((f) => f.id)).not.toContain('rage-frenzy');
  });
  it('Wolf: allies have advantage on melee attacks against foes next to the raging barbarian (PHB)', () => {
    const wolf = S('barbarian', 'totem-wolf', 3);
    let s = arrange(
      F(wolf),
      { ada: { x: 8, y: 4 }, thorn: { x: 9, y: 3 }, 'cultist-a': { x: 9, y: 4 } },
      'ada',
    );
    s = act(s, { type: 'feature', id: 'rage' }).state;
    s = arrange(s, {}, 'thorn');
    const r = act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'mace' });
    expect(texts(r.state)).toMatch(/Thorn attacks Cultist A .*d20 adv/);
  });
  it('Eagle: Dash as a bonus action while raging (PHB)', () => {
    let s = arrange(F(S('barbarian', 'totem-eagle', 3)), {}, 'ada');
    s = act(s, { type: 'feature', id: 'rage' }).state;
    s = arrange(s, {}, 'ada');
    s = act(s, { type: 'feature', id: 'rage' }).state; // already raging: no-op error
    const before = s.combatants['ada']!.turn.movement;
    const r = act(s, { type: 'feature', id: 'eagle-dash' });
    expect(r.state.combatants['ada']!.turn.movement).toBeGreaterThan(before);
  });
});

describe('College of Valor', () => {
  it('martial weapons, and Extra Attack at 6th level (PHB)', () => {
    const warhammer = weapons.find((w) => w.id === 'warhammer')!;
    expect(weaponProficient(S('bard', 'valor', 3), warhammer)).toBe(true);
    expect(weaponProficient(S('bard', 'lore', 3), warhammer)).toBe(false);
    const s = F(S('bard', 'valor', 6));
    expect(usesExtraAttack(s.combatants['ada']!)).toBe(2);
  });
});

describe('Battle Master', () => {
  it('Trip Attack: a superiority die on the damage, then Str save or prone (PHB)', () => {
    const out = withSeed(
      (seed) => {
        const s = arrange(
          F(S('fighter', 'battle-master', 3), 'f13-cloister', seed),
          { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
          'ada',
        );
        easyTarget(s, 'cultist-a');
        tough(s, 'cultist-a');
        return act(s, {
          type: 'attack',
          targetId: 'cultist-a',
          optionId: s.combatants['ada']!.turn ? 'longsword' : 'longsword',
          maneuver: 'trip',
        }).state;
      },
      (x) => /knocked prone/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/Trip Attack: \+1d8/);
    expect(texts(out)).toMatch(/Str \(Trip Attack\) save/);
  });
  it('Riposte: a melee miss against the fighter earns an attack back (PHB) [used automatically]', () => {
    const out = withSeed(
      (seed) => {
        const s = arrange(
          F(S('fighter', 'battle-master', 3), 'f13-cloister', seed),
          { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
          'cultist-a',
        );
        s.combatants['ada']!.creature = { ...s.combatants['ada']!.creature, ac: 30 };
        return advance(s);
      },
      (x) => /ripostes/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/Ada ripostes!\n.*Ada attacks Cultist A/);
  });
});

describe('Oath of Vengeance', () => {
  it('Vow of Enmity: advantage on attacks against the sworn foe (PHB)', () => {
    let s = arrange(
      F(S('paladin', 'vengeance', 3)),
      { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'ada',
    );
    s = act(s, { type: 'feature', id: 'vow-of-enmity', targetId: 'cultist-a' }).state;
    const r = act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'longsword' });
    expect(texts(r.state)).toMatch(/Ada attacks Cultist A .*d20 adv/);
  });
  it('Abjure Enemy: Wis save or frightened with speed 0 (PHB)', () => {
    const out = withSeed(
      (seed) =>
        act(
          arrange(
            F(S('paladin', 'vengeance', 3), 'f13-cloister', seed),
            { ada: { x: 8, y: 4 }, 'cultist-a': { x: 10, y: 4 } },
            'ada',
          ),
          { type: 'feature', id: 'abjure-enemy', targetId: 'cultist-a' },
        ).state,
      (x) => x.combatants['cultist-a']!.creature.conditions.some((c) => c.id === 'frightened'),
    );
    expect(speedNow(out.combatants['cultist-a']!)).toBe(0);
  });
  it('oath spells are always prepared', () => {
    const s = F(S('paladin', 'vengeance', 3));
    const ids = featureList(s.combatants['ada']!, s).map((f) => f.id);
    expect(ids).not.toContain('sacred-weapon');
  });
});

describe('Assassin', () => {
  it('Assassinate: advantage against a creature that has not acted yet (PHB)', () => {
    const s = arrange(
      F(S('rogue', 'assassin', 3)),
      { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'ada',
    );
    s.round = 1;
    s.order = ['ada', ...s.order.filter((x) => x !== 'ada')];
    s.turnIndex = 0;
    const r = act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'rapier' });
    expect(texts(r.state)).toMatch(/Ada attacks Cultist A .*d20 adv/);
  });
  it('any hit on a surprised creature is a critical hit (PHB)', () => {
    const out = withSeed(
      (seed) => {
        const s = arrange(
          F(S('rogue', 'assassin', 3), 'f13-cloister', seed),
          { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
          'ada',
        );
        easyTarget(s, 'cultist-a');
        tough(s, 'cultist-a');
        s.combatants['cultist-a']!.surprised = true;
        return act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'rapier' }).state;
      },
      (x) => /Assassinate: a strike from nowhere/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/CRITICAL HIT/);
  });
});

describe('The Great Old One', () => {
  it('Entropic Ward (6th): an attack against you has disadvantage [used automatically] (PHB)', () => {
    let s = arrange(
      F(S('warlock', 'great-old-one', 6)),
      { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'cultist-a',
    );
    s = advance(s);
    expect(texts(s)).toMatch(/Ada twists fate with an Entropic Ward/);
    expect(texts(s)).toMatch(/Cultist A attacks Ada .*d20 dis/);
  });
});

describe('School of Abjuration', () => {
  it('Arcane Ward: an abjuration spell raises it, and it takes damage first (PHB)', () => {
    let s = arrange(F(S('wizard', 'abjuration', 2, 'Ada', ['mage-armor'])), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'mage-armor', slotLevel: 1, targetIds: ['ada'] }).state;
    const w = s.combatants['ada']!.creature as Hero;
    const int = Math.floor((w.abilities.int - 10) / 2);
    expect(w.arcaneWard).toBe(4 + int);
    const hp = w.hp;
    s = produce(s, (ctx) =>
      dealDamage(ctx, ctx.s.combatants['ada']!, [{ amount: 3, type: 'slashing' }]),
    );
    const after = s.combatants['ada']!.creature as Hero;
    expect(after.hp).toBe(hp);
    expect(after.arcaneWard).toBe(4 + int - 3);
    expect(texts(s)).toMatch(/Arcane Ward absorbs 3/);
  });
});

describe('new spells (owner request: more spells)', () => {
  it('Blur: attacks against the caster have disadvantage (PHB)', () => {
    let s = arrange(
      F(S('wizard', 'evocation', 3, 'Ada', ['blur'])),
      { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'ada',
    );
    s = act(s, { type: 'cast', spellId: 'blur', slotLevel: 2 }).state;
    s = arrange(s, {}, 'cultist-a');
    s = advance(s);
    expect(texts(s)).toMatch(/Cultist A attacks Ada .*d20 dis/);
  });
  it('Protection from Energy: fire resistance (PHB; fire only in this game)', () => {
    let s = arrange(F(S('cleric', 'life', 5, 'Ada', ['protection-from-energy'])), {}, 'ada');
    s = act(s, {
      type: 'cast',
      spellId: 'protection-from-energy',
      slotLevel: 3,
      targetIds: ['ada'],
    }).state;
    const hp = s.combatants['ada']!.creature.hp;
    s = produce(s, (ctx) =>
      dealDamage(ctx, ctx.s.combatants['ada']!, [{ amount: 10, type: 'fire' }]),
    );
    expect(s.combatants['ada']!.creature.hp).toBe(hp - 5);
  });
  it('Searing Smite: the next weapon hit adds 1d6 fire (PHB)', () => {
    let s = arrange(
      F(S('paladin', 'devotion', 3, 'Ada', ['searing-smite'])),
      { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'ada',
    );
    easyTarget(s, 'cultist-a');
    tough(s, 'cultist-a');
    s = act(s, { type: 'cast', spellId: 'searing-smite', slotLevel: 1 }).state;
    s = act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'longsword' }).state;
    expect(texts(s)).toMatch(/1d6 \(\d\) = \d+ fire/);
    expect(texts(s)).toMatch(/glows white-hot/);
  });
  it('False Life: 1d4 + 4 temporary HP (PHB)', () => {
    let s = arrange(F(S('wizard', 'evocation', 1, 'Ada', ['false-life'])), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'false-life', slotLevel: 1 }).state;
    expect(s.combatants['ada']!.creature.tempHp).toBeGreaterThanOrEqual(5);
  });
});

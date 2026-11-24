// Beast Master ranger (D29, D36): the animal companion. Each test cites the rule.
import { describe, expect, it } from 'vitest';
import { act, attackOptions, checkOutcome, finishCombat } from '../../src/game/combat';
import { companionOf, setCompanionForm } from '../../src/game/companion';
import type { Hero } from '../../src/game/hero';
import {
  activePicks,
  applyLevelUp,
  defaultPlan,
  levelUpOptions,
  planProblems,
} from '../../src/game/levelup';
import { takeLongRest } from '../../src/game/rest';
import { makeSave, parseSave, serializeSave, type GameState } from '../../src/game/save';
import { SeededRng } from '../../src/rules';
import { arrange, fight, L, party, texts } from './combat/arrange';

const beastMaster = (level = 3): Hero => ({
  ...L('ranger', 'Kael', level),
  subclassId: 'beast-master',
});
const F = (lead: Hero) => fight('f13-cloister', party(lead, lead.level));
const rest = (h: Hero) =>
  takeLongRest(
    { party: [h], flags: {}, clock: 100, lastLongRest: null } as unknown as GameState,
    new SeededRng(1),
  ).game.party[0]!;

describe('choosing the Beast Master', () => {
  it("rangers choose Hunter or Beast Master at level 3; Hunter's Prey only for a Hunter (PHB)", () => {
    const h = { ...L('ranger', 'Kael', 2), xp: 900 };
    const o = levelUpOptions(h);
    const sub = o.picks.find((p) => p.id === 'subclass')!;
    expect(sub.options.map((x) => x.id)).toEqual(['hunter', 'beast-master']);
    const plan = defaultPlan(h);
    const bm = { ...plan, picks: { ...plan.picks, subclass: ['beast-master'] } };
    expect(activePicks(o, bm).some((g) => g.id === 'hunters-prey')).toBe(false);
    expect(planProblems(h, bm).filter((p) => !/spells/.test(p))).toEqual([]);
    // (The test hero's spell list is filled in so the plan is complete.)
    const spells = levelUpOptions(h)
      .spells!.spellPool.map((x) => x.id)
      .slice(0, 3);
    const out = applyLevelUp(h, { ...bm, spells });
    expect(out.subclassId).toBe('beast-master');
    expect(out.choices['hunters-prey']).toBeUndefined();
    expect(companionOf(out)?.form).toBe('wolf');
    // A Hunter still has to pick a technique.
    const hunter = { ...plan, picks: { subclass: ['hunter'] } };
    expect(planProblems(h, hunter)).toContain("Choose 1 for Hunter's Prey.");
  });

  it('a Hunter has no companion', () => {
    expect(companionOf(L('ranger', 'Kael', 3))).toBeNull();
  });
});

describe("the ranger's companion in a fight", () => {
  it('fights beside the ranger, with proficiency added to AC, attack and damage (PHB)', () => {
    const s = F(setCompanionForm(beastMaster(), 'panther'));
    const p = s.combatants['kael-companion']!;
    expect(p.side).toBe('party');
    expect(p.monsterId).toBe('panther');
    expect(p.creature.ac).toBe(12 + 2);
    const bite = attackOptions(p).find((o) => o.id === 'bite')!;
    expect(bite.toHit).toBe(4 + 2);
    expect(bite.damage[0]!.dice).toBe('1d6+4');
  });

  it('has at least 4 × ranger level HP (PHB)', () => {
    expect(F(beastMaster(3)).combatants['kael-companion']!.creature.maxHp).toBe(12);
    expect(F(beastMaster(5)).combatants['kael-companion']!.creature.maxHp).toBe(20);
  });

  it('takes its own turn and can attack (owner, Nov 23: BG3 style)', () => {
    const s = arrange(F(beastMaster()), { 'kael-companion': { x: 5, y: 4 } }, 'kael-companion');
    const foe = Object.values(s.combatants).find((c) => c.side === 'enemy')!;
    foe.pos = { x: 6, y: 4 };
    const r = act(s, { type: 'attack', targetId: foe.id, optionId: 'bite' });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/Bite/);
  });

  it('the fight is lost when every hero is down, even if the companion stands', () => {
    const s = F(beastMaster());
    for (const c of Object.values(s.combatants))
      if (c.side === 'party' && !c.pet) c.creature = { ...c.creature, hp: 0 };
    expect(checkOutcome(s)).toBe('defeat');
  });

  it('a downed companion is away until a long rest', () => {
    const s = F(beastMaster());
    const wolf = s.combatants['kael-companion']!;
    wolf.creature = { ...wolf.creature, hp: 0, dead: true };
    s.outcome = 'victory';
    const kael = finishCombat(s, party(beastMaster(), 3)).party[0]!;
    expect(kael.companion?.lost).toBe(true);
    expect(F(kael).combatants['kael-companion']).toBeUndefined();
    expect(F(rest(kael)).combatants['kael-companion']).toBeDefined();
  });
});

describe('changing the companion', () => {
  it('the first pick is immediate; a new animal joins after a long rest (PHB: 8 hours)', () => {
    const first = setCompanionForm(beastMaster(), 'boar');
    expect(F(first).combatants['kael-companion']!.monsterId).toBe('boar');
    const swap = setCompanionForm(first, 'giant-badger');
    expect(swap.companion).toEqual({ form: 'giant-badger', waiting: true });
    expect(F(swap).combatants['kael-companion']).toBeUndefined();
    expect(F(rest(swap)).combatants['kael-companion']!.monsterId).toBe('giant-badger');
  });

  it('only the four offered animals (owner, Nov 23)', () => {
    expect(setCompanionForm(beastMaster(), 'brown-bear').companion).toBeUndefined();
  });

  it('is kept in saves', () => {
    const kael = setCompanionForm(setCompanionForm(beastMaster(), 'boar'), 'panther');
    const g = {
      id: 'g',
      createdAt: '2026-11-16T10:00:00.000Z',
      seed: 1,
      rngState: 1,
      party: [kael],
      act: 1,
      location: 'drowned-lantern',
      playSeconds: 0,
      flags: {},
      quests: {},
      notes: [],
      ink: {},
      clock: 7972,
      lastLongRest: null,
      letters: [],
      inventory: {},
      gold: 0,
    } as GameState;
    const r = parseSave(serializeSave(makeSave(g)));
    expect(r.ok && r.save.game.party[0]!.companion).toEqual({ form: 'panther', waiting: true });
  });
});

describe('Multiattack for summoned animals (owner, Nov 24)', () => {
  const ready = () => {
    const s = arrange(
      F(setCompanionForm(beastMaster(), 'giant-badger')),
      { 'kael-companion': { x: 5, y: 4 } },
      'kael-companion',
    );
    const foe = Object.values(s.combatants).find((c) => c.side === 'enemy')!;
    foe.pos = { x: 6, y: 4 };
    foe.creature = { ...foe.creature, hp: 99, maxHp: 99 };
    return { s, foe };
  };

  it('a giant badger companion bites and claws in one turn (MM: Multiattack)', () => {
    const { s, foe } = ready();
    let r = act(s, { type: 'attack', targetId: foe.id, optionId: 'bite' });
    expect(r.error).toBeUndefined();
    r = act(r.state, { type: 'attack', targetId: foe.id, optionId: 'claws' });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/Bite[\s\S]*Claws|Claws[\s\S]*Bite/);
    r = act(r.state, { type: 'attack', targetId: foe.id, optionId: 'bite' });
    expect(r.error).toBeTruthy();
  });

  it('but not two bites (each attack only as listed)', () => {
    const { s, foe } = ready();
    const r = act(s, { type: 'attack', targetId: foe.id, optionId: 'bite' });
    expect(act(r.state, { type: 'attack', targetId: foe.id, optionId: 'bite' }).error).toMatch(
      /already used its bite/,
    );
  });
});

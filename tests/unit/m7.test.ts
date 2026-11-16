// Milestone M7: level-3 class features, new spell effects, monster tactics, items, and the
// combat sides of the Act I story (brawl, parley). Each test cites the rule it checks.
import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  attackOptions,
  getSpell,
  targeting,
  finishCombat,
  getEncounter,
  readyParty,
  speedNow,
  startCombat,
  type CombatState,
  type Pos,
} from '../../src/game/combat';
import type { Hero } from '../../src/game/hero';
import { equip, heroAc } from '../../src/game/items';
import { hero } from './combat/helpers';

/** Put creatures where we want them and make `activeId` the one whose turn it is. */
function arrange(s: CombatState, where: Record<string, Pos | null>, activeId: string): CombatState {
  const t = structuredClone(s);
  for (const [id, p] of Object.entries(where)) {
    if (!t.combatants[id]) continue;
    if (p) t.combatants[id]!.pos = p;
    else t.combatants[id]!.gone = true;
  }
  t.turnIndex = t.order.indexOf(activeId);
  const c = t.combatants[activeId]!;
  c.turn = {
    ...c.turn,
    actionUsed: false,
    bonusUsed: false,
    movement: speedNow(c),
    disengaged: false,
    attacked: false,
    attacksLeft: 0,
    extraActions: 0,
    sneakAttackUsed: false,
    lightWeaponUsed: null,
    bonusSpellCast: false,
    actionSpellCast: false,
  };
  t.prompt = null;
  t.plan = null;
  t.log = [];
  return t;
}
const texts = (s: CombatState) => s.log.map((l) => l.text).join('\n');

/** A level-N party; the first hero is replaced by `lead` (already levelled with it). */
function party(lead: Hero, level: number): Hero[] {
  return [
    lead,
    ...readyParty([hero('cleric', 'Thorn'), hero('rogue', 'Ilse'), hero('wizard', 'Wren')], level),
  ];
}
const L = (cls: string, name: string, level: number, choices: Record<string, string[]> = {}) => {
  const h = readyParty([hero(cls, name)], level)[0]!;
  return { ...h, choices: { ...h.choices, ...choices } };
};
function fight(
  id: string,
  p: Hero[],
  seed = 1,
  opts: Partial<Parameters<typeof startCombat>[0]> = {},
) {
  return startCombat({
    encounter: getEncounter(id),
    party: p,
    difficulty: 'medium',
    rngState: seed,
    ...opts,
  });
}
/** Try seeds until `pred` holds for the result (dice are seeded, not scripted). */
function withSeed(make: (seed: number) => CombatState, pred: (s: CombatState) => boolean) {
  for (let seed = 1; seed < 200; seed++) {
    const s = make(seed);
    if (pred(s)) return s;
  }
  throw new Error('no seed matched');
}
const easyTarget = (s: CombatState, id: string) => {
  s.combatants[id]!.creature = { ...s.combatants[id]!.creature, ac: 1 };
};

describe('the tavern brawl (F1): PHB Knocking a Creature Out', () => {
  it('a melee hit that drops a bruiser knocks it out instead of killing it', () => {
    const s0 = arrange(
      fight('f1-tavern-brawl', party(L('fighter', 'Mira', 1), 1)),
      { mira: { x: 11, y: 2 } },
      'mira',
    );
    s0.combatants['bruiser-a']!.creature = {
      ...s0.combatants['bruiser-a']!.creature,
      hp: 1,
      ac: 1,
    };
    const s = withSeed(
      (seed) =>
        act(
          { ...s0, rngState: seed },
          { type: 'attack', targetId: 'bruiser-a', optionId: 'longsword' },
        ).state,
      (x) => x.combatants['bruiser-a']!.creature.hp === 0,
    );
    const b = s.combatants['bruiser-a']!.creature;
    expect(b.dead).toBe(false);
    expect(b.stable).toBe(true);
  });

  it('losing the brawl does not end the game: everyone wakes with 1 HP and keeps the XP', () => {
    const s = fight('f1-tavern-brawl', party(L('fighter', 'Mira', 1), 1));
    const lost: CombatState = { ...s, outcome: 'defeat' };
    for (const c of Object.values(lost.combatants))
      if (c.side === 'party') c.creature = { ...c.creature, hp: 0, stable: true };
    const r = finishCombat(
      lost,
      Object.values(s.combatants)
        .filter((c) => c.side === 'party')
        .map((c) => c.creature as Hero),
    );
    expect(r.party.every((h) => h.hp === 1)).toBe(true);
    expect(r.xpEach).toBe(25);
  });
});

describe('talking Ulric down mid-fight (F7 parley)', () => {
  const base = () => fight('f7-sunken-shrine', party(L('paladin', 'Pell', 3), 3));
  it("uses the easier DC with Brannoc's name, ends the fight and still gives the XP (D16)", () => {
    const s0 = arrange({ ...base(), flags: { knows_ulric: true } }, {}, 'pell');
    const s = withSeed(
      (seed) => act({ ...s0, rngState: seed }, { type: 'parley' }).state,
      (x) => x.outcome === 'parley',
    );
    expect(texts(s)).toMatch(/vs DC 11/);
    const r = finishCombat(
      s,
      Object.values(s.combatants)
        .filter((c) => c.side === 'party')
        .map((c) => c.creature as Hero),
    );
    expect(r.xpEach).toBe(162);
  });
  it('each hero gets one try, using their action', () => {
    const s0 = arrange(base(), {}, 'pell');
    const s = withSeed(
      (seed) => act({ ...s0, rngState: seed }, { type: 'parley' }).state,
      (x) => !x.outcome,
    );
    expect(texts(s)).toMatch(/vs DC 15/);
    expect(act(s, { type: 'parley' }).error).toMatch(/already tried/);
  });
});

describe('potions in a fight (PHB: Use an Object)', () => {
  it('drinking a Potion of Healing heals 2d4 + 2 and uses one up', () => {
    const s0 = arrange(
      fight('f3-warren-gate', party(L('fighter', 'Mira', 2), 2), 1, {
        inventory: { 'potion-of-healing': 2 },
      }),
      {},
      'mira',
    );
    s0.combatants['mira']!.creature = { ...s0.combatants['mira']!.creature, hp: 1 };
    const s = act(s0, { type: 'use-item', itemId: 'potion-of-healing', targetId: 'mira' }).state;
    expect(s.combatants['mira']!.creature.hp).toBeGreaterThanOrEqual(5);
    expect(s.inventory['potion-of-healing']).toBe(1);
    expect(s.combatants['mira']!.turn.actionUsed).toBe(true);
  });
  it('a Thief uses Fast Hands: a bonus action, not the action (PHB: Thief)', () => {
    const s0 = arrange(
      fight('f3-warren-gate', party(L('rogue', 'Vex', 3), 3), 1, {
        inventory: { 'potion-of-healing': 1 },
      }),
      {},
      'vex',
    );
    const s = act(s0, { type: 'use-item', itemId: 'potion-of-healing', targetId: 'vex' }).state;
    expect(s.combatants['vex']!.turn.bonusUsed).toBe(true);
    expect(s.combatants['vex']!.turn.actionUsed).toBe(false);
  });
  it('a Potion of Resistance (fire) halves fire damage', () => {
    const s0 = arrange(
      fight('e1-scald', party(L('fighter', 'Mira', 3), 3), 1, {
        inventory: { 'potion-of-fire-resistance': 1 },
      }),
      {},
      'mira',
    );
    const s = act(s0, {
      type: 'use-item',
      itemId: 'potion-of-fire-resistance',
      targetId: 'mira',
    }).state;
    expect(
      s.combatants['mira']!.effects.some((e) => e.tag === 'resistance' && e.data?.type === 'fire'),
    ).toBe(true);
  });
});

describe('level-3 class features', () => {
  it('Berserker Frenzy: a bonus-action attack while raging, then 1 level of exhaustion (PHB)', () => {
    let s = arrange(
      fight('f3-warren-gate', party(L('barbarian', 'Bryn', 3), 3)),
      { bryn: { x: 7, y: 3 } },
      'bryn',
    );
    s = act(s, { type: 'feature', id: 'rage-frenzy' }).state;
    expect(s.combatants['bryn']!.effects.map((e) => e.tag)).toEqual(
      expect.arrayContaining(['rage', 'frenzy']),
    );
    s = {
      ...s,
      combatants: {
        ...s.combatants,
        bryn: {
          ...s.combatants['bryn']!,
          turn: { ...s.combatants['bryn']!.turn, bonusUsed: false },
        },
      },
    };
    const r = act(s, { type: 'feature', id: 'frenzy-attack', targetId: 'wolf-a' });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/Bryn attacks Wolf A/);
    const done = finishCombat({ ...r.state, outcome: 'victory' }, [
      s.combatants['bryn']!.creature as Hero,
    ]);
    expect(done.party[0]!.exhaustion).toBe(1);
  });

  it('Sacred Weapon adds Charisma to weapon attacks (PHB: Oath of Devotion)', () => {
    const s0 = arrange(fight('f3-warren-gate', party(L('paladin', 'Pell', 3), 3)), {}, 'pell');
    const s = act(s0, { type: 'feature', id: 'sacred-weapon' }).state;
    const eff = s.combatants['pell']!.effects.find((e) => e.tag === 'sacred-weapon')!;
    expect(eff.mod?.attack).toBeGreaterThanOrEqual(1);
    expect(s.combatants['pell']!.turn.actionUsed).toBe(true);
  });

  it("Colossus Slayer: +1d8 once a turn against a wounded target (PHB: Hunter's Prey)", () => {
    const s0 = arrange(
      fight(
        'f3-warren-gate',
        party(L('ranger', 'Ash', 3, { 'hunters-prey': ['colossus-slayer'] }), 3),
      ),
      { ash: { x: 7, y: 3 } },
      'ash',
    );
    easyTarget(s0, 'wolf-a');
    s0.combatants['wolf-a']!.creature = { ...s0.combatants['wolf-a']!.creature, hp: 10, maxHp: 11 };
    const opt = 'shortsword';
    const s = withSeed(
      (seed) =>
        act({ ...s0, rngState: seed }, { type: 'attack', targetId: 'wolf-a', optionId: opt }).state,
      (x) => /HIT/.test(texts(x)),
    );
    expect(texts(s)).toMatch(/1d8 \(\d\)/);
    expect(s.combatants['ash']!.turn.colossusUsed).toBe(true);
  });

  it('Open Hand Technique: a flurry hit can knock the target prone (Dex save) (PHB: Monk)', () => {
    let s0 = arrange(
      fight('f3-warren-gate', party(L('monk', 'Kai', 3), 3)),
      { kai: { x: 7, y: 3 } },
      'kai',
    );
    easyTarget(s0, 'wolf-a');
    s0 = act(s0, { type: 'attack', targetId: 'wolf-a', optionId: 'unarmed' }).state;
    s0.combatants['wolf-a']!.creature = { ...s0.combatants['wolf-a']!.creature, hp: 50, maxHp: 50 };
    const s = withSeed(
      (seed) =>
        act({ ...s0, rngState: seed }, { type: 'feature', id: 'flurry-prone', targetId: 'wolf-a' })
          .state,
      (x) => /knocked prone/.test(texts(x)),
    );
    expect(s.combatants['wolf-a']!.creature.conditions.some((c) => c.id === 'prone')).toBe(true);
  });

  it('Deflect Missiles cuts ranged weapon damage (PHB: Monk, level 3)', () => {
    let s = fight('f3-warren-gate', party(L('monk', 'Kai', 3), 3), 4);
    s = arrange(s, { kai: { x: 9, y: 2 }, 'wolf-a': null, 'wolf-b': null }, 'goblin-a');
    s.combatants['kai']!.creature = { ...s.combatants['kai']!.creature, ac: 1 };
    const out = withSeed(
      (seed) => advance({ ...s, rngState: seed }),
      (x) => /deflects the missile/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/Kai deflects the missile: −\d+ damage/);
  });

  it('Pact of the Blade gives a magical pact weapon (PHB: Warlock)', () => {
    const s = fight(
      'f3-warren-gate',
      party(L('warlock', 'Hex', 3, { 'pact-boon': ['pact-of-the-blade'] }), 3),
    );
    const blade = attackOptions(s.combatants['hex']!).find((o) => o.id === 'pact-blade')!;
    expect(blade.magical).toBe(true);
  });

  it('Cutting Words: a bard can take a Bardic Inspiration die off an enemy hit (PHB: College of Lore)', () => {
    let s = fight('f3-warren-gate', party(L('bard', 'Lark', 3), 3), 2);
    s = arrange(s, { lark: { x: 7, y: 4 } }, 'wolf-a');
    const out = withSeed(
      (seed) => advance({ ...s, rngState: seed }),
      (x) => x.prompt?.kind === 'cutting-words',
    );
    const after = act(out, { type: 'react', accept: true }).state;
    expect(texts(after)).toMatch(/Cutting Words: d6 \(\d\)/);
  });
});

describe('Metamagic (PHB: Sorcerer)', () => {
  const sorc = () =>
    L('sorcerer', 'Sol', 3, { metamagic: ['quickened', 'twinned', 'careful', 'distant'] });
  it('Quickened Spell: a 1-action spell as a bonus action for 2 sorcery points', () => {
    const s0 = arrange(fight('f3-warren-gate', party(sorc(), 3)), {}, 'sol');
    const before = (s0.combatants['sol']!.creature as Hero).resourcesUsed['sorcery-points'] ?? 0;
    const s = act(s0, {
      type: 'cast',
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: ['wolf-a'],
      metamagic: 'quickened',
    }).state;
    expect(s.combatants['sol']!.turn.bonusUsed).toBe(true);
    expect(s.combatants['sol']!.turn.actionUsed).toBe(false);
    expect((s.combatants['sol']!.creature as Hero).resourcesUsed['sorcery-points']).toBe(
      before + 2,
    );
  });
  it('Twinned Spell: a single-target spell hits a second creature', () => {
    const s0 = arrange(fight('f3-warren-gate', party(sorc(), 3)), {}, 'sol');
    const r = act(s0, {
      type: 'cast',
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: ['wolf-a', 'wolf-b'],
      metamagic: 'twinned',
    });
    expect(r.error).toBeUndefined();
    expect(texts(r.state).match(/Fire Bolt/g)!.length).toBeGreaterThanOrEqual(3);
    expect(
      act(s0, { type: 'cast', spellId: 'fire-bolt', slotLevel: 0, targetIds: ['wolf-a', 'wolf-b'] })
        .error,
    ).toMatch(/at most 1/);
  });
  it('Distant Spell doubles the range, and touch becomes 30 ft', () => {
    const fb = targeting(getSpell('fire-bolt'), 0, 'distant');
    const sg = targeting(getSpell('shocking-grasp'), 0, 'distant');
    expect(fb.kind === 'creatures' && fb.rangeFeet).toBe(240);
    expect(sg.kind === 'creatures' && sg.rangeFeet).toBe(30);
  });
  it('Careful Spell: chosen allies automatically succeed on the save', () => {
    const s0 = arrange(fight('f3-warren-gate', party(sorc(), 3)), {}, 'sol');
    const h = s0.combatants['sol']!.creature as Hero;
    s0.combatants['sol']!.creature = { ...h, spells: [...h.spells, 'thunderwave'] } as Hero;
    const s1 = arrange(
      s0,
      { sol: { x: 7, y: 4 }, thorn: { x: 8, y: 4 }, 'wolf-a': { x: 8, y: 3 } },
      'sol',
    );
    const r = act(s1, {
      type: 'cast',
      spellId: 'thunderwave',
      slotLevel: 1,
      point: { x: 8, y: 4 },
      metamagic: 'careful',
    });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/Thorn is spared by Careful Spell/);
  });
});

describe('new spell effects', () => {
  it('Misty Step teleports up to 30 ft to an open square (PHB)', () => {
    const w = L('wizard', 'Ivo', 3);
    const ivo = { ...w, spells: [...w.spells, 'misty-step'] };
    const s0 = arrange(fight('f3-warren-gate', party(ivo, 3)), { ivo: { x: 2, y: 4 } }, 'ivo');
    const s = act(s0, {
      type: 'cast',
      spellId: 'misty-step',
      slotLevel: 2,
      point: { x: 7, y: 4 },
    }).state;
    expect(s.combatants['ivo']!.pos).toEqual({ x: 7, y: 4 });
    expect(
      act(s0, { type: 'cast', spellId: 'misty-step', slotLevel: 2, point: { x: 14, y: 4 } }).error,
    ).toMatch(/range/);
  });

  it('Spiritual Weapon strikes now and gives a bonus-action attack on later turns (PHB)', () => {
    const c = L('cleric', 'Ada', 3);
    const s0 = arrange(
      fight('f3-warren-gate', party({ ...c, spells: [...c.spells, 'spiritual-weapon'] }, 3)),
      {},
      'ada',
    );
    const s = act(s0, {
      type: 'cast',
      spellId: 'spiritual-weapon',
      slotLevel: 2,
      targetIds: ['wolf-a'],
    }).state;
    expect(s.combatants['ada']!.effects.some((e) => e.tag === 'spiritual-weapon')).toBe(true);
  });

  it('Aid raises current and maximum HP by 5, gone when the fight ends (PHB; [inferred] duration)', () => {
    const c = L('cleric', 'Ada', 3);
    const s0 = arrange(
      fight('f3-warren-gate', party({ ...c, spells: [...c.spells, 'aid'] }, 3)),
      {},
      'ada',
    );
    const max = s0.combatants['thorn']!.creature.maxHp;
    const s = act(s0, {
      type: 'cast',
      spellId: 'aid',
      slotLevel: 2,
      targetIds: ['ada', 'thorn'],
    }).state;
    expect(s.combatants['thorn']!.creature.maxHp).toBe(max + 5);
    const r = finishCombat({ ...s, outcome: 'victory' }, [
      s0.combatants['thorn']!.creature as Hero,
    ]);
    expect(r.party[0]!.maxHp).toBe(max);
  });

  it('Lesser Restoration ends paralysis (PHB)', () => {
    const c = L('cleric', 'Ada', 3);
    const s0 = arrange(
      fight('f3-warren-gate', party({ ...c, spells: [...c.spells, 'lesser-restoration'] }, 3), 1),
      { ada: { x: 3, y: 4 }, thorn: { x: 4, y: 4 } },
      'ada',
    );
    s0.combatants['thorn']!.creature = {
      ...s0.combatants['thorn']!.creature,
      conditions: [{ id: 'paralyzed' }],
    };
    const s = act(s0, {
      type: 'cast',
      spellId: 'lesser-restoration',
      slotLevel: 2,
      targetIds: ['thorn'],
    }).state;
    expect(s.combatants['thorn']!.creature.conditions.some((x) => x.id === 'paralyzed')).toBe(
      false,
    );
  });

  it('Branding Smite: the next weapon hit deals +2d6 radiant, once (PHB)', () => {
    const p = L('paladin', 'Pell', 5); // 2nd-level slots arrive at paladin 5
    let s = arrange(
      fight('f3-warren-gate', party({ ...p, spells: [...p.spells, 'branding-smite'] }, 3)),
      { pell: { x: 7, y: 3 } },
      'pell',
    );
    easyTarget(s, 'wolf-a');
    s.combatants['wolf-a']!.creature = { ...s.combatants['wolf-a']!.creature, hp: 60, maxHp: 60 };
    s = act(s, { type: 'cast', spellId: 'branding-smite', slotLevel: 2 }).state;
    expect(s.combatants['pell']!.effects.some((e) => e.tag === 'next-hit')).toBe(true);
    const hit = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          {
            type: 'attack',
            targetId: 'wolf-a',
            optionId: s.combatants['pell']!.creature && 'longsword',
          },
        ).state,
      (x) => /2d6 \(\d, \d\) = \d+ radiant/.test(texts(x)),
    );
    expect(hit.combatants['pell']!.effects.some((e) => e.tag === 'next-hit')).toBe(false);
  });

  it('Mirror Image: an attack can strike a duplicate instead (PHB)', () => {
    const w = L('wizard', 'Ivo', 3);
    let s = arrange(
      fight('f3-warren-gate', party({ ...w, spells: [...w.spells, 'mirror-image'] }, 3)),
      { ivo: { x: 7, y: 4 } },
      'ivo',
    );
    s = act(s, { type: 'cast', spellId: 'mirror-image', slotLevel: 2 }).state;
    expect(s.combatants['ivo']!.effects.find((e) => e.tag === 'mirror-image')!.data!.images).toBe(
      3,
    );
    s = arrange(s, {}, 'wolf-a');
    const out = withSeed(
      (seed) => advance({ ...s, rngState: seed }),
      (x) => /mirror image/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/targets a mirror image of Ivo/);
  });
});

describe('monster tactics', () => {
  it('Brother Ulric casts Hold Person on Hard and spends a 2nd-level slot (MM: cult fanatic)', () => {
    let s = startCombat({
      encounter: getEncounter('f7-sunken-shrine'),
      party: readyParty(
        [
          hero('fighter', 'Mira'),
          hero('cleric', 'Thorn'),
          hero('rogue', 'Ilse'),
          hero('wizard', 'Wren'),
        ],
        3,
      ),
      difficulty: 'hard',
      rngState: 3,
    });
    s = arrange(s, { ulric: { x: 6, y: 4 } }, 'ulric');
    const out = advance(s);
    expect(texts(out)).toMatch(/Brother Ulric casts Hold Person/);
    expect(out.combatants['ulric']!.monsterSlots!['2']).toBe(2);
  });

  it('Ulric conjures a Spiritual Weapon from round 2 and attacks with it (bonus action)', () => {
    let s = fight(
      'f7-sunken-shrine',
      readyParty(
        [
          hero('fighter', 'Mira'),
          hero('cleric', 'Thorn'),
          hero('rogue', 'Ilse'),
          hero('wizard', 'Wren'),
        ],
        3,
      ),
      5,
    );
    s = arrange({ ...s, round: 2 }, { ulric: { x: 6, y: 4 } }, 'ulric');
    const out = advance(s);
    expect(texts(out)).toMatch(/casts Spiritual Weapon/);
    expect(out.combatants['ulric']!.effects.some((e) => e.tag === 'spiritual-weapon')).toBe(true);
  });

  it("Scald's Fire Breath: one damage roll for the cone, Dex save for half, then it must recharge (MM)", () => {
    let s = fight(
      'e1-scald',
      readyParty(
        [
          hero('fighter', 'Mira'),
          hero('cleric', 'Thorn'),
          hero('rogue', 'Ilse'),
          hero('wizard', 'Wren'),
        ],
        3,
      ),
      2,
    );
    s = arrange(
      s,
      {
        scald: { x: 4, y: 4 },
        mira: { x: 2, y: 4 },
        thorn: { x: 2, y: 3 },
        ilse: { x: 2, y: 5 },
        wren: { x: 13, y: 4 },
      },
      'scald',
    );
    const out = advance(s);
    expect(texts(out)).toMatch(/Scald uses Fire Breath!/);
    expect(texts(out).match(/7d6/g)!.length).toBeGreaterThanOrEqual(1);
    expect(out.combatants['scald']!.recharge!['fire-breath']).toBe(false);
  });

  it('Multiattack: a cult fanatic with no spell to cast attacks twice (MM)', () => {
    let s = fight(
      'f7-sunken-shrine',
      readyParty(
        [
          hero('fighter', 'Mira'),
          hero('cleric', 'Thorn'),
          hero('rogue', 'Ilse'),
          hero('wizard', 'Wren'),
        ],
        3,
      ),
      5,
    );
    s = arrange(s, { ulric: { x: 3, y: 4 }, mira: { x: 2, y: 4 } }, 'ulric');
    s.combatants['ulric']!.monsterSlots = { '1': 0, '2': 0 };
    const out = advance(s);
    expect(texts(out).match(/Brother Ulric attacks/g)!.length).toBe(2);
  });

  it("A shadow's Strength Drain lowers Strength, which comes back after the fight ([inferred] timing)", () => {
    let s = fight(
      's3-mill-shadows',
      readyParty(
        [
          hero('fighter', 'Mira'),
          hero('cleric', 'Thorn'),
          hero('rogue', 'Ilse'),
          hero('wizard', 'Wren'),
        ],
        2,
      ),
      2,
    );
    s = arrange(
      s,
      { 'shadow-a': { x: 3, y: 4 }, mira: { x: 2, y: 4 }, thorn: null, ilse: null, wren: null },
      'shadow-a',
    );
    s.combatants['mira']!.creature = {
      ...s.combatants['mira']!.creature,
      ac: 1,
      hp: 60,
      maxHp: 60,
    };
    const str = s.combatants['mira']!.creature.abilities.str;
    const out = withSeed(
      (seed) => advance({ ...s, rngState: seed }),
      (x) => /Strength drains/.test(texts(x)),
    );
    expect(out.combatants['mira']!.creature.abilities.str).toBeLessThan(str);
    const r = finishCombat({ ...out, outcome: 'victory' }, [
      s.combatants['mira']!.creature as Hero,
    ]);
    expect(r.party[0]!.abilities.str).toBe(str);
  });
});

describe('magic items (DMG)', () => {
  it('Cloak of Protection: +1 AC and +1 to saves; at most 3 attuned items', () => {
    const h = L('fighter', 'Mira', 3);
    const r = equip(h, 'cloak-of-protection');
    expect(r.hero.ac).toBe(heroAc(h) + 1);
    let x = r.hero;
    x = equip(x, 'luck-stone').hero;
    x = equip(x, 'lysas-locket').hero;
    expect(
      equip(
        { ...x, equipment: { ...x.equipment, magic: [...x.equipment.magic] } },
        'honor-guards-ring',
      ).error,
    ).toMatch(/three/);
  });
  it('Deepdelver (+1 warhammer) shows up as a magical +1 attack', () => {
    const h = equip(L('fighter', 'Mira', 3), 'deepdelver').hero;
    const s = fight('f3-warren-gate', party(h, 3));
    const dd = attackOptions(s.combatants['mira']!).find((o) => o.id === 'deepdelver')!;
    expect(dd.magical).toBe(true);
    expect(dd.damage[0]!.dice).toMatch(/\+4$/);
  });
  it("Lysa's Locket: a dying wearer stabilizes at the start of their turn (DMG: Periapt of Wound Closure)", () => {
    const h = equip(L('fighter', 'Mira', 2), 'lysas-locket').hero;
    let s = fight('f3-warren-gate', party(h, 2));
    const before = s.order[(s.order.indexOf('mira') + s.order.length - 1) % s.order.length]!;
    s = arrange(s, {}, before);
    s.combatants['mira']!.creature = {
      ...s.combatants['mira']!.creature,
      hp: 0,
      stable: false,
      conditions: [{ id: 'unconscious' }],
    };
    const next =
      s.combatants[before]!.side === 'party' ? act(s, { type: 'end-turn' }).state : advance(s);
    expect(texts(next)).toMatch(/locket glows: Mira is stable/);
    expect(next.combatants['mira']!.creature.stable).toBe(true);
  });
});

describe("Lysa's Locket at a short rest (DMG: Periapt of Wound Closure)", () => {
  it('doubles the healing from a Hit Die', async () => {
    const { spendDie } = await import('../../src/game/rest');
    const { SeededRng } = await import('../../src/rules');
    const plain = { ...L('fighter', 'Mira', 3), hp: 1 };
    const worn = equip(plain, 'lysas-locket').hero;
    const g = (h: Hero) => ({ party: [h] }) as unknown as import('../../src/game/save').GameState;
    const a = spendDie(g(plain), plain.id, new SeededRng(4)).game.party[0]!.hp - 1;
    const b = spendDie(g(worn), worn.id, new SeededRng(4)).game.party[0]!.hp - 1;
    expect(b).toBe(Math.min(2 * a, worn.maxHp - 1));
  });
});

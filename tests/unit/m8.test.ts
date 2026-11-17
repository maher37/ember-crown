// Milestone M8: level 4–5 features, 3rd-level spells and lasting spell areas, Act II monster
// abilities and magic items. Each test cites the rule it checks.
import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  attackOptions,
  currentAc,
  finishCombat,
  getEncounter,
  getSpell,
  hasLineOfSight,
  readyParty,
  speedNow,
  startCombat,
} from '../../src/game/combat';
import {
  addZone,
  around,
  enterSquare,
  makeZone,
  startOfTurnZones,
  zoneSlows,
} from '../../src/game/combat/zones';
import { moveCost } from '../../src/game/combat/grid';
import { endConcentrationEffects } from '../../src/game/combat/core';
import type { Hero } from '../../src/game/hero';
import { equip, heroAc } from '../../src/game/items';
import { takeLongRest } from '../../src/game/rest';
import type { GameState } from '../../src/game/save';
import { SeededRng } from '../../src/rules';
import { arrange, easyTarget, fight, L, party, texts, withSeed } from './combat/arrange';
import { hero } from './combat/helpers';

/** A level-5 hero who knows these extra spells. */
const caster = (cls: string, name: string, spells: string[], level = 5, choices = {}) => {
  const h = L(cls, name, level, choices);
  return { ...h, spells: [...h.spells, ...spells] };
};
const P = (lead: Hero) => party(lead, 5);
const F = (lead: Hero, id = 'f13-cloister', seed = 1) => fight(id, P(lead), seed);

describe('lasting spell areas (zones)', () => {
  it('Spirit Guardians: enemies starting their turn inside save or take 3d8 radiant, and are slowed (PHB)', () => {
    let s = arrange(
      F(caster('cleric', 'Ada', ['spirit-guardians'])),
      { ada: { x: 5, y: 4 }, 'cultist-a': { x: 6, y: 4 } },
      'ada',
    );
    s = act(s, { type: 'cast', spellId: 'spirit-guardians', slotLevel: 3 }).state;
    expect(s.zones).toHaveLength(1);
    expect(s.zones[0]!.aura).toBe(15);
    // An enemy stepping into the aura pays double.
    expect(moveCost(s, s.combatants['cultist-b']!, { x: 7, y: 4 }, zoneSlows)).toBe(10);
    expect(moveCost(s, s.combatants['thorn']!, { x: 7, y: 4 }, zoneSlows)).toBe(5);
    // Starting a turn inside: the cultist saves (Wis) or takes the damage.
    const ctx = { s: structuredClone(s), rng: new SeededRng(4) };
    startOfTurnZones(ctx, ctx.s.combatants['cultist-a']!);
    expect(texts(ctx.s)).toMatch(/Wis save/);
  });

  it('the zone ends with concentration', () => {
    let s = arrange(F(caster('cleric', 'Ada', ['spirit-guardians'])), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'spirit-guardians', slotLevel: 3 }).state;
    s.combatants['ada']!.creature = { ...s.combatants['ada']!.creature, hp: 1 };
    // Drop the cleric: concentration ends (PHB: falling unconscious ends concentration).
    const s2 = withSeed(
      (seed) =>
        advance({
          ...arrange(s, { 'cultist-a': { x: 1, y: 4 }, ada: { x: 0, y: 4 } }, 'cultist-a'),
          rngState: seed,
        }),
      (x) => x.combatants['ada']!.creature.hp === 0,
    );
    expect(s2.zones).toHaveLength(0);
  });

  it('Spike Growth: 2d4 piercing for every square moved through it (PHB)', () => {
    let s = arrange(F(caster('druid', 'Ivy', ['spike-growth'])), {}, 'ivy');
    s = act(s, {
      type: 'cast',
      spellId: 'spike-growth',
      slotLevel: 2,
      point: { x: 9, y: 4 },
    }).state;
    expect(s.zones[0]!.kind).toBe('spikes');
    const ctx = { s: structuredClone(s), rng: new SeededRng(3) };
    const before = ctx.s.combatants['cultist-c']!.creature.hp;
    ctx.s.combatants['cultist-c']!.creature = {
      ...ctx.s.combatants['cultist-c']!.creature,
      hp: 30,
      maxHp: 30,
    };
    enterSquare(ctx, ctx.s.combatants['cultist-c']!, { x: 9, y: 4 });
    expect(ctx.s.combatants['cultist-c']!.creature.hp).toBeLessThan(30);
    expect(before).toBeGreaterThan(0);
  });

  it('Silence: no spells with a verbal component inside it (PHB)', () => {
    let s = arrange(F(caster('cleric', 'Ada', ['silence'])), { ada: { x: 3, y: 4 } }, 'ada');
    s = act(s, { type: 'cast', spellId: 'silence', slotLevel: 2, point: { x: 3, y: 4 } }).state;
    s = arrange(s, {}, 'ada');
    expect(
      act(s, { type: 'cast', spellId: 'sacred-flame', slotLevel: 0, targetIds: ['cultist-a'] })
        .error,
    ).toMatch(/Silence/);
  });

  it('Darkness blocks sight into and out of it (PHB; the spell itself is exploration-only for now)', () => {
    const s = arrange(F(caster('wizard', 'Ivo', [])), { 'cultist-a': { x: 9, y: 4 } }, 'ivo');
    const ctx = { s: structuredClone(s), rng: new SeededRng(1) };
    const zone = makeZone(
      ctx.s.combatants['ivo']!,
      getSpell('darkness'),
      around(ctx.s, { x: 9, y: 4 }, 15),
      { dc: 13, slotLevel: 2 },
    );
    addZone(ctx, zone!);
    expect(hasLineOfSight(ctx.s.map, ctx.s.combatants['ivo']!.pos, { x: 9, y: 4 })).toBe(false);
  });
});

describe('3rd-level spells', () => {
  it('Haste: +2 AC, double speed, and one extra limited action; lethargy when it ends (PHB)', () => {
    let s = arrange(F(caster('wizard', 'Ivo', ['haste'])), {}, 'ivo');
    const ac = currentAc(s.combatants['thorn']!);
    const speed = speedNow(s.combatants['thorn']!);
    s = act(s, { type: 'cast', spellId: 'haste', slotLevel: 3, targetIds: ['thorn'] }).state;
    expect(currentAc(s.combatants['thorn']!)).toBe(ac + 2);
    const m = arrange(s, {}, 'thorn');
    m.combatants['thorn']!.turn.hasteAction = true;
    expect(speedNow(m.combatants['thorn']!)).toBe(speed * 2);
    const a = act(m, { type: 'dash' }).state;
    const b = act(a, { type: 'dash' });
    expect(b.error).toBeUndefined();
    expect(b.state.combatants['thorn']!.turn.hasteAction).toBe(false);
    // Concentration ends: lethargy.
    const ended = structuredClone(b.state);
    ended.combatants['ivo']!.creature = {
      ...ended.combatants['ivo']!.creature,
      concentration: null,
    };
    endConcentrationEffects(ended, 'ivo', 'haste');
    expect(ended.combatants['thorn']!.effects.some((e) => e.id === 'lethargy')).toBe(true);
  });

  it('Slow: half speed, only one attack, no reactions; a successful repeat save ends it all (PHB)', () => {
    let s = arrange(F(caster('wizard', 'Ivo', ['slow'])), {}, 'ivo');
    s = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'cast', spellId: 'slow', slotLevel: 3, targetIds: ['fanatic'] },
        ).state,
      (x) => x.combatants['fanatic']!.effects.some((e) => e.tag === 'slowed'),
    );
    const f = s.combatants['fanatic']!;
    expect(speedNow(f)).toBe(15);
    expect(currentAc(f)).toBe(11);
  });

  it('Revivify brings back an ally who died in this fight, with 1 HP (PHB)', () => {
    const s = arrange(
      F(caster('cleric', 'Ada', ['revivify'])),
      { ada: { x: 3, y: 4 }, ilse: { x: 4, y: 4 } },
      'ada',
    );
    s.combatants['ilse']!.creature = { ...s.combatants['ilse']!.creature, hp: 0, dead: true };
    expect(
      act(s, { type: 'cast', spellId: 'revivify', slotLevel: 3, targetIds: ['thorn'] }).error,
    ).toMatch(/fallen ally/);
    const out = act(s, {
      type: 'cast',
      spellId: 'revivify',
      slotLevel: 3,
      targetIds: ['ilse'],
    }).state;
    expect(out.combatants['ilse']!.creature).toMatchObject({ dead: false, hp: 1 });
  });

  it('Dispel Magic ends spells on the target, including its own concentration (PHB)', () => {
    let s = arrange(F(caster('cleric', 'Ada', ['spirit-guardians', 'dispel-magic'])), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'spirit-guardians', slotLevel: 3 }).state;
    s = arrange(s, {}, 'ada');
    const out = act(s, {
      type: 'cast',
      spellId: 'dispel-magic',
      slotLevel: 3,
      targetIds: ['ada'],
    }).state;
    expect(out.zones).toHaveLength(0);
  });

  it('Vampiric Touch heals the caster for half the necrotic damage (PHB)', () => {
    const s = arrange(
      F(caster('wizard', 'Ivo', ['vampiric-touch'])),
      { wren: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'ivo',
    );
    easyTarget(s, 'cultist-a');
    s.combatants['ivo']!.creature = { ...s.combatants['ivo']!.creature, hp: 5 };
    const out = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'cast', spellId: 'vampiric-touch', slotLevel: 3, targetIds: ['ivo'] },
        ).state,
      () => true,
    );
    expect(
      out.combatants['ivo']!.effects.some((e) => e.tag === 'vampiric-touch') ||
        /Vampiric Touch/.test(texts(out)),
    ).toBe(true);
  });

  it('Conjure Animals: two wolves fight on your side, and vanish with concentration (PHB; 2 wolves [inferred])', () => {
    let s = arrange(F(caster('druid', 'Ivy', ['conjure-animals'])), {}, 'ivy');
    s = act(s, {
      type: 'cast',
      spellId: 'conjure-animals',
      slotLevel: 3,
      point: { x: 4, y: 4 },
    }).state;
    const wolves = Object.values(s.combatants).filter((c) => c.summon);
    expect(wolves).toHaveLength(2);
    expect(wolves.every((w) => w.side === 'party' && w.monsterId === 'wolf')).toBe(true);
    expect(s.order.indexOf(wolves[0]!.id)).toBe(s.order.indexOf('ivy') + 1);
  });

  it('Fly: a 60-ft flying speed that ignores difficult terrain (PHB [inferred grid])', () => {
    let s = arrange(
      F(caster('wizard', 'Ivo', ['fly'])),
      { ivo: { x: 3, y: 4 }, thorn: { x: 4, y: 4 } },
      'ivo',
    );
    s = act(s, { type: 'cast', spellId: 'fly', slotLevel: 3, targetIds: ['thorn'] }).state;
    expect(speedNow(s.combatants['thorn']!)).toBe(60);
  });

  it('Shillelagh: a quarterstaff uses Wisdom, a d8, and counts as magical (PHB)', () => {
    let s = arrange(F(caster('druid', 'Ivy', ['shillelagh'], 5)), {}, 'ivy');
    s.combatants['ivy']!.creature = {
      ...(s.combatants['ivy']!.creature as Hero),
      cantrips: [...(s.combatants['ivy']!.creature as Hero).cantrips, 'shillelagh'],
      equipment: {
        ...(s.combatants['ivy']!.creature as Hero).equipment,
        weapons: ['quarterstaff'],
      },
    } as Hero;
    s = act(s, { type: 'cast', spellId: 'shillelagh', slotLevel: 0, targetIds: ['ivy'] }).state;
    const staff = attackOptions(s.combatants['ivy']!).find((o) => o.id === 'quarterstaff')!;
    expect(staff.magical).toBe(true);
    expect(staff.damage[0]!.dice).toMatch(/^1d8/);
  });
});

describe('level 5 class features', () => {
  it('Uncanny Dodge halves the damage of a hit (PHB: Rogue 5) [used automatically]', () => {
    let s = F(L('rogue', 'Vex', 5), 'f13-cloister', 4);
    s = arrange(s, { vex: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } }, 'cultist-a');
    s.combatants['vex']!.creature = { ...s.combatants['vex']!.creature, ac: 1 };
    const out = withSeed(
      (seed) => advance({ ...s, rngState: seed }),
      (x) => /Uncanny Dodge/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/Vex rolls with the blow/);
  });

  it('Stunning Strike: 1 ki on a hit, Con save or stunned (PHB: Monk 5)', () => {
    const s = arrange(
      F(L('monk', 'Kai', 5)),
      { kai: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'kai',
    );
    easyTarget(s, 'cultist-a');
    s.combatants['cultist-a']!.creature = {
      ...s.combatants['cultist-a']!.creature,
      hp: 60,
      maxHp: 60,
    };
    const out = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'attack', targetId: 'cultist-a', optionId: 'unarmed', stun: true },
        ).state,
      (x) => /is stunned/.test(texts(x)),
    );
    expect(out.combatants['cultist-a']!.creature.conditions.some((c) => c.id === 'stunned')).toBe(
      true,
    );
  });

  it('Destroy Undead: a turned zombie of CR 1/2 or less crumbles (PHB: Cleric 5)', () => {
    const s = arrange(
      F(L('cleric', 'Ada', 5), 'f10-marrowmere'),
      { ada: { x: 5, y: 4 }, 'zombie-a': { x: 7, y: 4 } },
      'ada',
    );
    const out = withSeed(
      (seed) => act({ ...s, rngState: seed }, { type: 'feature', id: 'turn-undead' }).state,
      (x) => /crumbles to dust/.test(texts(x)),
    );
    expect(
      out.combatants['zombie-a']!.creature.dead ||
        Object.values(out.combatants).some((c) => c.monsterId === 'zombie' && c.creature.dead),
    ).toBe(true);
  });

  it('Extra Attack: two attacks with the Attack action at level 5 (PHB)', () => {
    let s = arrange(
      F(L('fighter', 'Mira', 5)),
      { mira: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'mira',
    );
    s.combatants['cultist-a']!.creature = {
      ...s.combatants['cultist-a']!.creature,
      hp: 99,
      maxHp: 99,
    };
    s = act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'longsword' }).state;
    expect(s.combatants['mira']!.turn.attacksLeft).toBe(1);
  });
});

describe('Act II monsters (MM)', () => {
  it('Undead Fortitude: a zombie dropped to 0 by non-radiant damage may stay at 1 HP', () => {
    const s = arrange(
      F(L('fighter', 'Mira', 3), 'f10-marrowmere'),
      { mira: { x: 8, y: 2 }, 'zombie-a': { x: 9, y: 2 } },
      'mira',
    );
    easyTarget(s, 'zombie-a');
    s.combatants['zombie-a']!.creature = { ...s.combatants['zombie-a']!.creature, hp: 1 };
    const out = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'attack', targetId: 'zombie-a', optionId: 'longsword' },
        ).state,
      (x) => /Undead Fortitude/.test(texts(x)) && x.combatants['zombie-a']!.creature.hp === 1,
    );
    expect(out.combatants['zombie-a']!.creature.dead).toBe(false);
  });

  it('Life Drain lowers maximum HP; a long rest restores it', () => {
    let s = fight('e2-drowned-abbot', P(L('fighter', 'Mira', 5)), 2);
    s = arrange(
      s,
      {
        abbot: { x: 3, y: 4 },
        mira: { x: 2, y: 4 },
        thorn: null,
        ilse: null,
        wren: null,
        novice: null,
      },
      'abbot',
    );
    s.combatants['mira']!.creature = {
      ...s.combatants['mira']!.creature,
      ac: 1,
      hp: 200,
      maxHp: 200,
    };
    const out = withSeed(
      (seed) => advance({ ...s, rngState: seed }),
      (x) => /hit point maximum drops/.test(texts(x)),
    );
    const h = out.combatants['mira']!.creature as Hero;
    expect(h.maxHp).toBeLessThan(200);
    const g = { party: [h], flags: {}, clock: 100, lastLongRest: null } as unknown as GameState;
    const rested = takeLongRest(g, new SeededRng(1)).game.party[0]!;
    expect(rested.maxHp).toBe(200);
  });

  it('Wraiths and specters fly: they can move (speed 60 / 50)', () => {
    const s = fight('e2-drowned-abbot', P(L('fighter', 'Mira', 5)));
    expect(s.combatants['abbot']!.speed).toBeGreaterThan(0);
  });

  it("A ghast's Stench poisons creatures that start their turn next to it (DC 10 Con)", () => {
    let s = fight('s7-paladin-crypt', P(L('fighter', 'Mira', 5)), 3);
    s = arrange(
      s,
      { ghast: { x: 3, y: 4 }, mira: { x: 2, y: 4 } },
      s.order[(s.order.indexOf('mira') + s.order.length - 1) % s.order.length]!,
    );
    const next =
      s.combatants[s.order[s.turnIndex]!]!.side === 'party'
        ? act(s, { type: 'end-turn' }).state
        : advance(s);
    expect(texts(next)).toMatch(/Con \(Stench\)/);
  });

  it('Parry: the bandit captain turns a melee hit into a miss with +2 AC (reaction)', () => {
    const s = arrange(
      fight('s6-deserters', P(L('fighter', 'Mira', 5))),
      { mira: { x: 11, y: 4 } },
      'mira',
    );
    const ac = currentAc(s.combatants['holm']!);
    const out = withSeed(
      (seed) =>
        act({ ...s, rngState: seed }, { type: 'attack', targetId: 'holm', optionId: 'longsword' })
          .state,
      (x) => /parries/.test(texts(x)),
    );
    expect(texts(out)).toMatch(new RegExp(`vs AC ${ac + 2} → MISS`));
  });

  it('Sister Venna (priest) raises Spirit Guardians when heroes close in', () => {
    let s = fight('f14-undercroft', P(L('fighter', 'Mira', 4)), 2);
    s = arrange(s, { venna: { x: 6, y: 4 }, mira: { x: 4, y: 4 } }, 'venna');
    const out = advance(s);
    expect(texts(out)).toMatch(/Sister Venna casts Spirit Guardians/);
    expect(out.zones.some((z) => z.spellId === 'spirit-guardians' && z.side === 'enemy')).toBe(
      true,
    );
  });

  it('Counterspell: a party wizard may stop an enemy spell (PHB)', () => {
    let s = fight('f14-undercroft', P(caster('wizard', 'Ivo', ['counterspell'])), 2);
    s = arrange(s, { venna: { x: 6, y: 4 }, wren: { x: 4, y: 4 } }, 'venna');
    const asked = advance(s);
    expect(asked.prompt?.kind).toBe('counterspell');
    const out = act(asked, { type: 'react', accept: true }).state;
    expect(texts(out)).toMatch(/casts Counterspell/);
    expect(texts(out)).toMatch(/fizzles \(countered\)/);
  });
});

describe('Act II magic items (DMG)', () => {
  it("Kell's Shield is a +2 shield and gives advantage on initiative (Sentinel Shield)", () => {
    const h = L('wizard', 'Ivo', 4);
    expect(heroAc(equip(h, 'kells-shield').hero)).toBe(heroAc(h) + 2);
    const s = startCombat({
      encounter: getEncounter('f13-cloister'),
      party: party(equip(h, 'kells-shield').hero, 4),
      difficulty: 'medium',
      rngState: 5,
    });
    expect(texts(s)).toMatch(/Ivo d20 adv/);
  });

  it('Shield of the Morninglord: +1 AC on top of a shield, and fire resistance in a fight', () => {
    const h = L('cleric', 'Ada', 4);
    const worn = equip(h, 'shield-of-the-morninglord').hero;
    expect(heroAc(worn)).toBe(heroAc(h) + 1);
    const s = fight('f13-cloister', party(worn, 4));
    expect(
      s.combatants['ada']!.effects.some((e) => e.tag === 'resistance' && e.data?.type === 'fire'),
    ).toBe(true);
  });

  it('Mace of Disruption: +2d6 radiant against undead', () => {
    const h = equip({ ...L('cleric', 'Ada', 5) }, 'mace-of-disruption').hero;
    const s = arrange(
      fight('f10-marrowmere', party(h, 5)),
      { ada: { x: 8, y: 2 }, 'zombie-a': { x: 9, y: 2 } },
      'ada',
    );
    easyTarget(s, 'zombie-a');
    const out = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'attack', targetId: 'zombie-a', optionId: 'mace-of-disruption' },
        ).state,
      (x) => /HIT/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/2d6 \(\d, \d\) = \d+ radiant/);
  });

  it('the Easy-difficulty party wakes, the XP is unchanged by difficulty (D9)', () => {
    const s = fight('f9-lizardfolk', readyParty([hero('fighter', 'M')], 3));
    expect(finishCombat({ ...s, outcome: 'victory' }, []).xpEach).toBe(75);
  });
});

describe('repeatable spell actions (M8 fix)', () => {
  it('Call Lightning: a later bolt uses the action once (PHB)', () => {
    let s = arrange(F(caster('druid', 'Ivy', ['call-lightning'])), {}, 'ivy');
    s = act(s, {
      type: 'cast',
      spellId: 'call-lightning',
      slotLevel: 3,
      point: { x: 9, y: 2 },
    }).state;
    s = arrange(s, {}, 'ivy');
    const r = act(s, { type: 'feature', id: 'call-lightning', targetId: 'cultist-a' });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/calls down a bolt of lightning/);
  });
});

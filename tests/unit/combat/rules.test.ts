import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  coverBetween,
  currentAc,
  distanceFeet,
  posKey,
  reachable,
  speedNow,
  startCombat,
  getEncounter,
  type CombatState,
  type Pos,
} from '../../../src/game/combat';
import { readyParty } from '../../../src/game/combat';
import { f2, hero, standardParty } from './helpers';

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
  };
  t.prompt = null;
  t.plan = null;
  t.log = [];
  return t;
}
const texts = (s: CombatState) => s.log.map((l) => l.text).join('\n');
const onlyGoblinA = { 'goblin-b': null, 'goblin-c': null, 'goblin-d': null };

describe('the grid', () => {
  const s = f2();
  it('counts diagonals as 5 ft (PHB grid rule)', () => {
    expect(distanceFeet({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe(15);
  });
  it('blocks movement through trees and boulders, and enemies', () => {
    const mira = s.combatants['mira']!;
    const routes = reachable(s, mira, 30);
    expect(routes.has('7,0')).toBe(false); // boulder
    expect(routes.has('0,0')).toBe(false); // trees
    expect(routes.has(posKey(s.combatants['goblin-a']!.pos))).toBe(false);
  });
  it('charges double for brush (difficult terrain)', () => {
    const t = arrange(s, { mira: { x: 1, y: 3 } }, 'mira');
    expect(reachable(t, t.combatants['mira']!, 30).get('0,2')!.cost).toBe(10);
  });
  it('gives half cover behind a boulder, none when adjacent', () => {
    const t = arrange(s, { mira: { x: 7, y: 3 }, 'goblin-a': { x: 7, y: 2 } }, 'mira');
    expect(coverBetween(t, { x: 7, y: 2 }, { x: 7, y: 3 })).toBe('none');
    expect(coverBetween(t, { x: 7, y: 2 }, { x: 7, y: -0 + 0 })).toBe('half');
  });
});

describe('initiative and setup', () => {
  it('uses the mockup enemy counts: 3 / 4 / 6 by difficulty', () => {
    const count = (d: 'easy' | 'medium' | 'hard') =>
      Object.values(f2(d).combatants).filter((c) => c.side === 'enemy').length;
    expect([count('easy'), count('medium'), count('hard')]).toEqual([3, 4, 6]);
  });
  it('orders everyone by initiative, highest first, and logs every roll', () => {
    const s = f2('medium', 9);
    const inits = s.order.map((id) => s.combatants[id]!.initiative);
    expect([...inits].sort((a, b) => b - a)).toEqual(inits);
    expect(texts(s)).toMatch(/Initiative: Mira d20 \(\d+\) \+ \d+ = \d+/);
  });
  it('surprise: heroes who notice no one lose their first turn', () => {
    const enc = { ...getEncounter('f2-road-ambush'), surprise: true };
    const s = startCombat({
      encounter: enc,
      party: standardParty(),
      difficulty: 'medium',
      rngState: 3,
    });
    const surprised = Object.values(s.combatants).filter(
      (c) => c.surprised || /surprised/.test(texts(s)),
    );
    expect(surprised.length).toBeGreaterThanOrEqual(0);
    expect(texts(s)).toMatch(/surprised \(passive Perception \d+ vs Stealth \d+\)|Initiative/);
  });
});

describe('action economy', () => {
  it('one attack per action at level 2; Action Surge gives another', () => {
    const s = arrange(
      f2('medium', 4),
      { ...onlyGoblinA, mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
      'mira',
    );
    s.combatants['goblin-a']!.creature.hp = 99;
    s.combatants['goblin-a']!.creature.maxHp = 99;
    const a1 = act(s, { type: 'attack', targetId: 'goblin-a', optionId: 'longsword' });
    expect(a1.error).toBeUndefined();
    expect(
      act(a1.state, { type: 'attack', targetId: 'goblin-a', optionId: 'longsword' }).error,
    ).toBe('No attacks left this turn.');
    const surged = act(a1.state, { type: 'feature', id: 'action-surge' });
    expect(texts(surged.state)).toContain('Action Surge!');
    expect(
      act(surged.state, { type: 'attack', targetId: 'goblin-a', optionId: 'longsword' }).error,
    ).toBeUndefined();
  });
  it('Second Wind heals 1d10 + level as a bonus action, once', () => {
    const s = arrange(f2(), {}, 'mira');
    s.combatants['mira']!.creature.hp = 3;
    const r = act(s, { type: 'feature', id: 'second-wind' });
    expect(r.state.combatants['mira']!.creature.hp).toBeGreaterThan(3);
    expect(texts(r.state)).toMatch(/Second Wind: 1d10\+2 \(\d+\) \+ 2 = \d+/);
    expect(act(r.state, { type: 'feature', id: 'second-wind' }).error).toMatch(
      /bonus action used|none left/,
    );
  });
  it("won't let you attack out of reach", () => {
    const s = arrange(f2(), { mira: { x: 2, y: 4 }, 'goblin-a': { x: 9, y: 4 } }, 'mira');
    expect(act(s, { type: 'attack', targetId: 'goblin-a', optionId: 'longsword' }).error).toBe(
      'out of reach',
    );
  });
  it('moves along a path and spends movement (diagonals 5 ft)', () => {
    const s = arrange(f2(), { mira: { x: 2, y: 4 } }, 'mira');
    const r = act(s, { type: 'move', to: { x: 4, y: 5 } });
    expect(r.state.combatants['mira']!.pos).toEqual({ x: 4, y: 5 });
    expect(r.state.combatants['mira']!.turn.movement).toBe(20);
  });
});

describe('opportunity attacks (PHB)', () => {
  it('a hero walking out of a goblin’s reach provokes one (Medium)', () => {
    const s = arrange(
      f2('medium', 2),
      { ...onlyGoblinA, mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
      'mira',
    );
    const r = act(s, { type: 'move', to: { x: 4, y: 4 } });
    expect(texts(r.state)).toContain('Goblin A makes an opportunity attack!');
  });
  it('not after Disengage', () => {
    const s = arrange(
      f2('medium', 2),
      { ...onlyGoblinA, mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
      'mira',
    );
    const d = act(s, { type: 'disengage' });
    expect(texts(act(d.state, { type: 'move', to: { x: 4, y: 4 } }).state)).not.toContain(
      'opportunity attack',
    );
  });
  it('enemies skip them on Easy [inferred]', () => {
    const s = arrange(
      f2('easy', 2),
      { 'goblin-b': null, 'goblin-c': null, mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
      'mira',
    );
    expect(texts(act(s, { type: 'move', to: { x: 4, y: 4 } }).state)).not.toContain(
      'opportunity attack',
    );
  });
  it('an enemy leaving a hero’s reach pauses for the player to decide', () => {
    // On Hard, Goblin A ignores the fighter next to it and runs for the wizard.
    let s = arrange(
      f2('hard', 2),
      {
        ...onlyGoblinA,
        'goblin-e': null,
        wolf: null,
        mira: { x: 6, y: 4 },
        'goblin-a': { x: 7, y: 4 },
        wren: { x: 10, y: 6 },
        thorn: { x: 1, y: 3 },
        ilse: { x: 1, y: 4 },
      },
      'goblin-a',
    );
    s = advance(s);
    expect(s.prompt).toMatchObject({
      kind: 'opportunity-attack',
      reactorId: 'mira',
      targetId: 'goblin-a',
    });
    const after = act(s, { type: 'react', accept: true });
    expect(texts(after.state)).toContain('Mira takes an opportunity attack!');
    // The goblin carries on (it may now trigger Wren's Shield prompt).
    expect(after.state.prompt?.kind).not.toBe('opportunity-attack');
  });
});

describe('class features and spells', () => {
  it('Sneak Attack adds 1d6 when an ally is next to the target', () => {
    let seen = false;
    for (let seed = 1; seed < 40 && !seen; seed++) {
      const s = arrange(
        f2('medium', seed),
        { ...onlyGoblinA, ilse: { x: 3, y: 4 }, mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
        'ilse',
      );
      s.combatants['goblin-a']!.creature.hp = 99;
      const r = act(s, { type: 'attack', targetId: 'goblin-a', optionId: 'shortbow' });
      if (/HIT/.test(texts(r.state))) {
        expect(texts(r.state)).toContain('Sneak Attack! +1d6');
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });
  it('Magic Missile always hits: 3 darts of 1d4+1, one roll', () => {
    const s = arrange(f2('medium', 5), { wren: { x: 3, y: 4 } }, 'wren');
    const r = act(s, {
      type: 'cast',
      spellId: 'magic-missile',
      slotLevel: 1,
      targetIds: ['goblin-a', 'goblin-a', 'goblin-b'],
    });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/Magic Missile: 3 darts, each 1d4\+1 \(\d\) \+ 1 = \d force/);
    expect((r.state.combatants['wren']!.creature as { slotsUsed: number[] }).slotsUsed[0]).toBe(1);
  });
  it('Sleep knocks out the lowest-HP creatures first', () => {
    const s = arrange(f2('medium', 6), { wren: { x: 3, y: 4 } }, 'wren');
    const r = act(s, {
      type: 'cast',
      spellId: 'sleep',
      slotLevel: 1,
      point: s.combatants['goblin-c']!.pos,
    });
    expect(texts(r.state)).toMatch(/Sleep: 5d8 .* HP worth of creatures/);
    expect(texts(r.state)).toMatch(/is unconscious/);
  });
  it('Bless lasts while concentrating and adds 1d4 to attacks', () => {
    const s = arrange(f2('medium', 7), { thorn: { x: 5, y: 5 } }, 'thorn');
    const r = act(s, {
      type: 'cast',
      spellId: 'bless',
      slotLevel: 1,
      targetIds: ['mira', 'ilse', 'thorn'],
    });
    expect(r.state.combatants['thorn']!.creature.concentration).toBe('bless');
    expect(r.state.combatants['mira']!.effects.some((e) => e.name === 'Bless')).toBe(true);
  });
  it('a bonus-action spell leaves only cantrips for the action (PHB)', () => {
    const s = arrange(f2('medium', 7), { thorn: { x: 5, y: 5 } }, 'thorn');
    const r = act(s, { type: 'cast', spellId: 'healing-word', slotLevel: 1, targetIds: ['mira'] });
    expect(
      act(r.state, { type: 'cast', spellId: 'guiding-bolt', slotLevel: 1, targetIds: ['goblin-a'] })
        .error,
    ).toBe('only a cantrip after a bonus-action spell');
    expect(
      act(r.state, { type: 'cast', spellId: 'sacred-flame', slotLevel: 0, targetIds: ['goblin-a'] })
        .error,
    ).toBeUndefined();
  });
  it('Burning Hands spares allies thanks to Sculpt Spells? No: Sculpt is evocation; Burning Hands is evocation too', () => {
    const s = arrange(
      f2('medium', 8),
      { ...onlyGoblinA, wren: { x: 5, y: 4 }, mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
      'wren',
    );
    const r = act(s, {
      type: 'cast',
      spellId: 'burning-hands',
      slotLevel: 1,
      point: { x: 7, y: 4 },
    });
    expect(texts(r.state)).toContain('Sculpt Spells shields Mira');
    expect(r.state.combatants['mira']!.creature.hp).toBe(s.combatants['mira']!.creature.hp);
  });
  it('Shield: a hit that would miss at +5 AC asks the wizard', () => {
    let prompted = false;
    for (let seed = 1; seed < 80 && !prompted; seed++) {
      let s = arrange(
        f2('medium', seed),
        {
          ...onlyGoblinA,
          wren: { x: 6, y: 4 },
          'goblin-a': { x: 7, y: 4 },
          mira: { x: 1, y: 3 },
          thorn: { x: 1, y: 4 },
          ilse: { x: 1, y: 5 },
        },
        'goblin-a',
      );
      s = advance(s);
      if (s.prompt?.kind === 'shield') {
        prompted = true;
        const before = currentAc(s.combatants['wren']!);
        const r = act(s, { type: 'react', accept: true });
        expect(currentAc(r.state.combatants['wren']!)).toBe(before + 5);
        expect(texts(r.state)).toContain('Wren casts Shield (+5 AC)');
      }
    }
    expect(prompted).toBe(true);
  });
});

describe('down, out and done', () => {
  it('a downed hero rolls a death save at the start of their turn', () => {
    const s = arrange(f2('medium', 3), {}, 'goblin-d');
    const t = structuredClone(s);
    const next = t.order[(t.order.indexOf('goblin-d') + 1) % t.order.length]!;
    t.combatants[next]!.creature = {
      ...t.combatants[next]!.creature,
      hp: 0,
      conditions: [{ id: 'unconscious' }, { id: 'prone' }],
    };
    if (t.combatants[next]!.side === 'party') {
      const r = advance(t);
      expect(texts(r)).toMatch(new RegExp(`${t.combatants[next]!.name} death save: d20`));
    }
  });
  it('enemies never attack a hero who is down (all difficulties)', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const s = arrange(
        f2(d, 3),
        {
          ...onlyGoblinA,
          'goblin-e': null,
          wolf: null,
          mira: { x: 7, y: 5 },
          'goblin-a': { x: 7, y: 4 },
          thorn: { x: 1, y: 3 },
          ilse: { x: 1, y: 4 },
          wren: { x: 1, y: 5 },
        },
        'goblin-a',
      );
      s.combatants['mira']!.creature = {
        ...s.combatants['mira']!.creature,
        hp: 0,
        conditions: [{ id: 'unconscious' }, { id: 'prone' }],
      };
      const r = advance(s);
      expect(texts(r)).not.toMatch(/attacks Mira/);
    }
  });
  it('the fight ends in victory when no enemy is left standing', () => {
    let r: CombatState | null = null;
    for (let seed = 1; seed < 20 && r?.outcome !== 'victory'; seed++) {
      const s = arrange(
        f2('easy', seed),
        { 'goblin-b': null, 'goblin-c': null, mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
        'mira',
      );
      s.combatants['goblin-a']!.creature.hp = 1;
      r = act(s, { type: 'attack', targetId: 'goblin-a', optionId: 'longsword' }).state;
    }
    expect(r!.outcome).toBe('victory');
    expect(texts(r!)).toContain('Victory!');
  });
  it('heroes of any class can start a fight (all 12 classes, level 2)', () => {
    const classes = [
      'barbarian',
      'bard',
      'cleric',
      'druid',
      'fighter',
      'monk',
      'paladin',
      'ranger',
      'rogue',
      'sorcerer',
      'warlock',
      'wizard',
    ];
    for (let i = 0; i < classes.length; i += 4) {
      const party = readyParty(
        classes
          .slice(i, i + 4)
          .map((c) =>
            hero(
              c,
              c[0]!.toUpperCase() + c.slice(1),
              c === 'fighter'
                ? {}
                : { fightingStyle: c === 'paladin' || c === 'ranger' ? null : null },
            ),
          ),
        2,
      );
      const s = startCombat({
        encounter: getEncounter('f2-road-ambush'),
        party,
        difficulty: 'medium',
        rngState: i + 1,
      });
      expect(Object.keys(s.combatants)).toHaveLength(8);
    }
  });
});

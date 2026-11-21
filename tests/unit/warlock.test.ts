// Playtest round 5: Eldritch Blast beams and Hex on spell attacks; monster allies in the UI.
import { describe, expect, it } from 'vitest';
import { act } from '../../src/game/combat';
import { eldritchBeams, targeting } from '../../src/game/combat/spells';
import { spells } from '../../src/data';
import { arrange, easyTarget, fight, L, party, texts } from './combat/arrange';

const blast = spells.find((s) => s.id === 'eldritch-blast')!;

describe('Eldritch Blast (PHB)', () => {
  it('fires more beams at character levels 5, 11 and 17, each its own attack', () => {
    expect([1, 4, 5, 10, 11, 17].map(eldritchBeams)).toEqual([1, 1, 2, 2, 3, 4]);
    expect(targeting(blast, 0, undefined, 5)).toMatchObject({ count: 2, repeat: true });
    expect(targeting(blast, 0, undefined, 3)).toMatchObject({ count: 1 });
  });
  it('a level-5 warlock hits twice, and Hex adds 1d6 necrotic to each beam that hits', () => {
    const w = L('warlock', 'Hexa', 5);
    let s = arrange(
      fight('f3-warren-gate', party({ ...w, spells: [...w.spells, 'hex'] }, 5)),
      { hexa: { x: 4, y: 4 }, 'wolf-a': { x: 8, y: 4 } },
      'hexa',
    );
    easyTarget(s, 'wolf-a');
    s.combatants['wolf-a']!.creature = { ...s.combatants['wolf-a']!.creature, hp: 200, maxHp: 200 };
    s = act(s, { type: 'cast', spellId: 'hex', slotLevel: 3, targetIds: ['wolf-a'] }).state;
    const r = act(s, {
      type: 'cast',
      spellId: 'eldritch-blast',
      slotLevel: 0,
      targetIds: ['wolf-a', 'wolf-a'],
    });
    expect(r.error).toBeUndefined();
    const log = texts(r.state);
    expect(log.match(/Eldritch Blast: d20/g)?.length).toBe(2);
    expect(log.match(/HIT/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(log.match(/Hex: 1d6/g)?.length).toBe(log.match(/Eldritch Blast: d20.*HIT/g)?.length);
  });
});

describe('kind dice (owner request: spells land about 20% more often)', () => {
  const hits = (kind: boolean) => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const w = L('wizard', 'Wren', 1);
      const s = arrange(
        fight('f3-warren-gate', party(w, 1), seed, { flags: { kind_dice: kind } }),
        { wren: { x: 4, y: 4 }, 'wolf-a': { x: 8, y: 4 } },
        'wren',
      );
      const r = act(s, { type: 'cast', spellId: 'fire-bolt', slotLevel: 0, targetIds: ['wolf-a'] });
      if (/Fire Bolt: d20.*HIT/.test(texts(r.state))) n++;
      // Only one attack roll is ever logged.
      expect(texts(r.state).match(/Fire Bolt: d20/g)?.length).toBe(1);
    }
    return n;
  };
  it('a missed party spell is sometimes rerolled; the log shows one roll', () => {
    const plain = hits(false);
    const kind = hits(true);
    expect(kind / plain).toBeGreaterThan(1.1);
    expect(kind / plain).toBeLessThan(1.45);
  });
});

describe('item descriptions in scenes (owner request)', () => {
  it('a reward choice says which item it is, and receiving one shows what it does', async () => {
    const { Conversation } = await import('../../src/game/dialogue');
    const { readyParty } = await import('../../src/game/combat');
    const { hero } = await import('./combat/helpers');
    const { ScriptedRng } = await import('../../src/rules');
    const g = {
      id: 'g',
      createdAt: 'x',
      seed: 1,
      rngState: 1,
      party: readyParty([hero('cleric', 'Thorn')], 4),
      act: 2 as const,
      location: 'abbey',
      playSeconds: 0,
      flags: {},
      quests: {},
      notes: [],
      ink: {},
      clock: 8000,
      lastLongRest: null,
      letters: [],
      inventory: {},
      gold: 0,
    };
    const c = new Conversation('abbey', g, new ScriptedRng(Array(20).fill(10))).start(
      'arrive.abbot_reward',
    );
    expect(c.choices.map((x) => x.item)).toEqual(['mace-of-disruption', 'staff-of-healing']);
    c.choose(0);
    expect(c.lines.find((l) => l.item)).toMatchObject({
      item: 'mace-of-disruption',
      text: 'Received: Mace of Disruption',
    });
  });
});

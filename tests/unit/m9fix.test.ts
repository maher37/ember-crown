// Playtest fixes (2): moving Hex / Hunter's Mark, enemy details, formation, the long rest.
import { describe, expect, it } from 'vitest';
import { act, readyParty } from '../../src/game/combat';
import { formationOrder, withFormation } from '../../src/game/formation';
import type { GameState } from '../../src/game/save';
import { useGame } from '../../src/game/store';
import { foeInfo } from '../../src/ui/foeInfo';
import { arrange, fight, L, party, texts } from './combat/arrange';
import { hero } from './combat/helpers';

describe("Hex and Hunter's Mark move when the target drops (PHB)", () => {
  it('a bonus action moves Hex to a new creature, with no new slot', () => {
    const w = L('warlock', 'Hexa', 3);
    let s = arrange(
      fight('f3-warren-gate', party({ ...w, spells: [...w.spells, 'hex'] }, 3)),
      {},
      'hexa',
    );
    s = act(s, { type: 'cast', spellId: 'hex', slotLevel: 2, targetIds: ['goblin-a'] }).state;
    s.combatants['goblin-a']!.creature = {
      ...s.combatants['goblin-a']!.creature,
      hp: 0,
      dead: true,
    };
    s = arrange(s, {}, 'hexa');
    const slots = (s.combatants['hexa']!.creature as { slotsUsed: number[] }).slotsUsed.join();
    const r = act(s, { type: 'feature', id: 'move-mark', targetId: 'wolf-a' });
    expect(r.error).toBeUndefined();
    expect(r.state.combatants['wolf-a']!.effects.some((e) => e.tag === 'hex-target')).toBe(true);
    expect(r.state.combatants['hexa']!.turn.bonusUsed).toBe(true);
    expect((r.state.combatants['hexa']!.creature as { slotsUsed: number[] }).slotsUsed.join()).toBe(
      slots,
    );
    expect(texts(r.state)).toMatch(/moves the Hex to Wolf A/);
  });
  it('is not offered while the marked creature still stands', () => {
    const w = L('warlock', 'Hexa', 3);
    let s = arrange(
      fight('f3-warren-gate', party({ ...w, spells: [...w.spells, 'hex'] }, 3)),
      {},
      'hexa',
    );
    s = act(s, { type: 'cast', spellId: 'hex', slotLevel: 2, targetIds: ['goblin-a'] }).state;
    s = arrange(s, {}, 'hexa');
    expect(act(s, { type: 'feature', id: 'move-mark', targetId: 'wolf-a' }).error).toMatch(
      /don't have/,
    );
  });
});

describe('enemy details on hover', () => {
  it('shows type, defenses and what helps against it', () => {
    const c = L('cleric', 'Ada', 3);
    const s = fight('f7-sunken-shrine', party(c, 3));
    const info = foeInfo(s.combatants['skeleton-a']!, s.combatants['ada']!)!;
    expect(info.kind).toBe('Medium Undead');
    expect(info.defenses).toEqual(
      expect.arrayContaining(['Vulnerable to Bludgeoning', 'Immune to Poison']),
    );
    expect(info.edges.some((e) => /Turn Undead works on it/.test(e))).toBe(true);
    expect(info.edges.some((e) => /Mace: bludgeoning, double damage/.test(e))).toBe(true);
  });
  it('warns when weapons are nonmagical against a shadow', () => {
    const s = fight('s3-mill-shadows', party(L('fighter', 'Mira', 2), 2));
    const info = foeInfo(s.combatants['shadow-a']!, s.combatants['mira']!)!;
    expect(info.defenses).toContain('Resists nonmagical weapons');
    expect(info.edges.some((e) => /nonmagical: half damage/.test(e))).toBe(true);
  });
});

const game = (): GameState => ({
  id: 'g',
  createdAt: 'x',
  seed: 1,
  rngState: 1,
  party: readyParty(
    [
      hero('fighter', 'Mira'),
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('wizard', 'Wren'),
    ],
    2,
  ),
  act: 1,
  location: 'old-mine',
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
});

describe('the marching order is remembered', () => {
  it('keeps the saved order, adding any new hero at the back', () => {
    const g = game();
    const ids = g.party.map((h) => h.id);
    const moved = withFormation(g, [ids[2]!, ids[0]!]);
    expect(formationOrder(moved)).toEqual([ids[2], ids[0], ids[1], ids[3]]);
  });
});

describe('the long rest, hour by hour', () => {
  it('waking early passes the time but gives no benefit (PHB: 8 hours)', () => {
    const g = game();
    g.party[0] = { ...g.party[0]!, hp: 1 };
    useGame.setState({ game: g, campScene: 'inn', campLog: [], rngState: 3 });
    expect(useGame.getState().planLongRest()).toEqual({ interruptAt: null, encounterId: null });
    useGame.getState().wakeEarly(3);
    const after = useGame.getState().game!;
    expect(after.clock).toBe(g.clock + 3);
    expect(after.party[0]!.hp).toBe(1);
    expect(useGame.getState().campLog.at(-1)).toMatch(/no benefit/);
  });
  it('a night ambush strikes at an hour between 1 and 7', () => {
    const outcomes = new Set<number>();
    for (let seed = 1; seed < 400 && outcomes.size < 2; seed++) {
      useGame.setState({ game: game(), campScene: 'wild', campLog: [], rngState: seed });
      const p = useGame.getState().planLongRest()!;
      if (p.encounterId) {
        expect(p.interruptAt).toBeGreaterThanOrEqual(1);
        expect(p.interruptAt).toBeLessThanOrEqual(7);
        outcomes.add(p.interruptAt!);
      }
    }
    expect(outcomes.size).toBeGreaterThan(0);
  });
  it('the full 8 hours restore everything', () => {
    const g = game();
    g.party[0] = { ...g.party[0]!, hp: 1 };
    useGame.setState({ game: g, campScene: 'inn', campLog: [], rngState: 3 });
    useGame.getState().planLongRest();
    useGame.getState().completeLongRest();
    expect(useGame.getState().game!.party[0]!.hp).toBe(g.party[0]!.maxHp);
  });
});

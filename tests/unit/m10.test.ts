// M10: the balance simulator, the knocked-out-on-your-own-turn fix, the default marching order,
// and the comfort settings.
import { describe, expect, it } from 'vitest';
import { encounters } from '../../src/data';
import { act, readyParty } from '../../src/game/combat';
import { formationOrder } from '../../src/game/formation';
import type { GameState } from '../../src/game/save';
import { defaultSettings, prefersReducedMotion, useSettings } from '../../src/game/settings';
import { simParty } from '../../src/sim/party';
import { simulate, target } from '../../src/sim/simulate';
import { arrange, fight, L, party } from './combat/arrange';
import { hero } from './combat/helpers';

describe('the balance simulator', () => {
  it('every fight says what level it is built for', () => {
    for (const e of encounters) {
      expect(e.expectedLevel, e.id).toBeGreaterThanOrEqual(1);
      expect(e.expectedLevel, e.id).toBeLessThanOrEqual(6);
    }
  });
  it('builds its standard parties at a level', () => {
    const p = simParty('classic', 3);
    expect(p.map((h) => h.classId)).toEqual(['fighter', 'cleric', 'rogue', 'wizard']);
    expect(p.every((h) => h.level === 3)).toBe(true);
  });
  it('plays fights to the end and reports win rates (the road ambush is won at L2)', () => {
    const r = simulate('f2-road-ambush', { runs: 12 });
    expect(r.errors).toEqual([]);
    expect(r.stuck).toBe(0);
    expect(r.winRate).toBeGreaterThan(0.8);
    expect(r.avgRounds).toBeGreaterThan(0);
  });
  it('the casters cast: a wizard party member uses spells, not just a crossbow', () => {
    const r = simulate('f7-sunken-shrine', { runs: 4 });
    expect(r.errors).toEqual([]);
    expect(r.stuck).toBe(0);
  });
  it('targets: main fights 85–97%, Hard-designed fights 75–95%, elites 40–85%, travel 90%+', () => {
    expect(target('f2-road-ambush')).toEqual([0.85, 0.97]);
    expect(target('f7-sunken-shrine')).toEqual([0.75, 0.95]);
    expect(target('e1-scald')).toEqual([0.4, 0.85]);
    expect(target('road-wolves')).toEqual([0.9, 1]);
  });
});

describe('a hero knocked out on their own turn (bug found by the simulator)', () => {
  it('can always end the turn', () => {
    const s = arrange(fight('f2-road-ambush', party(L('fighter', 'Mira', 2), 2)), {}, 'mira');
    s.combatants['mira']!.creature = { ...s.combatants['mira']!.creature, hp: 0 };
    const r = act(s, { type: 'end-turn' });
    expect(r.error).toBeUndefined();
    expect(r.state.order[r.state.turnIndex]).not.toBe('mira');
  });
});

describe('the default marching order (playtest feedback)', () => {
  it('puts the toughest heroes first until the player sets an order', () => {
    const p = readyParty(
      [
        hero('wizard', 'Wren'),
        hero('rogue', 'Ilse'),
        hero('fighter', 'Mira'),
        hero('cleric', 'Thorn'),
      ],
      2,
    );
    const g = { party: p, flags: {} } as unknown as GameState;
    const order = formationOrder(g).map((id) => p.find((h) => h.id === id)!.classId);
    expect(order[0]).toBe('fighter');
    expect(order.at(-1)).toBe('wizard');
    const saved = { ...g, flags: { formation: [p[0]!.id].join(',') } } as GameState;
    expect(formationOrder(saved)[0]).toBe(p[0]!.id);
  });
});

describe('comfort settings', () => {
  it('reduce motion and reduce flashing start off and can be switched on', () => {
    expect(defaultSettings.reduceMotion).toBe(false);
    expect(defaultSettings.reduceFlashing).toBe(false);
    useSettings.getState().reset();
    expect(prefersReducedMotion()).toBe(false);
    useSettings.getState().toggle('reduceMotion');
    expect(prefersReducedMotion()).toBe(true);
    useSettings.getState().reset();
  });
});

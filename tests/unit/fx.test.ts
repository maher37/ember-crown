import { describe, expect, it } from 'vitest';
import { act, fxSince, type CombatState, type FxEvent } from '../../src/game/combat';
import { FX_KEEP, fx, weaponShot } from '../../src/game/combat/fx';
import { schedule } from '../../src/ui/combat/fxPlayer';
import { arrange } from './combat/arrange';
import { f2 } from './combat/helpers';

// M11 (docs/Animation_Plan.md): the engine resolves everything first, then records presentation
// events for the screen. These tests check the events match what the rules decided.
const onlyGoblinA = { 'goblin-b': null, 'goblin-c': null, 'goblin-d': null };
const events = (before: CombatState, after: CombatState): FxEvent[] =>
  fxSince(after, before.fxSeq ?? 0);

describe('presentation events', () => {
  it('a weapon attack records its shot before its damage, and whether it hit', () => {
    let sawHit = false;
    let sawMiss = false;
    for (let seed = 1; seed < 60 && !(sawHit && sawMiss); seed++) {
      const s = arrange(
        f2('medium', seed),
        { ...onlyGoblinA, ilse: { x: 3, y: 4 }, 'goblin-a': { x: 8, y: 4 } },
        'ilse',
      );
      s.combatants['goblin-a']!.creature.hp = 99;
      const r = act(s, { type: 'attack', targetId: 'goblin-a', optionId: 'shortbow' });
      const ev = events(s, r.state);
      const shot = ev.find((e) => e.type === 'shot');
      expect(shot).toMatchObject({ fromId: 'ilse', toId: 'goblin-a', style: 'arrow' });
      const hit = /HIT/.test(r.state.log.map((l) => l.text).join('\n'));
      expect(shot!.type === 'shot' && shot!.hit).toBe(hit);
      const dmg = ev.filter((e) => e.type === 'damage');
      if (hit) {
        sawHit = true;
        expect(ev.indexOf(dmg[0]!)).toBeGreaterThan(ev.indexOf(shot!));
        const taken = 99 - r.state.combatants['goblin-a']!.creature.hp;
        expect(dmg.reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0)).toBe(taken);
        expect(dmg[0]).toMatchObject({ targetId: 'goblin-a', damageType: 'piercing' });
      } else {
        sawMiss = true;
        expect(dmg).toHaveLength(0);
      }
    }
    expect(sawHit && sawMiss).toBe(true);
  });

  it("Magic Missile's darts fly as one volley (PHB: they strike simultaneously)", () => {
    const s = arrange(f2('medium', 5), { wren: { x: 3, y: 4 } }, 'wren');
    const r = act(s, {
      type: 'cast',
      spellId: 'magic-missile',
      slotLevel: 1,
      targetIds: ['goblin-a', 'goblin-a', 'goblin-b'],
    });
    const ev = events(s, r.state);
    expect(ev[0]).toMatchObject({ type: 'cast', casterId: 'wren', school: 'evocation' });
    const darts = ev.filter((e) => e.type === 'shot');
    expect(darts).toHaveLength(3);
    const volleys = new Set(darts.map((d) => (d.type === 'shot' ? d.volley : 0)));
    expect(volleys.size).toBe(1);
    expect(darts.every((d) => d.type === 'shot' && d.style === 'dart' && d.hit)).toBe(true);
    // They launch and land together on screen.
    const plan = schedule(darts, r.state, { speed: '1x', reduceMotion: false });
    expect(new Set(plan.map((p) => p.at)).size).toBe(1);
  });

  it('an area spell records its squares, its damage colour and each save', () => {
    const s = arrange(
      f2('medium', 8),
      { ...onlyGoblinA, wren: { x: 5, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
      'wren',
    );
    const r = act(s, {
      type: 'cast',
      spellId: 'burning-hands',
      slotLevel: 1,
      point: { x: 7, y: 4 },
    });
    const ev = events(s, r.state);
    const area = ev.find((e) => e.type === 'area');
    expect(area).toMatchObject({ shape: 'cone', damageType: 'fire', casterId: 'wren' });
    expect(area!.type === 'area' && area!.cells.some((c) => c.x === 7 && c.y === 4)).toBe(true);
    const save = ev.find((e) => e.type === 'save' && e.targetId === 'goblin-a');
    expect(save).toBeDefined();
    expect(ev.indexOf(save!)).toBeGreaterThan(ev.indexOf(area!));
  });

  it('healing records a heal event with the HP actually regained', () => {
    const s = arrange(f2('medium', 7), { thorn: { x: 5, y: 5 } }, 'thorn');
    s.combatants['mira']!.creature.hp = 1;
    const r = act(s, { type: 'cast', spellId: 'healing-word', slotLevel: 1, targetIds: ['mira'] });
    const heal = events(s, r.state).find((e) => e.type === 'heal');
    expect(heal).toMatchObject({ targetId: 'mira' });
    expect(heal!.type === 'heal' && heal!.amount).toBe(r.state.combatants['mira']!.creature.hp - 1);
  });

  it('keeps only the most recent events, numbered in order', () => {
    const s = f2();
    for (let i = 0; i < FX_KEEP + 10; i++) fx(s, { type: 'banner', text: `b${i}`, side: 'party' });
    expect(s.fx).toHaveLength(FX_KEEP);
    expect(s.fxSeq).toBe(FX_KEEP + 10);
    expect(fxSince(s, FX_KEEP + 8)).toHaveLength(2);
  });

  it('weapons pick a projectile look from their name', () => {
    expect(weaponShot('Light crossbow', 'ranged')).toBe('bolt');
    expect(weaponShot('Shortbow', 'ranged')).toBe('arrow');
    expect(weaponShot('Javelin', 'ranged')).toBe('thrown');
    expect(weaponShot('Longsword', 'melee')).toBe('melee');
  });
});

describe('the fx timeline (settings)', () => {
  const s = f2();
  const list: FxEvent[] = [
    { seq: 1, type: 'cast', casterId: 'wren', school: 'evocation', spellId: 'fire-bolt' },
    { seq: 2, type: 'shot', fromId: 'wren', toId: 'goblin-a', style: 'ray', hit: true },
    {
      seq: 3,
      type: 'damage',
      targetId: 'goblin-a',
      amount: 6,
      damageType: 'fire',
      critical: false,
    },
  ];
  it('the number appears when the shot lands', () => {
    const plan = schedule(list, s, { speed: '1x', reduceMotion: false });
    const shot = plan.find((p) => p.ev.type === 'shot')!;
    const dmg = plan.find((p) => p.ev.type === 'damage')!;
    expect(dmg.at).toBe(shot.at + shot.dur);
  });
  it('2× halves the waiting; instant and reduce motion skip what flies but keep the numbers', () => {
    const one = schedule(list, s, { speed: '1x', reduceMotion: false });
    const two = schedule(list, s, { speed: '2x', reduceMotion: false });
    expect(two.at(-1)!.at).toBeCloseTo(one.at(-1)!.at / 2);
    for (const opts of [
      { speed: 'instant' as const, reduceMotion: false },
      { speed: '1x' as const, reduceMotion: true },
    ]) {
      const plan = schedule(list, s, opts);
      expect(plan.map((p) => p.ev.type)).toEqual(['damage']);
      expect(plan[0]!.at).toBe(0);
    }
  });
});

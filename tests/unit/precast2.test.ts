// D34, finished: Protection from Evil and Good, Beacon of Hope and Pass without Trace work in a
// fight, and long spells (Aid, Mage Armor, Armor of Agathys, False Life) last into the next one.
import { describe, expect, it } from 'vitest';
import { finishCombat } from '../../src/game/combat';
import { combatSave } from '../../src/game/combat/core';
import { giveCondition } from '../../src/game/combat/leaves';
import { stealthBonus } from '../../src/game/combat/turn';
import { healDice, protectedFrom } from '../../src/game/combat/wards';
import type { Hero } from '../../src/game/hero';
import type { Precast } from '../../src/game/precast';
import { ScriptedRng, SeededRng } from '../../src/rules';
import { fight, L, party, texts } from './combat/arrange';

const knows = (h: Hero, ids: string[]): Hero => ({ ...h, spells: [...h.spells, ...ids] });
const cast = (casterId: string, spellId: string, slotLevel: number, targetIds: string[] = []) =>
  ({ casterId, spellId, slotLevel, targetIds }) as Precast;

describe('PHB: Protection from Evil and Good', () => {
  const s = fight(
    'f10-marrowmere',
    party(knows(L('cleric', 'Ada', 5), ['protection-from-evil-and-good']), 5),
    1,
    { precasts: [cast('ada', 'protection-from-evil-and-good', 1, ['thorn'])] },
  );
  const thorn = s.combatants['thorn']!;
  const zombie = Object.values(s.combatants).find((c) => c.monsterId === 'zombie')!;

  it('wards the target against undead (and not other heroes)', () => {
    expect(protectedFrom(thorn, zombie)).toBe(true);
    expect(protectedFrom(s.combatants['ada']!, zombie)).toBe(false);
    expect((s.combatants['ada']!.creature as Hero).concentration).toBe(
      'protection-from-evil-and-good',
    );
  });

  it('a warded type can’t frighten the target', () => {
    const ctx = { s: structuredClone(s), rng: new SeededRng(1) };
    giveCondition(
      ctx,
      ctx.s.combatants[zombie.id]!,
      ctx.s.combatants['thorn']!,
      'frightened',
      undefined,
    );
    expect(ctx.s.combatants['thorn']!.creature.conditions.some((c) => c.id === 'frightened')).toBe(
      false,
    );
    expect(texts(ctx.s)).toMatch(/can't be frightened/);
  });
});

describe('PHB: Beacon of Hope', () => {
  const s = fight('f13-cloister', party(knows(L('cleric', 'Ada', 5), ['beacon-of-hope']), 5), 1, {
    precasts: [cast('ada', 'beacon-of-hope', 3)],
  });

  it('reaches the allies within 30 ft with no aiming, under concentration', () => {
    const near = Object.values(s.combatants).filter((c) => c.side === 'party');
    expect(near.every((c) => c.effects.some((e) => e.tag === 'beacon'))).toBe(true);
    expect((s.combatants['ada']!.creature as Hero).slotsUsed[2]).toBe(1);
  });

  it('advantage on Wisdom saves, and healing gives its maximum', () => {
    const ctx = { s: structuredClone(s), rng: new ScriptedRng([3, 18]) };
    const r = combatSave(ctx, ctx.s.combatants['thorn']!, 'wis', 15);
    expect(r.log.text).toMatch(/Beacon of Hope/);
    expect(healDice(s.combatants['thorn']!, '2d4+2', new ScriptedRng([1, 1])).total).toBe(10);
  });
});

describe('PHB: Pass without Trace', () => {
  it('+10 Stealth for allies within 30 ft of the caster', () => {
    const ranger = knows(L('ranger', 'Ada', 5), ['pass-without-trace']);
    const s = fight('f13-cloister', party(ranger, 5), 1, {
      precasts: [cast('ada', 'pass-without-trace', 2)],
    });
    const ilse = s.combatants['ilse']!;
    expect(stealthBonus(ilse, s)).toBe(stealthBonus(ilse) + 10);
  });
});

describe('long spells last into the next fight (D34)', () => {
  const wizard = () => knows(L('wizard', 'Ada', 5), ['mage-armor', 'false-life']);
  const p = () => party(wizard(), 5);

  it('Mage Armor and False Life carry over within their time, without a new slot', () => {
    let s = fight('f13-cloister', p(), 1, {
      clock: 100,
      precasts: [cast('ada', 'mage-armor', 1, ['ada']), cast('ada', 'false-life', 1)],
    });
    const temp = s.combatants['ada']!.creature.tempHp;
    expect(temp).toBeGreaterThan(0);
    s = { ...s, outcome: 'victory' };
    const after = finishCombat(s, p()).party.find((h) => h.id === 'ada')!;
    expect(after.buffs?.map((b) => b.spell).sort()).toEqual(['false-life', 'mage-armor']);
    expect(after.buffs!.find((b) => b.spell === 'mage-armor')!.until).toBe(108);
    expect(after.buffs!.find((b) => b.spell === 'false-life')!.until).toBe(101);

    // Half an hour later: both are back. Nothing new is spent.
    const next = fight('f10-marrowmere', party(after, 5), 2, { clock: 100.5 });
    const ada = next.combatants['ada']!;
    expect(ada.effects.some((e) => e.tag === 'mage-armor')).toBe(true);
    expect(ada.creature.tempHp).toBe(temp);
    expect((ada.creature as Hero).slotsUsed).toEqual(after.slotsUsed);
    expect(texts(next)).toMatch(/Still in effect from earlier: Ada's Mage Armor, Ada's False Life/);

    // Two hours later False Life has run out; Mage Armor (8 hours) hasn't.
    const later = fight('f10-marrowmere', party(after, 5), 2, { clock: 102 }).combatants['ada']!;
    expect(later.effects.some((e) => e.tag === 'mage-armor')).toBe(true);
    expect(later.creature.tempHp).toBe(0);
  });

  it('Aid: the extra maximum HP comes back, and only the part not lost to wounds', () => {
    const cleric = knows(L('cleric', 'Ada', 5), ['aid']);
    let s = fight('f13-cloister', party(cleric, 5), 1, {
      clock: 50,
      precasts: [cast('ada', 'aid', 2, ['ada'])],
    });
    const base = cleric.maxHp;
    expect(s.combatants['ada']!.creature.maxHp).toBe(base + 5);
    // Ada ends the fight 2 HP below her raised maximum: 3 of Aid's 5 are still "on top".
    s = structuredClone(s);
    s.combatants['ada']!.creature.hp = base + 3;
    s.outcome = 'victory';
    const after = finishCombat(s, party(cleric, 5)).party.find((h) => h.id === 'ada')!;
    expect(after.maxHp).toBe(base);
    expect(after.hp).toBe(base);
    expect(after.buffs).toEqual([{ spell: 'aid', until: 58, amount: 5, hpAbove: 3 }]);
    const ada = fight('f10-marrowmere', party(after, 5), 2, { clock: 51 }).combatants['ada']!;
    expect(ada.creature.maxHp).toBe(base + 5);
    expect(ada.creature.hp).toBe(base + 3);
  });
});

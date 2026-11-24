// Wix's Clan Gift (DMG: Bag of Tricks, gray). D36: the beast fights for the party.
import { describe, expect, it } from 'vitest';
import { act, checkOutcome, finishCombat } from '../../src/game/combat';
import { BAG_TABLE, bagUsesLeft } from '../../src/game/combat/bag';
import type { Hero } from '../../src/game/hero';
import { takeLongRest } from '../../src/game/rest';
import type { GameState } from '../../src/game/save';
import { SeededRng } from '../../src/rules';
import { arrange, fight, L, party, texts } from './combat/arrange';

const carrier = (): Hero => {
  const h = L('fighter', 'Mira', 3);
  return { ...h, equipment: { ...h.equipment, magic: [...h.equipment.magic, 'wixs-clan-gift'] } };
};
const F = (lead: Hero, seed = 1) => fight('f13-cloister', party(lead, 3), seed);
const pull = (lead = carrier(), seed = 1) =>
  act(arrange(F(lead, seed), {}, 'mira'), { type: 'bag' }).state;

describe("Wix's Clan Gift", () => {
  it('an action pulls out a random beast (d8 on the DMG table) that fights for the party', () => {
    const s = pull();
    const beast = Object.values(s.combatants).find((c) => c.pet?.kind === 'bag')!;
    expect(beast.side).toBe('party');
    expect(BAG_TABLE).toContain(beast.monsterId);
    expect(s.combatants['mira']!.turn.actionUsed).toBe(true);
    expect(texts(s)).toMatch(/Wix's Clan Gift: d8 \(\d\) → /);
    // It acts right after the hero who used the bag.
    expect(s.order.indexOf(beast.id)).toBe(s.order.indexOf('mira') + 1);
  });

  it('every d8 result gives a beast', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 60; seed++)
      seen.add(
        Object.values(pull(carrier(), seed).combatants).find((c) => c.pet?.kind === 'bag')!
          .monsterId!,
      );
    expect([...seen].sort()).toEqual([...BAG_TABLE].sort());
  });

  it("can't be used without carrying it", () => {
    const r = act(arrange(F(L('fighter', 'Mira', 3)), {}, 'mira'), { type: 'bag' });
    expect(r.error).toMatch(/not carrying the bag/);
  });

  it('three uses, back after a long rest (DMG: Bag of Tricks)', () => {
    const s = pull();
    const used = s.combatants['mira']!.creature as Hero;
    expect(bagUsesLeft(used)).toBe(2);
    s.outcome = 'victory';
    const after = finishCombat(s, party(carrier(), 3)).party[0]!;
    expect(bagUsesLeft(after)).toBe(2);
    const empty = { ...after, resourcesUsed: { ...after.resourcesUsed, 'wixs-clan-gift': 3 } };
    const r = act(arrange(F(empty), {}, 'mira'), { type: 'bag' });
    expect(r.error).toMatch(/empty until a long rest/);
    const g = { party: [empty], flags: {}, clock: 100, lastLongRest: null } as unknown as GameState;
    expect(bagUsesLeft(takeLongRest(g, new SeededRng(1)).game.party[0]!)).toBe(3);
  });

  it('a beast alone does not keep a lost fight going', () => {
    const s = pull();
    for (const c of Object.values(s.combatants))
      if (c.side === 'party' && !c.pet) c.creature = { ...c.creature, hp: 0 };
    expect(checkOutcome(s)).toBe('defeat');
  });
});

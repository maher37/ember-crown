// Plain treasure found as loot: gold rings, necklaces and the like, sold for gold (owner, Nov 22).
import { describe, expect, it } from 'vitest';
import { finds, places, treasure } from '../../src/data';
import { lookupItem } from '../../src/game/gear';
import { sellAt, sellPriceAt } from '../../src/game/shops';
import type { GameState } from '../../src/game/save';

const actOf = (placeId: string) => places.find((p) => p.id === placeId)!.act;

describe('treasure', () => {
  it('is a catalog item worth its full value', () => {
    const t = lookupItem('gold-ring')!;
    expect(t.type).toBe('treasure');
    expect(t.costGp).toBe(treasure.find((x) => x.id === 'gold-ring')!.valueGp);
  });

  it('PHB: Selling Treasure. Jewelry sells for its full value, to a keeper who buys it', () => {
    expect(sellPriceAt('curios', 'pearl-necklace')).toBe(100);
    expect(sellPriceAt('wagon', 'pearl-necklace')).toBe(100);
    // The smith and the innkeeper don't deal in jewelry [inferred].
    expect(sellPriceAt('smithy', 'pearl-necklace')).toBeNull();
    expect(sellPriceAt('brannoc', 'pearl-necklace')).toBeNull();
  });

  it('selling a gold ring adds its value to the purse', () => {
    const g = { gold: 5, inventory: { 'gold-ring': 1 } } as unknown as GameState;
    const r = sellAt(g, 'curios', 'gold-ring');
    expect(r.error).toBeUndefined();
    expect(r.game.gold).toBe(30);
    expect(r.game.inventory['gold-ring']).toBe(0);
  });

  it('every treasure is hidden in a find, and each act has some', () => {
    const found = finds.flatMap((f) =>
      (f.loot.items ?? []).map((i) => ({ id: i.id, act: actOf(f.place) })),
    );
    for (const t of treasure) expect(found.map((x) => x.id)).toContain(t.id);
    for (const act of [1, 2, 3])
      expect(found.some((x) => x.act === act && treasure.some((t) => t.id === x.id))).toBe(true);
  });
});

// Hidden magic finds (D27, owner Nov 22): one ring, one cloak and one necklace to find in each act.
import { describe, expect, it } from 'vitest';
import { finds, places } from '../../src/data';
import { getItem, equip, hasSpecial } from '../../src/game/items';
import { slotKindOf } from '../../src/game/loadout';
import { spellNumbers } from '../../src/game/hero';
import { fight, L, party } from './combat/arrange';

const actOf = (placeId: string) => places.find((p) => p.id === placeId)!.act;

describe('magic rings, cloaks and necklaces in the hidden finds', () => {
  it('each act hides at least one ring, one cloak and one necklace', () => {
    for (const act of [1, 2, 3]) {
      const kinds = finds
        .filter((f) => actOf(f.place) === act)
        .flatMap((f) => f.loot.items ?? [])
        .map((i) => slotKindOf(i.id));
      expect(kinds, `act ${act}`).toEqual(expect.arrayContaining(['ring', 'cloak', 'neck']));
    }
  });

  it('a worn ring grants its resistance in a fight (DMG: Ring of Warmth, Ring of Resistance)', () => {
    const h = equip(
      equip(L('fighter', 'Ada', 4), 'ring-of-warmth').hero,
      'ring-of-fire-resistance',
    ).hero;
    const s = fight('f13-cloister', party(h, 4));
    const types = s.combatants['ada']!.effects.filter((e) => e.tag === 'resistance').map(
      (e) => e.data?.type,
    );
    expect(types).toEqual(expect.arrayContaining(['cold', 'fire']));
  });

  it('the Brooch of Shielding is worn at the neck and grants force resistance', () => {
    expect(slotKindOf('brooch-of-shielding')).toBe('neck');
    const s = fight(
      'f13-cloister',
      party(equip(L('wizard', 'Ada', 4), 'brooch-of-shielding').hero, 4),
    );
    expect(
      s.combatants['ada']!.effects.some((e) => e.tag === 'resistance' && e.data?.type === 'force'),
    ).toBe(true);
  });

  it('the Amulet of the Devout adds 1 to spell attacks and spell save DCs (TCE)', () => {
    const h = L('cleric', 'Ada', 4);
    const before = spellNumbers(h)!;
    const after = spellNumbers(equip(h, 'amulet-of-the-devout').hero)!;
    expect(after.attack).toBe(before.attack + 1);
    expect(after.dc).toBe(before.dc + 1);
  });

  it('the cloaks go in the cloak slot and carry their effects', () => {
    expect(slotKindOf('cloak-of-elvenkind')).toBe('cloak');
    expect(slotKindOf('kiln-wardens-mantle')).toBe('cloak');
    const rogue = equip(L('rogue', 'Ada', 3), 'cloak-of-elvenkind').hero;
    expect(hasSpecial(rogue, 'stealth-advantage-quiet')).toBe(true);
    const mantle = equip(L('fighter', 'Ada', 5), 'kiln-wardens-mantle').hero;
    expect(hasSpecial(mantle, 'initiative-advantage')).toBe(true);
    expect(hasSpecial(mantle, 'perception-advantage')).toBe(true);
    expect(getItem('kiln-wardens-mantle').homebrew).toBe(true);
  });
});

// PHB: Armor of Agathys (+5 temporary HP and +5 cold per slot level) and False Life
// (+5 temporary HP per slot level above 1st) cast with a higher slot.
import { describe, expect, it } from 'vitest';
import { act } from '../../src/game/combat';
import type { Hero } from '../../src/game/hero';
import { arrange, fight, L, party } from './combat/arrange';

const knows = (h: Hero, ids: string[]): Hero => ({ ...h, spells: [...h.spells, ...ids] });

describe('temporary HP spells cast with a higher slot (PHB)', () => {
  it('Armor of Agathys with a 2nd-level slot: 10 temporary HP and 10 cold', () => {
    const lead = knows(L('warlock', 'Ada', 3), ['armor-of-agathys']);
    let s = arrange(fight('f13-cloister', party(lead, 3)), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'armor-of-agathys', slotLevel: 2 }).state;
    const ada = s.combatants['ada']!;
    expect(ada.creature.tempHp).toBe(10);
    expect(ada.effects.find((e) => e.tag === 'agathys')?.data?.cold).toBe(10);
  });
  it('Armor of Agathys with a 1st-level slot: still 5 and 5', () => {
    const lead = knows(L('wizard', 'Ada', 3), ['armor-of-agathys']);
    let s = arrange(fight('f13-cloister', party(lead, 3)), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'armor-of-agathys', slotLevel: 1 }).state;
    expect(s.combatants['ada']!.creature.tempHp).toBe(5);
  });
  it('False Life with a 2nd-level slot: 1d4 + 9', () => {
    const lead = knows(L('wizard', 'Ada', 3), ['false-life']);
    let s = arrange(fight('f13-cloister', party(lead, 3)), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'false-life', slotLevel: 2 }).state;
    const t = s.combatants['ada']!.creature.tempHp;
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThanOrEqual(13);
  });
});

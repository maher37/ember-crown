// PHB: Invisibility. The spell ends for a target that attacks or casts a spell.
import { describe, expect, it } from 'vitest';
import { act } from '../../src/game/combat';
import { arrange, fight, L, party, texts } from './combat/arrange';

const ada = () => {
  const h = L('wizard', 'Ada', 3);
  return { ...h, spells: [...h.spells, 'invisibility'] };
};
const invisible = (s: ReturnType<typeof fight>, id: string) =>
  s.combatants[id]!.creature.conditions.some((c) => c.id === 'invisible');

describe('Invisibility ends on attacking or casting (PHB)', () => {
  it('ends when the invisible hero attacks, and the caster stops concentrating', () => {
    let s = arrange(fight('f13-cloister', party(ada(), 3)), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'invisibility', slotLevel: 2, targetIds: ['ada'] }).state;
    expect(invisible(s, 'ada')).toBe(true);
    s = arrange(s, { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } }, 'ada');
    const opt = 'dagger';
    s = act(s, { type: 'attack', targetId: 'cultist-a', optionId: opt }).state;
    expect(texts(s)).toMatch(/Ada attacks Cultist A .*d20 adv/);
    expect(invisible(s, 'ada')).toBe(false);
    expect(s.combatants['ada']!.creature.concentration).toBeNull();
  });
  it('ends when the invisible hero casts a spell', () => {
    let s = arrange(fight('f13-cloister', party(ada(), 3)), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'invisibility', slotLevel: 2, targetIds: ['ada'] }).state;
    s = arrange(s, { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } }, 'ada');
    s = act(s, {
      type: 'cast',
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: ['cultist-a'],
    }).state;
    expect(invisible(s, 'ada')).toBe(false);
    expect(texts(s)).toMatch(/visible again/);
  });
  it('does not end for an ally when the caster does something else', () => {
    let s = arrange(fight('f13-cloister', party(ada(), 3)), {}, 'ada');
    s = act(s, { type: 'cast', spellId: 'invisibility', slotLevel: 2, targetIds: ['thorn'] }).state;
    expect(invisible(s, 'thorn')).toBe(true);
    expect(s.combatants['ada']!.creature.concentration).toBe('invisibility');
  });
});

import { describe, expect, it } from 'vitest';
import { changeExhaustion } from '../../../src/rules';
import { makeCreature } from './helpers';

// PHB Appendix A: Exhaustion.
describe('exhaustion', () => {
  it('stacks one level at a time', () => {
    expect(changeExhaustion(makeCreature({ exhaustion: 1 }), 1).creature.exhaustion).toBe(2);
  });

  it('level 4 halves the HP maximum and current HP drops to fit', () => {
    const { creature } = changeExhaustion(makeCreature({ hp: 9, maxHp: 10, exhaustion: 3 }), 1);
    expect(creature.hp).toBe(5);
    expect(creature.maxHp).toBe(10);
  });

  it('level 6 is death', () => {
    const { creature, log } = changeExhaustion(makeCreature({ exhaustion: 5 }), 1);
    expect(creature.dead).toBe(true);
    expect(log.at(-1)!.text).toBe('Hero dies of exhaustion');
  });

  it('cannot go below 0', () => {
    expect(changeExhaustion(makeCreature(), -1).creature.exhaustion).toBe(0);
  });
});

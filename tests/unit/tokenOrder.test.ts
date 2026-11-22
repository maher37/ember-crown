import { describe, expect, it } from 'vitest';
import { tokenDrawOrder } from '../../src/ui/combatUi';

const c = (id: string, hp: number, dead = false) => ({ id, creature: { hp, dead } });

describe('combat board drawing order (playtest Nov 22)', () => {
  it('draws bodies and downed creatures under the living, so a monster on a body can be clicked', () => {
    const order = tokenDrawOrder([
      c('goblin-alive', 7),
      c('goblin-body', 0, true),
      c('hero-down', 0),
    ]);
    expect(order.map((x) => x.id)).toEqual(['goblin-body', 'hero-down', 'goblin-alive']);
  });

  it('keeps the original order within each group', () => {
    const order = tokenDrawOrder([c('a', 5), c('b', 3), c('x', 0, true), c('c', 1)]);
    expect(order.map((x) => x.id)).toEqual(['x', 'a', 'b', 'c']);
  });
});

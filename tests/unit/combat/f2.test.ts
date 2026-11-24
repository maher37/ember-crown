import { describe, expect, it } from 'vitest';
import { finishCombat } from '../../../src/game/combat';
import { f2, playOut, standardParty } from './helpers';

describe('F2 Road ambush, played start to finish by a simple bot', () => {
  // 100 whole fights per difficulty take ~3 s locally and can pass 5 s on a slow CI machine.
  it.each(['easy', 'medium', 'hard'] as const)(
    'always ends on %s (100 seeds)',
    { timeout: 20_000 },
    (difficulty) => {
      let wins = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const end = playOut(f2(difficulty, seed));
        expect(
          end.outcome,
          `seed ${seed}: ${end.log
            .slice(-5)
            .map((l) => l.text)
            .join(' | ')}`,
        ).not.toBeNull();
        if (end.outcome === 'victory') wins++;
      }
      console.log(`${difficulty}: ${wins}/100 victories`);
      expect(wins).toBeGreaterThan(difficulty === 'hard' ? 30 : 60);
    },
  );

  it('is exactly reproducible from its seed', () => {
    expect(playOut(f2('medium', 42)).log).toEqual(playOut(f2('medium', 42)).log);
  });

  it('awards 50 XP each after a win, the same on every difficulty', () => {
    for (const d of ['easy', 'hard'] as const) {
      let seed = 1;
      let end = playOut(f2(d, seed));
      while (end.outcome !== 'victory') end = playOut(f2(d, ++seed));
      const r = finishCombat(end, standardParty());
      expect(r.xpEach).toBe(50);
      for (const h of r.party.filter((x) => !x.dead)) expect(h.xp).toBe(350);
    }
  });
});

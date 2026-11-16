import { describe, expect, it } from 'vitest';
import { getEncounter, readyParty, startCombat } from '../../../src/game/combat';
import { hero, playOut } from './helpers';

// Every Act I fight (Encounters_and_XP §4, §5, §5c), played to the end by the simple bot.
const FIGHTS: [string, number][] = [
  ['f1-tavern-brawl', 1],
  ['f3-warren-gate', 2],
  ['f4-grisk', 2],
  ['f5-mine-mouth', 2],
  ['f6-deep-seam', 2],
  ['f7-sunken-shrine', 3],
  ['s1-cellar-rats', 2],
  ['s2-ashwood-wolves', 2],
  ['s3-mill-shadows', 2],
  ['s4-luck-stone', 2],
  ['e1-scald', 3],
];
const party = (lvl: number) =>
  readyParty(
    [
      hero('fighter', 'Mira'),
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('wizard', 'Wren'),
    ],
    lvl,
  );

describe('Act I fights', () => {
  for (const [id, lvl] of FIGHTS)
    it(`${id} always finishes, reproducibly from its seed`, () => {
      for (const d of ['easy', 'medium', 'hard'] as const)
        for (const seed of [1, 2]) {
          const run = () =>
            playOut(
              startCombat({
                encounter: getEncounter(id),
                party: party(lvl),
                difficulty: d,
                rngState: seed * 7919,
              }),
            );
          const a = run();
          expect(a.outcome, `${id} ${d} ${seed}`).not.toBeNull();
          expect(run().log).toEqual(a.log);
        }
    });

  it('the brawl never kills anyone (nonlethal)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = playOut(
        startCombat({
          encounter: getEncounter('f1-tavern-brawl'),
          party: party(1),
          difficulty: 'hard',
          rngState: seed,
        }),
      );
      expect(Object.values(s.combatants).some((c) => c.creature.dead)).toBe(false);
    }
  });
});

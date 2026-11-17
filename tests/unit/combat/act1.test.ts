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
  // Act II (M8)
  ['f8-toll-bridge', 3],
  ['f9-lizardfolk', 3],
  ['f10-marrowmere', 3],
  ['f11-chapel', 3],
  ['f12-betrayal', 4],
  ['f12-betrayal-small', 4],
  ['f13-cloister', 4],
  ['f14-undercroft', 4],
  ['s5-sallow', 4],
  ['s6-deserters', 4],
  ['s7-paladin-crypt', 4],
  ['s8-edric-ambush', 4],
  ['e2-drowned-abbot', 5],
  // Act III (M9)
  ['f15-ashfall-pass', 4],
  ['f16-kiln-gate', 4],
  ['f16-kiln-gate-kell', 4],
  ['f17-furnace-halls', 4],
  ['f18-honor-guard', 5],
  ['f19-ember-galleries', 5],
  ['f20-last-stand', 5],
  ['f20-last-stand-half', 5],
  ['f21-crowning-maelis', 5],
  ['f21-crowning-wraith', 6],
  ['f21-ember-queen', 6],
  ['s9-cold-forge', 5],
  ['s10-ossuary', 5],
  ['s11-convoy', 5],
  ['s12-wix-giant', 5],
  ['e3-vorrag', 6],
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

describe('every story fight (Acts I–III)', () => {
  for (const [id, lvl] of FIGHTS)
    it(`${id} always finishes, reproducibly from its seed`, () => {
      for (const d of ['easy', 'medium', 'hard'] as const)
        for (const seed of [1]) {
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

import { describe, expect, it } from 'vitest';
import { noDefenses, SeededRng, type Creature } from '../../../src/rules';
import { runDuel, type Fighter } from './duel';

// Two test fighters with SRD-style numbers: a level 1 fighter (chain mail, longsword) and an orc.
const sellsword = (): Fighter => ({
  creature: {
    id: 'sellsword',
    name: 'Sellsword',
    kind: 'pc',
    level: 1,
    xp: 0,
    proficiencyBonus: 2,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
    saveProficiencies: ['str', 'con'],
    ac: 16,
    maxHp: 12,
    hp: 12,
    tempHp: 0,
    hitDice: { die: 10, total: 1, remaining: 1 },
    conditions: [],
    exhaustion: 0,
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
    dead: false,
    defenses: noDefenses(),
    concentration: null,
  } satisfies Creature,
  weapon: { name: 'longsword', attackBonus: 5, damage: { dice: '1d8+3', type: 'slashing' } },
});

const orc = (): Fighter => ({
  creature: {
    ...sellsword().creature,
    id: 'orc',
    name: 'Orc',
    kind: 'monster',
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    saveProficiencies: [],
    ac: 13,
    maxHp: 15,
    hp: 15,
    hitDice: { die: 8, total: 2, remaining: 2 },
  },
  weapon: { name: 'greataxe', attackBonus: 5, damage: { dice: '1d12+3', type: 'slashing' } },
});

describe('scripted duel', () => {
  it('prints a readable combat log (seed 73)', () => {
    const log = runDuel(sellsword(), orc(), new SeededRng(73));
    console.log(`\n${log.join('\n')}\n`);
    expect(log.join('\n')).toMatchSnapshot();
  });

  it('is exactly reproducible from its seed', () => {
    expect(runDuel(sellsword(), orc(), new SeededRng(7))).toEqual(
      runDuel(sellsword(), orc(), new SeededRng(7)),
    );
  });

  it('every attack line shows its roll, total and target AC', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const log = runDuel(sellsword(), orc(), new SeededRng(seed));
      for (const line of log.filter((l) => l.includes(' attacks '))) {
        expect(line).toMatch(
          /: d20( adv| dis)? \(\d+(, \d+)?\) [+-] \d+ = -?\d+ vs AC \d+ → (CRITICAL HIT|HIT|MISS)/,
        );
      }
      expect(log.at(-1)).toMatch(/wins the duel|draw/);
    }
  });
});
